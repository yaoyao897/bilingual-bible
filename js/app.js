/**
 * Bilingual Bible - Application Main Controller
 */

document.addEventListener('DOMContentLoaded', async () => {
  // Instances
  const dataManager = new BibleDataManager();
  const audioPlayer = new BibleAudioPlayer();

  // App State
  let currentBookData = null;
  let currentVerses = [];
  let currentViewMode = localStorage.getItem('bible_view_mode') || 'side'; // 'side' or 'interlinear'
  let currentTheme = localStorage.getItem('bible_theme') || 'parchment'; // 'parchment', 'light', 'dark'
  let fontScale = parseFloat(localStorage.getItem('bible_font_scale')) || 1.0;

  function formatZhScripture(text) {
    if (!text) return '';
    return text.replace(/(?<=[\u4e00-\u9fa5，。！？；：“”‘’（）《》])\s+(?=[\u4e00-\u9fa5，。！？；：“”‘’（）《》])/g, '').trim();
  }

  // DOM Elements
  const scriptureContainer = document.getElementById('scriptureContainer');
  const bookHeroTitle = document.getElementById('bookHeroTitle');
  const bookHeroEn = document.getElementById('bookHeroEn');
  const chapterHeroPill = document.getElementById('chapterHeroPill');
  const pdfSourceLink = document.getElementById('pdfSourceLink');
  
  const btnNavBook = document.getElementById('btnNavBook');
  const currentNavText = document.getElementById('currentNavText');
  const btnPrevChapter = document.getElementById('btnPrevChapter');
  const btnNextChapter = document.getElementById('btnNextChapter');
  const currentChapterDisplay = document.getElementById('currentChapterDisplay');

  const btnViewSide = document.getElementById('btnViewSide');
  const btnViewInterlinear = document.getElementById('btnViewInterlinear');

  const btnTheme = document.getElementById('btnTheme');
  const btnFontDec = document.getElementById('btnFontDec');
  const btnFontInc = document.getElementById('btnFontInc');

  // Drawer
  const drawerBackdrop = document.getElementById('drawerBackdrop');
  const booksDrawer = document.getElementById('booksDrawer');
  const btnCloseDrawer = document.getElementById('btnCloseDrawer');
  const bookSearchInput = document.getElementById('bookSearchInput');
  const drawerTabOT = document.getElementById('drawerTabOT');
  const drawerTabNT = document.getElementById('drawerTabNT');
  const drawerBookList = document.getElementById('drawerBookList');

  // Audio Dock
  const audioDock = document.getElementById('audioDock');
  const btnDockPlay = document.getElementById('btnDockPlay');
  const btnDockPrev = document.getElementById('btnDockPrev');
  const btnDockNext = document.getElementById('btnDockNext');
  const audioTrackTitle = document.getElementById('audioTrackTitle');
  const audioTrackStatus = document.getElementById('audioTrackStatus');
  const speedSelect = document.getElementById('speedSelect');
  const voiceSelect = document.getElementById('voiceSelect');

  // Apply Theme & Font Scale Initial
  applyTheme(currentTheme);
  applyFontScale(fontScale);
  applyViewMode(currentViewMode);

  // Initialize Data
  await dataManager.init();
  const lastSlug = localStorage.getItem('bible_last_book_slug');
  const lastChap = parseInt(localStorage.getItem('bible_last_chapter')) || 1;
  const initBook = dataManager.booksMeta.find(b => b.slug === lastSlug) || dataManager.currentBook;
  renderDrawerBooks(initBook.testament || 'OT');
  await switchBook(initBook, lastChap);

  // Populate Voices once available
  setTimeout(() => {
    populateVoiceOptions();
  }, 300);
  if (speechSynthesis.onvoiceschanged !== undefined) {
    speechSynthesis.onvoiceschanged = () => populateVoiceOptions();
  }

  // Setup Audio Callbacks
  audioPlayer.onVerseStart = (verseNum) => {
    highlightVerseRow(verseNum);
    updateAudioDockStatus('Playing', verseNum);
  };

  audioPlayer.onVerseEnd = (verseNum) => {
    unhighlightVerseRow(verseNum);
  };

  audioPlayer.onStateChange = (state, verseNum) => {
    if (state === 'playing') {
      audioDock.classList.add('is-playing');
      btnDockPlay.innerHTML = `<svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor"><rect x="6" y="4" width="4" height="16" rx="1"/><rect x="14" y="4" width="4" height="16" rx="1"/></svg>`;
      updateAudioDockStatus('Playing', verseNum);
    } else if (state === 'paused') {
      audioDock.classList.remove('is-playing');
      btnDockPlay.innerHTML = `<svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor"><polygon points="5 3 19 12 5 21 5 3"/></svg>`;
      updateAudioDockStatus('Paused', verseNum);
    } else {
      audioDock.classList.remove('is-playing');
      btnDockPlay.innerHTML = `<svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor"><polygon points="5 3 19 12 5 21 5 3"/></svg>`;
      updateAudioDockStatus('Ready', null);
      clearAllHighlights();
    }
  };

  // Audio Dock Controls
  btnDockPlay.addEventListener('click', () => {
    audioPlayer.togglePlayPause();
  });

  btnDockPrev.addEventListener('click', () => {
    audioPlayer.prevVerse();
  });

  btnDockNext.addEventListener('click', () => {
    audioPlayer.nextVerse();
  });

  speedSelect.addEventListener('change', (e) => {
    audioPlayer.setRate(e.target.value);
  });

  voiceSelect.addEventListener('change', (e) => {
    audioPlayer.setVoice(e.target.value);
  });

  // Switch Book & Chapter
  async function switchBook(bookMeta, chapterNum = 1) {
    audioPlayer.stop();
    dataManager.currentBook = bookMeta;
    dataManager.currentChapter = chapterNum;
    localStorage.setItem('bible_last_book_slug', bookMeta.slug);
    localStorage.setItem('bible_last_chapter', chapterNum);

    // Load data
    currentBookData = await dataManager.loadBook(bookMeta.slug);
    renderCurrentChapter();
    updateHeaderNav();
  }

  function renderCurrentChapter() {
    const cNum = dataManager.currentChapter;
    currentVerses = dataManager.getChapterVerses(currentBookData, cNum);

    // Sync with Audio Player
    audioPlayer.setChapterData(currentVerses);

    // Update Hero Titles
    bookHeroTitle.textContent = `${dataManager.currentBook.name_zh} 第 ${cNum} 章`;
    bookHeroEn.textContent = `${dataManager.currentBook.name_en} Chapter ${cNum} (NIV 1984)`;
    chapterHeroPill.textContent = `Chapter ${cNum}`;

    // PDF Source link
    if (dataManager.currentBook.pdf) {
      pdfSourceLink.href = dataManager.currentBook.pdf;
      pdfSourceLink.title = `查阅并下载 ${dataManager.currentBook.name_en} 1984 原版 PDF`;
      pdfSourceLink.style.display = 'inline-flex';
    } else {
      pdfSourceLink.style.display = 'none';
    }

    // Render Scripture Rows
    scriptureContainer.innerHTML = '';
    if (currentVerses.length === 0) {
      scriptureContainer.innerHTML = `<div style="text-align:center; padding: 3rem; color: var(--text-muted);">本章节正在从云端加载或整理中，请选择其他章节...</div>`;
      return;
    }

    currentVerses.forEach((v) => {
      const row = document.createElement('div');
      row.className = 'verse-row';
      row.id = `verse-${v.verse}`;
      row.dataset.verse = v.verse;

      // Clean display Chinese (standard simplified punctuation & spacing)
      const zhDisplay = formatZhScripture(v.zh) || '（待补充）';
      const enDisplay = v.en ? v.en.trim() : '（Pending NIV 1984 text）';

      row.innerHTML = `
        <div class="verse-side-zh text-zh-scripture">
          <span class="verse-number">${v.verse}</span>
          <span class="verse-text">${zhDisplay}</span>
        </div>
        <div class="verse-side-en text-en-scripture">
          <span class="verse-text">${enDisplay}</span>
          <span class="verse-actions-mini">
            <button class="btn-verse-speak" title="朗读此节英文" data-verse="${v.verse}">
              <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5"></polygon>
                <path d="M19.07 4.93a10 10 0 0 1 0 14.14M15.54 8.46a5 5 0 0 1 0 7.07"></path>
              </svg>
            </button>
          </span>
        </div>
      `;

      // Click to read this specific verse only (single row, no auto-continue)
      const speakBtn = row.querySelector('.btn-verse-speak');
      speakBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        audioPlayer.speakSingleVerse(v.verse);
      });

      // Click row to read this single verse
      row.addEventListener('click', () => {
        audioPlayer.speakSingleVerse(v.verse);
      });

      scriptureContainer.appendChild(row);
    });

    // Update Pagination buttons
    btnPrevChapter.disabled = cNum <= 1;
    btnNextChapter.disabled = cNum >= (dataManager.currentBook.chapters || 50);
    currentChapterDisplay.textContent = `${cNum} / ${dataManager.currentBook.chapters || 1}`;
  }

  function updateHeaderNav() {
    currentNavText.textContent = `${dataManager.currentBook.name_zh} 第${dataManager.currentChapter}章`;
    audioTrackTitle.textContent = `${dataManager.currentBook.name_en} Ch.${dataManager.currentChapter}`;
    updateAudioDockStatus('Ready', null);
  }

  function updateAudioDockStatus(status, verseNum) {
    if (verseNum !== null && verseNum !== undefined) {
      audioTrackStatus.textContent = `${status} - Verse ${verseNum}`;
    } else {
      audioTrackStatus.textContent = `${status} (${currentVerses.length} verses)`;
    }
  }

  function highlightVerseRow(verseNum) {
    clearAllHighlights();
    const target = document.getElementById(`verse-${verseNum}`);
    if (target) {
      target.classList.add('is-reading');
      target.scrollIntoView({ behavior: 'smooth', block: 'center' });
    }
  }

  function unhighlightVerseRow(verseNum) {
    const target = document.getElementById(`verse-${verseNum}`);
    if (target) {
      target.classList.remove('is-reading');
    }
  }

  function clearAllHighlights() {
    document.querySelectorAll('.verse-row.is-reading').forEach(el => {
      el.classList.remove('is-reading');
    });
  }

  function populateVoiceOptions() {
    const voices = audioPlayer.voices;
    if (!voices || voices.length === 0) return;
    voiceSelect.innerHTML = '';
    voices.forEach(v => {
      const opt = document.createElement('option');
      opt.value = v.voiceURI;
      opt.textContent = `${v.name.split(' ')[0]} (${v.lang})`;
      if (audioPlayer.selectedVoice && audioPlayer.selectedVoice.voiceURI === v.voiceURI) {
        opt.selected = true;
      }
      voiceSelect.appendChild(opt);
    });
  }

  // Chapter Pagination
  btnPrevChapter.addEventListener('click', () => {
    if (dataManager.currentChapter > 1) {
      switchBook(dataManager.currentBook, dataManager.currentChapter - 1);
    }
  });

  btnNextChapter.addEventListener('click', () => {
    if (dataManager.currentChapter < dataManager.currentBook.chapters) {
      switchBook(dataManager.currentBook, dataManager.currentChapter + 1);
    }
  });

  // View Mode: Side by Side vs Interlinear
  btnViewSide.addEventListener('click', () => {
    applyViewMode('side');
  });

  btnViewInterlinear.addEventListener('click', () => {
    applyViewMode('interlinear');
  });

  function applyViewMode(mode) {
    currentViewMode = mode;
    localStorage.setItem('bible_view_mode', mode);
    if (mode === 'side') {
      scriptureContainer.className = 'scripture-view-side';
      btnViewSide.classList.add('active');
      btnViewInterlinear.classList.remove('active');
    } else {
      scriptureContainer.className = 'scripture-view-interlinear';
      btnViewInterlinear.classList.add('active');
      btnViewSide.classList.remove('active');
    }
  }

  // Themes: Parchment -> Light -> Dark -> Parchment
  btnTheme.addEventListener('click', () => {
    const nextTheme = currentTheme === 'parchment' ? 'light' : (currentTheme === 'light' ? 'dark' : 'parchment');
    applyTheme(nextTheme);
  });

  function applyTheme(theme) {
    currentTheme = theme;
    localStorage.setItem('bible_theme', theme);
    document.documentElement.setAttribute('data-theme', theme);
    const themeTitles = {
      'parchment': '经典羊皮纸 (Parchment)',
      'light': '清新日间 (Light)',
      'dark': '沉思黑夜 (Dark)'
    };
    btnTheme.title = `当前主题：${themeTitles[theme]}（点击切换）`;
  }

  // Font Scale
  btnFontDec.addEventListener('click', () => {
    if (fontScale > 0.8) {
      applyFontScale(fontScale - 0.1);
    }
  });

  btnFontInc.addEventListener('click', () => {
    if (fontScale < 1.6) {
      applyFontScale(fontScale + 0.1);
    }
  });

  function applyFontScale(scale) {
    fontScale = Math.round(scale * 10) / 10;
    localStorage.setItem('bible_font_scale', fontScale);
    document.documentElement.style.setProperty('--font-scale-ratio', fontScale);
  }

  // Drawer Interactions
  btnNavBook.addEventListener('click', openDrawer);
  btnCloseDrawer.addEventListener('click', closeDrawer);
  drawerBackdrop.addEventListener('click', closeDrawer);

  function openDrawer() {
    booksDrawer.classList.add('active');
    drawerBackdrop.classList.add('active');
    bookSearchInput.focus();
  }

  function closeDrawer() {
    booksDrawer.classList.remove('active');
    drawerBackdrop.classList.remove('active');
  }

  let activeTestamentTab = 'OT';
  drawerTabOT.addEventListener('click', () => {
    activeTestamentTab = 'OT';
    drawerTabOT.classList.add('active');
    drawerTabNT.classList.remove('active');
    renderDrawerBooks('OT', bookSearchInput.value);
  });

  drawerTabNT.addEventListener('click', () => {
    activeTestamentTab = 'NT';
    drawerTabNT.classList.add('active');
    drawerTabOT.classList.remove('active');
    renderDrawerBooks('NT', bookSearchInput.value);
  });

  bookSearchInput.addEventListener('input', (e) => {
    renderDrawerBooks(activeTestamentTab, e.target.value.trim().toLowerCase());
  });

  function renderDrawerBooks(testament, filter = '') {
    drawerBookList.innerHTML = '';
    const books = dataManager.booksMeta.filter(b => {
      const matchTestament = (b.testament === testament);
      if (!filter) return matchTestament;
      const matchSearch = b.name_zh.includes(filter) || b.name_en.toLowerCase().includes(filter);
      return matchTestament && matchSearch;
    });

    let currentGroup = '';
    books.forEach(b => {
      if (b.group !== currentGroup) {
        currentGroup = b.group;
        const grpHead = document.createElement('div');
        grpHead.className = 'book-group-title';
        grpHead.textContent = currentGroup;
        drawerBookList.appendChild(grpHead);
      }

      const btn = document.createElement('button');
      btn.className = 'book-item-btn';
      if (dataManager.currentBook && dataManager.currentBook.id === b.id) {
        btn.classList.add('selected');
      }
      btn.innerHTML = `
        <div>
          <span>${b.name_zh}</span>
          <span class="name-en">(${b.name_en})</span>
        </div>
        <span style="font-size:0.75rem; color:var(--text-muted);">${b.chapters}章</span>
      `;

      btn.addEventListener('click', () => {
        showChapterSelector(b);
      });

      drawerBookList.appendChild(btn);
    });
  }

  function showChapterSelector(book) {
    drawerBookList.innerHTML = `
      <div style="margin-bottom: 0.8rem; display: flex; align-items:center; justify-content:space-between;">
        <button id="btnBackToBooks" style="background:none; border:none; color:var(--accent-gold); font-size:0.85rem; font-weight:600; cursor:pointer; display:flex; align-items:center; gap:0.3rem;">
          ← 返回书卷目录
        </button>
        <span style="font-weight:700; color:var(--text-main);">${book.name_zh} (${book.name_en})</span>
      </div>
      <div style="font-size:0.8rem; color:var(--text-muted); margin-bottom:0.75rem;">请选择阅读章节：</div>
      <div class="chapter-grid" id="chapterGrid"></div>
    `;

    document.getElementById('btnBackToBooks').addEventListener('click', () => {
      renderDrawerBooks(activeTestamentTab, bookSearchInput.value);
    });

    const grid = document.getElementById('chapterGrid');
    for (let c = 1; c <= book.chapters; c++) {
      const cBtn = document.createElement('button');
      cBtn.className = 'chapter-btn';
      if (dataManager.currentBook.id === book.id && dataManager.currentChapter === c) {
        cBtn.classList.add('current');
      }
      cBtn.textContent = c;
      cBtn.addEventListener('click', () => {
        closeDrawer();
        switchBook(book, c);
      });
      grid.appendChild(cBtn);
    }
  }
});
