# 中英双语对照圣经阅读器 (和合本 CUV & NIV 1984 经典版)

典雅的中英双语圣经研读工具，精选中文简体和合本 (CUV) 与经典 1984 年版新国际版 (NIV 1984)，集成纯前端高质量英文朗读与跟随高亮、并排与穿插对照双排版模式。

## 🌟 核心特性

1. **原汁原味权威版本**：
   - **中文**：经典和合本（Chinese Union Version）
   - **英文**：经典的 1984 版新国际版（NIV 1984，来自 [christunite.com](https://www.christunite.com/index.php/bible/niv-1984-bible-pdf)），每卷均提供官方原版 PDF 直达查阅与下载入口。
2. **专业双语对照排版**：
   - **左右双栏对照（Side-by-Side）**：经文逐节精准水平对齐，适合大屏深度比对研读。
   - **上下逐节穿插（Interlinear）**：中文在上、英文在下紧随其后，适合沉浸式逐句精读。
   - **中文拼音大字版（Pinyin / Senior）**：仅显示中文，逐字上标拼音（多音字按语境正确处理），默认更大字号并配有右下角悬浮「放大 / 缩小」按钮，字号可在更大范围内调节（1.0x–2.8x），适合长辈阅读。
3. **英文智能语音朗读 (Audio Read-Aloud)**：
   - 采用 Web Speech API 零依赖本地运行，无缝调用系统高质量英文语音（Google US English, Samantha, Daniel 等）。
   - **单节点播**：点击任意经文右侧小喇叭即可精准朗读该句。
   - **整章连续播放**：底部悬浮控制台一键播放，句子间自然停顿过渡。
   - **卡拉OK跟随高亮**：朗读时当前节自动呈金色发光轮廓，并平滑滚动到屏幕中央。
   - **语速调节**：支持 0.75x、1.0x、1.2x、1.5x 语速。
4. **典雅视觉设计系统**：
   - 三款精美主题：**经典羊皮纸 (Parchment)**、**清新日间 (Light)**、**沉思黑夜 (Dark)**。
   - 经文字号一键无级缩放（A- / A+）。
   - 抽屉式卷目目录：旧约（39卷）、新约（27卷）分类清晰，支持中英文名称即时搜索。

## 🚀 启动与使用

### 方法 1：一键脚本启动
```bash
cd "03_软件尝试与原型实验/bilingual-bible"
./run.sh
```
浏览器将自动打开 `http://localhost:8123` 即可畅读。

### 方法 2：Python 内置服务器
```bash
cd "03_软件尝试与原型实验/bilingual-bible"
python3 -m http.server 8123
```
打开浏览器访问：`http://localhost:8123`

### 方法 3：直接双击打开
直接双击 `index.html` 也可阅读全部经文（数据会通过 `<script>` 标签自动降级加载）。

## 📂 项目结构
```text
bilingual-bible/
├── index.html            # 主阅读器页面
├── css/
│   ├── style.css         # 布局与交互控制样式
│   └── typography.css    # 经文专业排版与主题系统
├── js/
│   ├── app.js            # 核心业务交互（抽屉、视图、主题、字号）
│   ├── audio-player.js   # 英文朗读引擎（Web Speech API 与跟随高亮）
│   └── bible-data.js     # 数据管理与缓存层
├── data/
│   ├── books-meta.json   # 66卷圣经完整元数据与 PDF 链接（另有同名 .js 供 file:// 加载）
│   └── chapters/         # 双语对齐的章节经文（.json 供 fetch；同名 .js 供 file:// script 标签加载）
└── scripts/
    ├── fetch_and_align.py# 自动从 christunite 抓取并与和合本对齐的脚本
    ├── add_pinyin.py     # 为每条中文经文生成逐字拼音 py 字段（依赖 pypinyin，venv 在 scripts/.venv）
    └── gen_js_data.py    # 由 *.json 生成可供 <script> 标签加载的同名 .js
```
