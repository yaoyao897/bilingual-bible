#!/usr/bin/env python3
"""
Batch fetch, simplify Chinese (CUV 简体和合本), and align NIV 1984 from christunite.com
for all 66 books of the Bible.
"""

import os
import re
import json
import time
import urllib.request
from concurrent.futures import ThreadPoolExecutor, as_completed
import zhconv

BASE_DIR = os.path.dirname(os.path.abspath(__file__))
DATA_DIR = os.path.join(BASE_DIR, "../data")
CHAPTERS_DIR = os.path.join(DATA_DIR, "chapters")
os.makedirs(CHAPTERS_DIR, exist_ok=True)

# Slug overrides for christunite.com URLs
SLUG_MAP = {
    "1-chronicles": "1-Chronicles",
    "2-chronicles": "2-Chronicles",
    "1-kings": "1-Kings",
    "2-kings": "2-Kings",
    "song-of-songs": "Song-of-Solomon",
    "psalms": "Psalm",
    "judges": "Judges",
    "ruth": "Ruth",
    "ezra": "Ezra",
    "nehemiah": "Nehemiah",
    "esther": "Esther",
    "job": "Job",
    "proverbs": "Proverbs",
    "ecclesiastes": "Ecclesiastes",
    "isaiah": "Isaiah",
    "jeremiah": "Jeremiah",
    "lamentations": "Lamentations",
    "ezekiel": "Ezekiel",
    "titus": "../titus-niv-1984"
}

def clean_text(s):
    s = re.sub(r"<[^>]+>", "", s)
    s = re.sub(r"&nbsp;", " ", s)
    s = re.sub(r"&amp;", "&", s)
    s = re.sub(r"&quot;", "\"", s)
    s = re.sub(r"&#39;", "'", s)
    return " ".join(s.split()).strip()

def clean_zh_text(s):
    if not s:
        return ""
    # Convert to Simplified Chinese
    simplified = zhconv.convert(s, 'zh-cn')
    # Clean redundant spaces between Chinese characters while keeping natural pauses
    cleaned = re.sub(r'(?<=[\u4e00-\u9fa5，。！？；：“”‘’（）《》])\s+(?=[\u4e00-\u9fa5，。！？；：“”‘’（）《》])', '', simplified)
    return cleaned.strip()

def fetch_book_html(slug):
    custom_slug = SLUG_MAP.get(slug, slug)
    if custom_slug.startswith(".."):
        url = f"https://www.christunite.com/{custom_slug[3:]}"
    else:
        url = f"https://www.christunite.com/index.php/{custom_slug}"

    for attempt in range(3):
        try:
            req = urllib.request.Request(url, headers={
                "User-Agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36"
            })
            with urllib.request.urlopen(req, timeout=16) as resp:
                return resp.read().decode("utf-8", errors="ignore")
        except Exception as e:
            time.sleep(1 + attempt * 0.5)
    return None

def parse_niv_chapters(html):
    if not html:
        return {}
    start = html.find('<div itemprop="articleBody">')
    if start == -1:
        return {}
    body = html[start:]

    # Match red chapter marker: <strong><span ... color: #cc0000;>(\d+)</span></strong>
    chap_regex = re.compile(r"<strong><span[^>]*color:\s*#cc0000;?\"?>\s*(\d+)\s*</span></strong>", re.IGNORECASE)
    splits = chap_regex.split(body)
    
    result = {} # chapter_num: { verse_num: text }
    if len(splits) > 1:
        for i in range(1, len(splits), 2):
            try:
                c_num = int(splits[i])
            except ValueError:
                continue
            c_content = splits[i+1]
            # Verse marker: <sup><span ... color: #3365cc;>(\d+)</span></sup>
            v_splits = re.split(r"<sup><span[^>]*color:\s*#3365cc;?\"?>\s*(\d+)\s*</span></sup>", c_content)
            verses = {}
            if len(v_splits) > 0:
                first_verse = clean_text(v_splits[0])
                if first_verse:
                    verses[1] = first_verse
            if len(v_splits) > 1:
                for j in range(1, len(v_splits), 2):
                    try:
                        v_num = int(v_splits[j])
                        v_text = clean_text(v_splits[j+1])
                        verses[v_num] = v_text
                    except (ValueError, IndexError):
                        pass
            result[c_num] = verses
    return result

def process_single_book(meta, cuv_book):
    slug = meta["slug"]
    out_path = os.path.join(CHAPTERS_DIR, f"{slug}.json")
    
    html = fetch_book_html(slug)
    niv_chapters = parse_niv_chapters(html) if html else {}

    book_output = {
        "id": meta["id"],
        "name_zh": meta["name_zh"],
        "name_en": meta["name_en"],
        "testament": meta["testament"],
        "group": meta["group"],
        "total_chapters": meta["chapters"],
        "pdf_url": meta["pdf"],
        "chapters": {}
    }

    cuv_chapters = cuv_book.get("chapters", []) if cuv_book else []

    for chap_idx in range(meta["chapters"]):
        c_num = chap_idx + 1
        cuv_verses = cuv_chapters[chap_idx] if chap_idx < len(cuv_chapters) else []
        niv_verses = niv_chapters.get(c_num, {})

        max_v = max(len(cuv_verses), max(niv_verses.keys(), default=0))
        if max_v == 0:
            continue

        chapter_list = []
        for v in range(1, max_v + 1):
            raw_zh = cuv_verses[v - 1] if v - 1 < len(cuv_verses) else ""
            zh_simplified = clean_zh_text(raw_zh)
            en_text = niv_verses.get(v, "")
            chapter_list.append({
                "verse": v,
                "zh": zh_simplified,
                "en": en_text
            })

        book_output["chapters"][str(c_num)] = chapter_list

    with open(out_path, "w", encoding="utf-8") as f:
        json.dump(book_output, f, ensure_ascii=False, indent=2)

    return meta["name_zh"], meta["name_en"], len(book_output["chapters"]), len(niv_chapters)

def run_all():
    with open(os.path.join(DATA_DIR, "books-meta.json"), "r", encoding="utf-8") as f:
        books_meta = json.load(f)

    with open(os.path.join(DATA_DIR, "cuv_raw.json"), "r", encoding="utf-8-sig") as f:
        cuv_data = json.load(f)

    print(f"Starting parallel processing of {len(books_meta)} books with Simplified Chinese & NIV 1984...")
    start_time = time.time()

    with ThreadPoolExecutor(max_workers=10) as executor:
        futures = []
        for idx, meta in enumerate(books_meta):
            cuv_book = cuv_data[idx] if idx < len(cuv_data) else None
            futures.append(executor.submit(process_single_book, meta, cuv_book))

        completed = 0
        for fut in as_completed(futures):
            try:
                name_zh, name_en, total_chaps, niv_chaps = fut.result()
                completed += 1
                print(f"[{completed:02d}/{len(books_meta)}] Done: {name_zh} ({name_en}) - {total_chaps} chapters (NIV parsed: {niv_chaps})")
            except Exception as e:
                print(f"Error processing book: {e}")

    elapsed = time.time() - start_time
    print(f"🎉 Successfully generated and aligned all {len(books_meta)} books in {elapsed:.1f}s!")

if __name__ == "__main__":
    run_all()
