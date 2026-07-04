// handler/context.rs — 上下文用量 handler
// Sprint S2: 处理上下文用量统计

use async_trait::async_trait;

use crate::cc_agent::handler::{HandlerContext, MessageHandler};
use crate::cc_agent::provider::ProviderEvent;

/// 上下文用量 Handler
///
/// 监听 Usage 事件，累积统计 token 使用量。
/// 对应 cc-gui 的 ContextUsageHandler。
pub struct ContextHandler {
    // 累积统计（通过 HandlerContext 的 event_counts 间接追踪）
    _private: (),
}

impl ContextHandler {
    pub fn new() -> Self {
        Self { _private: () }
    }
}

impl Default for ContextHandler {
    fn default() -> Self {
        Self::new()
    }
}

/// 上下文用量快照
#[derive(Debug, Clone, Default, serde::Serialize)]
pub struct ContextUsageSnapshot {
    pub total_input_tokens: u64,
    pub total_output_tokens: u64,
    pub total_cache_read_tokens: u64,
    pub total_cache_create_tokens: u64,
    pub total_cost_usd: f64,
    pub event_count: u64,
}

impl ContextUsageSnapshot {
    /// 合并新的 Usage 事件
    pub fn merge(&mut self, event: &ProviderEvent) {
        if let ProviderEvent::Usage {
            input_tokens,
            output_tokens,
            cache_read_tokens,
            cache_create_tokens,
            cost_usd,
        } = event
        {
            if let Some(v) = input_tokens {
                self.total_input_tokens += v;
            }
            if let Some(v) = output_tokens {
                self.total_output_tokens += v;
            }
            if let Some(v) = cache_read_tokens {
                self.total_cache_read_tokens += v;
            }
            if let Some(v) = cache_create_tokens {
                self.total_cache_create_tokens += v;
            }
            if let Some(v) = cost_usd {
                self.total_cost_usd += v;
            }
            self.event_count += 1;
        }
    }

    /// 总 token 数
    pub fn total_tokens(&self) -> u64 {
        self.total_input_tokens + self.total_output_tokens
    }

    /// 有效 token 数（排除缓存读取）
    pub fn effective_tokens(&self) -> u64 {
        self.total_input_tokens + self.total_output_tokens - self.total_cache_read_tokens
    }
}

#[async_trait]
impl MessageHandler for ContextHandler {
    fn name(&self) -> &'static str {
        "ContextHandler"
    }

    async fn handle(&self, event: &ProviderEvent, ctx: &HandlerContext) -> bool {
        match event {
            ProviderEvent::Usage { .. } => {
                // Usage 事件已被 FileHandler 之前的计数记录
                // 这里可以做额外的处理，如更新上下文百分比
                // 目前只记录日志
                let _ = ctx;
                false
            }
            _ => false,
        }
    }
}

// ─── Y1 增强：工作区上下文收集 ──────────────────────────────────────────────────

use std::collections::HashMap;
use std::path::{Path, PathBuf};
use std::fs;

/// 工作区上下文快照
#[derive(Debug, Clone, serde::Serialize)]
pub struct WorkspaceContext {
    pub root: String,
    pub language: Option<String>,
    pub build_tools: Vec<String>,
    pub frameworks: Vec<String>,
    pub test_frameworks: Vec<String>,
    pub package_manager: Option<String>,
    pub file_count: usize,
    pub dir_count: usize,
}

/// 收集工作区上下文
///
/// 扫描项目根目录，检测语言、构建工具、框架等。
pub fn collect_workspace_context(cwd: &Path) -> WorkspaceContext {
    let root = cwd.to_string_lossy().to_string();
    let mut ctx = WorkspaceContext {
        root,
        language: None,
        build_tools: Vec::new(),
        frameworks: Vec::new(),
        test_frameworks: Vec::new(),
        package_manager: None,
        file_count: 0,
        dir_count: 0,
    };

    // 检测语言和构建工具
    detect_from_files(cwd, &mut ctx);
    ctx
}

fn detect_from_files(cwd: &Path, ctx: &mut WorkspaceContext) {
    let mut detector = ProjectDetector::new();

    // 扫描根目录
    if let Ok(entries) = fs::read_dir(cwd) {
        for entry in entries.flatten() {
            let name = entry.file_name().to_string_lossy().to_string();

            if entry.file_type().map(|t| t.is_dir()).unwrap_or(false) {
                ctx.dir_count += 1;
                match name.as_str() {
                    "src" | "lib" | "app" => detector.has_source = true,
                    ".git" => detector.has_git = true,
                    "node_modules" => detector.has_node_modules = true,
                    _ => {}
                }
            } else {
                ctx.file_count += 1;
                detector.check_file(&name);
            }
        }
    }

    // 应用检测结果
    ctx.language = detector.detect_language();
    ctx.build_tools = detector.build_tools();
    ctx.frameworks = detector.frameworks();
    ctx.test_frameworks = detector.test_frameworks();
    ctx.package_manager = detector.package_manager();
}

struct ProjectDetector {
    has_source: bool,
    has_git: bool,
    has_node_modules: bool,
    files: HashMap<String, bool>,
}

impl ProjectDetector {
    fn new() -> Self {
        Self {
            has_source: false,
            has_git: false,
            has_node_modules: false,
            files: HashMap::new(),
        }
    }

    fn check_file(&mut self, name: &str) {
        self.files.insert(name.to_string(), true);
    }

    fn has(&self, name: &str) -> bool {
        self.files.contains_key(name)
    }

    fn detect_language(&self) -> Option<String> {
        if self.has("Cargo.toml") { return Some("Rust".into()); }
        if self.has("go.mod") { return Some("Go".into()); }
        if self.has("package.json") { return Some("TypeScript/JavaScript".into()); }
        if self.has("tsconfig.json") { return Some("TypeScript".into()); }
        if self.has("pom.xml") || self.has("build.gradle") || self.has("build.gradle.kts") { return Some("Java/Kotlin".into()); }
        if self.has("requirements.txt") || self.has("setup.py") || self.has("pyproject.toml") { return Some("Python".into()); }
        if self.has("CMakeLists.txt") { return Some("C/C++".into()); }
        if self.has("mix.exs") { return Some("Elixir".into()); }
        if self.has("Gemfile") { return Some("Ruby".into()); }
        if self.has("composer.json") { return Some("PHP".into()); }
        if self.has("pubspec.yaml") { return Some("Dart/Flutter".into()); }
        None
    }

    fn build_tools(&self) -> Vec<String> {
        let mut tools = Vec::new();
        if self.has("Cargo.toml") { tools.push("Cargo".into()); }
        if self.has("Makefile") { tools.push("Make".into()); }
        if self.has("CMakeLists.txt") { tools.push("CMake".into()); }
        if self.has("pom.xml") { tools.push("Maven".into()); }
        if self.has("build.gradle") || self.has("build.gradle.kts") { tools.push("Gradle".into()); }
        if self.has("go.mod") { tools.push("Go Modules".into()); }
        if self.has("vite.config.ts") || self.has("vite.config.js") { tools.push("Vite".into()); }
        if self.has("webpack.config.js") { tools.push("Webpack".into()); }
        if self.has("eslint.config.js") || self.has(".eslintrc.js") { tools.push("ESLint".into()); }
        if self.has("tsconfig.json") { tools.push("TypeScript Compiler".into()); }
        tools
    }

    fn frameworks(&self) -> Vec<String> {
        let mut fws = Vec::new();
        if let Ok(pkg_json) = fs::read_to_string("package.json") {
            if let Ok(pkg) = serde_json::from_str::<serde_json::Value>(&pkg_json) {
                let deps = pkg.get("dependencies").and_then(|v| v.as_object());
                let dev_deps = pkg.get("devDependencies").and_then(|v| v.as_object());
                let check = |fw: &str| -> bool {
                    deps.map_or(false, |d| d.contains_key(fw)) ||
                    dev_deps.map_or(false, |d| d.contains_key(fw))
                };
                if check("react") { fws.push("React".into()); }
                if check("vue") { fws.push("Vue".into()); }
                if check("@angular/core") { fws.push("Angular".into()); }
                if check("next") { fws.push("Next.js".into()); }
                if check("svelte") { fws.push("Svelte".into()); }
                if check("express") { fws.push("Express".into()); }
                if check("fastify") { fws.push("Fastify".into()); }
                if check("tailwindcss") { fws.push("Tailwind CSS".into()); }
                if check("prisma") { fws.push("Prisma".into()); }
            }
        }
        fws
    }

    fn test_frameworks(&self) -> Vec<String> {
        let mut tests = Vec::new();
        if self.has("vitest.config.ts") || self.has("vitest.config.js") { tests.push("Vitest".into()); }
        if self.has("jest.config.ts") || self.has("jest.config.js") { tests.push("Jest".into()); }
        if self.has(".mocharc.js") || self.has(".mocharc.json") { tests.push("Mocha".into()); }
        if self.has("playwright.config.ts") { tests.push("Playwright".into()); }
        if self.has("cypress.config.ts") || self.has("cypress.config.js") { tests.push("Cypress".into()); }
        if self.has("pytest.ini") || self.has("conftest.py") { tests.push("Pytest".into()); }
        if self.has("junit-platform.properties") { tests.push("JUnit".into()); }
        tests
    }

    fn package_manager(&self) -> Option<String> {
        if self.has("package-lock.json") { return Some("npm".into()); }
        if self.has("yarn.lock") { return Some("Yarn".into()); }
        if self.has("pnpm-lock.yaml") { return Some("pnpm".into()); }
        if self.has("bun.lockb") { return Some("Bun".into()); }
        if self.has("Cargo.lock") { return Some("Cargo".into()); }
        if self.has("Pipfile") || self.has("Pipfile.lock") { return Some("Pipenv".into()); }
        if self.has("poetry.lock") { return Some("Poetry".into()); }
        None
    }
}

#[cfg(test)]
mod context_tests {
    use super::*;

    #[test]
    fn test_snapshot_merge() {
        let mut snap = ContextUsageSnapshot::default();
        snap.merge(&ProviderEvent::Usage {
            input_tokens: Some(100),
            output_tokens: Some(50),
            cache_read_tokens: Some(10),
            cache_create_tokens: Some(5),
            cost_usd: Some(0.01),
        });
        assert_eq!(snap.total_input_tokens, 100);
        assert_eq!(snap.total_output_tokens, 50);
        assert_eq!(snap.total_tokens(), 150);
        assert_eq!(snap.effective_tokens(), 140);
        assert_eq!(snap.event_count, 1);
    }

    #[test]
    fn test_collect_workspace_context() {
        use std::fs;
        let dir = std::env::temp_dir().join("test_ws_ctx");
        let _ = fs::remove_dir_all(&dir);
        fs::create_dir_all(&dir).unwrap();

        // Create a minimal Rust project
        fs::write(dir.join("Cargo.toml"), "[package]\nname = \"test\"").unwrap();
        fs::create_dir(dir.join("src")).unwrap();
        fs::write(dir.join("src").join("main.rs"), "fn main() {}").unwrap();

        let ctx = collect_workspace_context(&dir);
        assert_eq!(ctx.language, Some("Rust".into()));
        assert!(ctx.build_tools.contains(&"Cargo".into()));

        let _ = fs::remove_dir_all(&dir);
    }
}

// ─── B7: 最近打开文件收集 ───────────────────────────────────────────────────────

use std::time::{SystemTime, UNIX_EPOCH};

/// 最近打开文件条目
#[derive(Debug, Clone, serde::Serialize)]
pub struct RecentFile {
    pub path: String,
    pub name: String,
    pub extension: Option<String>,
    pub last_accessed: u64,
    pub size: u64,
}

/// 获取最近打开/修改的文件
#[tauri::command]
pub async fn cc_get_recent_files(
    workspace: Option<String>,
    max_count: Option<usize>,
    extensions: Option<Vec<String>>,
) -> Result<Vec<RecentFile>, String> {
    let cwd = workspace.unwrap_or_else(|| ".".to_string());
    let max = max_count.unwrap_or(20);
    let ext_filter = extensions.unwrap_or_default();

    let mut files = Vec::new();
    let root = PathBuf::from(&cwd);

    if let Err(e) = collect_recent_files(&root, &mut files, 3, &ext_filter) {
        return Err(format!("扫描失败: {}", e));
    }

    // 按修改时间排序
    files.sort_by(|a, b| b.last_accessed.cmp(&a.last_accessed));
    files.truncate(max);

    Ok(files)
}

fn collect_recent_files(
    dir: &PathBuf,
    out: &mut Vec<RecentFile>,
    depth: usize,
    ext_filter: &[String],
) -> Result<(), std::io::Error> {
    if depth == 0 || !dir.is_dir() {
        return Ok(());
    }

    let skip_dirs = ["node_modules", ".git", "target", ".idea", "__pycache__", "dist", "build", ".next"];

    for entry in std::fs::read_dir(dir)? {
        let entry = entry?;
        let path = entry.path();
        let name = entry.file_name().to_string_lossy().to_string();

        if path.is_dir() {
            if skip_dirs.contains(&name.as_str()) { continue; }
            if name.starts_with('.') && name != "." { continue; }
            collect_recent_files(&path, out, depth - 1, ext_filter)?;
        } else if path.is_file() {
            let ext = path.extension()
                .map(|e| e.to_string_lossy().to_lowercase())
                .unwrap_or_default();

            // 过滤
            if !ext_filter.is_empty() && !ext_filter.contains(&ext) {
                continue;
            }

            // 只取代码相关文件
            let code_exts = [
                "rs", "java", "py", "ts", "tsx", "js", "jsx", "go", "rb",
                "c", "cpp", "h", "hpp", "swift", "kt", "scala", "cs",
                "html", "css", "scss", "less", "json", "yaml", "yml", "toml",
                "md", "sql", "sh", "bash", "zsh", "fish",
            ];

            if !ext_filter.is_empty() || code_exts.contains(&ext.as_str()) {
                let size = std::fs::metadata(&path)
                    .map(|m| m.len())
                    .unwrap_or(0);
                let last_accessed = std::fs::metadata(&path)
                    .ok()
                    .and_then(|m| m.modified().ok())
                    .and_then(|t| t.duration_since(UNIX_EPOCH).ok())
                    .map(|d| d.as_secs())
                    .unwrap_or(0);

                out.push(RecentFile {
                    path: path.to_string_lossy().to_string(),
                    name,
                    extension: Some(ext),
                    last_accessed,
                    size,
                });
            }
        }
    }

    Ok(())
}
