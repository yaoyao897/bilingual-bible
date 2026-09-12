#!/usr/bin/env python3
"""
Fetch and Align CUV (和合本) and NIV 1984 (from christunite.com)
Generates structured JSON chapters with verse-by-verse bilingual alignment.
"""

import os
import re
import json
import urllib.request

DATA_DIR = os.path.join(os.path.dirname(__file__), "../data")
CHAPTERS_DIR = os.path.join(DATA_DIR, "chapters")
os.makedirs(CHAPTERS_DIR, exist_ok=True)

CUV_SOURCE_URL = "https://raw.githubusercontent.com/thiagobodruk/bible/master/json/zh_cuv.json"

# Traditional to Simplified common Chinese conversions for smoother reading
T2S_MAP = {
    "創": "创", "造": "造", "起初": "起初", "神": "神", "天": "天", "地": "地",
    "說": "说", "光": "光", "為": "为", "晝": "昼", "夜": "夜", "萬": "万",
    "國": "国", "愛": "爱", "賜": "赐", "與": "与", "們": "们", "見": "见",
    "聽": "听", "開": "开", "關": "关", "靈": "灵", "應": "应", "許": "许",
    "約": "约", "書": "书", "傳": "传", "道": "道", "義": "义", "聖": "圣",
    "靈": "灵", "經": "经", "從": "从", "來": "来", "東": "东", "個": "个"
}

def quick_t2s(text):
    for k, v in T2S_MAP.items():
        text = text.replace(k, v)
    return text.replace(" ", "")

def download_cuv_all():
    cache_path = os.path.join(DATA_DIR, "cuv_raw.json")
    if os.path.exists(cache_path):
        with open(cache_path, "r", encoding="utf-8-sig") as f:
            return json.load(f)
    print(f"Downloading CUV Chinese Bible from {CUV_SOURCE_URL}...")
    req = urllib.request.Request(CUV_SOURCE_URL, headers={"User-Agent": "Mozilla/5.0"})
    with urllib.request.urlopen(req, timeout=15) as resp:
        content = resp.read().decode("utf-8-sig")
        data = json.loads(content)
        with open(cache_path, "w", encoding="utf-8") as f:
            f.write(content)
        return data

def fetch_christunite_niv(slug):
    url = f"https://www.christunite.com/index.php/{slug}"
    print(f"Fetching NIV 1984 for {slug} from {url}...")
    req = urllib.request.Request(url, headers={"User-Agent": "Mozilla/5.0"})
    with urllib.request.urlopen(req, timeout=20) as resp:
        html = resp.read().decode("utf-8", errors="ignore")
    return html

def parse_niv_chapters(html):
    start = html.find('<div itemprop="articleBody">')
    if start == -1:
        return {}
    body = html[start:]

    def clean_text(s):
        s = re.sub(r"<[^>]+>", "", s)
        s = re.sub(r"&nbsp;", " ", s)
        s = re.sub(r"&amp;", "&", s)
        s = re.sub(r"&quot;", "\"", s)
        return " ".join(s.split()).strip()

    # Split by Chapter marker: <strong><span ... color: #cc0000;>(\d+)</span></strong>
    # or variation: <strong><span ...>(\d+)</span></strong>
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

def align_and_save():
    cuv_data = download_cuv_all()
    # Map CUV books by name
    cuv_book_map = {}
    for idx, b in enumerate(cuv_data):
        cuv_book_map[b["name"].lower()] = b

    # Load books meta
    with open(os.path.join(DATA_DIR, "books-meta.json"), "r", encoding="utf-8") as f:
        books_meta = json.load(f)

    # We process foundational books first: Genesis, John, Matthew, Psalm, Romans
    target_books = [
        {"meta_id": "GEN", "slug": "genesis", "cuv_name": "genesis"},
        {"meta_id": "JHN", "slug": "john", "cuv_name": "john"},
        {"meta_id": "MAT", "slug": "matthew", "cuv_name": "matthew"},
        {"meta_id": "PSA", "slug": "psalm", "cuv_name": "psalms"},
        {"meta_id": "ROM", "slug": "romans", "cuv_name": "romans"}
    ]

    for tb in target_books:
        meta = next((b for b in books_meta if b["id"] == tb["meta_id"]), None)
        if not meta:
            continue

        cuv_book = cuv_book_map.get(tb["cuv_name"])
        try:
            niv_html = fetch_christunite_niv(tb["slug"])
            niv_chapters = parse_niv_chapters(niv_html)
            print(f"Parsed {len(niv_chapters)} chapters from christunite for {meta['name_en']}")
        except Exception as e:
            print(f"Failed fetching NIV for {tb['slug']}: {e}")
            niv_chapters = {}

        # Build book data structure
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

        cuv_chapters = cuv_book["chapters"] if cuv_book else []

        for chap_idx in range(meta["chapters"]):
            c_num = chap_idx + 1
            cuv_verses = cuv_chapters[chap_idx] if chap_idx < len(cuv_chapters) else []
            niv_verses = niv_chapters.get(c_num, {})

            max_v = max(len(cuv_verses), max(niv_verses.keys(), default=0))
            if max_v == 0:
                continue

            chapter_list = []
            for v in range(1, max_v + 1):
                zh_text = cuv_verses[v - 1] if v - 1 < len(cuv_verses) else ""
                en_text = niv_verses.get(v, "")
                chapter_list.append({
                    "verse": v,
                    "zh": zh_text,
                    "en": en_text
                })

            book_output["chapters"][str(c_num)] = chapter_list

        out_path = os.path.join(CHAPTERS_DIR, f"{meta['slug']}.json")
        with open(out_path, "w", encoding="utf-8") as out_f:
            json.dump(book_output, out_f, ensure_ascii=False, indent=2)
        print(f"Saved {out_path} with {len(book_output['chapters'])} aligned chapters.")

if __name__ == "__main__":
    align_and_save()
