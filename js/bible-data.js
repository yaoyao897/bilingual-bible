/**
 * Bilingual Bible - Data Access & Cache Layer
 */

// 内置兜底经文的逐字拼音（由 scripts/add_pinyin.py 同款逻辑生成，| 分隔并与 zh 逐字对齐）
const BUILTIN_PINYIN = {
  "起初，神创造天地。": "qǐ|chū|，|shén|chuàng|zào|tiān|dì|。",
  "地是空虚混沌，渊面黑暗；神的灵运行在水面上。": "dì|shì|kōng|xū|hùn|dùn|，|yuān|miàn|hēi|àn|；|shén|de|líng|yùn|xíng|zài|shuǐ|miàn|shàng|。",
  "神说：「要有光」，就有了光。": "shén|shuō|：|「|yào|yǒu|guāng|」|，|jiù|yǒu|le|guāng|。",
  "神看光是好的，就把光暗分开了。": "shén|kàn|guāng|shì|hǎo|de|，|jiù|bǎ|guāng|àn|fēn|kāi|le|。",
  "神称光为「昼」，称暗为「夜」。有晚上，有早晨，这是头一日。": "shén|chēng|guāng|wèi|「|zhòu|」|，|chēng|àn|wèi|「|yè|」|。|yǒu|wǎn|shàng|，|yǒu|zǎo|chén|，|zhè|shì|tóu|yī|rì|。",
  "神说：「诸水之间要有空气，将水分为上下。」": "shén|shuō|：|「|zhū|shuǐ|zhī|jiān|yào|yǒu|kòng|qì|，|jiāng|shuǐ|fèn|wèi|shàng|xià|。|」",
  "神就造出空气，将空气以下的水、空气以上的水分开了。事就这样成了。": "shén|jiù|zào|chū|kōng|qì|，|jiāng|kōng|qì|yǐ|xià|de|shuǐ|、|kōng|qì|yǐ|shàng|de|shuǐ|fèn|kāi|le|。|shì|jiù|zhè|yàng|chéng|le|。",
  "神称空气为「天」。有晚上，有早晨，是第二日。": "shén|chēng|kōng|qì|wèi|「|tiān|」|。|yǒu|wǎn|shàng|，|yǒu|zǎo|chén|，|shì|dì|èr|rì|。",
  "神说：「天下的水要聚在一处，使旱地露出来。」事就这样成了。": "shén|shuō|：|「|tiān|xià|de|shuǐ|yào|jù|zài|yī|chù|，|shǐ|hàn|dì|lù|chū|lái|。|」|shì|jiù|zhè|yàng|chéng|le|。",
  "神称旱地为「地」，称水的聚处为「海」。神看着是好的。": "shén|chēng|hàn|dì|wèi|「|dì|」|，|chēng|shuǐ|de|jù|chù|wèi|「|hǎi|」|。|shén|kàn|zhe|shì|hǎo|de|。",
  "太初有道，道与神同在，道就是神。": "tài|chū|yǒu|dào|，|dào|yǔ|shén|tóng|zài|，|dào|jiù|shì|shén|。",
  "这道太初与神同在。": "zhè|dào|tài|chū|yǔ|shén|tóng|zài|。",
  "万物是借着他造的；凡被造的，没有一样不是借着他造的。": "wàn|wù|shì|jiè|zhe|tā|zào|de|；|fán|bèi|zào|de|，|méi|yǒu|yī|yàng|bú|shì|jiè|zhe|tā|zào|de|。",
  "生命在他里头，这生命就是人的光。": "shēng|mìng|zài|tā|lǐ|tou|，|zhè|shēng|mìng|jiù|shì|rén|de|guāng|。",
  "光照在黑暗里，黑暗却不接受光。": "guāng|zhào|zài|hēi|àn|lǐ|，|hēi|àn|què|bù|jiē|shòu|guāng|。",
  "道成了肉身，住在我们中间，充充满满地有恩典有真理。我们也见过他的荣光，正是父独生子的荣光。": "dào|chéng|le|ròu|shēn|，|zhù|zài|wǒ|men|zhōng|jiān|，|chōng|chōng|mǎn|mǎn|dì|yǒu|ēn|diǎn|yǒu|zhēn|lǐ|。|wǒ|men|yě|jiàn|guò|tā|de|róng|guāng|，|zhèng|shì|fù|dú|shēng|zi|de|róng|guāng|。"
};

function attachBuiltinPinyin(bookData) {
  if (!bookData || !bookData.chapters) return bookData;
  Object.values(bookData.chapters).forEach(verses => {
    verses.forEach(v => {
      if (!v.py && BUILTIN_PINYIN[v.zh]) v.py = BUILTIN_PINYIN[v.zh];
    });
  });
  return bookData;
}

class BibleDataManager {
  constructor() {
    this.booksMeta = [];
    this.currentBook = null;
    this.currentChapter = 1;
    this.loadedBookData = {}; // Cache of bookSlug -> bookData
  }

  async init() {
    // 优先使用 <script> 预加载的元数据（file:// 直接打开页面时 fetch 会被拦截）
    if (window.BIBLE_BOOKS_META && window.BIBLE_BOOKS_META.length) {
      this.booksMeta = window.BIBLE_BOOKS_META;
    } else {
      try {
        const resp = await fetch('data/books-meta.json');
        if (resp.ok) {
          this.booksMeta = await resp.json();
        } else {
          throw new Error("Failed to load books-meta.json");
        }
      } catch (e) {
        console.warn("Could not fetch remote books-meta.json, using fallback metadata.", e);
        this.booksMeta = this.getFallbackMeta();
      }
    }

    // Default to Genesis (创世记)
    this.currentBook = this.booksMeta[0];
    this.currentChapter = 1;
  }

  async loadBook(slug) {
    if (this.loadedBookData[slug]) {
      return this.loadedBookData[slug];
    }

    // 方式一：HTTP 环境下 fetch JSON
    try {
      const resp = await fetch(`data/chapters/${slug}.json`);
      if (resp.ok) {
        const data = await resp.json();
        this.loadedBookData[slug] = data;
        return data;
      }
    } catch (e) {
      // file:// 直接打开页面时 fetch 会被浏览器拦截，改用 <script> 兜底
    }

    // 方式二：<script> 标签加载 data/chapters/{slug}.js（file:// 也可用）
    const viaScript = await this.loadBookViaScript(slug);
    if (viaScript) {
      this.loadedBookData[slug] = viaScript;
      return viaScript;
    }

    // 方式三：内置兜底经文（离线且无数据文件时）
    const fallback = this.getBuiltinVerses(slug);
    if (fallback) {
      attachBuiltinPinyin(fallback);
      this.loadedBookData[slug] = fallback;
      return fallback;
    }
    return null;
  }

  loadBookViaScript(slug) {
    return new Promise((resolve) => {
      const cached = window.BIBLE_CHAPTER_DATA && window.BIBLE_CHAPTER_DATA[slug];
      if (cached) {
        resolve(cached);
        return;
      }
      const s = document.createElement('script');
      s.src = `data/chapters/${slug}.js`;
      const timer = setTimeout(() => {
        s.remove();
        resolve(null);
      }, 10000);
      s.onload = () => {
        clearTimeout(timer);
        const data = window.BIBLE_CHAPTER_DATA && window.BIBLE_CHAPTER_DATA[slug];
        resolve(data || null);
      };
      s.onerror = () => {
        clearTimeout(timer);
        s.remove();
        resolve(null);
      };
      document.head.appendChild(s);
    });
  }

  getChapterVerses(bookData, chapterNum) {
    if (!bookData || !bookData.chapters) return [];
    return bookData.chapters[String(chapterNum)] || [];
  }

  getFallbackMeta() {
    return [
      { id: "GEN", name_zh: "创世记", name_en: "Genesis", testament: "OT", group: "律法书", chapters: 50, pdf: "https://www.christunite.com/NIV1984Bible/1Genesis.pdf", slug: "genesis" },
      { id: "PSA", name_zh: "诗篇", name_en: "Psalms", testament: "OT", group: "诗歌智慧书", chapters: 150, pdf: "https://www.christunite.com/NIV1984Bible/19Psalms.pdf", slug: "psalm" },
      { id: "MAT", name_zh: "马太福音", name_en: "Matthew", testament: "NT", group: "福音书", chapters: 28, pdf: "https://www.christunite.com/NIV1984Bible/40Matthew.pdf", slug: "matthew" },
      { id: "JHN", name_zh: "约翰福音", name_en: "John", testament: "NT", group: "福音书", chapters: 21, pdf: "https://www.christunite.com/NIV1984Bible/43John.pdf", slug: "john" },
      { id: "ROM", name_zh: "罗马书", name_en: "Romans", testament: "NT", group: "保罗书信", chapters: 16, pdf: "https://www.christunite.com/NIV1984Bible/45Romans.pdf", slug: "romans" }
    ];
  }

  getBuiltinVerses(slug) {
    // Built-in foundational chapters (Genesis 1, John 1, Psalm 23) in case network is offline
    if (slug === "genesis") {
      return {
        id: "GEN", name_zh: "创世记", name_en: "Genesis", testament: "OT", group: "律法书", total_chapters: 50,
        pdf_url: "https://www.christunite.com/NIV1984Bible/1Genesis.pdf",
        chapters: {
          "1": [
            { verse: 1, zh: "起初，神创造天地。", en: "In the beginning God created the heavens and the earth." },
            { verse: 2, zh: "地是空虚混沌，渊面黑暗；神的灵运行在水面上。", en: "Now the earth was formless and empty, darkness was over the surface of the deep, and the Spirit of God was hovering over the waters." },
            { verse: 3, zh: "神说：「要有光」，就有了光。", en: "And God said, \"Let there be light,\" and there was light." },
            { verse: 4, zh: "神看光是好的，就把光暗分开了。", en: "God saw that the light was good, and he separated the light from the darkness." },
            { verse: 5, zh: "神称光为「昼」，称暗为「夜」。有晚上，有早晨，这是头一日。", en: "God called the light \"day,\" and the darkness he called \"night.\" And there was evening, and there was morning—the first day." },
            { verse: 6, zh: "神说：「诸水之间要有空气，将水分为上下。」", en: "And God said, \"Let there be an expanse between the waters to separate water from water.\"" },
            { verse: 7, zh: "神就造出空气，将空气以下的水、空气以上的水分开了。事就这样成了。", en: "So God made the expanse and separated the water under the expanse from the water above it. And it was so." },
            { verse: 8, zh: "神称空气为「天」。有晚上，有早晨，是第二日。", en: "God called the expanse \"sky.\" And there was evening, and there was morning—the second day." },
            { verse: 9, zh: "神说：「天下的水要聚在一处，使旱地露出来。」事就这样成了。", en: "And God said, \"Let the water under the sky be gathered to one place, and let dry ground appear.\" And it was so." },
            { verse: 10, zh: "神称旱地为「地」，称水的聚处为「海」。神看着是好的。", en: "God called the dry ground \"land,\" and the gathered waters he called \"seas.\" And God saw that it was good." }
          ]
        }
      };
    } else if (slug === "john") {
      return {
        id: "JHN", name_zh: "约翰福音", name_en: "John", testament: "NT", group: "福音书", total_chapters: 21,
        pdf_url: "https://www.christunite.com/NIV1984Bible/43John.pdf",
        chapters: {
          "1": [
            { verse: 1, zh: "太初有道，道与神同在，道就是神。", en: "In the beginning was the Word, and the Word was with God, and the Word was God." },
            { verse: 2, zh: "这道太初与神同在。", en: "He was with God in the beginning." },
            { verse: 3, zh: "万物是借着他造的；凡被造的，没有一样不是借着他造的。", en: "Through him all things were made; without him nothing was made that has been made." },
            { verse: 4, zh: "生命在他里头，这生命就是人的光。", en: "In him was life, and that life was the light of men." },
            { verse: 5, zh: "光照在黑暗里，黑暗却不接受光。", en: "The light shines in the darkness, but the darkness has not understood it." },
            { verse: 14, zh: "道成了肉身，住在我们中间，充充满满地有恩典有真理。我们也见过他的荣光，正是父独生子的荣光。", en: "The Word became flesh and made his dwelling among us. We have seen his glory, the glory of the One and Only, who came from the Father, full of grace and truth." }
          ]
        }
      };
    }
    return null;
  }
}

window.BibleDataManager = BibleDataManager;
