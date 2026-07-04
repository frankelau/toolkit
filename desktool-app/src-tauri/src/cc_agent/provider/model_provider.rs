// provider/model_provider.rs — B7: 模型Provider验证

use serde_json::Value;
use std::time::Instant;
use tauri::State;
use crate::cc_agent::network::NetworkLogState;

/// 验证 API Key（通过调用对应 API endpoint）
#[tauri::command]
pub async fn cc_verify_api_key(
    provider: String,
    api_key: String,
    base_url: Option<String>,
    net_log: State<'_, NetworkLogState>,
) -> Result<Value, String> {
    match provider.to_lowercase().as_str() {
        "claude" | "anthropic" => verify_anthropic_key(&api_key, &net_log).await,
        "codex" | "openai" => verify_openai_key(&api_key, base_url.as_deref(), &net_log).await,
        "custom" => verify_custom_key(&api_key, base_url.as_deref(), &net_log).await,
        _ => Err(format!("不支持的 Provider: {}", provider)),
    }
}

async fn verify_anthropic_key(api_key: &str, net_log: &NetworkLogState) -> Result<Value, String> {
    let url = "https://api.anthropic.com/v1/models";
    let client = reqwest::Client::new();
    let start = Instant::now();

    let resp = client
        .get(url)
        .header("x-api-key", api_key)
        .header("anthropic-version", "2023-06-01")
        .timeout(std::time::Duration::from_secs(10))
        .send()
        .await;

    let duration_ms = start.elapsed().as_millis() as u64;

    match resp {
        Ok(r) if r.status().is_success() => {
            let status = r.status().as_u16();
            let body: Value = r.json().await.unwrap_or_default();
            let models = body.get("data")
                .and_then(|d| d.as_array())
                .map(|a| a.len())
                .unwrap_or(0);
            net_log.record("anthropic", url, "GET", Some(status), duration_ms, None, None, None);
            Ok(serde_json::json!({
                "valid": true,
                "provider": "anthropic",
                "models_available": models,
            }))
        }
        Ok(r) => {
            let status = r.status().as_u16();
            let err = if status == 401 {
                "API Key 无效 (401 Unauthorized)".to_string()
            } else if status == 403 {
                "API Key 权限不足 (403 Forbidden)".to_string()
            } else {
                format!("API 请求失败: HTTP {}", status)
            };
            net_log.record("anthropic", url, "GET", Some(status), duration_ms, Some(err.clone()), None, None);
            Err(err)
        }
        Err(e) => {
            let err = format!("网络请求失败: {}", e);
            net_log.record("anthropic", url, "GET", None, duration_ms, Some(err.clone()), None, None);
            Err(err)
        }
    }
}

async fn verify_openai_key(api_key: &str, base_url: Option<&str>, net_log: &NetworkLogState) -> Result<Value, String> {
    let url = format!("{}/v1/models", base_url.unwrap_or("https://api.openai.com"));
    let client = reqwest::Client::new();
    let start = Instant::now();

    let resp = client
        .get(&url)
        .header("Authorization", format!("Bearer {}", api_key))
        .timeout(std::time::Duration::from_secs(10))
        .send()
        .await;

    let duration_ms = start.elapsed().as_millis() as u64;

    match resp {
        Ok(r) if r.status().is_success() => {
            let status = r.status().as_u16();
            let body: Value = r.json().await.unwrap_or_default();
            let models = body.get("data")
                .and_then(|d| d.as_array())
                .map(|a| a.len())
                .unwrap_or(0);
            net_log.record("openai", &url, "GET", Some(status), duration_ms, None, None, None);
            Ok(serde_json::json!({
                "valid": true,
                "provider": "openai",
                "models_available": models,
            }))
        }
        Ok(r) => {
            let status = r.status().as_u16();
            let err = if status == 401 {
                "API Key 无效 (401 Unauthorized)".to_string()
            } else {
                format!("API 请求失败: HTTP {}", status)
            };
            net_log.record("openai", &url, "GET", Some(status), duration_ms, Some(err.clone()), None, None);
            Err(err)
        }
        Err(e) => {
            let err = format!("网络请求失败: {}", e);
            net_log.record("openai", &url, "GET", None, duration_ms, Some(err.clone()), None, None);
            Err(err)
        }
    }
}

async fn verify_custom_key(api_key: &str, base_url: Option<&str>, net_log: &NetworkLogState) -> Result<Value, String> {
    let base = base_url.unwrap_or("http://localhost:11434");
    let url = format!("{}/api/tags", base);
    let client = reqwest::Client::new();
    let start = Instant::now();

    let resp = client
        .get(&url)
        .timeout(std::time::Duration::from_secs(5))
        .send()
        .await;

    let duration_ms = start.elapsed().as_millis() as u64;

    match resp {
        Ok(r) if r.status().is_success() => {
            let status = r.status().as_u16();
            net_log.record("custom", &url, "GET", Some(status), duration_ms, None, None, None);
            Ok(serde_json::json!({
                "valid": true,
                "provider": "custom",
                "endpoint": base,
            }))
        }
        Ok(r) => {
            let status = r.status().as_u16();
            let err = format!("服务响应异常: HTTP {}", status);
            net_log.record("custom", &url, "GET", Some(status), duration_ms, Some(err.clone()), None, None);
            Err(err)
        }
        Err(_) => {
            // fallback to /v1/models
            let url2 = format!("{}/v1/models", base);
            let start2 = Instant::now();
            let resp2 = reqwest::Client::new()
                .get(&url2)
                .header("Authorization", format!("Bearer {}", api_key))
                .timeout(std::time::Duration::from_secs(5))
                .send()
                .await;
            let dur2 = start2.elapsed().as_millis() as u64;

            match resp2 {
                Ok(r) if r.status().is_success() => {
                    let status = r.status().as_u16();
                    net_log.record("custom", &url2, "GET", Some(status), dur2, None, None, None);
                    Ok(serde_json::json!({
                        "valid": true,
                        "provider": "custom (OpenAI-compatible)",
                        "endpoint": base,
                    }))
                }
                Ok(r) => {
                    let status = r.status().as_u16();
                    let err = format!("API 验证失败: HTTP {}", status);
                    net_log.record("custom", &url2, "GET", Some(status), dur2, Some(err.clone()), None, None);
                    Err(err)
                }
                Err(e) => {
                    let err = format!("无法连接: {}", e);
                    net_log.record("custom", &url2, "GET", None, dur2, Some(err.clone()), None, None);
                    Err(err)
                }
            }
        }
    }
}

/// 列出可用的 Provider 模型列表
#[tauri::command]
pub async fn cc_list_available_models(
    provider: String,
    api_key: Option<String>,
    base_url: Option<String>,
    net_log: State<'_, NetworkLogState>,
) -> Result<Vec<Value>, String> {
    let key = api_key.unwrap_or_default();
    match provider.to_lowercase().as_str() {
        "claude" | "anthropic" => {
            let url = "https://api.anthropic.com/v1/models";
            let client = reqwest::Client::new();
            let start = Instant::now();
            let resp = client
                .get(url)
                .header("x-api-key", &key)
                .header("anthropic-version", "2023-06-01")
                .send()
                .await
                .map_err(|e| e.to_string())?;
            let status = resp.status().as_u16();
            let body: Value = resp.json().await.map_err(|e| e.to_string())?;
            net_log.record("anthropic", url, "GET", Some(status), start.elapsed().as_millis() as u64, None, None, None);
            let models = body["data"].as_array().cloned().unwrap_or_default();
            Ok(models)
        }
        "codex" | "openai" => {
            let url = format!("{}/v1/models", base_url.unwrap_or("https://api.openai.com".to_string()));
            let client = reqwest::Client::new();
            let start = Instant::now();
            let resp = client
                .get(&url)
                .header("Authorization", format!("Bearer {}", key))
                .send()
                .await
                .map_err(|e| e.to_string())?;
            let status = resp.status().as_u16();
            let body: Value = resp.json().await.map_err(|e| e.to_string())?;
            net_log.record("openai", &url, "GET", Some(status), start.elapsed().as_millis() as u64, None, None, None);
            let models = body["data"].as_array().cloned().unwrap_or_default();
            Ok(models)
        }
        _ => Ok(Vec::new()),
    }
}
