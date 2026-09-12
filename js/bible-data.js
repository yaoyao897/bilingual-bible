/**
 * Bilingual Bible - Data Access & Cache Layer
 */

class BibleDataManager {
  constructor() {
    this.booksMeta = [];
    this.currentBook = null;
    this.currentChapter = 1;
    this.loadedBookData = {}; // Cache of bookSlug -> bookData
  }

  async init() {
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

    // Default to Genesis (创世记)
    this.currentBook = this.booksMeta[0];
    this.currentChapter = 1;
  }

  async loadBook(slug) {
    if (this.loadedBookData[slug]) {
      return this.loadedBookData[slug];
    }

    try {
      const resp = await fetch(`data/chapters/${slug}.json`);
      if (resp.ok) {
        const data = await resp.json();
        this.loadedBookData[slug] = data;
        return data;
      }
    } catch (e) {
      console.warn(`Could not load data/chapters/${slug}.json`, e);
    }

    // If file not found yet, provide built-in initial verses for key books
    const fallback = this.getBuiltinVerses(slug);
    if (fallback) {
      this.loadedBookData[slug] = fallback;
      return fallback;
    }
    return null;
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
