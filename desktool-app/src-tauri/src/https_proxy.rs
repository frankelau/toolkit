use std::sync::Arc;
use std::collections::HashMap;
use std::sync::Mutex;
use rcgen::{CertificateParams, DistinguishedName, DnType, KeyPair, PKCS_ECDSA_P256_SHA256, IsCa, BasicConstraints};
use rustls::ServerConfig;
use tokio::io::{AsyncReadExt, AsyncWriteExt};
use tokio::net::TcpStream;
use tauri::Manager;

/// CA 证书管理器：生成根证书 + 动态签发域名证书
pub struct CaManager {
    ca_cert: rcgen::Certificate,
    ca_key: KeyPair,
    cache: Mutex<HashMap<String, Arc<ServerConfig>>>,
}

impl CaManager {
    pub fn new() -> Result<Self, String> {
        let ca_key = KeyPair::generate_for(&PKCS_ECDSA_P256_SHA256).map_err(|e| e.to_string())?;

        let mut params = CertificateParams::new(vec![]).map_err(|e| e.to_string())?;
        params.distinguished_name = DistinguishedName::new();
        params.distinguished_name.push(DnType::CommonName, "DeskTool Proxy CA");
        params.distinguished_name.push(DnType::OrganizationName, "DeskTool");
        params.is_ca = IsCa::Ca(BasicConstraints::Unconstrained);
        params.not_before = time::OffsetDateTime::now_utc();
        params.not_after = time::OffsetDateTime::now_utc() + time::Duration::days(3650);

        let ca_cert = params.self_signed(&ca_key).map_err(|e| e.to_string())?;

        Ok(CaManager { ca_cert, ca_key, cache: Mutex::new(HashMap::new()) })
    }

    pub fn ca_cert_pem(&self) -> String {
        self.ca_cert.pem()
    }

    pub fn get_server_config(&self, domain: &str) -> Result<Arc<ServerConfig>, String> {
        {
            let cache = self.cache.lock().map_err(|e| e.to_string())?;
            if let Some(cfg) = cache.get(domain) {
                return Ok(Arc::clone(cfg));
            }
        }

        let server_key = KeyPair::generate_for(&PKCS_ECDSA_P256_SHA256).map_err(|e| e.to_string())?;

        let mut params = CertificateParams::new(vec![domain.to_string()]).map_err(|e| e.to_string())?;
        params.distinguished_name = DistinguishedName::new();
        params.distinguished_name.push(DnType::CommonName, domain);
        params.not_before = time::OffsetDateTime::now_utc();
        params.not_after = time::OffsetDateTime::now_utc() + time::Duration::days(365);

        let server_cert = params.signed_by(&server_key, &self.ca_cert, &self.ca_key).map_err(|e| e.to_string())?;

        let cert_pem = server_cert.pem();
        let key_pem = server_key.serialize_pem();

        let certs: Vec<rustls::pki_types::CertificateDer> = rustls_pemfile::certs(&mut cert_pem.as_bytes())
            .filter_map(|c| c.ok())
            .map(|c| rustls::pki_types::CertificateDer::from(c.to_vec()))
            .collect();

        let key_der = rustls_pemfile::pkcs8_private_keys(&mut key_pem.as_bytes())
            .filter_map(|k| k.ok())
            .next()
            .ok_or("Failed to parse server key")?;

        let key = rustls::pki_types::PrivateKeyDer::Pkcs8(rustls::pki_types::PrivatePkcs8KeyDer::from(key_der.secret_pkcs8_der().to_vec()));

        let config = ServerConfig::builder()
            .with_no_client_auth()
            .with_single_cert(certs, key)
            .map_err(|e| e.to_string())?;

        let config = Arc::new(config);

        {
            let mut cache = self.cache.lock().map_err(|e| e.to_string())?;
            cache.insert(domain.to_string(), Arc::clone(&config));
        }

        Ok(config)
    }
}

pub fn get_or_create_ca() -> Result<Arc<CaManager>, String> {
    let ca = CaManager::new()?;
    Ok(Arc::new(ca))
}

/// 纯隧道透传（不做 MITM，不解密 HTTPS）
/// 适用于未启用 HTTPS 解密的场景：HTTPS 正常访问，但看不到内容
/// DNS Spoofing 仍可生效（通过 override_ip 改连接目标）
pub async fn handle_connect_passthrough(
    browser_stream: TcpStream,
    host: &str,
    port: u16,
    override_ip: Option<&str>,
) -> Result<(), String> {
    let mut browser = browser_stream;
    // 1. 回复 200 Connection Established
    browser.write_all(b"HTTP/1.1 200 Connection Established\r\n\r\n").await
        .map_err(|e| e.to_string())?;

    // 2. 连接到上游（DNS Spoofing 时连 override_ip，否则正常解析 host）
    let connect_host = override_ip.unwrap_or(host);
    let upstream_addr = format!("{}:{}", connect_host, port);
    let mut upstream = TcpStream::connect(&upstream_addr).await
        .map_err(|e| format!("Connect to upstream {} failed: {}", upstream_addr, e))?;

    // 3. 纯 TCP 双向透传（不解密）
    let (mut br_rx, mut br_tx) = tokio::io::split(browser);
    let (mut up_rx, mut up_tx) = tokio::io::split(&mut upstream);

    let br_to_up = async {
        let mut buf = vec![0u8; 65536];
        loop {
            match br_rx.read(&mut buf).await {
                Ok(0) => break,
                Ok(n) => {
                    if up_tx.write_all(&buf[..n]).await.is_err() { break; }
                    let _ = up_tx.flush().await;
                }
                Err(_) => break,
            }
        }
    };

    let up_to_br = async {
        let mut buf = vec![0u8; 65536];
        loop {
            match up_rx.read(&mut buf).await {
                Ok(0) => break,
                Ok(n) => {
                    if br_tx.write_all(&buf[..n]).await.is_err() { break; }
                    let _ = br_tx.flush().await;
                }
                Err(_) => break,
            }
        }
    };

    tokio::join!(br_to_up, up_to_br);
    Ok(())
}

pub async fn handle_connect(
    browser_stream: TcpStream,
    host: &str,
    connect_host: &str,
    port: u16,
    ca: Arc<CaManager>,
    override_ip: Option<&str>,
    map_remote_target: Option<&str>,
) -> Result<(), String> {
    let mut browser = browser_stream;
    // 1. 回复 200 Connection Established
    browser.write_all(b"HTTP/1.1 200 Connection Established\r\n\r\n").await
        .map_err(|e| e.to_string())?;

    // 2. 获取域名证书（始终用原 host 签发，浏览器看到的证书域名必须匹配）
    let server_config = ca.get_server_config(host)?;

    // 3. TLS 握手（与浏览器）
    let tls_acceptor = tokio_rustls::TlsAcceptor::from(server_config);
    let tls_browser = tls_acceptor.accept(browser).await
        .map_err(|e| format!("TLS handshake with browser failed: {}", e))?;

    // 4. 连接到上游服务器
    //    - DNS Spoofing: override_ip 非 None → 连 IP，SNI 用原 host
    //    - Map Remote: connect_host 是目标 host → 连目标，SNI 用目标 host
    //    - 正常: connect_host == host → 正常解析
    let tcp_target = override_ip.unwrap_or(connect_host);
    let upstream_addr = format!("{}:{}", tcp_target, port);
    let upstream_tcp = TcpStream::connect(&upstream_addr).await
        .map_err(|e| format!("Connect to upstream {} failed: {}", upstream_addr, e))?;

    let upstream_tls_config = Arc::new(
        rustls::ClientConfig::builder()
            .dangerous()
            .with_custom_certificate_verifier(Arc::new(NoVerifyVerifier))
            .with_no_client_auth()
    );

    // SNI：Map Remote 时用目标 host，DNS Spoofing 时用原 host
    let sni_host = if map_remote_target.is_some() { connect_host } else { host };
    let server_name = rustls::pki_types::ServerName::try_from(sni_host.to_string())
        .map_err(|e| format!("Invalid server name: {}", e))?;

    let tls_connector = tokio_rustls::TlsConnector::from(upstream_tls_config);
    let upstream = tls_connector.connect(server_name, upstream_tcp).await
        .map_err(|e| format!("TLS to upstream failed: {}", e))?;

    // 5. 双向管道转发
    let (mut br_rx, mut br_tx) = tokio::io::split(tls_browser);
    let (mut up_rx, mut up_tx) = tokio::io::split(upstream);

    // Map Remote 时，浏览器→上游方向需要把 Host 头从原 host 改成目标 host
    let orig_host = host.to_string();
    let target_host = map_remote_target.map(|h| h.to_string());

    let br_to_up = async {
        let mut buf = vec![0u8; 65536];
        // 如果有 Map Remote，需要缓冲并替换 Host 头
        if let Some(ref target) = target_host {
            let mut acc: Vec<u8> = Vec::new();
            let mut header_end: Option<usize> = None;
            loop {
                match br_rx.read(&mut buf).await {
                    Ok(0) => break,
                    Ok(n) => {
                        if header_end.is_none() {
                            acc.extend_from_slice(&buf[..n]);
                            // 搜索 \r\n\r\n（HTTP headers 结束标记）
                            if let Some(idx) = find_header_end(&acc) {
                                header_end = Some(idx);
                                // 替换 Host 头
                                let modified = replace_host_in_headers(&acc[..idx + 4], &orig_host, target);
                                if up_tx.write_all(&modified).await.is_err() { break; }
                                // 写入 headers 之后的 body 数据
                                if acc.len() > idx + 4 {
                                    if up_tx.write_all(&acc[idx + 4..]).await.is_err() { break; }
                                }
                                let _ = up_tx.flush().await;
                            }
                            // headers 不完整，继续读
                        } else {
                            // headers 已处理，直接透传剩余数据
                            if up_tx.write_all(&buf[..n]).await.is_err() { break; }
                            let _ = up_tx.flush().await;
                        }
                    }
                    Err(_) => break,
                }
            }
        } else {
            // 无 Map Remote，直接透传
            loop {
                match br_rx.read(&mut buf).await {
                    Ok(0) => break,
                    Ok(n) => {
                        if up_tx.write_all(&buf[..n]).await.is_err() { break; }
                        let _ = up_tx.flush().await;
                    }
                    Err(_) => break,
                }
            }
        }
    };

    let up_to_br = async {
        let mut buf = vec![0u8; 65536];
        loop {
            match up_rx.read(&mut buf).await {
                Ok(0) => break,
                Ok(n) => {
                    if br_tx.write_all(&buf[..n]).await.is_err() { break; }
                    // 必须 flush：TLS 写入后数据可能留在加密缓冲区，
                    // 不 flush 会导致浏览器收不到流式数据（SSE/chunked）
                    let _ = br_tx.flush().await;
                }
                Err(_) => break,
            }
        }
    };

    tokio::join!(br_to_up, up_to_br);
    Ok(())
}

/// 在字节数组中搜索 \r\n\r\n，返回其起始位置
fn find_header_end(data: &[u8]) -> Option<usize> {
    if data.len() < 4 { return None; }
    for i in 0..=data.len() - 4 {
        if &data[i..i + 4] == b"\r\n\r\n" {
            return Some(i);
        }
    }
    None
}

/// 在 HTTP 请求头中替换 Host 头的值
/// headers_data 包含到 \r\n\r\n 为止的完整请求头
fn replace_host_in_headers(headers_data: &[u8], orig_host: &str, target_host: &str) -> Vec<u8> {
    let text = String::from_utf8_lossy(headers_data);
    // 替换 "Host: orig_host" → "Host: target_host"（大小写不敏感）
    // HTTP 头名大小写不敏感，但通常浏览器发送的是 "Host:"
    let mut result = text.into_owned();
    // 尝试几种大小写组合
    for prefix in &["Host:", "host:", "HOST:"] {
        let pattern = format!("{} {}\r\n", prefix, orig_host);
        let replacement = format!("{} {}\r\n", prefix, target_host);
        result = result.replace(&pattern, &replacement);
        // 也处理 Host:orig_host（无空格）
        let pattern2 = format!("{}{}\r\n", prefix, orig_host);
        let replacement2 = format!("{} {}\r\n", prefix, target_host);
        result = result.replace(&pattern2, &replacement2);
    }
    eprintln!("[proxy] HTTPS MapRemote Host rewrite: {} -> {}", orig_host, target_host);
    result.into_bytes()
}

#[derive(Debug)]
struct NoVerifyVerifier;

impl rustls::client::danger::ServerCertVerifier for NoVerifyVerifier {
    fn verify_server_cert(
        &self,
        _end_entity: &rustls::pki_types::CertificateDer,
        _intermediates: &[rustls::pki_types::CertificateDer],
        _server_name: &rustls::pki_types::ServerName,
        _ocsp_response: &[u8],
        _now: rustls::pki_types::UnixTime,
    ) -> Result<rustls::client::danger::ServerCertVerified, rustls::Error> {
        Ok(rustls::client::danger::ServerCertVerified::assertion())
    }

    fn verify_tls12_signature(
        &self,
        _message: &[u8],
        _cert: &rustls::pki_types::CertificateDer,
        _dss: &rustls::DigitallySignedStruct,
    ) -> Result<rustls::client::danger::HandshakeSignatureValid, rustls::Error> {
        Ok(rustls::client::danger::HandshakeSignatureValid::assertion())
    }

    fn verify_tls13_signature(
        &self,
        _message: &[u8],
        _cert: &rustls::pki_types::CertificateDer,
        _dss: &rustls::DigitallySignedStruct,
    ) -> Result<rustls::client::danger::HandshakeSignatureValid, rustls::Error> {
        Ok(rustls::client::danger::HandshakeSignatureValid::assertion())
    }

    fn supported_verify_schemes(&self) -> Vec<rustls::SignatureScheme> {
        vec![
            rustls::SignatureScheme::ECDSA_NISTP256_SHA256,
            rustls::SignatureScheme::ECDSA_NISTP384_SHA384,
            rustls::SignatureScheme::RSA_PSS_SHA256,
            rustls::SignatureScheme::RSA_PSS_SHA384,
            rustls::SignatureScheme::RSA_PSS_SHA512,
            rustls::SignatureScheme::ED25519,
        ]
    }
}
