#!/usr/bin/env python3
"""把 data/*.json 转成可通过 <script> 标签加载的 .js 版本。

浏览器在 file:// 协议下会拦截 fetch()，导致双击打开 index.html 时
经文无法加载；<script src> 不受此限制，生成的 .js 作为兜底数据源。

用法：
    python3 gen_js_data.py            # 仅更新内容有变化的文件
"""
import json
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
DATA_DIR = ROOT / "data"
CHAPTERS_DIR = DATA_DIR / "chapters"


def write_if_changed(path: Path, content: str) -> bool:
    if path.exists() and path.read_text(encoding="utf-8") == content:
        return False
    path.write_text(content, encoding="utf-8")
    return True


def gen_chapter_js(json_path: Path) -> bool:
    """为单个章节 json 生成同名 .js，返回是否有更新。"""
    slug = json_path.stem
    book = json.loads(json_path.read_text(encoding="utf-8"))
    content = (
        f"// Auto-generated from {slug}.json — 请勿手改，改动请改 json 后运行 scripts/gen_js_data.py\n"
        "window.BIBLE_CHAPTER_DATA = window.BIBLE_CHAPTER_DATA || {};\n"
        f'window.BIBLE_CHAPTER_DATA["{slug}"] = '
        + json.dumps(book, ensure_ascii=False)
        + ";\n"
    )
    return write_if_changed(json_path.with_suffix(".js"), content)


def main() -> int:
    changed = 0

    # 卷目元数据
    meta_path = DATA_DIR / "books-meta.json"
    if meta_path.exists():
        meta = json.loads(meta_path.read_text(encoding="utf-8"))
        content = (
            "// Auto-generated from books-meta.json — 请勿手改\n"
            "window.BIBLE_BOOKS_META = "
            + json.dumps(meta, ensure_ascii=False)
            + ";\n"
        )
        changed += write_if_changed(DATA_DIR / "books-meta.js", content)

    # 章节经文
    files = sorted(CHAPTERS_DIR.glob("*.json"))
    for f in files:
        changed += gen_chapter_js(f)

    print(f"已生成 books-meta.js + {len(files)} 个章节 .js（更新 {changed} 个）")
    return 0


if __name__ == "__main__":
    sys.exit(main())
