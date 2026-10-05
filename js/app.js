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
  let currentViewMode = localStorage.getItem('bible_view_mode') || 'side'; // 'side', 'interlinear' or 'pinyin'
  let currentTheme = localStorage.getItem('bible_theme') || 'parchment'; // 'parchment', 'light', 'dark'
  let fontScale = parseFloat(localStorage.getItem('bible_font_scale')) || 1.0;
  let fontScalePinyin = parseFloat(localStorage.getItem('bible_font_scale_pinyin')) || 1.4; // 拼音大字版默认更大
  let isSpeakEnabled = localStorage.getItem('bible_click_speak_enabled') === 'true'; // default false

  const FONT_LIMITS = {
    default: { min: 0.8, max: 1.6, step: 0.1 },
    pinyin:  { min: 1.0, max: 2.8, step: 0.2 }
  };
  const CJK_PUNCT_RE = /[一-龥，。！？；：“”‘’（）《》]/;
  const HAN_RE = /[㐀-䶿一-鿿]/;

  function escapeHtml(s) {
    return String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
  }

  // 生成「汉字 + 上标拼音」的 ruby HTML。py 为 | 分隔且与 zh 逐字对齐（由 scripts/add_pinyin.py 生成）。
  function buildPinyinHtml(zh, py) {
    if (!zh) return '（待补充）';
    const chars = Array.from(zh); // 按码点迭代，与 Python len() 对齐
    const tokenArr = typeof py === 'string' ? py.split('|') : (Array.isArray(py) ? py : null);
    const tokens = (tokenArr && tokenArr.length === chars.length) ? tokenArr : null;
    let html = '';
    for (let i = 0; i < chars.length; i++) {
      const ch = chars[i];
      if (/\s/.test(ch)) {
        // 与 formatZhScripture 一致：仅去掉夹在中文字符/标点之间的空白
        const prev = chars.slice(0, i).reverse().find(c => !/\s/.test(c));
        const next = chars.slice(i + 1).find(c => !/\s/.test(c));
        if (prev && next && CJK_PUNCT_RE.test(prev) && CJK_PUNCT_RE.test(next)) continue;
        html += ' ';
        continue;
      }
      const pyToken = tokens ? tokens[i] : null;
      if (pyToken && pyToken !== ch && HAN_RE.test(ch)) {
        html += `<ruby class="py-ruby">${escapeHtml(ch)}<rt>${escapeHtml(pyToken)}</rt></ruby>`;
      } else {
        html += escapeHtml(ch);
      }
    }
    return html.trim();
  }

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

  const btnToggleSpeak = document.getElementById('btnToggleSpeak');
  const btnSubbarSpeakToggle = document.getElementById('btnSubbarSpeakToggle');
  const bibleToast = document.getElementById('bibleToast');

  const btnViewSide = document.getElementById('btnViewSide');
  const btnViewInterlinear = document.getElementById('btnViewInterlinear');
  const btnViewPinyin = document.getElementById('btnViewPinyin');

  const btnTheme = document.getElementById('btnTheme');
  const btnFontDec = document.getElementById('btnFontDec');
  const btnFontInc = document.getElementById('btnFontInc');
  const btnZoomInBig = document.getElementById('btnZoomInBig');
  const btnZoomOutBig = document.getElementById('btnZoomOutBig');

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

  // Toast Notification Function
  let toastTimer = null;
  function showToast(msg) {
    if (!bibleToast) return;
    bibleToast.textContent = msg;
    bibleToast.classList.add('show');
    if (toastTimer) clearTimeout(toastTimer);
    toastTimer = setTimeout(() => {
      bibleToast.classList.remove('show');
    }, 2200);
  }

  // Speak Switch Controller
  function setSpeakEnabled(enabled, showFeedback = true) {
    isSpeakEnabled = !!enabled;
    localStorage.setItem('bible_click_speak_enabled', isSpeakEnabled);

    if (!isSpeakEnabled && audioPlayer.isPlaying) {
      audioPlayer.stop();
    }

    // Update Header Button
    if (btnToggleSpeak) {
      if (isSpeakEnabled) {
        btnToggleSpeak.classList.add('is-active');
        const textSpan = btnToggleSpeak.querySelector('.speak-toggle-text');
        if (textSpan) textSpan.textContent = '点读: 开';
        btnToggleSpeak.title = '点按朗读开关：当前已开启，点击经文句子即可朗读。点击可关闭';
      } else {
        btnToggleSpeak.classList.remove('is-active');
        const textSpan = btnToggleSpeak.querySelector('.speak-toggle-text');
        if (textSpan) textSpan.textContent = '点读: 关';
        btnToggleSpeak.title = '点按朗读开关：当前已关闭，点击经文不会触发朗读。点击可开启';
      }
    }

    // Update Subbar Button
    if (btnSubbarSpeakToggle) {
      if (isSpeakEnabled) {
        btnSubbarSpeakToggle.classList.add('is-active');
        const textSpan = btnSubbarSpeakToggle.querySelector('.subbar-speak-text');
        if (textSpan) textSpan.textContent = '点读: 开';
      } else {
        btnSubbarSpeakToggle.classList.remove('is-active');
        const textSpan = btnSubbarSpeakToggle.querySelector('.subbar-speak-text');
        if (textSpan) textSpan.textContent = '点读: 关';
      }
    }

    // Update Body visual mode
    if (isSpeakEnabled) {
      document.body.classList.add('click-speak-enabled');
      document.body.classList.remove('click-speak-disabled');
      if (showFeedback) showToast('🔊 点读已开启：点击任意单行句子即可朗读');
    } else {
      document.body.classList.add('click-speak-disabled');
      document.body.classList.remove('click-speak-enabled');
      if (showFeedback) showToast('🔇 点读已关闭：静音阅读模式，点击句子不会发声');
    }
  }

  if (btnToggleSpeak) {
    btnToggleSpeak.addEventListener('click', () => {
      setSpeakEnabled(!isSpeakEnabled, true);
    });
  }

  if (btnSubbarSpeakToggle) {
    btnSubbarSpeakToggle.addEventListener('click', () => {
      setSpeakEnabled(!isSpeakEnabled, true);
    });
  }

  // Apply Theme, View Mode & Speak Mode Initial
  // （applyViewMode 内部会按当前模式应用对应的字号比例）
  applyTheme(currentTheme);
  applyViewMode(currentViewMode);
  setSpeakEnabled(isSpeakEnabled, false);

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
    if (!isSpeakEnabled && !audioPlayer.isPlaying) {
      setSpeakEnabled(true, false);
    }
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
    chapterHeroPill.textContent = currentViewMode === 'pinyin' ? `第 ${cNum} 章` : `Chapter ${cNum}`;

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

    // 中文拼音大字版：仅渲染中文，逐字上标拼音
    if (currentViewMode === 'pinyin') {
      currentVerses.forEach((v) => {
        const row = document.createElement('div');
        row.className = 'verse-row-pinyin';
        row.id = `verse-${v.verse}`;
        row.dataset.verse = v.verse;
        row.innerHTML = `
          <span class="verse-number">${v.verse}</span>
          <span class="verse-text pinyin-text">${buildPinyinHtml(v.zh, v.py)}</span>
        `;
        scriptureContainer.appendChild(row);
      });
      btnPrevChapter.disabled = cNum <= 1;
      btnNextChapter.disabled = cNum >= (dataManager.currentBook.chapters || 50);
      currentChapterDisplay.textContent = `${cNum} / ${dataManager.currentBook.chapters || 1}`;
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
        if (!isSpeakEnabled) {
          showToast('🔇 朗读开关当前已关闭，点击顶部「点读: 关」即可开启');
          return;
        }
        audioPlayer.speakSingleVerse(v.verse);
      });

      // Click row to read this single verse
      row.addEventListener('click', () => {
        if (!isSpeakEnabled) {
          return;
        }
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

  // View Mode: Side by Side vs Interlinear vs Pinyin (Chinese-only, senior)
  btnViewSide.addEventListener('click', () => {
    applyViewMode('side');
  });

  btnViewInterlinear.addEventListener('click', () => {
    applyViewMode('interlinear');
  });

  btnViewPinyin.addEventListener('click', () => {
    applyViewMode('pinyin');
    showToast('拼音大字版：仅显示中文并逐字标注拼音，右下角可放大缩小字体');
  });

  function currentFontScale() {
    return currentViewMode === 'pinyin' ? fontScalePinyin : fontScale;
  }

  function applyViewMode(mode) {
    currentViewMode = mode;
    localStorage.setItem('bible_view_mode', mode);
    btnViewSide.classList.toggle('active', mode === 'side');
    btnViewInterlinear.classList.toggle('active', mode === 'interlinear');
    btnViewPinyin.classList.toggle('active', mode === 'pinyin');

    if (mode === 'pinyin') {
      scriptureContainer.className = 'scripture-view-pinyin';
      document.body.classList.add('mode-pinyin');
      if (audioPlayer.isPlaying) audioPlayer.stop();
    } else {
      scriptureContainer.className = mode === 'interlinear' ? 'scripture-view-interlinear' : 'scripture-view-side';
      document.body.classList.remove('mode-pinyin');
    }

    // 各模式使用独立的字号记忆
    document.documentElement.style.setProperty('--font-scale-ratio', currentFontScale());
    if (currentBookData) renderCurrentChapter();
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

  // Font Scale (拼音版使用独立的更大调节范围)
  function adjustFont(dir) {
    const lim = currentViewMode === 'pinyin' ? FONT_LIMITS.pinyin : FONT_LIMITS.default;
    const cur = currentFontScale();
    const next = Math.min(lim.max, Math.max(lim.min, cur + dir * lim.step));
    if (next !== cur) {
      applyFontScale(next);
    } else {
      showToast(dir > 0 ? '已是最大字号' : '已是最小字号');
    }
  }

  btnFontDec.addEventListener('click', () => adjustFont(-1));
  btnFontInc.addEventListener('click', () => adjustFont(1));
  if (btnZoomOutBig) btnZoomOutBig.addEventListener('click', () => adjustFont(-1));
  if (btnZoomInBig) btnZoomInBig.addEventListener('click', () => adjustFont(1));

  function applyFontScale(scale) {
    const rounded = Math.round(scale * 10) / 10;
    if (currentViewMode === 'pinyin') {
      fontScalePinyin = rounded;
      localStorage.setItem('bible_font_scale_pinyin', fontScalePinyin);
    } else {
      fontScale = rounded;
      localStorage.setItem('bible_font_scale', fontScale);
    }
    document.documentElement.style.setProperty('--font-scale-ratio', rounded);
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
