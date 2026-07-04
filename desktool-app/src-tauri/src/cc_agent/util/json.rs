// util/json.rs — JSON 工具
// 对齐 cc-gui MessageJsonConverter + JsUtils

use serde_json::{Value, Map};

/// 安全地从 JSON object 中获取字符串值
pub fn get_str<'a>(obj: &'a Map<String, Value>, key: &str) -> Option<&'a str> {
    obj.get(key).and_then(|v| v.as_str())
}

/// 安全地从 JSON object 中获取布尔值
pub fn get_bool(obj: &Map<String, Value>, key: &str) -> Option<bool> {
    obj.get(key).and_then(|v| v.as_bool())
}

/// 安全地从 JSON object 中获取数值（i64）
pub fn get_i64(obj: &Map<String, Value>, key: &str) -> Option<i64> {
    obj.get(key).and_then(|v| v.as_i64())
}

/// 安全地从 JSON object 中获取浮点数
pub fn get_f64(obj: &Map<String, Value>, key: &str) -> Option<f64> {
    obj.get(key).and_then(|v| v.as_f64())
}

/// 获取嵌套 JSON 值（用点分隔的路径，如 "a.b.c"）
pub fn get_nested<'a>(value: &'a Value, path: &str) -> Option<&'a Value> {
    let mut current = value;
    for key in path.split('.') {
        match current {
            Value::Object(map) => {
                current = map.get(key)?;
            }
            _ => return None,
        }
    }
    Some(current)
}

/// 设置嵌套 JSON 值
pub fn set_nested(value: &mut Value, path: &str, new_value: Value) {
    let keys: Vec<&str> = path.split('.').collect();
    let last = keys.last().unwrap();
    let mut current = value;
    for key in keys.iter().take(keys.len() - 1) {
        if let Value::Object(map) = current {
            current = map.entry((*key).to_string())
                .or_insert_with(|| Value::Object(Map::new()));
        } else {
            return;
        }
    }
    if let Value::Object(map) = current {
        map.insert((*last).to_string(), new_value);
    }
}

/// 深度合并两个 JSON object（target 合并到 source，target 优先）
pub fn merge(source: &mut Value, target: &Value) {
    match (source, target) {
        (Value::Object(s_map), Value::Object(t_map)) => {
            for (key, val) in t_map {
                match s_map.get_mut(key) {
                    Some(s_val) => merge(s_val, val),
                    None => {
                        s_map.insert(key.clone(), val.clone());
                    }
                }
            }
        }
        (s, t) => {
            *s = t.clone();
        }
    }
}

/// 安全解析 JSON
pub fn parse_safe(text: &str) -> Option<Value> {
    serde_json::from_str(text).ok()
}

/// 安全序列化 JSON
pub fn stringify_safe(value: &Value) -> Option<String> {
    serde_json::to_string_pretty(value).ok()
}

/// 展平 JSON（嵌套对象转为点分隔 key）
pub fn flatten(value: &Value, prefix: &str) -> Map<String, Value> {
    let mut result = Map::new();
    match value {
        Value::Object(map) => {
            for (key, val) in map {
                let full_key = if prefix.is_empty() {
                    key.clone()
                } else {
                    format!("{}.{}", prefix, key)
                };
                match val {
                    Value::Object(_) => {
                        result.extend(flatten(val, &full_key));
                    }
                    _ => {
                        result.insert(full_key, val.clone());
                    }
                }
            }
        }
        _ => {}
    }
    result
}

/// 提取 JSON 中类型为 object 的所有顶层 key
pub fn keys(value: &Value) -> Vec<String> {
    match value {
        Value::Object(map) => map.keys().cloned().collect(),
        _ => vec![],
    }
}

/// 判断两个 JSON 值是否相同（类型 + 内容）
pub fn is_equal(a: &Value, b: &Value) -> bool {
    a == b
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_get_nested() {
        let json: Value = serde_json::from_str(r#"{"a":{"b":{"c":"hello"}}}"#).unwrap();
        assert_eq!(get_nested(&json, "a.b.c").and_then(|v| v.as_str()), Some("hello"));
        assert!(get_nested(&json, "a.x").is_none());
    }

    #[test]
    fn test_merge() {
        let mut base: Value = serde_json::from_str(r#"{"a":1,"b":{"x":2}}"#).unwrap();
        let overlay: Value = serde_json::from_str(r#"{"a":3,"b":{"y":4},"c":5}"#).unwrap();
        merge(&mut base, &overlay);

        assert_eq!(base["a"], 3);
        assert_eq!(base["b"]["x"], 2);
        assert_eq!(base["b"]["y"], 4);
        assert_eq!(base["c"], 5);
    }

    #[test]
    fn test_flatten() {
        let json: Value = serde_json::from_str(r#"{"a":{"b":1,"c":{"d":2}}}"#).unwrap();
        let flat = flatten(&json, "");
        assert_eq!(flat.get("a.b").and_then(|v| v.as_i64()), Some(1));
        assert_eq!(flat.get("a.c.d").and_then(|v| v.as_i64()), Some(2));
    }

    #[test]
    fn test_parse_safe() {
        assert!(parse_safe(r#"{"valid":true}"#).is_some());
        assert!(parse_safe("not json").is_none());
    }

    #[test]
    fn test_set_nested() {
        let mut value: Value = serde_json::from_str(r#"{"a":{}}"#).unwrap();
        set_nested(&mut value, "a.b.c", Value::String("hello".into()));
        assert_eq!(get_nested(&value, "a.b.c").and_then(|v| v.as_str()), Some("hello"));
    }
}
