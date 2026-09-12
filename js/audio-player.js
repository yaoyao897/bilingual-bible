/**
 * Bilingual Bible - Audio Player Engine (Web Speech API)
 * Implements continuous playback, single-verse recitation,
 * follow-along auto-scrolling karaoke highlight, and rate/voice controls.
 */

class BibleAudioPlayer {
  constructor() {
    this.synth = window.speechSynthesis;
    this.currentVerse = null;
    this.isPlaying = false;
    this.isPaused = false;
    this.isContinuous = true;
    this.rate = 1.0;
    this.selectedVoice = null;
    this.voices = [];
    
    // Callbacks
    this.onVerseStart = null;
    this.onVerseEnd = null;
    this.onStateChange = null;
    this.onChapterComplete = null;

    // Current Chapter Data
    this.chapterVerses = []; // Array of { verse: number, en: string, zh: string }
    this.currentIndex = -1;

    this.initVoices();
  }

  initVoices() {
    if (!this.synth) {
      console.warn("Web Speech API is not supported in this browser.");
      return;
    }

    const updateVoices = () => {
      const allVoices = this.synth.getVoices();
      // Filter for English voices
      this.voices = allVoices.filter(v => v.lang.startsWith("en"));
      
      // Prefer high quality English voices: Google US, Samantha, Daniel, Karen, Natural
      const preferredNames = ["Google US English", "Samantha", "Daniel", "Karen", "Victoria", "Natural"];
      for (const pref of preferredNames) {
        const found = this.voices.find(v => v.name.includes(pref));
        if (found) {
          this.selectedVoice = found;
          break;
        }
      }
      if (!this.selectedVoice && this.voices.length > 0) {
        this.selectedVoice = this.voices[0];
      }
    };

    updateVoices();
    if (speechSynthesis.onvoiceschanged !== undefined) {
      speechSynthesis.onvoiceschanged = updateVoices;
    }
  }

  setChapterData(verses) {
    this.stop();
    this.chapterVerses = verses || [];
    this.currentIndex = -1;
    this.currentVerse = null;
  }

  setRate(newRate) {
    this.rate = parseFloat(newRate) || 1.0;
    if (this.isPlaying && !this.isPaused) {
      // Re-read current verse with new rate
      const v = this.currentVerse;
      this.speakVerse(v, true);
    }
  }

  setVoice(voiceURI) {
    const v = this.voices.find(item => item.voiceURI === voiceURI);
    if (v) {
      this.selectedVoice = v;
    }
  }

  speakSingleVerse(verseNumber) {
    this.speakVerse(verseNumber, false);
  }

  speakVerse(verseNumber, continuous = true) {
    if (!this.synth) return;

    const index = this.chapterVerses.findIndex(item => item.verse === verseNumber);
    if (index === -1) return;

    this.synth.cancel();

    this.currentIndex = index;
    this.currentVerse = verseNumber;
    this.isContinuous = continuous;
    this.isPlaying = true;
    this.isPaused = false;

    const verseData = this.chapterVerses[index];
    const textToRead = this.cleanTextForTTS(verseData.en);

    const utterance = new SpeechSynthesisUtterance(textToRead);
    utterance.lang = "en-US";
    utterance.rate = this.rate;
    if (this.selectedVoice) {
      utterance.voice = this.selectedVoice;
    }

    utterance.onstart = () => {
      this.isPlaying = true;
      this.isPaused = false;
      if (this.onVerseStart) this.onVerseStart(verseNumber);
      if (this.onStateChange) this.onStateChange("playing", verseNumber);
    };

    utterance.onend = () => {
      if (this.onVerseEnd) this.onVerseEnd(verseNumber);

      if (this.isContinuous && this.isPlaying) {
        if (this.currentIndex + 1 < this.chapterVerses.length) {
          // Play next verse after short natural pause
          setTimeout(() => {
            if (this.isPlaying && !this.isPaused && this.isContinuous) {
              const nextVerseNumber = this.chapterVerses[this.currentIndex + 1].verse;
              this.speakVerse(nextVerseNumber, true);
            }
          }, 350);
        } else {
          // End of chapter
          this.isPlaying = false;
          this.currentVerse = null;
          if (this.onChapterComplete) this.onChapterComplete();
          if (this.onStateChange) this.onStateChange("idle", null);
        }
      } else {
        this.isPlaying = false;
        this.currentVerse = null;
        if (this.onStateChange) this.onStateChange("idle", null);
      }
    };

    utterance.onerror = (e) => {
      console.warn("TTS Utterance Error:", e);
      this.isPlaying = false;
      if (this.onStateChange) this.onStateChange("idle", null);
    };

    this.synth.speak(utterance);
  }

  play() {
    if (!this.synth || this.chapterVerses.length === 0) return;

    if (this.isPaused) {
      this.synth.resume();
      this.isPaused = false;
      this.isPlaying = true;
      if (this.onStateChange) this.onStateChange("playing", this.currentVerse);
      return;
    }

    // If starting from scratch or after stop
    const targetVerse = (this.currentVerse !== null) 
      ? this.currentVerse 
      : this.chapterVerses[0].verse;
    
    this.isContinuous = true;
    this.speakVerse(targetVerse);
  }

  pause() {
    if (!this.synth || !this.isPlaying) return;
    this.synth.pause();
    this.isPaused = true;
    if (this.onStateChange) this.onStateChange("paused", this.currentVerse);
  }

  togglePlayPause() {
    if (this.isPlaying && !this.isPaused) {
      this.pause();
    } else {
      this.play();
    }
  }

  stop() {
    if (this.synth) {
      this.synth.cancel();
    }
    const lastVerse = this.currentVerse;
    this.isPlaying = false;
    this.isPaused = false;
    if (lastVerse && this.onVerseEnd) {
      this.onVerseEnd(lastVerse);
    }
    this.currentVerse = null;
    if (this.onStateChange) this.onStateChange("idle", null);
  }

  nextVerse() {
    if (this.chapterVerses.length === 0) return;
    if (this.currentIndex + 1 < this.chapterVerses.length) {
      const nextNum = this.chapterVerses[this.currentIndex + 1].verse;
      this.speakVerse(nextNum);
    }
  }

  prevVerse() {
    if (this.chapterVerses.length === 0) return;
    if (this.currentIndex > 0) {
      const prevNum = this.chapterVerses[this.currentIndex - 1].verse;
      this.speakVerse(prevNum);
    } else if (this.currentIndex === 0) {
      this.speakVerse(this.chapterVerses[0].verse);
    }
  }

  cleanTextForTTS(text) {
    if (!text) return "";
    return text
      .replace(/\[\w+\]/g, "")      // remove cross-reference tags
      .replace(/\(\w+\)/g, "")
      .replace(/[—–]/g, ", ")       // dashes to brief pauses
      .trim();
  }
}

// Export singleton
window.BibleAudioPlayer = BibleAudioPlayer;
