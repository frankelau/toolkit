// util/template.rs — 简易模板引擎

use std::collections::HashMap;

/// 简单模板替换（{{variable}} 语法）
pub fn render(template: &str, vars: &HashMap<String, String>) -> String {
    let mut result = template.to_string();
    for (key, value) in vars {
        let placeholder = format!("{{{{{}}}}}", key);
        result = result.replace(&placeholder, value);
    }
    result
}

/// 模板渲染（支持默认值：{{key:default}}）
pub fn render_with_defaults(template: &str, vars: &HashMap<String, String>) -> String {
    let re = regex::Regex::new(r"\{\{(\w+)(?::([^}]*))?\}\}").unwrap();
    re.replace_all(template, |caps: &regex::Captures| {
        let key = caps.get(1).unwrap().as_str();
        vars.get(key)
            .cloned()
            .or_else(|| caps.get(2).map(|m| m.as_str().to_string()))
            .unwrap_or_else(|| caps.get(0).unwrap().as_str().to_string())
    })
    .to_string()
}

/// 渲染多行模板为 Vec<String>（每行独立渲染）
pub fn render_lines(template: &str, vars: &HashMap<String, String>) -> Vec<String> {
    template
        .lines()
        .map(|line| render(line, vars))
        .collect()
}

/// 构建一个简单的变量映射
#[macro_export]
macro_rules! template_vars {
    ($($key:expr => $value:expr),* $(,)?) => {{
        let mut map = std::collections::HashMap::new();
        $(
            map.insert($key.to_string(), $value.to_string());
        )*
        map
    }};
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_render() {
        let mut vars = HashMap::new();
        vars.insert("name".to_string(), "World".to_string());
        assert_eq!(render("Hello {{name}}!", &vars), "Hello World!");
    }

    #[test]
    fn test_render_with_defaults() {
        let mut vars = HashMap::new();
        vars.insert("name".to_string(), "World".to_string());

        assert_eq!(
            render_with_defaults("{{name}} {{missing:none}}", &vars),
            "World none"
        );
    }

    #[test]
    fn test_render_lines() {
        let mut vars = HashMap::new();
        vars.insert("name".to_string(), "World".to_string());
        let result = render_lines("line1 {{name}}\nline2 {{name}}", &vars);
        assert_eq!(result, vec!["line1 World", "line2 World"]);
    }
}
