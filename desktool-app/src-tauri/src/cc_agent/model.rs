// model.rs — 数据模型层
// Sprint Final F4: 对齐 cc-gui 的 model 包（7 个文件 / 912 行）
//
// cc-gui (Java): model 包提供跨模块共享的领域模型
// ccagent (Rust): 本文件集中实现 7 个模型，用 enum + struct + 构造方法表达
//
// 模型清单：
// 1. ConflictStrategy   — 文件冲突处理策略枚举
// 2. DeleteResult       — 删除操作结果（成功/失败 + 错误类型）
// 3. FileSortItem       — 文件排序项（带优先级/深度/路径）
// 4. NodeDetectionResult — Node.js 检测结果
// 5. PathCheckResult    — 路径校验结果（ok/warning/error）
// 6. PromptScope        — 提示词作用域枚举
// 7. SessionTemplate    — 会话模板（预设配置）
//
// 设计要点：
// - 所有模型实现 Serialize + Deserialize（可作 Tauri command 参数/返回值）
// - 枚举用 #[serde(rename_all = "snake_case")] 与前端约定一致
// - 提供工厂方法（success/failure）和便捷谓词（is_ok/is_warning）

use std::path::{Path, PathBuf};

// ─── ConflictStrategy ──────────────────────────────────────────────────────

/// 文件冲突处理策略
///
/// 当目标文件已存在时，决定如何处理：
/// - Overwrite: 直接覆盖
/// - Skip: 跳过
/// - Rename: 重命名（加后缀）
/// - Ask: 询问用户
#[derive(Debug, Clone, Copy, PartialEq, Eq, serde::Serialize, serde::Deserialize)]
#[serde(rename_all = "snake_case")]
pub enum ConflictStrategy {
    Overwrite,
    Skip,
    Rename,
    Ask,
}

impl ConflictStrategy {
    /// 获取字符串值（用于持久化）
    pub fn get_value(&self) -> &'static str {
        match self {
            ConflictStrategy::Overwrite => "overwrite",
            ConflictStrategy::Skip => "skip",
            ConflictStrategy::Rename => "rename",
            ConflictStrategy::Ask => "ask",
        }
    }

    /// 从字符串解析
    pub fn from_value(value: &str) -> Option<Self> {
        match value.to_lowercase().as_str() {
            "overwrite" => Some(ConflictStrategy::Overwrite),
            "skip" => Some(ConflictStrategy::Skip),
            "rename" => Some(ConflictStrategy::Rename),
            "ask" => Some(ConflictStrategy::Ask),
            _ => None,
        }
    }
}

impl std::fmt::Display for ConflictStrategy {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        write!(f, "{}", self.get_value())
    }
}

impl Default for ConflictStrategy {
    fn default() -> Self {
        ConflictStrategy::Ask
    }
}

// ─── DeleteResult ──────────────────────────────────────────────────────────

/// 删除操作错误类型
#[derive(Debug, Clone, PartialEq, Eq, serde::Serialize, serde::Deserialize)]
#[serde(rename_all = "snake_case")]
pub enum DeleteErrorType {
    /// 文件不存在
    NotFound,
    /// 权限不足
    PermissionDenied,
    /// 路径是目录但未递归
    IsDirectory,
    /// 路径是文件但期望目录
    IsFile,
    /// IO 错误
    IoError,
    /// 路径无效
    InvalidPath,
    /// 未知错误
    Unknown,
}

/// 删除操作结果
#[derive(Debug, Clone, serde::Serialize, serde::Deserialize)]
pub struct DeleteResult {
    pub success: bool,
    pub deleted_path: Option<String>,
    pub error_type: Option<DeleteErrorType>,
    pub error_message: Option<String>,
    pub affected_path: Option<String>,
    pub suggestion: Option<String>,
}

impl DeleteResult {
    pub fn success() -> Self {
        Self {
            success: true,
            deleted_path: None,
            error_type: None,
            error_message: None,
            affected_path: None,
            suggestion: None,
        }
    }

    pub fn success_with_path(deleted_path: impl Into<String>) -> Self {
        Self {
            success: true,
            deleted_path: Some(deleted_path.into()),
            error_type: None,
            error_message: None,
            affected_path: None,
            suggestion: None,
        }
    }

    pub fn failure(error_type: DeleteErrorType, error_message: impl Into<String>) -> Self {
        Self {
            success: false,
            deleted_path: None,
            error_type: Some(error_type),
            error_message: Some(error_message.into()),
            affected_path: None,
            suggestion: None,
        }
    }

    pub fn failure_with_path(
        error_type: DeleteErrorType,
        error_message: impl Into<String>,
        affected_path: impl Into<String>,
    ) -> Self {
        Self {
            success: false,
            deleted_path: None,
            error_type: Some(error_type),
            error_message: Some(error_message.into()),
            affected_path: Some(affected_path.into()),
            suggestion: None,
        }
    }

    pub fn failure_with_suggestion(
        error_type: DeleteErrorType,
        error_message: impl Into<String>,
        affected_path: impl Into<String>,
        suggestion: impl Into<String>,
    ) -> Self {
        Self {
            success: false,
            deleted_path: None,
            error_type: Some(error_type),
            error_message: Some(error_message.into()),
            affected_path: Some(affected_path.into()),
            suggestion: Some(suggestion.into()),
        }
    }

    /// 从 IO 错误推断错误类型
    pub fn from_io_error(e: &std::io::Error, path: &str) -> Self {
        let error_type = match e.kind() {
            std::io::ErrorKind::NotFound => DeleteErrorType::NotFound,
            std::io::ErrorKind::PermissionDenied => DeleteErrorType::PermissionDenied,
            _ => DeleteErrorType::IoError,
        };
        let suggestion = match error_type {
            DeleteErrorType::PermissionDenied => Some("请检查文件权限或使用管理员权限运行".to_string()),
            DeleteErrorType::NotFound => Some(format!("路径不存在: {}", path)),
            _ => None,
        };
        Self {
            success: false,
            deleted_path: None,
            error_type: Some(error_type),
            error_message: Some(e.to_string()),
            affected_path: Some(path.to_string()),
            suggestion,
        }
    }

    pub fn is_success(&self) -> bool {
        self.success
    }

    /// 用户友好的错误消息
    pub fn user_friendly_message(&self) -> String {
        if self.success {
            match &self.deleted_path {
                Some(p) => format!("已删除: {}", p),
                None => "删除成功".to_string(),
            }
        } else {
            let etype = self.error_type.as_ref().map(|t| format!("{:?}", t)).unwrap_or_default();
            let msg = self.error_message.clone().unwrap_or_default();
            let sug = self.suggestion.clone().unwrap_or_default();
            if sug.is_empty() {
                format!("[{}] {}", etype, msg)
            } else {
                format!("[{}] {} — {}", etype, msg, sug)
            }
        }
    }
}

// ─── FileSortItem ──────────────────────────────────────────────────────────

/// 文件排序项
///
/// 用于文件列表排序，带优先级（目录优先/特定文件优先）。
#[derive(Debug, Clone, serde::Serialize, serde::Deserialize)]
pub struct FileSortItem {
    /// 原始 JSON（透传，前端可能需要）
    pub raw: serde_json::Value,
    /// 排序优先级（越小越靠前）
    pub priority: i32,
    /// 完整路径
    pub path: String,
    /// 是否目录
    pub is_dir: bool,
    /// 文件名
    pub name: String,
}

impl FileSortItem {
    pub fn new(
        raw: serde_json::Value,
        priority: i32,
        path: impl Into<String>,
        is_dir: bool,
        name: impl Into<String>,
    ) -> Self {
        Self {
            raw,
            priority,
            path: path.into(),
            is_dir,
            name: name.into(),
        }
    }

    /// 路径深度（根目录为 0）
    pub fn depth(&self) -> usize {
        self.path.matches('/').count() + self.path.matches('\\').count()
    }

    /// 父目录路径
    pub fn parent_path(&self) -> Option<String> {
        Path::new(&self.path)
            .parent()
            .map(|p| p.to_string_lossy().to_string())
    }

    /// 比较器：目录优先，然后按优先级，再按名称
    pub fn compare(a: &Self, b: &Self) -> std::cmp::Ordering {
        // 目录优先
        match (a.is_dir, b.is_dir) {
            (true, false) => return std::cmp::Ordering::Less,
            (false, true) => return std::cmp::Ordering::Greater,
            _ => {}
        }
        // 按优先级
        match a.priority.cmp(&b.priority) {
            std::cmp::Ordering::Equal => {}
            ord => return ord,
        }
        // 按名称（不区分大小写）
        a.name.to_lowercase().cmp(&b.name.to_lowercase())
    }
}

// ─── NodeDetectionResult ───────────────────────────────────────────────────

/// Node.js 检测方法
#[derive(Debug, Clone, PartialEq, Eq, serde::Serialize, serde::Deserialize)]
#[serde(rename_all = "snake_case")]
pub enum DetectionMethod {
    /// PATH 环境变量
    Path,
    /// nvm
    Nvm,
    /// fnm
    Fnm,
    /// volta
    Volta,
    /// n
    N,
    /// homebrew
    Homebrew,
    /// 手动指定
    Manual,
    /// 系统默认
    System,
}

/// Node.js 检测结果
#[derive(Debug, Clone, serde::Serialize, serde::Deserialize)]
pub struct NodeDetectionResult {
    pub found: bool,
    pub node_path: Option<String>,
    pub node_version: Option<String>,
    pub method: Option<DetectionMethod>,
    pub tried_paths: Vec<String>,
    pub error_message: Option<String>,
}

impl NodeDetectionResult {
    pub fn success(node_path: impl Into<String>, node_version: impl Into<String>, method: DetectionMethod) -> Self {
        Self {
            found: true,
            node_path: Some(node_path.into()),
            node_version: Some(node_version.into()),
            method: Some(method),
            tried_paths: Vec::new(),
            error_message: None,
        }
    }

    pub fn failure(error_message: impl Into<String>) -> Self {
        Self {
            found: false,
            node_path: None,
            node_version: None,
            method: None,
            tried_paths: Vec::new(),
            error_message: Some(error_message.into()),
        }
    }

    pub fn failure_with_paths(error_message: impl Into<String>, tried_paths: Vec<String>) -> Self {
        Self {
            found: false,
            node_path: None,
            node_version: None,
            method: None,
            tried_paths,
            error_message: Some(error_message.into()),
        }
    }

    pub fn add_tried_path(&mut self, path: impl Into<String>) {
        self.tried_paths.push(path.into());
    }

    pub fn is_found(&self) -> bool {
        self.found
    }

    /// 方法描述
    pub fn method_description(&self) -> &'static str {
        match self.method {
            Some(DetectionMethod::Path) => "PATH 环境变量",
            Some(DetectionMethod::Nvm) => "nvm 版本管理器",
            Some(DetectionMethod::Fnm) => "fnm 版本管理器",
            Some(DetectionMethod::Volta) => "Volta 版本管理器",
            Some(DetectionMethod::N) => "n 版本管理器",
            Some(DetectionMethod::Homebrew) => "Homebrew 包管理器",
            Some(DetectionMethod::Manual) => "手动指定路径",
            Some(DetectionMethod::System) => "系统默认",
            None => "未知",
        }
    }

    /// 用户友好消息
    pub fn user_friendly_message(&self) -> String {
        if self.found {
            format!(
                "检测到 Node.js {}（{}，via {}）",
                self.node_version.as_deref().unwrap_or("未知版本"),
                self.node_path.as_deref().unwrap_or("未知路径"),
                self.method_description()
            )
        } else {
            let tried = if self.tried_paths.is_empty() {
                String::new()
            } else {
                format!("，已尝试: {}", self.tried_paths.join(", "))
            };
            format!(
                "未检测到 Node.js: {}{}",
                self.error_message.as_deref().unwrap_or("未知原因"),
                tried
            )
        }
    }
}

// ─── PathCheckResult ───────────────────────────────────────────────────────

/// 路径校验结果级别
#[derive(Debug, Clone, Copy, PartialEq, Eq, serde::Serialize, serde::Deserialize)]
#[serde(rename_all = "snake_case")]
pub enum ResultLevel {
    Ok,
    Warning,
    Error,
}

/// 路径校验结果
#[derive(Debug, Clone, serde::Serialize, serde::Deserialize)]
pub struct PathCheckResult {
    pub level: ResultLevel,
    pub message: String,
    pub path: Option<String>,
    pub path_length: Option<usize>,
}

impl PathCheckResult {
    pub fn ok() -> Self {
        Self { level: ResultLevel::Ok, message: String::new(), path: None, path_length: None }
    }

    pub fn ok_with(path: impl Into<String>, path_length: usize) -> Self {
        Self { level: ResultLevel::Ok, message: String::new(), path: Some(path.into()), path_length: Some(path_length) }
    }

    pub fn warning(message: impl Into<String>) -> Self {
        Self { level: ResultLevel::Warning, message: message.into(), path: None, path_length: None }
    }

    pub fn warning_with(message: impl Into<String>, path: impl Into<String>, path_length: usize) -> Self {
        Self { level: ResultLevel::Warning, message: message.into(), path: Some(path.into()), path_length: Some(path_length) }
    }

    pub fn error(message: impl Into<String>) -> Self {
        Self { level: ResultLevel::Error, message: message.into(), path: None, path_length: None }
    }

    pub fn error_with(message: impl Into<String>, path: impl Into<String>, path_length: usize) -> Self {
        Self { level: ResultLevel::Error, message: message.into(), path: Some(path.into()), path_length: Some(path_length) }
    }

    pub fn is_ok(&self) -> bool { self.level == ResultLevel::Ok }
    pub fn is_warning(&self) -> bool { self.level == ResultLevel::Warning }
    pub fn is_error(&self) -> bool { self.level == ResultLevel::Error }
}

// ─── PromptScope ───────────────────────────────────────────────────────────

/// 提示词作用域
#[derive(Debug, Clone, Copy, PartialEq, Eq, serde::Serialize, serde::Deserialize)]
#[serde(rename_all = "snake_case")]
pub enum PromptScope {
    /// 全局
    Global,
    /// 项目级
    Project,
    /// 会话级
    Session,
}

impl PromptScope {
    pub fn get_value(&self) -> &'static str {
        match self {
            PromptScope::Global => "global",
            PromptScope::Project => "project",
            PromptScope::Session => "session",
        }
    }

    pub fn from_string(value: &str) -> Option<Self> {
        match value.to_lowercase().as_str() {
            "global" => Some(PromptScope::Global),
            "project" => Some(PromptScope::Project),
            "session" => Some(PromptScope::Session),
            _ => None,
        }
    }

    /// 配置目录名
    pub fn config_dir(&self) -> &'static str {
        match self {
            PromptScope::Global => "global",
            PromptScope::Project => "projects",
            PromptScope::Session => "sessions",
        }
    }
}

impl std::fmt::Display for PromptScope {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        write!(f, "{}", self.get_value())
    }
}

// ─── SessionTemplate ───────────────────────────────────────────────────────

/// 会话模板
///
/// 预设的会话配置，可快速创建会话。
#[derive(Debug, Clone, serde::Serialize, serde::Deserialize)]
pub struct SessionTemplate {
    pub name: String,
    pub provider: String,
    pub model: String,
    pub permission_mode: String,
    pub reasoning_effort: Option<String>,
    pub cwd: Option<String>,
    pub system_prompt: Option<String>,
    pub description: Option<String>,
    /// 是否内置模板
    pub builtin: bool,
}

impl SessionTemplate {
    pub fn new(name: impl Into<String>, provider: impl Into<String>, model: impl Into<String>) -> Self {
        Self {
            name: name.into(),
            provider: provider.into(),
            model: model.into(),
            permission_mode: "default".to_string(),
            reasoning_effort: None,
            cwd: None,
            system_prompt: None,
            description: None,
            builtin: false,
        }
    }

    pub fn with_permission_mode(mut self, mode: impl Into<String>) -> Self {
        self.permission_mode = mode.into();
        self
    }

    pub fn with_reasoning_effort(mut self, effort: impl Into<String>) -> Self {
        self.reasoning_effort = Some(effort.into());
        self
    }

    pub fn with_cwd(mut self, cwd: impl Into<String>) -> Self {
        self.cwd = Some(cwd.into());
        self
    }

    pub fn with_system_prompt(mut self, prompt: impl Into<String>) -> Self {
        self.system_prompt = Some(prompt.into());
        self
    }

    pub fn with_description(mut self, desc: impl Into<String>) -> Self {
        self.description = Some(desc.into());
        self
    }

    pub fn as_builtin(mut self) -> Self {
        self.builtin = true;
        self
    }

    /// 深拷贝（Rust Clone 已实现，此方法为 API 对齐）
    pub fn copy(&self) -> Self {
        self.clone()
    }

    /// 内置模板列表
    pub fn builtin_templates() -> Vec<SessionTemplate> {
        vec![
            SessionTemplate::new("Claude 默认", "claude", "sonnet")
                .with_description("Claude Code 默认会话")
                .as_builtin(),
            SessionTemplate::new("Claude Opus 深度", "claude", "opus")
                .with_reasoning_effort("high")
                .with_description("Claude Opus 深度思考模式")
                .as_builtin(),
            SessionTemplate::new("Codex 默认", "codex", "gpt-5")
                .with_description("Codex CLI 默认会话")
                .as_builtin(),
            SessionTemplate::new("Claude 超长上下文", "claude", "sonnet")
                .with_permission_mode("bypassPermissions")
                .with_description("跳过权限确认，适合长任务")
                .as_builtin(),
        ]
    }

    /// 按名称查找内置模板
    pub fn find_builtin(name: &str) -> Option<SessionTemplate> {
        Self::builtin_templates().into_iter().find(|t| t.name == name)
    }
}

impl Default for SessionTemplate {
    fn default() -> Self {
        Self::new("default", "claude", "sonnet")
    }
}

// ─── SessionTemplateService ─────────────────────────────────────────────────
// 对齐 cc-gui SessionTemplateService: CRUD + 持久化 + 验证

use std::collections::HashMap;
use std::fs;

/// 会话模板持久化管理器
pub struct SessionTemplateService {
    store: HashMap<String, SessionTemplate>,
    file_path: PathBuf,
}

impl SessionTemplateService {
    /// 从文件加载模板集合
    pub fn load(config_dir: &Path) -> Result<Self, String> {
        let file_path = config_dir.join("session_templates.json");
        let store = if file_path.exists() {
            let data = fs::read_to_string(&file_path).map_err(|e| e.to_string())?;
            let templates: Vec<SessionTemplate> =
                serde_json::from_str(&data).map_err(|e| e.to_string())?;
            templates.into_iter().map(|t| (t.name.clone(), t)).collect()
        } else {
            // 初始化内置模板
            SessionTemplate::builtin_templates()
                .into_iter()
                .map(|t| (t.name.clone(), t))
                .collect()
        };
        Ok(Self { store, file_path })
    }

    /// 保存模板
    pub fn save(&mut self, template: SessionTemplate) -> Result<(), String> {
        let name = template.name.clone();
        self.store.insert(name, template);
        self.persist()
    }

    /// 删除模板
    pub fn delete(&mut self, name: &str) -> Result<bool, String> {
        if self.store.remove(name).is_some() {
            self.persist()?;
            Ok(true)
        } else {
            Ok(false)
        }
    }

    /// 检查模板是否存在
    pub fn exists(&self, name: &str) -> bool {
        self.store.contains_key(name)
    }

    /// 获取指定模板
    pub fn get(&self, name: &str) -> Option<&SessionTemplate> {
        self.store.get(name)
    }

    /// 列出所有模板
    pub fn list(&self) -> Vec<&SessionTemplate> {
        self.store.values().collect()
    }

    /// 获取模板数量
    pub fn count(&self) -> usize {
        self.store.len()
    }

    /// 持久化到磁盘
    fn persist(&self) -> Result<(), String> {
        let templates: Vec<&SessionTemplate> = self.store.values().collect();
        let json = serde_json::to_string_pretty(&templates).map_err(|e| e.to_string())?;
        if let Some(parent) = self.file_path.parent() {
            fs::create_dir_all(parent).map_err(|e| e.to_string())?;
        }
        fs::write(&self.file_path, json).map_err(|e| e.to_string())
    }
}

// ─── PermissionDialogTimeout ────────────────────────────────────────────────
// 对齐 cc-gui PermissionDialogTimeoutSettings: 范围钳制 + 安全网缓冲

/// 权限弹窗超时配置
pub struct PermissionDialogTimeout {
    pub seconds: u32,
}

/// 默认值对齐 cc-gui DEFAULT_PERMISSION_DIALOG_TIMEOUT_SECONDS
pub const DEFAULT_TIMEOUT_SECONDS: u32 = 300;
pub const MIN_TIMEOUT_SECONDS: u32 = 30;
pub const MAX_TIMEOUT_SECONDS: u32 = 3600;
/// 安全网缓冲：自动批准前额外等待
pub const SAFETY_NET_BUFFER_SECONDS: u64 = 60;

impl PermissionDialogTimeout {
    /// 创建带钳制的超时配置
    pub fn new(seconds: u32) -> Self {
        Self {
            seconds: clamp_timeout(seconds),
        }
    }

    /// 默认 300 秒
    pub fn default_timeout() -> Self {
        Self {
            seconds: DEFAULT_TIMEOUT_SECONDS,
        }
    }

    /// 获取有效超时（考虑安全网缓冲后的实际值）
    pub fn effective_seconds(&self) -> u64 {
        (self.seconds as u64).saturating_add(SAFETY_NET_BUFFER_SECONDS)
    }

    /// 是否在有效范围内
    pub fn is_valid(seconds: u32) -> bool {
        seconds >= MIN_TIMEOUT_SECONDS && seconds <= MAX_TIMEOUT_SECONDS
    }
}

/// 钳制超时秒数到 [MIN, MAX] 范围
pub fn clamp_timeout(seconds: u32) -> u32 {
    seconds.clamp(MIN_TIMEOUT_SECONDS, MAX_TIMEOUT_SECONDS)
}

// ─── 单元测试 ──────────────────────────────────────────────────────────────

#[cfg(test)]
mod tests {
    use super::*;

    // ConflictStrategy
    #[test]
    fn test_conflict_strategy_roundtrip() {
        for s in [ConflictStrategy::Overwrite, ConflictStrategy::Skip, ConflictStrategy::Rename, ConflictStrategy::Ask] {
            let v = s.get_value();
            assert_eq!(ConflictStrategy::from_value(v), Some(s));
        }
        assert_eq!(ConflictStrategy::from_value("unknown"), None);
        assert_eq!(ConflictStrategy::default(), ConflictStrategy::Ask);
        assert_eq!(format!("{}", ConflictStrategy::Overwrite), "overwrite");
    }

    // DeleteResult
    #[test]
    fn test_delete_result_success() {
        let r = DeleteResult::success();
        assert!(r.is_success());
        assert!(r.deleted_path.is_none());
        assert_eq!(r.user_friendly_message(), "删除成功");

        let r2 = DeleteResult::success_with_path("/tmp/x");
        assert_eq!(r2.deleted_path.as_deref(), Some("/tmp/x"));
        assert!(r2.user_friendly_message().contains("/tmp/x"));
    }

    #[test]
    fn test_delete_result_failure() {
        let r = DeleteResult::failure(DeleteErrorType::NotFound, "文件不存在");
        assert!(!r.is_success());
        assert_eq!(r.error_type, Some(DeleteErrorType::NotFound));
        assert!(r.user_friendly_message().contains("NotFound"));
    }

    #[test]
    fn test_delete_result_from_io_error() {
        let e = std::io::Error::new(std::io::ErrorKind::NotFound, "no such file");
        let r = DeleteResult::from_io_error(&e, "/tmp/missing");
        assert_eq!(r.error_type, Some(DeleteErrorType::NotFound));
        assert!(r.suggestion.is_some());

        let e2 = std::io::Error::new(std::io::ErrorKind::PermissionDenied, "denied");
        let r2 = DeleteResult::from_io_error(&e2, "/root/secret");
        assert_eq!(r2.error_type, Some(DeleteErrorType::PermissionDenied));
    }

    // FileSortItem
    #[test]
    fn test_file_sort_item_depth_and_parent() {
        let item = FileSortItem::new(serde_json::Value::Null, 0, "/a/b/c.txt", false, "c.txt");
        assert_eq!(item.depth(), 3);
        assert_eq!(item.parent_path().as_deref(), Some("/a/b"));
    }

    #[test]
    fn test_file_sort_item_compare() {
        let dir = FileSortItem::new(serde_json::Value::Null, 0, "/d", true, "d");
        let file = FileSortItem::new(serde_json::Value::Null, 0, "/f", false, "f");
        assert_eq!(FileSortItem::compare(&dir, &file), std::cmp::Ordering::Less);
        assert_eq!(FileSortItem::compare(&file, &dir), std::cmp::Ordering::Greater);

        let a = FileSortItem::new(serde_json::Value::Null, 1, "/a", false, "a");
        let b = FileSortItem::new(serde_json::Value::Null, 2, "/b", false, "b");
        assert_eq!(FileSortItem::compare(&a, &b), std::cmp::Ordering::Less);
    }

    // NodeDetectionResult
    #[test]
    fn test_node_detection_success() {
        let r = NodeDetectionResult::success("/usr/bin/node", "v20.10.0", DetectionMethod::Path);
        assert!(r.is_found());
        assert_eq!(r.node_version.as_deref(), Some("v20.10.0"));
        assert_eq!(r.method_description(), "PATH 环境变量");
        assert!(r.user_friendly_message().contains("v20.10.0"));
    }

    #[test]
    fn test_node_detection_failure_with_tried() {
        let mut r = NodeDetectionResult::failure("未找到");
        r.add_tried_path("/usr/local/bin/node");
        r.add_tried_path("/opt/homebrew/bin/node");
        assert_eq!(r.tried_paths.len(), 2);
        assert!(r.user_friendly_message().contains("/opt/homebrew/bin/node"));
    }

    // PathCheckResult
    #[test]
    fn test_path_check_result_levels() {
        let ok = PathCheckResult::ok();
        assert!(ok.is_ok());
        assert!(!ok.is_warning());

        let warn = PathCheckResult::warning_with("路径较长", "/a/b/c", 6);
        assert!(warn.is_warning());
        assert_eq!(warn.path_length, Some(6));

        let err = PathCheckResult::error("非法路径");
        assert!(err.is_error());
        assert!(err.path.is_none());
    }

    // PromptScope
    #[test]
    fn test_prompt_scope_roundtrip() {
        assert_eq!(PromptScope::from_string("global"), Some(PromptScope::Global));
        assert_eq!(PromptScope::from_string("PROJECT"), Some(PromptScope::Project));
        assert_eq!(PromptScope::from_string("xxx"), None);
        assert_eq!(PromptScope::Global.config_dir(), "global");
        assert_eq!(format!("{}", PromptScope::Session), "session");
    }

    // SessionTemplate
    #[test]
    fn test_session_template_builder() {
        let t = SessionTemplate::new("测试", "claude", "opus")
            .with_permission_mode("bypassPermissions")
            .with_reasoning_effort("high")
            .with_cwd("/tmp")
            .with_description("测试模板")
            .as_builtin();
        assert_eq!(t.name, "测试");
        assert_eq!(t.permission_mode, "bypassPermissions");
        assert_eq!(t.reasoning_effort.as_deref(), Some("high"));
        assert!(t.builtin);
    }

    #[test]
    fn test_session_template_builtins() {
        let builtins = SessionTemplate::builtin_templates();
        assert!(builtins.len() >= 3);
        assert!(builtins.iter().all(|t| t.builtin));
        let found = SessionTemplate::find_builtin("Claude 默认");
        assert!(found.is_some());
        assert_eq!(found.unwrap().model, "sonnet");
    }

    #[test]
    fn test_session_template_default() {
        let t = SessionTemplate::default();
        assert_eq!(t.name, "default");
        assert_eq!(t.provider, "claude");
        assert!(!t.builtin);
    }
}
