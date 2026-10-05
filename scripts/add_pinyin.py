#!/usr/bin/env python3
"""为 data/chapters/*.json 中每条中文经文生成逐字拼音 (py 字段)。

生成的 py 是与 zh 逐字对齐、以 | 分隔的字符串：
- 汉字 -> 带声调拼音（借助 pypinyin 的短语词典正确处理多音字）
- 标点/字母等非汉字 -> 原字符本身

（| 不会出现在拼音与经文文本中，用作分隔符可把每节拼音压缩成一行。）

用法：
    ./.venv/bin/python add_pinyin.py          # 仅更新缺失或变化的 py
    ./.venv/bin/python add_pinyin.py --force  # 全量重新生成
"""
import json
import sys
from pathlib import Path

from pypinyin import Style, pinyin

ROOT = Path(__file__).resolve().parent.parent
CHAPTERS_DIR = ROOT / "data" / "chapters"

HAN_RANGE = ("一", "鿿")


def is_han(ch: str) -> bool:
    return HAN_RANGE[0] <= ch <= HAN_RANGE[1]


def verse_pinyin(text: str) -> str:
    """返回与 text 逐字符对齐、| 分隔的拼音串（非汉字返回原字符）。"""
    tokens = pinyin(
        text,
        style=Style.TONE,
        heteronym=False,
        errors=lambda s: list(s),
    )
    flat = [t[0] if isinstance(t, list) else t for t in tokens]
    if len(flat) != len(text):
        raise ValueError(f"拼音与原文长度不一致: {len(flat)} vs {len(text)} | {text}")
    if any("|" in t for t in flat):
        raise ValueError(f"拼音 token 含分隔符 | : {text}")
    return "|".join(flat)


def main() -> int:
    force = "--force" in sys.argv
    files = sorted(CHAPTERS_DIR.glob("*.json"))
    if not files:
        print("未找到 data/chapters/*.json")
        return 1

    total_verses = 0
    changed_files = 0
    for f in files:
        book = json.loads(f.read_text(encoding="utf-8"))
        dirty = False
        for verses in (book.get("chapters") or {}).values():
            for v in verses:
                zh = v.get("zh") or ""
                if not zh:
                    continue
                py = verse_pinyin(zh)
                total_verses += 1
                if force or v.get("py") != py:
                    v["py"] = py
                    dirty = True
        if dirty:
            f.write_text(
                json.dumps(book, ensure_ascii=False, indent=2) + "\n",
                encoding="utf-8",
            )
            changed_files += 1

    print(f"共处理 {len(files)} 卷书，{total_verses} 节经文；更新 {changed_files} 个文件")

    # 同步再生成可供 <script> 标签加载的 .js 版本（file:// 直开页面用）
    try:
        sys.path.insert(0, str(Path(__file__).resolve().parent))
        from gen_js_data import gen_chapter_js
        for f in files:
            gen_chapter_js(f)
    except Exception as e:
        print(f"警告：章节 .js 再生成失败（可手动运行 scripts/gen_js_data.py）: {e}")
    return 0


if __name__ == "__main__":
    sys.exit(main())
