// skill/mod.rs — Skill 管理模块入口
// Sprint W1: 从 75 行单文件深化为目录模块（验证/前端解析/扫描/服务）
// 对齐 cc-gui skill/ 包（SkillService + SkillFrontmatterParser + ManagedSkillScanner）

pub mod validation;
pub mod frontmatter;
pub mod scanner;
pub mod service;
// Sprint B6: 斜杠命令扫描
pub mod commands;

// 类型再导出
pub use frontmatter::SkillMetadata;
pub use scanner::SkillEntry;

// 核心命令再导出（保持与旧 skill.rs 相同的 API）
pub use service::{
    cc_list_skills,       // 原始 list 命令（向后兼容）
    cc_list_all_skills,   // 新：列出 global+local 全部 skills
    cc_create_skill,      // 创建 skill（扩展了 scope/cwd 参数）
    cc_delete_skill,      // 删除 skill（扩展了 scope/enabled/cwd 参数）
    cc_import_skill,      // 新：导入 skill
    cc_enable_skill,      // 新：启用 skill
    cc_disable_skill,     // 新：禁用 skill
    cc_toggle_skill,      // 新：切换启用/禁用
    cc_get_skill_metadata, // 新：读取 SKILL.md frontmatter
};
