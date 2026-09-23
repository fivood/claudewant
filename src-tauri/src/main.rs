// 前端就是 web/ 里的网页，桌宠逻辑也在 game.html 里；这里只负责开窗口和挂上更新插件。
#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

fn main() {
    tauri::Builder::default()
        .plugin(tauri_plugin_updater::Builder::new().build())
        .plugin(tauri_plugin_process::init())
        .run(tauri::generate_context!())
        .expect("四维来客启动失败");
}
