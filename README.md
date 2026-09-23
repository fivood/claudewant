# 四维来客

一只四维生物（Clawd）掉进了一个无限展开的二维世界，从一片空白开始行动。像素挂机游戏，不需要操作。

- **网页版**：https://claude.70015.net
- **桌面版（桌宠）**：到 [Releases](https://github.com/fivood/claudewant/releases/latest) 下载 `SiweiLaike_*_x64-setup.exe`。Clawd 会住在任务栏上面来回走、说话；点它展开完整游戏，关掉窗口又缩回去。之后自动更新。
- **会话查看器**：https://claude.70015.net/viewer —— 把 AI 编程助手的会话记录变成能读的对话。

## 玩法

- Clawd 走到哪，纸面就展开到哪；展开的格子换成「感知」，它自己决定先长哪一块。
- **会话当种子**：开始时可以导入一段会话记录（Claude Code、Codex、Kimi Code、Antigravity 的记录，claude.ai / ChatGPT 的数据导出，或 OpenAI 格式的 messages）。对话会变成这张纸：读文件多的积成水，跑命令多的推成山，改文件多的长成森林，出过的错留成裂缝，你说过的话由居民念出来。文件只在本地读，不上传。
- **二维居民的历史**在载入时就由种子推演完了：人口、纪元（游荡 → 村落 → 城邦 → 几何 → 觉醒）、城镇、战争、神殿，直到它们离开纸面。同一段会话永远是同一部历史。四维生物能看见整条时间线，纪年里淡色的是还没发生的事。
- 右下角的电台是 WebAudio 现场合成的 lo-fi。

## 目录

```
web/          网页本体（纯静态，无构建）：index 开始页、game 游戏、viewer 会话查看器、parse.js 各家记录解析
src-tauri/    桌面版外壳（Tauri 2），前端直接用 web/
test.mjs      解析器测试
```

## 开发

```bash
node test.mjs                     # 测试
npx serve web                     # 本地看网页（任何静态服务器都行）
npm install && npx tauri dev      # 本地跑桌面版
```

发布网页：`wrangler pages deploy web --project-name=claude --branch=main`

发布桌面版：把 `src-tauri/tauri.conf.json`、`src-tauri/Cargo.toml`、`package.json` 里的版本号改成同一个新版本，提交后推一个 `v<版本号>` 标签，GitHub Actions 会打包并发布，已安装的客户端会自己更新。

## 许可

- 代码：MIT
- 字体：[Fusion Pixel Font](https://github.com/TakWolf/fusion-pixel-font)，SIL OFL 1.1（见 `web/fonts/LICENSE-OFL.txt`）
- Clawd 形象属于 Anthropic。这是一个粉丝作品，与 Anthropic 无关。
