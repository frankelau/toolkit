/**
 * HTTP 正向代理服务器
 *
 * 功能：
 *   - 监听指定端口，作为 HTTP/1.1 正向代理
 *   - 规则：域名映射 / 路径重写 / 参数注入 / Map Local / Block List / Rewrite
 *   - No Caching 禁缓存
 *   - Breakpoint 断点（请求/响应暂停修改）
 *   - 用 reqwest 转发改写后的请求，把响应原样返回给客户端
 *   - 通过 Tauri 事件把流量摘要推送给前端
 */
use futures_util::StreamExt;
use reqwest::header::{HeaderMap, HeaderName, HeaderValue};
use serde::{Deserialize, Serialize};
use std::collections::HashMap;
use std::str::FromStr;
use std::sync::{Arc, Mutex};
use tauri::{AppHandle, Emitter};
use tokio::io::{AsyncBufReadExt, AsyncWriteExt, BufReader};
use tokio::net::{TcpListener, TcpStream};
use tokio::sync::oneshot;
use tokio::task::JoinHandle;

// ── 规则类型 ──────────────────────────────────────────────────────────────────

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(tag = "type")]
pub enum ProxyRule {
    /// DNS Spoofing：域名强制解析到指定 IP（保留 Host 头，替代 hosts）
    DnsSpoof {
        host: String,
        ip: String,
    },
    /// Map Remote：把匹配的域名/路径转发到另一个网络地址（Host 头会变）
    MapRemote {
        #[serde(rename = "matchHost")]
        match_host: String,
        #[serde(rename = "matchPath")]
        match_path: String,
        /// 目标地址，如 https://test.example.com 或 http://192.168.1.100:8080
        #[serde(rename = "targetUrl")]
        target_url: String,
    },
    PathRewrite {
        #[serde(rename = "matchHost")]
        match_host: String,
        #[serde(rename = "matchPrefix")]
        match_prefix: String,
        replacement: String,
    },
    ParamInject {
        #[serde(rename = "matchHost")]
        match_host: String,
        #[serde(rename = "matchPath")]
        match_path: String,
        params: Vec<ParamKV>,
    },
    MapLocal {
        #[serde(rename = "matchHost")]
        match_host: String,
        #[serde(rename = "matchPath")]
        match_path: String,
        /// 本地文件路径
        #[serde(rename = "filePath")]
        file_path: String,
        /// 返回的 HTTP 状态码
        status: u16,
        /// Content-Type（空则自动推断）
        #[serde(rename = "contentType")]
        content_type: String,
    },
    BlockList {
        #[serde(rename = "matchHost")]
        match_host: String,
        #[serde(rename = "matchPath")]
        match_path: String,
        /// 返回的状态码，如 404、403
        status: u16,
    },
    Rewrite {
        #[serde(rename = "matchHost")]
        match_host: String,
        #[serde(rename = "matchPath")]
        match_path: String,
        /// 改写目标：req_body / res_body / res_status
        target: String,
        /// 正则表达式
        pattern: String,
        /// 替换文本
        replacement: String,
    },
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ParamKV {
    pub key: String,
    pub value: String,
}

// ── 断点 ──────────────────────────────────────────────────────────────────────

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct BreakpointRule {
    #[serde(rename = "matchHost")]
    pub match_host: String,
    #[serde(rename = "matchPath")]
    pub match_path: String,
    /// "request" 或 "response"
    pub phase: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct BreakpointHit {
    pub id: String,
    pub phase: String,
    pub method: String,
    pub url: String,
    pub headers: Vec<(String, String)>,
    pub body: String,
    pub status: Option<u16>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct BreakpointResume {
    /// "resume" | "abort"
    pub action: String,
    pub method: Option<String>,
    pub url: Option<String>,
    pub headers: Option<Vec<(String, String)>>,
    pub body: Option<String>,
    pub status: Option<u16>,
}

/// 断点注册表：存储待恢复的 oneshot sender。
/// 内部用 Arc<Mutex> 以便 clone 给 proxy task。
#[derive(Default, Clone)]
pub struct BreakpointRegistry {
    pub pending: Arc<Mutex<HashMap<String, oneshot::Sender<BreakpointResume>>>>,
}

// ── 代理配置 ──────────────────────────────────────────────────────────────────

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ProxyConfig {
    pub rules: Vec<ProxyRule>,
    #[serde(rename = "noCaching")]
    pub no_caching: bool,
    pub breakpoints: Vec<BreakpointRule>,
    #[serde(default)]
    pub throttle: ThrottleConfig,
    /// 是否解密 HTTPS（MITM）。关闭时 HTTPS 纯隧道透传，只有 DNS Spoofing 生效。
    #[serde(rename = "httpsDecrypt", default)]
    pub https_decrypt: bool,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ThrottleConfig {
    pub enabled: bool,
    pub bandwidth: u64,  // KB/s
    pub latency: u64,    // ms
}

impl Default for ThrottleConfig {
    fn default() -> Self {
        ThrottleConfig { enabled: false, bandwidth: 100, latency: 200 }
    }
}

impl Default for ProxyConfig {
    fn default() -> Self {
        ProxyConfig {
            rules: vec![],
            no_caching: false,
            breakpoints: vec![],
            throttle: ThrottleConfig::default(),
            https_decrypt: false,
        }
    }
}

// ── 代理状态 ──────────────────────────────────────────────────────────────────

#[derive(Debug, Clone, Serialize)]
pub struct ProxyStatus {
    pub running: bool,
    pub port: u16,
}

#[derive(Debug, Clone, Serialize)]
pub struct TrafficEntry {
    pub id: String,
    pub method: String,
    pub url: String,
    pub original_url: String,
    pub peer_addr: String,
    pub status: Option<u16>,
    pub duration: Option<u64>,
    pub error: Option<String>,
    pub timestamp: u64,
    pub rule_matched: bool,
    pub req_headers: Vec<(String, String)>,
    pub req_body_preview: String,
    pub res_headers: Vec<(String, String)>,
    pub res_body_preview: String,
    pub res_body_size: u64,
}

pub struct ProxyState {
    pub handle: Option<JoinHandle<()>>,
    pub port: u16,
    pub rules: Vec<ProxyRule>,
}

impl ProxyState {
    pub fn new() -> Self {
        ProxyState { handle: None, port: 8080, rules: vec![] }
    }
    pub fn is_running(&self) -> bool {
        self.handle.as_ref().map(|h| !h.is_finished()).unwrap_or(false)
    }
}

// ── URL 匹配工具 ──────────────────────────────────────────────────────────────

fn url_matches(url: &str, match_host: &str, match_path: &str) -> bool {
    let Ok(parsed) = url::Url::parse(url) else { return false; };
    let host_ok = match_host.is_empty() || parsed.host_str() == Some(match_host);
    let path_ok = match_path.is_empty() || parsed.path().starts_with(match_path);
    host_ok && path_ok
}

/// 根据 URL 后缀推断 Content-Type
fn guess_content_type(path: &str) -> &str {
    let ext = path.rsplit('.').next().unwrap_or("").to_lowercase();
    match ext.as_str() {
        "json" => "application/json",
        "html" | "htm" => "text/html",
        "xml" => "application/xml",
        "txt" => "text/plain",
        "js" => "application/javascript",
        "css" => "text/css",
        "png" => "image/png",
        "jpg" | "jpeg" => "image/jpeg",
        "gif" => "image/gif",
        "svg" => "image/svg+xml",
        "csv" => "text/csv",
        _ => "application/octet-stream",
    }
}

// ── 规则应用：URL 改写 ────────────────────────────────────────────────────────

/// DNS Spoofing 查找：返回匹配 host 的 (override_ip, override_port)
/// ip 字段可填 "192.168.1.1" 或 "192.168.1.1:8080"
fn find_dns_spoof(rules: &[ProxyRule], host: &str) -> Option<(String, Option<u16>)> {
    let spoof_rules: Vec<_> = rules.iter().filter_map(|r| {
        if let ProxyRule::DnsSpoof { host: h, ip } = r { Some((h, ip)) } else { None }
    }).collect();
    if spoof_rules.is_empty() {
        return None;
    }
    for (h, ip) in &spoof_rules {
        let matched = h.to_lowercase() == host.to_lowercase();
        eprintln!("[dns-spoof] 请求host={} 规则host={} -> {}", host, h, if matched { format!("命中 ip={}", ip) } else { "不匹配".to_string() });
        if matched {
            // 解析 ip:port 格式
            if let Some((ip_part, port_part)) = ip.rsplit_once(':') {
                if let Ok(port) = port_part.parse::<u16>() {
                    return Some((ip_part.to_string(), Some(port)));
                }
            }
            return Some((ip.to_string(), None));
        }
    }
    None
}

/// Map Remote 查找：返回改写后的 URL（若有匹配）
fn apply_map_remote(url: &str, rules: &[ProxyRule]) -> Option<(String, String)> {
    let parsed = url::Url::parse(url).ok()?;
    let host = parsed.host_str()?.to_string();
    let path = parsed.path();

    for rule in rules {
        if let ProxyRule::MapRemote { match_host, match_path, target_url } = rule {
            let host_ok = host.to_lowercase() == match_host.to_lowercase();
            let path_ok = match_path.is_empty() || match_path == "/" || path.starts_with(match_path.as_str());
            eprintln!("[map-remote] host={} path={} | rule matchHost={} matchPath={} targetUrl={} | host_ok={} path_ok={}",
                host, path, match_host, match_path, target_url, host_ok, path_ok);
            if !host_ok || !path_ok { continue; }

            // 若 targetUrl 没有 scheme（如直接填域名），自动补 http://
            let normalized_target = if target_url.contains("://") {
                target_url.clone()
            } else {
                format!("http://{}", target_url)
            };
            if let Ok(mut target) = url::Url::parse(&normalized_target) {
                let base_path = target.path().trim_end_matches('/').to_string();
                let remaining = if match_path.is_empty() || match_path == "/" {
                    path.to_string()
                } else {
                    path[match_path.len()..].to_string()
                };
                let remaining = if remaining.is_empty() {
                    String::new()
                } else if remaining.starts_with('/') {
                    remaining
                } else {
                    format!("/{}", remaining)
                };
                let new_path = if remaining.is_empty() {
                    if base_path.is_empty() { "/".to_string() } else { base_path }
                } else {
                    format!("{}{}", base_path, remaining)
                };
                target.set_path(&new_path);
                if let Some(q) = parsed.query() {
                    target.set_query(Some(q));
                }
                eprintln!("[map-remote] HIT: {} -> {}", url, target);
                return Some((target.to_string(), host));
            }
        }
    }
    eprintln!("[map-remote] NO MATCH url={}", url);
    None
}

fn apply_url_rules(url: &str, rules: &[ProxyRule]) -> (String, bool) {
    if rules.is_empty() {
        return (url.to_string(), false);
    }

    // 先尝试 Map Remote（整 URL 替换）
    if let Some((new_url, _orig_host)) = apply_map_remote(url, rules) {
        return (new_url, true);
    }

    let Ok(mut parsed) = url::Url::parse(url) else {
        return (url.to_string(), false);
    };

    let mut matched = false;

    for rule in rules {
        match rule {
            ProxyRule::PathRewrite { match_host, match_prefix, replacement } => {
                if parsed.host_str() == Some(match_host.as_str()) {
                    let path = parsed.path().to_string();
                    if path.starts_with(match_prefix.as_str()) {
                        let new_path = format!("{}{}", replacement, &path[match_prefix.len()..]);
                        parsed.set_path(&new_path);
                        matched = true;
                    }
                }
            }
            ProxyRule::ParamInject { match_host, match_path, params } => {
                if parsed.host_str() == Some(match_host.as_str())
                    && parsed.path().starts_with(match_path.as_str())
                {
                    let mut pairs: Vec<(String, String)> = parsed
                        .query_pairs()
                        .map(|(k, v)| (k.into_owned(), v.into_owned()))
                        .collect();
                    for p in params {
                        if !p.key.is_empty() {
                            let pos = pairs.iter().position(|(k, _)| k == &p.key);
                            if let Some(i) = pos {
                                pairs[i] = (p.key.clone(), p.value.clone());
                            } else {
                                pairs.push((p.key.clone(), p.value.clone()));
                            }
                        }
                    }
                    let qs: String = pairs
                        .iter()
                        .map(|(k, v)| format!("{}={}", urlencoding::encode(k), urlencoding::encode(v)))
                        .collect::<Vec<_>>()
                        .join("&");
                    parsed.set_query(if qs.is_empty() { None } else { Some(&qs) });
                    matched = true;
                }
            }
            _ => {} // DnsSpoof/MapRemote/MapLocal/BlockList/Rewrite 不在通用 URL 改写阶段处理
        }
    }

    (parsed.to_string(), matched)
}

// ── Rewrite 改写 ──────────────────────────────────────────────────────────────

/// 对文本做正则替换，返回改写后的文本
fn apply_rewrite_text(text: &str, pattern: &str, replacement: &str) -> String {
    if pattern.is_empty() { return text.to_string(); }
    match regex::Regex::new(pattern) {
        Ok(re) => re.replace_all(text, replacement).into_owned(),
        Err(_) => text.to_string(),
    }
}

/// 判断是否有针对当前 URL 的响应体/状态码 Rewrite 规则（影响是否缓冲完整响应）
/// 只有 pattern 非空的规则才需要缓冲（pattern 为空时 apply_rewrite_text 直接返回原文）
fn needs_response_buffer_for_url(rules: &[ProxyRule], url: &str) -> bool {
    rules.iter().any(|r| {
        if let ProxyRule::Rewrite { match_host, match_path, target, pattern, .. } = r {
            if pattern.is_empty() { return false; }
            (target == "res_body" || target == "res_status") && url_matches(url, match_host, match_path)
        } else {
            false
        }
    })
}

// ── HTTP/1.1 请求解析 ─────────────────────────────────────────────────────────

#[derive(Debug)]
struct HttpRequest {
    method: String,
    target: String,
    headers: Vec<(String, String)>,
    body: Vec<u8>,
}

async fn read_request(stream: &mut BufReader<TcpStream>) -> Option<HttpRequest> {
    let mut first_line = String::new();
    stream.read_line(&mut first_line).await.ok()?;
    let parts: Vec<&str> = first_line.trim().splitn(3, ' ').collect();
    if parts.len() < 3 {
        return None;
    }
    let method = parts[0].to_string();
    let target = parts[1].to_string();

    let mut headers: Vec<(String, String)> = Vec::new();
    let mut content_length: usize = 0;
    loop {
        let mut line = String::new();
        stream.read_line(&mut line).await.ok()?;
        let line = line.trim_end_matches(['\r', '\n']);
        if line.is_empty() { break; }
        if let Some(idx) = line.find(':') {
            let key = line[..idx].trim().to_lowercase();
            let val = line[idx + 1..].trim().to_string();
            if key == "content-length" {
                content_length = val.parse().unwrap_or(0);
            }
            headers.push((key, val));
        }
    }

    let mut body = vec![0u8; content_length];
    if content_length > 0 {
        use tokio::io::AsyncReadExt;
        stream.read_exact(&mut body).await.ok()?;
    }

    Some(HttpRequest { method, target, headers, body })
}

// ── 逐跳头 ────────────────────────────────────────────────────────────────────

fn is_hop_by_hop(name: &str) -> bool {
    matches!(
        name,
        "connection" | "keep-alive" | "proxy-authenticate" | "proxy-authorization"
            | "te" | "trailers" | "transfer-encoding" | "upgrade"
            | "proxy-connection"
    )
}

/// 判断是否为缓存相关头（No Caching 模式下需要去掉）
fn is_cache_header(name: &str) -> bool {
    matches!(name, "cache-control" | "etag" | "last-modified" | "expires" | "age" | "pragma")
}

// ── 发送简单响应给客户端 ──────────────────────────────────────────────────────

async fn send_simple_response(
    tcp: &mut tokio::net::TcpStream,
    status_code: u16,
    body: &[u8],
    content_type: &str,
    no_caching: bool,
) {
    let reason = match status_code {
        200 => "OK", 403 => "Forbidden", 404 => "Not Found",
        _ => "OK",
    };
    let mut hdr = format!("HTTP/1.1 {} {}\r\n", status_code, reason);
    hdr.push_str(&format!("Content-Type: {}\r\n", content_type));
    hdr.push_str(&format!("Content-Length: {}\r\n", body.len()));
    if no_caching {
        hdr.push_str("Cache-Control: no-store, no-cache, must-revalidate\r\n");
    }
    hdr.push_str("Connection: close\r\n\r\n");
    let _ = tcp.write_all(hdr.as_bytes()).await;
    let _ = tcp.write_all(body).await;
}

// ── 发送流量事件 ──────────────────────────────────────────────────────────────

#[allow(clippy::too_many_arguments)]
fn emit_traffic(
    app: &AppHandle,
    entry_id: String, method: String, url: String, original_url: String,
    peer_addr: String, status: Option<u16>, duration: Option<u64>,
    error: Option<String>, timestamp: u64, rule_matched: bool,
    req_headers: Vec<(String, String)>, req_body_preview: String,
    res_headers: Vec<(String, String)>, res_body_preview: String,
    res_body_size: u64,
) {
    let entry = TrafficEntry {
        id: entry_id, method, url, original_url, peer_addr,
        status, duration, error, timestamp, rule_matched,
        req_headers, req_body_preview,
        res_headers, res_body_preview, res_body_size,
    };
    let _ = app.emit("proxy-traffic", entry);
}

// ── 断点处理 ──────────────────────────────────────────────────────────────────

/// 请求/响应断点：emit 事件后等待前端 resume
async fn breakpoint_wait(
    app: &AppHandle,
    bp_registry: &BreakpointRegistry,
    id: &str,
    phase: &str,
    method: &str,
    url: &str,
    headers: &[(String, String)],
    body: &str,
    status: Option<u16>,
) -> Option<BreakpointResume> {
    let (tx, rx) = oneshot::channel();
    {
        let mut pending = bp_registry.pending.lock().unwrap();
        pending.insert(id.to_string(), tx);
    }
    let hit = BreakpointHit {
        id: id.to_string(),
        phase: phase.to_string(),
        method: method.to_string(),
        url: url.to_string(),
        headers: headers.to_vec(),
        body: body.to_string(),
        status,
    };
    let _ = app.emit("proxy-breakpoint", hit);
    match rx.await {
        Ok(resume) => Some(resume),
        Err(_) => None,
    }
}

// ── 单连接处理 ────────────────────────────────────────────────────────────────

async fn handle_connection(
    stream: TcpStream,
    peer_addr: String,
    config: Arc<ProxyConfig>,
    client: Arc<reqwest::Client>,
    app: AppHandle,
    bp_registry: BreakpointRegistry,
) {
    let mut buf = BufReader::new(stream);
    let Some(req) = read_request(&mut buf).await else { return; };

    if req.method.to_uppercase() == "CONNECT" {
        // HTTPS MITM: parse host:port from target
        let target = req.target.clone();
        let (host, port) = match target.rsplit_once(':') {
            Some((h, p)) => (h.to_string(), p.parse::<u16>().unwrap_or(443)),
            None => (target.clone(), 443),
        };

        // DNS Spoofing：查规则，若有匹配则连接到指定 IP（可带自定义端口）
        let spoof = find_dns_spoof(&config.rules, &host);
        let spoof_ip = spoof.as_ref().map(|(ip, _)| ip.clone());
        let spoof_port = spoof.as_ref().and_then(|(_, p)| *p);

        // Map Remote（HTTPS）：按 host 匹配（CONNECT 阶段只有 host:port，没有 path）
        // 返回 (target_host, target_port, orig_host_for_display)
        let https_map_remote = config.rules.iter().find_map(|r| {
            if let ProxyRule::MapRemote { match_host, match_path, target_url } = r {
                // CONNECT 阶段只按 host 匹配（path 在 TLS 解密后再判断）
                if host != *match_host { return None; }
                if let Ok(target) = url::Url::parse(target_url) {
                    let t_host = target.host_str()?.to_string();
                    let t_port = target.port_or_known_default().unwrap_or(443);
                    eprintln!("[proxy] CONNECT MapRemote: {} -> {}:{}", host, t_host, t_port);
                    return Some((t_host, t_port, target_url.clone()));
                }
                None
            } else {
                None
            }
        });

        let connect_addr = match (&spoof_ip, spoof_port, &https_map_remote) {
            (Some(ip), Some(sp), _) => format!("{}:{}", ip, sp),
            (Some(ip), None, _) => format!("{}:{}", ip, port),
            (None, _, Some((t_host, t_port, _))) => format!("{}:{}", t_host, t_port),
            (None, _, None) => format!("{}:{}", host, port),
        };
        let rule_matched = spoof_ip.is_some() || https_map_remote.is_some();

        // Get CA manager from app state
        use tauri::Manager;
        let ca_state = app.state::<std::sync::Mutex<Option<std::sync::Arc<crate::https_proxy::CaManager>>>>();
        let ca = {
            let guard = ca_state.lock();
            match guard {
                Ok(g) => {
                    if let Some(ref cm) = *g {
                        std::sync::Arc::clone(cm)
                    } else {
                        drop(g);
                        match crate::https_proxy::get_or_create_ca() {
                            Ok(cm) => {
                                if let Ok(mut g2) = ca_state.lock() {
                                    *g2 = Some(std::sync::Arc::clone(&cm));
                                }
                                cm
                            }
                            Err(_) => return,
                        }
                    }
                }
                Err(_) => return,
            }
        };

        // Emit traffic entry for CONNECT
        let display_url = match (&spoof_ip, spoof_port, &https_map_remote) {
            (Some(ip), Some(sp), _) => format!("{}  [DNS Spoof → {}:{}]", target, ip, sp),
            (Some(ip), None, _) => format!("{}  [DNS Spoof → {}]", target, ip),
            (None, _, Some((t_host, _, _))) => format!("{}  [Map Remote → {}]", target, t_host),
            (None, _, None) => target.clone(),
        };
        let _ = app.emit("proxy-traffic", TrafficEntry {
            id: uuid::Uuid::new_v4().to_string(),
            method: "CONNECT".to_string(),
            url: display_url,
            original_url: target.clone(),
            peer_addr: peer_addr.clone(),
            status: Some(200),
            duration: Some(0),
            error: None,
            timestamp: std::time::SystemTime::now()
                .duration_since(std::time::UNIX_EPOCH)
                .map(|d| d.as_millis() as u64)
                .unwrap_or(0),
            rule_matched,
            req_headers: vec![],
            req_body_preview: String::new(),
            res_headers: vec![],
            res_body_preview: String::new(),
            res_body_size: 0,
        });

        // Take ownership of the underlying TcpStream
        let raw_stream = buf.into_inner();

        // ── 根据是否启用 HTTPS 解密决定走 MITM 还是纯透传 ──
        if !config.https_decrypt {
            // 纯透传：不解密，HTTPS 正常访问
            // DNS Spoofing 仍生效（改连接 IP），但看不到内容、不能改 Host
            if let Err(e) = crate::https_proxy::handle_connect_passthrough(
                raw_stream,
                &host,
                port,
                spoof_ip.as_deref(),
            ).await {
                eprintln!("[proxy] HTTPS passthrough error for {}: {}", host, e);
            }
            return;
        }

        // ── MITM 解密模式 ──
        // 确定实际连接的 host 和 port（用于 TCP + TLS SNI）
        // 优先级：Map Remote > DNS Spoofing(带端口) > DNS Spoofing(仅IP) > 原始
        let (connect_host, connect_port) = match &https_map_remote {
            Some((t_host, t_port, _)) => (t_host.clone(), *t_port),
            None => match &spoof {
                Some((ip, Some(sp))) => (ip.clone(), *sp),
                Some((ip, None)) => (ip.clone(), port),
                None => (host.clone(), port),
            },
        };

        if let Err(e) = crate::https_proxy::handle_connect(
            raw_stream,
            &host,              // 原始 host（用于 CA 证书签发）
            &connect_host,      // 实际连接的 host（用于 TCP + TLS SNI）
            connect_port,
            ca,
            spoof_ip.as_deref(),
            https_map_remote.as_ref().map(|(h, _, _)| h.as_str()),
        ).await {
            eprintln!("[proxy] HTTPS MITM error for {} (connect {}): {}", host, connect_addr, e);
        }
        return;
    }

    let original_url = req.target.clone();
    let timestamp = std::time::SystemTime::now()
        .duration_since(std::time::UNIX_EPOCH)
        .map(|d| d.as_millis() as u64)
        .unwrap_or(0);
    let entry_id = uuid::Uuid::new_v4().to_string();
    let t0 = std::time::Instant::now();

    let req_headers_display: Vec<(String, String)> = req.headers.clone();
    let req_body_preview_orig = if req.body.is_empty() {
        String::new()
    } else {
        String::from_utf8_lossy(&req.body).into_owned()
    };

    let tcp = buf.get_mut();

    // ══════════ 1. BlockList 检查 ══════════
    for rule in &config.rules {
        if let ProxyRule::BlockList { match_host, match_path, status } = rule {
            if url_matches(&original_url, match_host, match_path) {
                let body = format!("Blocked by proxy (status {})", status).into_bytes();
                send_simple_response(tcp, *status, &body, "text/plain", config.no_caching).await;
                let dur = t0.elapsed().as_millis() as u64;
                emit_traffic(
                    &app, entry_id, req.method.clone(), original_url.clone(), original_url.clone(),
                    peer_addr, Some(*status), Some(dur), None, timestamp, true,
                    req_headers_display, req_body_preview_orig,
                    vec![], String::new(), 0,
                );
                return;
            }
        }
    }

    // ══════════ 2. MapLocal 检查 ══════════
    for rule in &config.rules {
        if let ProxyRule::MapLocal { match_host, match_path, file_path, status, content_type } = rule {
            if url_matches(&original_url, match_host, match_path) {
                let file_bytes = std::fs::read(file_path).unwrap_or_else(|e| {
                    format!("MapLocal error: cannot read {}: {}", file_path, e).into_bytes()
                });
                let ct = if content_type.is_empty() {
                    guess_content_type(file_path)
                } else {
                    content_type.as_str()
                };
                let actual_status = if *status == 0 { 200 } else { *status };
                send_simple_response(tcp, actual_status, &file_bytes, ct, config.no_caching).await;
                let dur = t0.elapsed().as_millis() as u64;
                let body_preview = String::from_utf8_lossy(&file_bytes).into_owned();
                let res_headers = vec![
                    ("content-type".to_string(), ct.to_string()),
                    ("content-length".to_string(), file_bytes.len().to_string()),
                ];
                emit_traffic(
                    &app, entry_id, req.method.clone(), original_url.clone(), original_url.clone(),
                    peer_addr, Some(actual_status), Some(dur), None, timestamp, true,
                    req_headers_display, req_body_preview_orig,
                    res_headers, body_preview, file_bytes.len() as u64,
                );
                return;
            }
        }
    }

    // ══════════ 3. URL 规则改写（Map Remote / PathRewrite / ParamInject） ══════════
    let (target_url, url_rewritten) = apply_url_rules(&original_url, &config.rules);

    // ══════════ 3b. DNS Spoofing（HTTP） ══════════
    // 把 URL 的 host 改成 spoof IP，但 Host 头保留原域名
    let mut final_url = target_url.clone();
    // 若 DNS Spoofing 命中，这里保存要发给服务器的 Host 头（原域名）
    let mut spoof_host_hdr: Option<String> = None;
    let mut spoofed = false;
    if let Ok(parsed) = url::Url::parse(&target_url) {
        if let Some(host) = parsed.host_str() {
            if let Some((ip, override_port)) = find_dns_spoof(&config.rules, host) {
                let orig_host_hdr = match parsed.port_or_known_default() {
                    Some(p) if p != 80 && p != 443 => format!("{}:{}", host, p),
                    _ => host.to_string(),
                };
                let mut spoofed_url = parsed.clone();
                let _ = spoofed_url.set_host(Some(&ip));
                if let Some(p) = override_port {
                    let _ = spoofed_url.set_port(Some(p));
                }
                final_url = spoofed_url.to_string();
                spoof_host_hdr = Some(orig_host_hdr);
                spoofed = true;
                eprintln!("[proxy] DnsSpoof HTTP: {} -> {} (Host 保持 {})", target_url, final_url, spoof_host_hdr.as_deref().unwrap_or(""));
            }
        }
    }
    let rule_matched = url_rewritten || spoofed;

    // ══════════ 4. 请求 Rewrite（req_body） ══════════
    let mut req_body = req.body.clone();
    let req_headers = req.headers.clone();

    for rule in &config.rules {
        if let ProxyRule::Rewrite { match_host, match_path, target, pattern, replacement } = rule {
            if target == "req_body" && url_matches(&target_url, match_host, match_path) {
                let body_str = String::from_utf8_lossy(&req_body).into_owned();
                let new_body = apply_rewrite_text(&body_str, pattern, replacement);
                req_body = new_body.into_bytes();
            }
        }
    }

    let req_body_preview = String::from_utf8_lossy(&req_body).into_owned();

    // ══════════ 5. 请求断点 ══════════
    let bp_req_hit = config.breakpoints.iter().any(|bp| {
        bp.phase == "request" && url_matches(&target_url, &bp.match_host, &bp.match_path)
    });

    let mut final_method = req.method.clone();
    let mut final_headers = req_headers.clone();
    let mut final_body = req_body.clone();
    // final_url 已在上方 DNS Spoof 阶段声明并可能被改写为 IP，不能在这里重新 let 声明（会 shadow 掉 spoofed 值）

    if bp_req_hit {
        let bp_id = format!("bp-{}-{}", entry_id, "req");
        let resume = breakpoint_wait(
            &app, &bp_registry, &bp_id, "request",
            &final_method, &final_url, &final_headers, &req_body_preview, None,
        ).await;
        if let Some(r) = resume {
            if r.action == "abort" {
                let body = b"Request aborted at breakpoint";
                send_simple_response(tcp, 502, body, "text/plain", config.no_caching).await;
                let dur = t0.elapsed().as_millis() as u64;
                emit_traffic(
                    &app, entry_id, final_method, final_url, original_url,
                    peer_addr, Some(502), Some(dur),
                    Some("Aborted at breakpoint".into()), timestamp, rule_matched,
                    req_headers_display, req_body_preview_orig,
                    vec![], String::new(), 0,
                );
                return;
            }
            if let Some(m) = r.method { final_method = m; }
            if let Some(u) = r.url { final_url = u; }
            if let Some(h) = r.headers { final_headers = h; }
            if let Some(b) = r.body { final_body = b.into_bytes(); }
        }
    }

    // ══════════ 6. 转发请求 ══════════
    let method = reqwest::Method::from_str(&final_method).unwrap_or(reqwest::Method::GET);
    let mut fwd_headers = HeaderMap::new();
    for (k, v) in &final_headers {
        if is_hop_by_hop(k) || k == "host" || k == "accept-encoding" { continue; }
        if let (Ok(name), Ok(val)) = (HeaderName::from_str(k), HeaderValue::from_str(v)) {
            fwd_headers.insert(name, val);
        }
    }
    fwd_headers.insert(HeaderName::from_static("accept-encoding"), HeaderValue::from_static("identity"));

    // Host 头：DNS Spoofing 时用原域名，否则用最终 URL 的 host
    let host_hdr_value = spoof_host_hdr.clone().unwrap_or_else(|| {
        if let Ok(parsed) = url::Url::parse(&final_url) {
            if let Some(host) = parsed.host_str() {
                match parsed.port_or_known_default() {
                    Some(p) if p != 80 && p != 443 => format!("{}:{}", host, p),
                    _ => host.to_string(),
                }
            } else { String::new() }
        } else { String::new() }
    });
    if !host_hdr_value.is_empty() {
        if let Ok(v) = HeaderValue::from_str(&host_hdr_value) {
            fwd_headers.insert(reqwest::header::HOST, v);
        }
    }

    let mut builder = client.request(method, &final_url).headers(fwd_headers);
    if !final_body.is_empty() {
        builder = builder.body(final_body.clone());
    }

    // Throttle latency: delay before sending request
    if config.throttle.enabled && config.throttle.latency > 0 {
        tokio::time::sleep(std::time::Duration::from_millis(config.throttle.latency)).await;
    }

    match builder.send().await {
        Ok(resp) => {
            let mut status_code = resp.status().as_u16();
            let resp_headers_raw = resp.headers().clone();

            let mut res_headers_display: Vec<(String, String)> = resp_headers_raw
                .iter()
                .filter_map(|(k, v)| v.to_str().ok().map(|v| (k.to_string(), v.to_string())))
                .collect();

            let content_type = resp_headers_raw
                .get("content-type")
                .and_then(|v| v.to_str().ok())
                .unwrap_or("");

            // 判断是否为流式响应：SSE / NDJSON / chunked stream / 无 Content-Length
            let is_sse = content_type.contains("text/event-stream");
            let is_streaming_ct = is_sse
                || content_type.contains("application/x-ndjson")
                || content_type.contains("application/stream+json")
                || content_type.contains("application/octet-stream")
                || content_type.contains("chunked");

            let is_chunked_te = resp_headers_raw
                .get("transfer-encoding")
                .and_then(|v| v.to_str().ok())
                .map(|te| te.contains("chunked"))
                .unwrap_or(false);

            // 判断是否需要缓冲完整响应（有匹配当前 URL 的 res_body/res_status rewrite 或 response 断点）
            // 流式响应始终不缓冲（缓冲会破坏流式语义）
            let has_res_rewrite = needs_response_buffer_for_url(&config.rules, &final_url);
            let has_res_bp = config.breakpoints.iter().any(|bp| {
                bp.phase == "response" && url_matches(&final_url, &bp.match_host, &bp.match_path)
            });
            let need_buffer = !is_streaming_ct && !is_chunked_te && (has_res_rewrite || has_res_bp);

            let has_content_length = resp_headers_raw.contains_key("content-length");
            // 流式模式：SSE/流式 Content-Type / chunked TE / 无 Content-Length
            let use_streaming = is_streaming_ct || is_chunked_te;
            let use_chunked = use_streaming || !has_content_length;

            // 决定走哪个分支
            let mode = if need_buffer { "buffer" }
                else if use_streaming || use_chunked { "stream" }
                else { "normal" };

            eprintln!(
                "[proxy] {} {} -> ct=[{}] status={} sse={} stream_ct={} chunked_te={} has_cl={} need_buf={} res_rewrite={} res_bp={} mode={}",
                final_method, final_url, content_type, status_code, is_sse, is_streaming_ct, is_chunked_te,
                has_content_length, need_buffer, has_res_rewrite, has_res_bp, mode
            );

            // 发送初始流量事件（响应头已到达，body 尚未读取）
            // 前端立即显示该条目，响应完成后用相同 ID 更新
            emit_traffic(
                &app, entry_id.clone(), final_method.clone(), final_url.clone(), original_url.clone(),
                peer_addr.clone(), Some(status_code), None, None, timestamp, rule_matched,
                req_headers_display.clone(), req_body_preview.clone(),
                res_headers_display.clone(), String::new(), 0,
            );

            // ── 缓冲模式（有 Rewrite/断点 需要完整响应） ──
            if need_buffer {
                let body_bytes = resp.bytes().await.unwrap_or_default();
                let mut body_str = String::from_utf8_lossy(&body_bytes).into_owned();
                let mut final_status = status_code;

                // Rewrite: res_body
                for rule in &config.rules {
                    if let ProxyRule::Rewrite { match_host, match_path, target, pattern, replacement } = rule {
                        if target == "res_body" && url_matches(&final_url, match_host, match_path) {
                            body_str = apply_rewrite_text(&body_str, pattern, replacement);
                        }
                    }
                }

                // Rewrite: res_status
                for rule in &config.rules {
                    if let ProxyRule::Rewrite { match_host, match_path, target, pattern, replacement } = rule {
                        if target == "res_status" && url_matches(&final_url, match_host, match_path) {
                            if let Ok(re) = regex::Regex::new(pattern) {
                                let status_str = final_status.to_string();
                                if re.is_match(&status_str) {
                                    if let Ok(new_status) = replacement.parse::<u16>() {
                                        final_status = new_status;
                                    }
                                }
                            }
                        }
                    }
                }

                // 响应断点
                let bp_res_hit = config.breakpoints.iter().any(|bp| {
                    bp.phase == "response" && url_matches(&final_url, &bp.match_host, &bp.match_path)
                });

                if bp_res_hit {
                    let bp_id = format!("bp-{}-{}", entry_id, "res");
                    let resume = breakpoint_wait(
                        &app, &bp_registry, &bp_id, "response",
                        &final_method, &final_url, &res_headers_display, &body_str, Some(final_status),
                    ).await;
                    if let Some(r) = resume {
                        if r.action == "abort" {
                            let abort_body = b"Response aborted at breakpoint";
                            send_simple_response(tcp, 502, abort_body, "text/plain", config.no_caching).await;
                            let dur = t0.elapsed().as_millis() as u64;
                            emit_traffic(
                                &app, entry_id, final_method, final_url, original_url,
                                peer_addr, Some(502), Some(dur),
                                Some("Aborted at breakpoint".into()), timestamp, rule_matched,
                                req_headers_display, req_body_preview_orig,
                                vec![], String::new(), 0,
                            );
                            return;
                        }
                        if let Some(s) = r.status { final_status = s; }
                        if let Some(h) = r.headers { res_headers_display = h; }
                        if let Some(b) = r.body { body_str = b; }
                    }
                }

                status_code = final_status;
                let final_bytes = body_str.into_bytes();

                // 构造响应头
                let reason = reqwest::StatusCode::from_u16(final_status)
                    .ok()
                    .and_then(|s| s.canonical_reason().map(|r| r.to_string()))
                    .unwrap_or_else(|| "OK".into());

                let mut hdr_text = format!("HTTP/1.1 {} {}\r\n", final_status, reason);
                for (k, v) in &res_headers_display {
                    let lk = k.to_lowercase();
                    if is_hop_by_hop(&lk) || lk == "content-length" || lk == "transfer-encoding" || lk == "content-encoding" {
                        continue;
                    }
                    if config.no_caching && is_cache_header(&lk) { continue; }
                    hdr_text.push_str(&format!("{}: {}\r\n", k, v));
                }
                if config.no_caching {
                    hdr_text.push_str("Cache-Control: no-store, no-cache, must-revalidate\r\n");
                }
                hdr_text.push_str(&format!("Content-Length: {}\r\n", final_bytes.len()));
                hdr_text.push_str("Connection: close\r\n\r\n");
                let _ = tcp.write_all(hdr_text.as_bytes()).await;
                let _ = tcp.write_all(&final_bytes).await;

                let dur = t0.elapsed().as_millis() as u64;
                let res_body_preview = String::from_utf8_lossy(&final_bytes).into_owned();
                emit_traffic(
                    &app, entry_id, final_method, final_url, original_url,
                    peer_addr, Some(status_code), Some(dur), None, timestamp, rule_matched,
                    req_headers_display, req_body_preview,
                    res_headers_display, res_body_preview, final_bytes.len() as u64,
                );
            }
            // ── 流式模式（SSE / chunked） ──
            else if use_streaming || use_chunked {
                let mut hdr_text = format!(
                    "HTTP/1.1 {} {}\r\n",
                    status_code,
                    reqwest::StatusCode::from_u16(status_code)
                        .ok()
                        .and_then(|s| s.canonical_reason().map(|r| r.to_string()))
                        .unwrap_or_else(|| "OK".into())
                );
                for (k, v) in &resp_headers_raw {
                    let key = k.as_str();
                    if is_hop_by_hop(key) || key == "content-length" || key == "transfer-encoding" || key == "content-encoding" {
                        continue;
                    }
                    if config.no_caching && is_cache_header(key) { continue; }
                    if let Ok(v_str) = v.to_str() {
                        hdr_text.push_str(&format!("{}: {}\r\n", key, v_str));
                    }
                }

                if is_sse || is_streaming_ct {
                    let has_cache_ctrl = resp_headers_raw.contains_key("cache-control") || config.no_caching;
                    if !has_cache_ctrl {
                        hdr_text.push_str("Cache-Control: no-cache\r\n");
                    }
                    if config.no_caching {
                        hdr_text.push_str("Cache-Control: no-store, no-cache, must-revalidate\r\n");
                    }
                    hdr_text.push_str("X-Accel-Buffering: no\r\n");
                    hdr_text.push_str("Transfer-Encoding: chunked\r\n\r\n");
                } else {
                    hdr_text.push_str("Transfer-Encoding: chunked\r\nConnection: close\r\n\r\n");
                }
                let _ = tcp.write_all(hdr_text.as_bytes()).await;
                let _ = tcp.flush().await;

                let mut body_stream = resp.bytes_stream();
                let mut total_bytes: u64 = 0;
                let mut preview_buf: Vec<u8> = Vec::new();
                let mut chunk_count: u32 = 0;
                let mut last_emit = std::time::Instant::now();

                loop {
                    match body_stream.next().await {
                        Some(Ok(chunk)) if !chunk.is_empty() => {
                            chunk_count += 1;
                            preview_buf.extend_from_slice(&chunk);
                            let size_line = format!("{:X}\r\n", chunk.len());
                            if tcp.write_all(size_line.as_bytes()).await.is_err() {
                                eprintln!("[proxy] stream write size_line failed: {} {}", final_method, final_url);
                                break;
                            }
                            if tcp.write_all(&chunk).await.is_err() {
                                eprintln!("[proxy] stream write chunk failed: {} {}", final_method, final_url);
                                break;
                            }
                            if tcp.write_all(b"\r\n").await.is_err() {
                                eprintln!("[proxy] stream write crlf failed: {} {}", final_method, final_url);
                                break;
                            }
                            let _ = tcp.flush().await;
                            total_bytes += chunk.len() as u64;
                            eprintln!("[proxy] stream chunk #{} {} bytes, total {} for {}",
                                chunk_count, chunk.len(), total_bytes, final_url);

                            // 流式更新流量日志 body preview（节流：每 200ms 或前 5 个 chunk）
                            let should_emit = chunk_count <= 5 || last_emit.elapsed() > std::time::Duration::from_millis(200);
                            if should_emit {
                                let preview_so_far = String::from_utf8_lossy(&preview_buf).into_owned();
                                emit_traffic(
                                    &app, entry_id.clone(), final_method.clone(), final_url.clone(), original_url.clone(),
                                    peer_addr.clone(), Some(status_code), None, None, timestamp, rule_matched,
                                    req_headers_display.clone(), req_body_preview.clone(),
                                    res_headers_display.clone(), preview_so_far, total_bytes,
                                );
                                last_emit = std::time::Instant::now();
                            }

                            // Throttle: sleep based on bandwidth
                            if config.throttle.enabled && config.throttle.bandwidth > 0 {
                                let chunk_kb = chunk.len() as f64 / 1024.0;
                                let sleep_ms = (chunk_kb / config.throttle.bandwidth as f64 * 1000.0) as u64;
                                if sleep_ms > 0 {
                                    tokio::time::sleep(std::time::Duration::from_millis(sleep_ms)).await;
                                }
                            }
                        }
                        Some(Ok(_)) => {}
                        Some(Err(e)) => {
                            eprintln!("[proxy] stream error for {}: {}", final_url, e);
                            break;
                        }
                        None => {
                            eprintln!("[proxy] stream ended for {} after {} chunks / {} bytes", final_url, chunk_count, total_bytes);
                            break;
                        }
                    }
                }
                let _ = tcp.write_all(b"0\r\n\r\n").await;

                let dur = t0.elapsed().as_millis() as u64;
                let res_body_preview = String::from_utf8_lossy(&preview_buf).into_owned();
                emit_traffic(
                    &app, entry_id, final_method, final_url, original_url,
                    peer_addr, Some(status_code), Some(dur), None, timestamp, rule_matched,
                    req_headers_display, req_body_preview,
                    res_headers_display, res_body_preview, total_bytes,
                );
            }
            // ── 普通模式（有 Content-Length 且非流式） ──
            else {
                eprintln!("[proxy] normal mode: waiting for full body via resp.bytes() for {}", final_url);
                let body_bytes = resp.bytes().await.unwrap_or_default();
                let dur = t0.elapsed().as_millis() as u64;
                eprintln!("[proxy] normal mode: got {} bytes in {}ms for {}", body_bytes.len(), dur, final_url);

                let mut hdr_text = format!(
                    "HTTP/1.1 {} {}\r\n",
                    status_code,
                    reqwest::StatusCode::from_u16(status_code)
                        .ok()
                        .and_then(|s| s.canonical_reason().map(|r| r.to_string()))
                        .unwrap_or_else(|| "OK".into())
                );
                for (k, v) in &resp_headers_raw {
                    let key = k.as_str();
                    if is_hop_by_hop(key) || key == "content-length" || key == "transfer-encoding" || key == "content-encoding" {
                        continue;
                    }
                    if config.no_caching && is_cache_header(key) { continue; }
                    if let Ok(v_str) = v.to_str() {
                        hdr_text.push_str(&format!("{}: {}\r\n", key, v_str));
                    }
                }
                if config.no_caching {
                    hdr_text.push_str("Cache-Control: no-store, no-cache, must-revalidate\r\n");
                }
                hdr_text.push_str(&format!("Content-Length: {}\r\n", body_bytes.len()));
                hdr_text.push_str("Connection: close\r\n\r\n");
                let _ = tcp.write_all(hdr_text.as_bytes()).await;
                let _ = tcp.write_all(&body_bytes).await;

                let res_body_preview = String::from_utf8_lossy(&body_bytes).into_owned();
                emit_traffic(
                    &app, entry_id, final_method, final_url, original_url,
                    peer_addr, Some(status_code), Some(dur), None, timestamp, rule_matched,
                    req_headers_display, req_body_preview,
                    res_headers_display, res_body_preview, body_bytes.len() as u64,
                );
            }
        }
        Err(e) => {
            let dur = t0.elapsed().as_millis() as u64;
            let err_msg = e.to_string();
            let _ = tcp.write_all(b"HTTP/1.1 502 Bad Gateway\r\nConnection: close\r\n\r\n").await;
            emit_traffic(
                &app, entry_id, final_method, final_url, original_url,
                peer_addr, None, Some(dur), Some(err_msg), timestamp, rule_matched,
                req_headers_display, req_body_preview_orig,
                vec![], String::new(), 0,
            );
        }
    }
}

// ── 代理服务器主循环 ──────────────────────────────────────────────────────────

async fn run_proxy(
    port: u16,
    config: ProxyConfig,
    app: AppHandle,
    bp_registry: BreakpointRegistry,
) -> Result<(), String> {
    let listener = TcpListener::bind(format!("127.0.0.1:{}", port))
        .await
        .map_err(|e| format!("无法绑定端口 {}: {}", port, e))?;

    // 启动时打印规则摘要，便于排查规则是否下发
    eprintln!("[proxy] 启动 port={} 规则总数={}", port, config.rules.len());
    for (i, rule) in config.rules.iter().enumerate() {
        match rule {
            ProxyRule::DnsSpoof { host, ip } =>
                eprintln!("[proxy]   [{}] DnsSpoof  host={} -> ip={}", i, host, ip),
            ProxyRule::MapRemote { match_host, match_path, target_url } =>
                eprintln!("[proxy]   [{}] MapRemote matchHost={} matchPath={} -> {}", i, match_host, match_path, target_url),
            ProxyRule::PathRewrite { match_host, match_prefix, replacement } =>
                eprintln!("[proxy]   [{}] PathRewrite matchHost={} prefix={} -> {}", i, match_host, match_prefix, replacement),
            ProxyRule::ParamInject { match_host, match_path, params } =>
                eprintln!("[proxy]   [{}] ParamInject matchHost={} path={} params={}", i, match_host, match_path, params.len()),
            ProxyRule::MapLocal { match_host, match_path, file_path, .. } =>
                eprintln!("[proxy]   [{}] MapLocal matchHost={} path={} file={}", i, match_host, match_path, file_path),
            ProxyRule::BlockList { match_host, match_path, status } =>
                eprintln!("[proxy]   [{}] BlockList matchHost={} path={} status={}", i, match_host, match_path, status),
            ProxyRule::Rewrite { match_host, match_path, target, pattern, .. } =>
                eprintln!("[proxy]   [{}] Rewrite matchHost={} path={} target={} pattern={}", i, match_host, match_path, target, pattern),
        }
    }

    let config = Arc::new(config);
    let client = Arc::new(
        reqwest::Client::builder()
            .danger_accept_invalid_certs(true)
            .redirect(reqwest::redirect::Policy::none())
            .http1_only()
            .no_proxy()
            .tcp_nodelay(true)          // 禁用 Nagle，流式数据立即发送
            .connect_timeout(std::time::Duration::from_secs(30))  // 连接超时 30s
            // 不设 timeout（默认 None）—— SSE/流式响应可能持续很长时间
            .pool_max_idle_per_host(0)  // 禁用连接池复用，避免流式连接被干扰
            .build()
            .map_err(|e| format!("reqwest 初始化失败: {}", e))?,
    );

    loop {
        let Ok((stream, addr)) = listener.accept().await else { break; };
        stream.set_nodelay(true).ok();
        let peer_addr = addr.to_string();
        let config = Arc::clone(&config);
        let client = Arc::clone(&client);
        let app = app.clone();
        let bp = bp_registry.clone();
        tokio::spawn(handle_connection(stream, peer_addr, config, client, app, bp));
    }
    Ok(())
}

// ── 系统代理设置 ──────────────────────────────────────────────────────────────

// ── macOS ──
#[cfg(target_os = "macos")]
fn list_network_services() -> Vec<String> {
    let output = match std::process::Command::new("networksetup")
        .arg("-listallnetworkservices")
        .output()
    {
        Ok(o) => o,
        Err(_) => return vec![],
    };
    if !output.status.success() { return vec![]; }
    let text = String::from_utf8_lossy(&output.stdout);
    text.lines()
        .skip(1)
        .filter_map(|l| {
            let l = l.trim();
            if l.is_empty() || l.starts_with('*') { return None; }
            let lower = l.to_lowercase();
            if lower.contains("bluetooth") || lower.contains("thunderbolt") || lower.contains("bridge") {
                return None;
            }
            Some(l.to_string())
        })
        .collect()
}

#[cfg(target_os = "macos")]
fn set_system_proxy_macos(port: u16) -> Result<(), String> {
    let services = list_network_services();
    if services.is_empty() {
        return Err("未找到网络服务".into());
    }
    let mut errors = vec![];
    for svc in &services {
        // 只设置 HTTP 代理（按用户要求）
        let r = std::process::Command::new("networksetup")
            .args(["-setwebproxy", svc, "127.0.0.1", &port.to_string()])
            .output();
        if let Ok(o) = &r {
            if !o.status.success() {
                errors.push(format!("{}: {}", svc, String::from_utf8_lossy(&o.stderr).trim()));
            }
        }
    }
    if errors.is_empty() { Ok(()) } else { Err(errors.join("; ")) }
}

#[cfg(target_os = "macos")]
fn clear_system_proxy_macos() {
    let services = list_network_services();
    for svc in &services {
        let _ = std::process::Command::new("networksetup")
            .args(["-setwebproxystate", svc, "off"]).output();
        let _ = std::process::Command::new("networksetup")
            .args(["-setsecurewebproxystate", svc, "off"]).output();
        let _ = std::process::Command::new("networksetup")
            .args(["-setsocksfirewallproxystate", svc, "off"]).output();
    }
}

// ── Windows ──
#[cfg(target_os = "windows")]
fn set_system_proxy_windows(port: u16) -> Result<(), String> {
    use winreg::enums::*;
    use winreg::RegKey;
    let hkcu = RegKey::predef(HKEY_CURRENT_USER);
    let settings = hkcu.open_subkey_with_flags(
        r"Software\Microsoft\Windows\CurrentVersion\Internet Settings",
        KEY_SET_VALUE | KEY_READ,
    ).map_err(|e| format!("打开注册表失败: {}", e))?;

    // ProxyEnable = 1
    settings.set_value("ProxyEnable", &1u32)
        .map_err(|e| format!("设置 ProxyEnable 失败: {}", e))?;
    // ProxyServer 只指定 http=，这样 HTTPS 不走代理
    // 格式 "http=127.0.0.1:port" 只对 HTTP 生效；若写成 "127.0.0.1:port" 则所有协议都走
    let proxy_server = format!("http=127.0.0.1:{}", port);
    settings.set_value("ProxyServer", &proxy_server)
        .map_err(|e| format!("设置 ProxyServer 失败: {}", e))?;
    // ProxyOverride（绕过列表）保留本地地址
    settings.set_value("ProxyOverride", &"localhost;127.*;10.*;172.16.*;172.17.*;172.18.*;172.19.*;172.20.*;172.21.*;172.22.*;172.23.*;172.24.*;172.25.*;172.26.*;172.27.*;172.28.*;172.29.*;172.30.*;172.31.*;192.168.*;<local>")
        .ok();

    // 通知系统设置已变更
    use windows::Win32::Networking::WinInet::*;
    unsafe {
        let mut options = INTERNET_PER_CONN_OPTION_LISTW::default();
        options.dwSize = std::mem::size_of::<INTERNET_PER_CONN_OPTION_LISTW>() as u32;
        InternetSetOptionW(None, INTERNET_OPTION_SETTINGS_CHANGED, None, 0);
        InternetSetOptionW(None, INTERNET_OPTION_REFRESH, None, 0);
    }
    Ok(())
}

#[cfg(target_os = "windows")]
fn clear_system_proxy_windows() {
    use winreg::enums::*;
    use winreg::RegKey;
    if let Ok(hkcu) = RegKey::predef(HKEY_CURRENT_USER)
        .open_subkey_with_flags(
            r"Software\Microsoft\Windows\CurrentVersion\Internet Settings",
            KEY_SET_VALUE,
        )
    {
        let _ = hkcu.set_value("ProxyEnable", &0u32);
    }
    // 通知系统
    #[cfg(target_os = "windows")]
    unsafe {
        use windows::Win32::Networking::WinInet::*;
        InternetSetOptionW(None, INTERNET_OPTION_SETTINGS_CHANGED, None, 0);
        InternetSetOptionW(None, INTERNET_OPTION_REFRESH, None, 0);
    }
}

// ── 跨平台入口 ──
fn set_system_proxy(port: u16) -> Result<(), String> {
    #[cfg(target_os = "macos")]
    { set_system_proxy_macos(port) }
    #[cfg(target_os = "windows")]
    { set_system_proxy_windows(port) }
    #[cfg(not(any(target_os = "macos", target_os = "windows")))]
    { let _ = port; Ok(()) }
}

fn clear_system_proxy() {
    #[cfg(target_os = "macos")]
    { clear_system_proxy_macos(); }
    #[cfg(target_os = "windows")]
    { clear_system_proxy_windows(); }
    #[cfg(not(any(target_os = "macos", target_os = "windows")))]
    {}
}

/// 应用退出时调用：清除系统代理
pub fn clear_system_proxy_on_exit() {
    clear_system_proxy();
}

// ── Tauri 命令 ─────────────────────────────────────────────────────────────────

#[tauri::command]
pub async fn start_http_proxy(
    port: u16,
    config: ProxyConfig,
    state: tauri::State<'_, Mutex<ProxyState>>,
    app: AppHandle,
    bp_registry: tauri::State<'_, BreakpointRegistry>,
) -> Result<(), String> {
    let mut st = state.lock().map_err(|e| e.to_string())?;
    if let Some(h) = st.handle.take() {
        h.abort();
    }

    // 设置系统代理（失败不阻断启动，只警告）
    if let Err(e) = set_system_proxy(port) {
        eprintln!("[proxy] 设置系统代理失败（不影响代理服务器本身）：{}", e);
    }

    let config_clone = config.clone();
    let app_clone = app.clone();
    let bp = bp_registry.inner().clone();

    let handle = tokio::task::spawn(async move {
        if let Err(e) = run_proxy(port, config_clone, app_clone, bp).await {
            eprintln!("proxy error: {}", e);
        }
    });

    st.handle = Some(handle);
    st.port = port;
    st.rules = config.rules;
    Ok(())
}

#[tauri::command]
pub async fn stop_http_proxy(
    state: tauri::State<'_, Mutex<ProxyState>>,
) -> Result<(), String> {
    let mut st = state.lock().map_err(|e| e.to_string())?;
    if let Some(h) = st.handle.take() {
        h.abort();
    }
    // 停止时清除系统代理，避免网络中断
    clear_system_proxy();
    Ok(())
}

#[tauri::command]
pub fn get_proxy_status(state: tauri::State<'_, Mutex<ProxyState>>) -> ProxyStatus {
    let st = state.lock().unwrap();
    ProxyStatus { running: st.is_running(), port: st.port }
}

#[tauri::command]
pub async fn update_proxy_rules(
    rules: Vec<ProxyRule>,
    state: tauri::State<'_, Mutex<ProxyState>>,
    app: AppHandle,
    bp_registry: tauri::State<'_, BreakpointRegistry>,
) -> Result<(), String> {
    let port = {
        let mut st = state.lock().map_err(|e| e.to_string())?;
        if let Some(h) = st.handle.take() { h.abort(); }
        st.rules = rules.clone();
        st.port
    };
    let config = ProxyConfig { rules, no_caching: false, breakpoints: vec![], throttle: ThrottleConfig::default(), https_decrypt: false };
    // 直接用 start_http_proxy 的逻辑
    let mut st = state.lock().map_err(|e| e.to_string())?;
    if let Some(h) = st.handle.take() { h.abort(); }
    let config_clone = config.clone();
    let app_clone = app.clone();
    let bp = bp_registry.inner().clone();
    let handle = tokio::task::spawn(async move {
        if let Err(e) = run_proxy(port, config_clone, app_clone, bp).await {
            eprintln!("proxy error: {}", e);
        }
    });
    st.handle = Some(handle);
    st.port = port;
    st.rules = config.rules;
    Ok(())
}

/// 断点恢复：前端修改后调用此命令放行
#[tauri::command]
pub fn resume_breakpoint(
    id: String,
    data: BreakpointResume,
    state: tauri::State<'_, BreakpointRegistry>,
) -> Result<(), String> {
    let mut pending = state.pending.lock().map_err(|e| e.to_string())?;
    if let Some(sender) = pending.remove(&id) {
        let _ = sender.send(data);
        Ok(())
    } else {
        Err("断点已过期或不存在".into())
    }
}
