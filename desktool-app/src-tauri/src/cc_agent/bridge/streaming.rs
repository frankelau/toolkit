// bridge/streaming.rs — bridge 流式传输工具
// Sprint V3: 标准化发送请求和读取响应

use tokio::io::{AsyncBufReadExt, AsyncWriteExt, BufReader};
use tokio::process::ChildStdin;
use super::protocol::{BridgeRequest, BridgeResponse};

/// 构建标准 bridge 请求
pub fn build_request(method: &str, params: Option<serde_json::Value>) -> BridgeRequest {
    let mut req = BridgeRequest::new(method);
    if let Some(p) = params {
        req = req.with_params(p);
    }
    req
}

/// 发送请求到 bridge 子进程的 stdin
pub async fn send_to_bridge(
    stdin: &mut ChildStdin,
    request: &BridgeRequest,
) -> Result<(), String> {
    let line = request.to_line();
    stdin
        .write_all(line.as_bytes())
        .await
        .map_err(|e| format!("Failed to write to bridge stdin: {}", e))?;
    stdin
        .flush()
        .await
        .map_err(|e| format!("Failed to flush bridge stdin: {}", e))?;
    Ok(())
}

/// 从 bridge stdout 读取一行并解析为 BridgeResponse
pub async fn read_bridge_line(
    reader: &mut tokio::io::Lines<BufReader<tokio::process::ChildStdout>>,
) -> Option<BridgeResponse> {
    loop {
        let line = reader.next_line().await.ok()??;
        if line.trim().is_empty() {
            continue;
        }
        if let Ok(resp) = serde_json::from_str::<BridgeResponse>(&line) {
            return Some(resp);
        }
        // 非 JSON 行返回为 raw 类型
        return Some(BridgeResponse {
            msg_type: "raw".to_string(),
            data: Some(serde_json::json!({"text": line})),
            thread_id: None,
            error: None,
        });
    }
}

/// 发送简单请求（无参数）到 bridge
pub async fn send_simple(
    stdin: &mut ChildStdin,
    method: &str,
) -> Result<String, String> {
    let req = build_request(method, None);
    let id = req.id.clone();
    send_to_bridge(stdin, &req).await?;
    Ok(id)
}

/// 发送带参数的请求到 bridge
pub async fn send_with_params(
    stdin: &mut ChildStdin,
    method: &str,
    params: serde_json::Value,
) -> Result<String, String> {
    let req = build_request(method, Some(params));
    let id = req.id.clone();
    send_to_bridge(stdin, &req).await?;
    Ok(id)
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_build_request() {
        let req = build_request("send", Some(serde_json::json!({"msg": "hi"})));
        assert_eq!(req.method, "send");
        assert!(req.params.is_some());
        assert!(!req.id.is_empty());
    }

    #[test]
    fn test_build_request_no_params() {
        let req = build_request("abort", None);
        assert_eq!(req.method, "abort");
        assert!(req.params.is_none());
    }
}
