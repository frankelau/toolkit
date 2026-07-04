use base64::{engine::general_purpose::STANDARD, Engine};
use std::process::Command;
use std::sync::Mutex;

mod proxy;
use proxy::{ProxyState, start_http_proxy, stop_http_proxy, get_proxy_status, update_proxy_rules, resume_breakpoint, BreakpointRegistry};

mod cc_agent;
use cc_agent::{
    SessionManager, cc_start_session, cc_send_message, cc_abort_session, cc_get_history,
    cc_list_claude_sessions, cc_list_files, cc_read_file, cc_check_engines,
    cc_permission_response, cc_list_skills, cc_get_context_usage, cc_ensure_bridge,
    // Phase 9: 后端能力补齐
    cc_rewind, cc_plan_response, cc_ask_user_response,
    cc_get_file_diff, cc_undo_file, cc_discard_all_files,
    cc_refresh_session_index, cc_search_sessions, cc_get_session_status,
    // 需求补齐：提示词增强
    cc_enhance_prompt,
    // Sprint F: 后端能力补齐（16 个新命令）
    cc_get_project_config, cc_save_project_config,
    cc_list_prompt_templates, cc_save_prompt_template, cc_delete_prompt_template,
    cc_check_dependencies,
    cc_get_settings, cc_save_settings,
    cc_list_mcp_servers, cc_add_mcp_server, cc_remove_mcp_server, cc_get_mcp_tools,
    cc_get_input_history, cc_add_input_history, cc_clear_input_history,
    cc_get_usage_stats, cc_push_usage_record, cc_reset_usage_stats,
    cc_set_permission_mode,
    cc_list_tabs, cc_switch_tab,
    cc_convert_to_codex_format, cc_convert_from_codex_format,
    cc_create_skill, cc_delete_skill,
    cc_list_all_skills, cc_import_skill, cc_enable_skill,
    cc_disable_skill, cc_toggle_skill, cc_get_skill_metadata,
    cc_get_changelog,
    // Sprint Final F1: handler command 包装
    cc_build_file_tree, cc_get_directory_stats, cc_diff_texts, cc_compute_line_diff,
    cc_collect_workspace_context, cc_get_session_stats, cc_delete_session_by_id,
    cc_list_handlers,
    // Sprint Final F2: session health 命令
    cc_session_health,
    // Sprint Final F2: ProviderRuntime state
    create_provider_runtime,
    // Sprint B3: bridge_commands (57 个桥接命令)
    cc_get_streaming_enabled, cc_set_streaming_enabled,
    cc_get_thinking_enabled, cc_set_thinking_enabled,
    cc_get_auto_open_file_enabled, cc_set_auto_open_file_enabled,
    cc_get_send_shortcut, cc_set_send_shortcut,
    cc_get_codex_sandbox_mode, cc_set_codex_sandbox_mode,
    cc_set_codex_fast_mode,
    cc_get_mode, cc_set_mode, cc_set_model, cc_set_reasoning_effort,
    cc_get_permission_dialog_timeout, cc_set_permission_dialog_timeout,
    cc_set_diff_expanded_by_default, cc_set_history_completion_enabled,
    cc_set_commit_generation_enabled, cc_set_ai_title_generation_enabled,
    cc_get_node_path, cc_save_node_path,
    cc_get_claude_cli_path, cc_save_claude_cli_path,
    cc_get_working_directory, cc_save_working_directory,
    cc_get_commit_prompt, cc_save_commit_prompt, cc_save_project_commit_prompt,
    cc_open_file, cc_open_external_url, cc_resolve_file_path,
    cc_get_node_processes, cc_kill_node_process, cc_kill_all_orphans, cc_restart_node_daemon,
    cc_get_codex_subscription_quota,
    cc_get_dependency_status,
    cc_deep_search_history,
    cc_toggle_mcp_server,
    cc_get_providers, cc_add_provider, cc_update_provider, cc_delete_provider,
    cc_get_active_provider, cc_set_provider, cc_switch_provider,
    cc_get_agents, cc_add_agent, cc_update_agent, cc_delete_agent,
    cc_get_selected_agent, cc_set_selected_agent,
    cc_get_prompts, cc_add_prompt, cc_update_prompt, cc_delete_prompt,
    // Sprint B4: SDK 自动检测 + 下载安装
    SdkManagerState,
    cc_check_node_environment, cc_get_all_sdk_status,
    cc_is_sdk_installed, cc_get_sdk_version,
    cc_install_sdk, cc_uninstall_sdk, cc_get_install_progress,
    // B5: 交互式Diff + Git + 子Agent历史 + Provider导入导出
    cc_apply_diff_changes, cc_reject_diff_changes,
    cc_generate_commit_message, cc_get_git_status,
    // B9 IDEA级Git管理
    cc_get_git_changes, cc_stage_file, cc_unstage_file, cc_stage_all,
    cc_revert_file, cc_get_git_file_diff, cc_get_git_branches,
    cc_create_branch, cc_checkout_branch, cc_git_commit,
    cc_git_pull, cc_git_push, cc_git_fetch, cc_get_git_log,
    cc_get_subagent_history, cc_export_session, cc_delete_sessions,
    cc_export_providers, cc_import_providers, cc_reorder_providers,
    // B6: 斜杠命令 + Node检测 + 环境配置 + Codex历史
    cc_list_slash_commands, cc_detect_node_installations,
    cc_configure_bridge_env, cc_parse_codex_history,
    // B7: 条件Skill + 重放去重 + npm修复 + Bridge解压 + 模型验证 + 最近文件
    cc_filter_skills_by_context, cc_deduplicate_messages,
    cc_fix_npm_permissions, cc_verify_bridge_integrity, cc_extract_bridge,
    cc_verify_api_key, cc_list_available_models, cc_get_recent_files,
    // network 请求日志
    NetworkLogState,
    cc_get_network_log, cc_clear_network_log, cc_get_network_stats,
};

mod https_proxy;
use https_proxy::{CaManager, get_or_create_ca};

mod switchhosts;
use switchhosts::{read_hosts, apply_hosts, preview_hosts, read_system_hosts};

#[cfg(target_os = "macos")]
const CAP_PATH: &str = "/tmp/desktool_cap.png";
#[cfg(target_os = "macos")]
const OCR_SRC: &str = "/tmp/desktool_ocr.swift";
#[cfg(target_os = "macos")]
const OCR_BIN: &str = "/tmp/desktool_ocr_bin";
#[cfg(target_os = "macos")]
const SCROLL_SRC: &str = "/tmp/desktool_scroll.swift";
#[cfg(target_os = "macos")]
const SCROLL_BIN: &str = "/tmp/desktool_scroll_bin";

#[cfg(target_os = "windows")]
fn tmp(name: &str) -> String {
    std::env::temp_dir().join(name).to_string_lossy().replace('\\', "/").to_string()
}

#[cfg(target_os = "windows")]
fn run_ps(script: &str) -> Result<std::process::Output, String> {
    Command::new("powershell")
        .args(["-NoProfile", "-ExecutionPolicy", "Bypass", "-Command", script])
        .output()
        .map_err(|e| e.to_string())
}

// 选区 + 滚动截图 Swift 程序：拖拽选区后在该区域循环「截图 + 向下滚动」
#[cfg(target_os = "macos")]
const SCROLL_SWIFT: &str = r#"import AppKit

let argv = CommandLine.arguments
let frames = argv.count > 1 ? (Int(argv[1]) ?? 8) : 8
let delayMs = argv.count > 2 ? (Int(argv[2]) ?? 350) : 350

final class SelectionView: NSView {
    var start: NSPoint?
    var current: NSPoint?
    var onDone: ((NSRect) -> Void)?
    override var acceptsFirstResponder: Bool { true }
    override func draw(_ dirtyRect: NSRect) {
        NSColor(white: 0, alpha: 0.25).setFill()
        bounds.fill()
        guard let s = start, let c = current else { return }
        let r = NSRect(x: min(s.x, c.x), y: min(s.y, c.y),
                       width: abs(s.x - c.x), height: abs(s.y - c.y))
        NSColor(white: 1, alpha: 0.12).setFill()
        r.fill()
        NSColor.controlAccentColor.setStroke()
        let path = NSBezierPath(rect: r)
        path.lineWidth = 2
        path.stroke()
    }
    override func mouseDown(with e: NSEvent) {
        start = convert(e.locationInWindow, from: nil)
        current = start
        needsDisplay = true
    }
    override func mouseDragged(with e: NSEvent) {
        current = convert(e.locationInWindow, from: nil)
        needsDisplay = true
    }
    override func mouseUp(with e: NSEvent) {
        guard let s = start, let c = current else { return }
        let r = NSRect(x: min(s.x, c.x), y: min(s.y, c.y),
                       width: abs(s.x - c.x), height: abs(s.y - c.y))
        onDone?(r)
    }
    override func keyDown(with e: NSEvent) {
        if e.keyCode == 53 { onDone?(.zero) }
    }
}

let app = NSApplication.shared
app.setActivationPolicy(.accessory)
guard let screen = NSScreen.main else { exit(2) }
let win = NSWindow(contentRect: screen.frame, styleMask: .borderless,
                   backing: .buffered, defer: false)
win.level = .screenSaver
win.backgroundColor = .clear
win.isOpaque = false
win.ignoresMouseEvents = false
let view = SelectionView(frame: NSRect(origin: .zero, size: screen.frame.size))
win.contentView = view
win.makeKeyAndOrderFront(nil)
app.activate(ignoringOtherApps: true)
let scale = screen.backingScaleFactor

view.onDone = { rect in
    win.orderOut(nil)
    if rect.width < 5 || rect.height < 5 {
        FileHandle.standardError.write("cancelled\n".data(using: .utf8)!)
        exit(1)
    }
    let gx = screen.frame.origin.x + rect.origin.x
    let topY = screen.frame.maxY - rect.maxY
    let region = "\(Int(gx)),\(Int(topY)),\(Int(rect.width)),\(Int(rect.height))"
    let cx = gx + rect.width / 2
    let cy = topY + rect.height / 2
    func capture(_ i: Int) {
        let p = Process()
        p.launchPath = "/usr/sbin/screencapture"
        p.arguments = ["-x", "-R", region, "/tmp/desktool_scroll_\(i).png"]
        p.launch(); p.waitUntilExit()
    }
    func scroll() {
        let move = CGEvent(mouseEventSource: nil, mouseType: .mouseMoved,
                           mouseCursorPosition: CGPoint(x: cx, y: cy), mouseButton: .left)
        move?.post(tap: .cghidEventTap)
        usleep(50000)
        let lines = max(2, Int(rect.height / scale / 28))
        let ev = CGEvent(scrollWheelEvent2Source: nil, units: .line,
                         wheelCount: 1, wheel1: Int32(-lines), wheel2: 0, wheel3: 0)
        ev?.post(tap: .cghidEventTap)
    }
    for i in 0..<frames {
        capture(i)
        if i < frames - 1 { scroll(); usleep(UInt32(delayMs) * 1000) }
    }
    print("\(frames) \(scale) \(Int(gx)) \(Int(topY)) \(Int(rect.width)) \(Int(rect.height))")
    exit(0)
}
app.run()
"#;

#[tauri::command]
fn greet(name: &str) -> String {
    format!("Hello, {}! You've been greeted from Rust!", name)
}

#[tauri::command]
async fn show_main_window(window: tauri::Window) {
    let _ = window.show();
}

#[tauri::command]
fn get_ca_cert_pem(state: tauri::State<'_, std::sync::Mutex<Option<std::sync::Arc<CaManager>>>>) -> Result<String, String> {
    let ca = state.lock().map_err(|e| e.to_string())?;
    if let Some(ref cm) = *ca {
        Ok(cm.ca_cert_pem())
    } else {
        Err("CA not initialized".into())
    }
}

#[tauri::command]
fn init_ca(state: tauri::State<'_, std::sync::Mutex<Option<std::sync::Arc<CaManager>>>>) -> Result<String, String> {
    let cm = get_or_create_ca()?;
    let pem = cm.ca_cert_pem();
    let mut ca_state = state.lock().map_err(|e| e.to_string())?;
    *ca_state = Some(cm);
    Ok(pem)
}

// ── macOS ────────────────────────────────────────────────────────────────────

#[cfg(target_os = "macos")]
#[tauri::command]
async fn take_screenshot(interactive: bool) -> Result<String, String> {
    let _ = std::fs::remove_file(CAP_PATH);
    let mut cmd = Command::new("screencapture");
    if interactive { cmd.arg("-i"); }
    cmd.arg(CAP_PATH);
    cmd.status().map_err(|e| e.to_string())?;
    let bytes = std::fs::read(CAP_PATH).map_err(|_| "截图已取消".to_string())?;
    Ok(format!("data:image/png;base64,{}", STANDARD.encode(&bytes)))
}

#[cfg(target_os = "macos")]
#[tauri::command]
async fn ocr_image() -> Result<String, String> {
    if !std::path::Path::new(OCR_BIN).exists() {
        std::fs::write(OCR_SRC, r#"import Vision
import AppKit
let p = CommandLine.arguments[1]
guard let img = NSImage(contentsOfFile: p),
      let cg = img.cgImage(forProposedRect: nil, context: nil, hints: nil) else { exit(1) }
let req = VNRecognizeTextRequest()
req.recognitionLevel = .accurate
req.recognitionLanguages = ["zh-Hans", "en-US"]
req.usesLanguageCorrection = true
try? VNImageRequestHandler(cgImage: cg, options: [:]).perform([req])
print((req.results ?? []).compactMap { $0.topCandidates(1).first?.string }.joined(separator: "\n"))
"#).map_err(|e| e.to_string())?;
        let compile = Command::new("swiftc").args(["-O", OCR_SRC, "-o", OCR_BIN]).output()
            .map_err(|e| format!("编译 OCR 程序失败：{e}（需安装 Xcode Command Line Tools）"))?;
        if !compile.status.success() {
            return Err(String::from_utf8_lossy(&compile.stderr).into());
        }
    }
    let out = Command::new(OCR_BIN).arg(CAP_PATH).output().map_err(|e| e.to_string())?;
    if !out.status.success() { return Err(String::from_utf8_lossy(&out.stderr).into()); }
    Ok(String::from_utf8_lossy(&out.stdout).trim().to_string())
}

#[cfg(target_os = "macos")]
#[tauri::command]
async fn record_screen() -> Result<String, String> {
    let ts = std::time::SystemTime::now().duration_since(std::time::UNIX_EPOCH).unwrap().as_secs();
    let path = format!("/tmp/desktool_rec_{ts}.mov");
    Command::new("screencapture").args(["-v", &path]).status().map_err(|e| e.to_string())?;
    if std::path::Path::new(&path).exists() { Ok(path) } else { Err("录制已取消".into()) }
}

#[cfg(target_os = "macos")]
#[tauri::command]
async fn scroll_capture(frames: u32, delay_ms: u32) -> Result<Vec<String>, String> {
    for i in 0..100 { let _ = std::fs::remove_file(format!("/tmp/desktool_scroll_{i}.png")); }
    if !std::path::Path::new(SCROLL_BIN).exists() {
        std::fs::write(SCROLL_SRC, SCROLL_SWIFT).map_err(|e| e.to_string())?;
        let compile = Command::new("swiftc").args(["-O", SCROLL_SRC, "-o", SCROLL_BIN]).output()
            .map_err(|e| format!("编译滚动截图程序失败：{e}（需安装 Xcode Command Line Tools）"))?;
        if !compile.status.success() { return Err(String::from_utf8_lossy(&compile.stderr).into()); }
    }
    let out = Command::new(SCROLL_BIN).args([frames.to_string(), delay_ms.to_string()]).output()
        .map_err(|e| e.to_string())?;
    if !out.status.success() {
        let err = String::from_utf8_lossy(&out.stderr);
        return Err(if err.contains("cancelled") { "已取消".into() } else { format!("滚动截图失败：{err}") });
    }
    let stdout = String::from_utf8_lossy(&out.stdout);
    let actual: usize = stdout.split_whitespace().next().and_then(|s| s.parse().ok()).unwrap_or(frames as usize);
    let mut urls = Vec::new();
    for i in 0..actual {
        if let Ok(bytes) = std::fs::read(format!("/tmp/desktool_scroll_{i}.png")) {
            urls.push(format!("data:image/png;base64,{}", STANDARD.encode(&bytes)));
        }
    }
    if urls.is_empty() { return Err("未捕获到任何帧".into()); }
    Ok(urls)
}

// ── Windows ──────────────────────────────────────────────────────────────────

#[cfg(target_os = "windows")]
#[tauri::command]
async fn take_screenshot(interactive: bool) -> Result<String, String> {
    let cap = tmp("desktool_cap.png");
    let _ = std::fs::remove_file(&cap);
    let script = if interactive {
        format!(r#"
Add-Type -AssemblyName System.Windows.Forms,System.Drawing
$vs=[System.Windows.Forms.SystemInformation]::VirtualScreen
$full=[System.Drawing.Bitmap]::new($vs.Width,$vs.Height)
$g=[System.Drawing.Graphics]::FromImage($full)
$g.CopyFromScreen($vs.Left,$vs.Top,0,0,$vs.Size);$g.Dispose()
$form=[System.Windows.Forms.Form]::new()
$form.FormBorderStyle='None';$form.Bounds=$vs;$form.TopMost=$true
$form.BackgroundImage=$full;$form.Cursor=[System.Windows.Forms.Cursors]::Cross;$form.KeyPreview=$true
$s=$null;$rect=$null
$form.Add_KeyDown({{if($_.KeyCode-eq'Escape'){{$form.Close()}}}})
$form.Add_MouseDown({{$script:s=$_.Location}})
$form.Add_MouseMove({{
    if($script:s){{
        $form.Refresh()
        $x=[Math]::Min($script:s.X,$_.Location.X);$y=[Math]::Min($script:s.Y,$_.Location.Y)
        $w=[Math]::Abs($_.Location.X-$script:s.X);$h=[Math]::Abs($_.Location.Y-$script:s.Y)
        if($w-gt0-and$h-gt0){{
            $g2=$form.CreateGraphics()
            $pen=[System.Drawing.Pen]::new([System.Drawing.Color]::Red,2)
            $g2.DrawRectangle($pen,$x,$y,$w,$h);$pen.Dispose();$g2.Dispose()
        }}
    }}
}})
$form.Add_MouseUp({{
    if($script:s){{
        $script:rect=[System.Drawing.Rectangle]::new(
            [Math]::Min($script:s.X,$_.Location.X),[Math]::Min($script:s.Y,$_.Location.Y),
            [Math]::Abs($_.Location.X-$script:s.X),[Math]::Abs($_.Location.Y-$script:s.Y))
        $form.Close()
    }}
}})
$form.ShowDialog()|Out-Null;$full.Dispose()
if($rect-and$rect.Width-gt5-and$rect.Height-gt5){{
    $bmp=[System.Drawing.Bitmap]::new($rect.Width,$rect.Height)
    $g3=[System.Drawing.Graphics]::FromImage($bmp)
    $g3.CopyFromScreen($vs.Left+$rect.X,$vs.Top+$rect.Y,0,0,$rect.Size)
    $bmp.Save('{cap}');$g3.Dispose();$bmp.Dispose()
}}else{{exit 1}}
"#, cap = cap.replace('/', "\\"))
    } else {
        format!(r#"
Add-Type -AssemblyName System.Windows.Forms,System.Drawing
$s=[System.Windows.Forms.Screen]::PrimaryScreen.Bounds
$b=[System.Drawing.Bitmap]::new($s.Width,$s.Height)
$g=[System.Drawing.Graphics]::FromImage($b)
$g.CopyFromScreen(0,0,0,0,$s.Size);$b.Save('{cap}');$g.Dispose();$b.Dispose()
"#, cap = cap.replace('/', "\\"))
    };
    let out = run_ps(&script)?;
    if !out.status.success() { return Err("截图已取消".into()); }
    let bytes = std::fs::read(&cap).map_err(|_| "截图已取消".to_string())?;
    Ok(format!("data:image/png;base64,{}", STANDARD.encode(&bytes)))
}

#[cfg(target_os = "windows")]
#[tauri::command]
async fn ocr_image() -> Result<String, String> {
    let cap = tmp("desktool_cap.png");
    // Windows path for PowerShell (backslashes)
    let cap_win = cap.replace('/', "\\");
    let script = format!(r#"
Add-Type -AssemblyName System.Runtime.WindowsRuntime
$null=[Windows.Media.Ocr.OcrEngine,Windows.Media.Ocr,ContentType=WindowsRuntime]
$null=[Windows.Storage.StorageFile,Windows.Storage,ContentType=WindowsRuntime]
$null=[Windows.Graphics.Imaging.BitmapDecoder,Windows.Graphics.Imaging,ContentType=WindowsRuntime]
function Await($task,$type){{
    $m=([System.WindowsRuntimeSystemExtensions].GetMethods()|?{{$_.Name-eq'AsTask'-and$_.GetParameters().Count-eq1-and$_.GetParameters()[0].ParameterType.Name-eq'IAsyncOperation`1'}})[0]
    $t=$m.MakeGenericMethod($type);$n=$t.Invoke($null,@($task));$n.Wait(-1)|Out-Null;$n.Result
}}
$f=Await([Windows.Storage.StorageFile]::GetFileFromPathAsync('{cap}'))([Windows.Storage.StorageFile])
$s=Await($f.OpenAsync([Windows.Storage.FileAccessMode]::Read))([Windows.Storage.Streams.IRandomAccessStream])
$d=Await([Windows.Graphics.Imaging.BitmapDecoder]::CreateAsync($s))([Windows.Graphics.Imaging.BitmapDecoder])
$b=Await($d.GetSoftwareBitmapAsync())([Windows.Graphics.Imaging.SoftwareBitmap])
$e=[Windows.Media.Ocr.OcrEngine]::TryCreateFromUserProfileLanguages()
$r=Await($e.RecognizeAsync($b))([Windows.Media.Ocr.OcrResult])
$r.Lines|%{{$_.Text}}
"#, cap = cap_win);
    let out = run_ps(&script)?;
    if !out.status.success() { return Err(String::from_utf8_lossy(&out.stderr).trim().to_string()); }
    Ok(String::from_utf8_lossy(&out.stdout).trim().to_string())
}

#[cfg(target_os = "windows")]
#[tauri::command]
async fn record_screen() -> Result<String, String> {
    // Try ffmpeg if available; otherwise report unsupported
    let ts = std::time::SystemTime::now().duration_since(std::time::UNIX_EPOCH).unwrap().as_secs();
    let path = tmp(&format!("desktool_rec_{ts}.mp4")).replace('/', "\\");
    let out = Command::new("ffmpeg")
        .args(["-f", "gdigrab", "-framerate", "30", "-i", "desktop", "-t", "60", "-y", &path])
        .output();
    match out {
        Ok(_) if std::path::Path::new(&path).exists() => Ok(path),
        Ok(o) => Err(String::from_utf8_lossy(&o.stderr).lines().last().unwrap_or("录制失败").to_string()),
        Err(_) => Err("录制需要安装 ffmpeg（https://ffmpeg.org）".into()),
    }
}

#[cfg(target_os = "windows")]
#[tauri::command]
async fn scroll_capture(frames: u32, delay_ms: u32) -> Result<Vec<String>, String> {
    let tmp_dir = std::env::temp_dir().to_string_lossy().replace('\\', "/");
    for i in 0..100 { let _ = std::fs::remove_file(tmp(&format!("desktool_scroll_{i}.png"))); }
    let script = format!(r#"
Add-Type -AssemblyName System.Windows.Forms,System.Drawing
Add-Type -TypeDefinition @"
using System;using System.Runtime.InteropServices;
public class WinInput{{
[DllImport("user32.dll")]public static extern bool SetCursorPos(int x,int y);
[DllImport("user32.dll")]public static extern void mouse_event(uint f,int dx,int dy,int d,int e);
public const uint WHEEL=0x0800;}}
"@
$vs=[System.Windows.Forms.SystemInformation]::VirtualScreen
$full=[System.Drawing.Bitmap]::new($vs.Width,$vs.Height)
$g=[System.Drawing.Graphics]::FromImage($full)
$g.CopyFromScreen($vs.Left,$vs.Top,0,0,$vs.Size);$g.Dispose()
$form=[System.Windows.Forms.Form]::new()
$form.FormBorderStyle='None';$form.Bounds=$vs;$form.TopMost=$true
$form.BackgroundImage=$full;$form.Cursor=[System.Windows.Forms.Cursors]::Cross;$form.KeyPreview=$true
$s=$null;$rect=$null
$form.Add_KeyDown({{if($_.KeyCode-eq'Escape'){{$form.Close()}}}})
$form.Add_MouseDown({{$script:s=$_.Location}})
$form.Add_MouseMove({{
    if($script:s){{
        $form.Refresh()
        $x=[Math]::Min($script:s.X,$_.Location.X);$y=[Math]::Min($script:s.Y,$_.Location.Y)
        $w=[Math]::Abs($_.Location.X-$script:s.X);$h=[Math]::Abs($_.Location.Y-$script:s.Y)
        if($w-gt0-and$h-gt0){{
            $g2=$form.CreateGraphics()
            $pen=[System.Drawing.Pen]::new([System.Drawing.Color]::Red,2)
            $g2.DrawRectangle($pen,$x,$y,$w,$h);$pen.Dispose();$g2.Dispose()
        }}
    }}
}})
$form.Add_MouseUp({{
    if($script:s){{
        $script:rect=[System.Drawing.Rectangle]::new(
            [Math]::Min($script:s.X,$_.Location.X),[Math]::Min($script:s.Y,$_.Location.Y),
            [Math]::Abs($_.Location.X-$script:s.X),[Math]::Abs($_.Location.Y-$script:s.Y))
        $form.Close()
    }}
}})
$form.ShowDialog()|Out-Null;$full.Dispose()
if(!$rect-or$rect.Width-le5-or$rect.Height-le5){{exit 1}}
$rx=$vs.Left+$rect.X;$ry=$vs.Top+$rect.Y
$cx=[int]($rx+$rect.Width/2);$cy=[int]($ry+$rect.Height/2)
for($i=0;$i-lt{frames};$i++){{
    $bmp=[System.Drawing.Bitmap]::new($rect.Width,$rect.Height)
    $g3=[System.Drawing.Graphics]::FromImage($bmp)
    $g3.CopyFromScreen($rx,$ry,0,0,$rect.Size)
    $bmp.Save('{tmp_dir}\desktool_scroll_'+$i+'.png');$g3.Dispose();$bmp.Dispose()
    if($i-lt{frames_minus1}){{
        [WinInput]::SetCursorPos($cx,$cy);Start-Sleep -Milliseconds 50
        [WinInput]::mouse_event([WinInput]::WHEEL,0,0,-360,0)
        Start-Sleep -Milliseconds {delay_ms}
    }}
}}
Write-Output "{frames}"
"#,
        frames = frames,
        frames_minus1 = frames.saturating_sub(1),
        delay_ms = delay_ms,
        tmp_dir = tmp_dir.trim_end_matches('/'),
    );
    let out = run_ps(&script)?;
    if !out.status.success() {
        let err = String::from_utf8_lossy(&out.stderr);
        return Err(if err.trim().is_empty() { "已取消".into() } else { format!("滚动截图失败：{err}") });
    }
    let mut urls = Vec::new();
    for i in 0..frames {
        if let Ok(bytes) = std::fs::read(tmp(&format!("desktool_scroll_{i}.png"))) {
            urls.push(format!("data:image/png;base64,{}", STANDARD.encode(&bytes)));
        }
    }
    if urls.is_empty() { return Err("未捕获到任何帧".into()); }
    Ok(urls)
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_http::init())
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_fs::init())
        .invoke_handler(tauri::generate_handler![
            greet,
            show_main_window,
            take_screenshot,
            ocr_image,
            record_screen,
            scroll_capture,
            start_http_proxy,
            stop_http_proxy,
            get_proxy_status,
            update_proxy_rules,
            resume_breakpoint,
            read_hosts,
            apply_hosts,
            preview_hosts,
            read_system_hosts,
            get_ca_cert_pem,
            init_ca,
            cc_start_session,
            cc_send_message,
            cc_abort_session,
            cc_get_history,
            cc_list_claude_sessions,
            cc_list_files,
            cc_read_file,
            cc_check_engines,
            cc_permission_response,
            cc_list_skills,
            cc_get_context_usage,
            cc_ensure_bridge,
            // Phase 9: 后端能力补齐
            cc_rewind,
            cc_plan_response,
            cc_ask_user_response,
            cc_get_file_diff,
            cc_undo_file,
            cc_discard_all_files,
            cc_refresh_session_index,
            cc_search_sessions,
            cc_get_session_status,
            cc_enhance_prompt,
            // Sprint F: 16 个新命令
            cc_get_project_config,
            cc_save_project_config,
            cc_list_prompt_templates,
            cc_save_prompt_template,
            cc_delete_prompt_template,
            cc_check_dependencies,
            cc_get_settings,
            cc_save_settings,
            cc_list_mcp_servers,
            cc_add_mcp_server,
            cc_remove_mcp_server,
            cc_get_mcp_tools,
            cc_get_input_history,
            cc_add_input_history,
            cc_clear_input_history,
            cc_get_usage_stats,
            cc_push_usage_record,
            cc_reset_usage_stats,
            cc_set_permission_mode,
            cc_list_tabs,
            cc_switch_tab,
            cc_convert_to_codex_format,
            cc_convert_from_codex_format,
            cc_create_skill,
            cc_delete_skill,
            cc_list_all_skills,
            cc_import_skill,
            cc_enable_skill,
            cc_disable_skill,
            cc_toggle_skill,
            cc_get_skill_metadata,
            cc_get_changelog,
            // Sprint Final F1: handler command 包装
            cc_build_file_tree,
            cc_get_directory_stats,
            cc_diff_texts,
            cc_compute_line_diff,
            cc_collect_workspace_context,
            cc_get_session_stats,
            cc_delete_session_by_id,
            cc_list_handlers,
            // Sprint Final F2: session health
            cc_session_health,
            // Sprint B3: bridge_commands (57 个桥接命令)
            cc_get_streaming_enabled, cc_set_streaming_enabled,
            cc_get_thinking_enabled, cc_set_thinking_enabled,
            cc_get_auto_open_file_enabled, cc_set_auto_open_file_enabled,
            cc_get_send_shortcut, cc_set_send_shortcut,
            cc_get_codex_sandbox_mode, cc_set_codex_sandbox_mode,
            cc_set_codex_fast_mode,
            cc_get_mode, cc_set_mode, cc_set_model, cc_set_reasoning_effort,
            cc_get_permission_dialog_timeout, cc_set_permission_dialog_timeout,
            cc_set_diff_expanded_by_default, cc_set_history_completion_enabled,
            cc_set_commit_generation_enabled, cc_set_ai_title_generation_enabled,
            cc_get_node_path, cc_save_node_path,
            cc_get_claude_cli_path, cc_save_claude_cli_path,
            cc_get_working_directory, cc_save_working_directory,
            cc_get_commit_prompt, cc_save_commit_prompt, cc_save_project_commit_prompt,
            cc_open_file, cc_open_external_url, cc_resolve_file_path,
            cc_get_node_processes, cc_kill_node_process, cc_kill_all_orphans, cc_restart_node_daemon,
            cc_get_codex_subscription_quota,
            cc_get_dependency_status,
            cc_deep_search_history,
            cc_toggle_mcp_server,
            cc_get_providers, cc_add_provider, cc_update_provider, cc_delete_provider,
            cc_get_active_provider, cc_set_provider, cc_switch_provider,
            cc_get_agents, cc_add_agent, cc_update_agent, cc_delete_agent,
            cc_get_selected_agent, cc_set_selected_agent,
            cc_get_prompts, cc_add_prompt, cc_update_prompt, cc_delete_prompt,
            // Sprint B4: SDK 自动检测 + 下载安装
            cc_check_node_environment, cc_get_all_sdk_status,
            cc_is_sdk_installed, cc_get_sdk_version,
            cc_install_sdk, cc_uninstall_sdk, cc_get_install_progress,
            // B5: 交互式Diff + Git提交消息 + 子Agent历史 + Provider导入导出/排序
            cc_apply_diff_changes, cc_reject_diff_changes,
            cc_generate_commit_message, cc_get_git_status,
    // B9 IDEA级Git管理
    cc_get_git_changes, cc_stage_file, cc_unstage_file, cc_stage_all,
    cc_revert_file, cc_get_git_file_diff, cc_get_git_branches,
    cc_create_branch, cc_checkout_branch, cc_git_commit,
    cc_git_pull, cc_git_push, cc_git_fetch, cc_get_git_log,
            cc_get_subagent_history, cc_export_session, cc_delete_sessions,
            cc_export_providers, cc_import_providers, cc_reorder_providers,
            // B6: 斜杠命令 + Node检测 + 环境配置 + Codex历史
            cc_list_slash_commands, cc_detect_node_installations,
            cc_configure_bridge_env, cc_parse_codex_history,
            // B7: 条件Skill + 重放去重 + npm修复 + Bridge解压 + 模型验证 + 最近文件
            cc_filter_skills_by_context, cc_deduplicate_messages,
            cc_fix_npm_permissions, cc_verify_bridge_integrity, cc_extract_bridge,
            cc_verify_api_key, cc_list_available_models, cc_get_recent_files,
            // network 请求日志
            cc_get_network_log, cc_clear_network_log, cc_get_network_stats,
        ])
        .manage(Mutex::new(ProxyState::new()))
        .manage(BreakpointRegistry::default())
        .manage::<std::sync::Mutex<Option<std::sync::Arc<CaManager>>>>(std::sync::Mutex::new(None))
        .manage(std::sync::Arc::new(SessionManager::default()))
        // Sprint Final F2: ProviderRuntime 注册到 app state
        .manage(create_provider_runtime())
        // Sprint B3: BridgeState 注册到 app state
        .manage(cc_agent::BridgeState::default())
        // Sprint B4: SdkManagerState 注册到 app state
        .manage(cc_agent::SdkManagerState::default())
        // network 请求日志
        .manage(cc_agent::NetworkLogState::default())
        .build(tauri::generate_context!())
        .expect("error while building tauri application")
        .run(|app_handle, event| {
            // 应用退出时清除系统代理，防止网络中断
            if let tauri::RunEvent::ExitRequested { .. } = event {
                crate::proxy::clear_system_proxy_on_exit();
                let _ = app_handle;
            }
        });
}
