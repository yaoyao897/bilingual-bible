#!/usr/bin/env python3
"""清理抓取残留的网页垃圾。

christunite.com 每卷是一整页 HTML，正文结束后跟着分享按钮、
Facebook/Twitter/LinkedIn 延迟加载脚本和 AdSense 代码。旧解析器
只剥掉 HTML 标签、却保留了 <script>/<style> 的文本内容，导致
每卷最后一节的英文末尾混入大段代码；另有零星 HTML 实体残留
（如出埃及记 5:20 的 &lt;）。此外 CUV 源数据在个别经文里带有
成对花括号标记 { }，一并清理（zh 与 py 同步）。

用法：
    python3 clean_scraped_junk.py        # 之后运行 gen_js_data.py 重新生成 .js
"""
import json
import re
from pathlib import Path

CHAPTERS_DIR = Path(__file__).resolve().parent.parent / "data" / "chapters"

# 经文之后出现的垃圾起点，取最早出现者截断
JUNK_MARKERS = [
    "var loadAsyncDeferred",
    "Share With Others",
    "adsbygoogle",
    "&nbsp;",
    "&copy;",
    "&amp;",
]

# 截断后仍可能残留的孤立 HTML 实体（多为标签剥离后的尾巴）
ENTITY_TAIL = re.compile(r"(?:\s*&[a-zA-Z#0-9]+;)+\s*$")
STRAY_ENTITY = re.compile(r"&(?:lt|gt|nbsp);")

CJK = r"一-鿿，。！？；：“”‘’（）《》、─·"
CJK_SPACE = re.compile(rf"(?<=[{CJK}])\s+(?=[{CJK}])")

SENTENCE_END = tuple('.!?"’”\'):;')


def clean_en(en: str) -> str:
    cut = len(en)
    for marker in JUNK_MARKERS:
        pos = en.find(marker)
        if pos != -1:
            cut = min(cut, pos)
    en = ENTITY_TAIL.sub("", en[:cut])
    en = STRAY_ENTITY.sub("", en)
    return " ".join(en.split()).strip()


def clean_zh(zh: str) -> str:
    if "{" not in zh and "}" not in zh:
        return zh
    zh = zh.replace("{", "").replace("}", "")
    zh = CJK_SPACE.sub("", zh)
    return zh.strip()


def clean_py(py: str) -> str:
    if "{" not in py and "}" not in py:
        return py
    out = []
    for tok in py.split("|"):
        if tok in ("{", "}"):
            continue
        if tok == " " and out and out[-1] == " ":
            continue
        out.append(tok)
    return "|".join(out)


def main() -> int:
    fixed_en = fixed_zh = 0
    warnings = []
    for path in sorted(CHAPTERS_DIR.glob("*.json")):
        book = json.loads(path.read_text(encoding="utf-8"))
        changed = False
        for chnum, verses in book["chapters"].items():
            for v in verses:
                new_en = clean_en(v.get("en", ""))
                if new_en != v.get("en", ""):
                    if new_en and not new_en.endswith(SENTENCE_END):
                        warnings.append(
                            f"{path.stem} ch{chnum} v{v['verse']}: "
                            f"清理后结尾异常 …{new_en[-40:]!r}"
                        )
                    v["en"] = new_en
                    fixed_en += 1
                    changed = True
                new_zh = clean_zh(v.get("zh", ""))
                new_py = clean_py(v.get("py", ""))
                if new_zh != v.get("zh", "") or new_py != v.get("py", ""):
                    if new_py and len(new_py.split("|")) != len(new_zh):
                        warnings.append(
                            f"{path.stem} v{v['verse']}: 拼音与中文长度不一致，跳过 py"
                        )
                        new_py = v.get("py", "")
                    v["zh"] = new_zh
                    v["py"] = new_py
                    fixed_zh += 1
                    changed = True
        if changed:
            with open(path, "w", encoding="utf-8") as f:
                json.dump(book, f, ensure_ascii=False, indent=2)

    print(f"已清理英文经文 {fixed_en} 节、中文/拼音 {fixed_zh} 节")
    for w in warnings:
        print("⚠", w)
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
