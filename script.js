// script.js
// Playlist playback + overlay + persistent unique visit count via countapi.xyz
// - Playlist loops through tracks sequentially (wraps).
// - Visits counter increments once per browser (localStorage.afk_counted) using countapi.xyz.
// - If autoplay blocked on page-load restore, a small "Resume audio" button will appear.

(function(){
  // ---- localStorage keys ----
  const OPENED_KEY = 'afk_opened';
  const IDX_KEY = 'afk_idx';
  const POS_KEY = 'afk_pos';
  const PLAYING_KEY = 'afk_playing';
  const COUNTED_KEY = 'afk_counted'; // for visits

  // ---- DOM references (populated on DOMContentLoaded) ----
  let overlay = null;
  let fileInput = null;
  let resumeBtn = null;
  let visitsEl = null;
  let visCountSpan = null;

  // ---- audio / playlist state ----
  const audio = new Audio();
  audio.preload = 'auto';
  audio.crossOrigin = 'anonymous';
  audio.loop = false; // playlist handled manually
  let currentIndex = 0;
  let playlist = [];

  // ---- default playlist (your provided filenames) ----
  const defaultPlaylist = [
    "𝙳 𝚈 𝚂 𝚃 𝙾 𝙿 𝙸 𝙲 - dreamy nights (youtube).mp3",
    "instupendo - comfort chain (speed up) - kew3z (youtube).mp3"
  ];

  // ---- countapi settings (global visits) ----
  // namespace/key — change if you want a different counter
  const COUNT_NAMESPACE = 'afk-lol';
  const COUNT_KEY = 'visits';
  const COUNT_HIT_URL = `https://api.countapi.xyz/hit/${encodeURIComponent(COUNT_NAMESPACE)}/${encodeURIComponent(COUNT_KEY)}`;
  const COUNT_GET_URL = `https://api.countapi.xyz/get/${encodeURIComponent(COUNT_NAMESPACE)}/${encodeURIComponent(COUNT_KEY)}`;

  // ---------- helpers ----------
  function getPlaylistFromBody() {
    try {
      const raw = document.body.getAttribute('data-playlist') || document.body.dataset.playlist;
      if (!raw) return null;
      return raw.split(',').map(s => s.trim()).filter(Boolean);
    } catch (e) {
      return null;
    }
  }

  function encodeSrc(src) {
    return encodeURI(src);
  }

  function saveState(index, pos, playing) {
    try {
      if (typeof index === 'number') localStorage.setItem(IDX_KEY, String(index));
      if (typeof pos === 'number') localStorage.setItem(POS_KEY, String(pos));
      if (typeof playing !== 'undefined') localStorage.setItem(PLAYING_KEY, playing ? '1' : '0');
    } catch (e) {}
  }

  function loadState() {
    try {
      const idx = parseInt(localStorage.getItem(IDX_KEY) || '0', 10) || 0;
      const pos = parseFloat(localStorage.getItem(POS_KEY) || '0') || 0;
      const playing = localStorage.getItem(PLAYING_KEY) === '1';
      return { idx, pos, playing };
    } catch (e) {
      return { idx:0, pos:0, playing:false };
    }
  }

  // ---------- visits (countapi) ----------
  async function fetchAndMaybeIncrementVisits() {
    // If user already counted from this browser, do GET only; otherwise call /hit to increment and set flag.
    const counted = localStorage.getItem(COUNTED_KEY) === '1';
    try {
      if (!counted) {
        // increment (hit)
        const res = await fetch(COUNT_HIT_URL, { method: 'GET' }); // countapi uses GET for hit as well
        if (res.ok) {
          const json = await res.json();
          if (json && (typeof json.value !== 'undefined')) {
            visCountSpan.textContent = String(json.value);
            try { localStorage.setItem(COUNTED_KEY,'1'); } catch(e){}
            return;
          }
        }
      }
      // otherwise get current value
      const g = await fetch(COUNT_GET_URL, { method: 'GET' });
      if (g.ok) {
        const j = await g.json();
        if (j && (typeof j.value !== 'undefined')) {
          visCountSpan.textContent = String(j.value);
          return;
        }
      }
    } catch (err) {
      console.warn('visits fetch failed', err);
      // if API fails, show dash
      visCountSpan.textContent = '—';
    }
  }

  // ---------- playback functions ----------
  function playAt(index) {
    return new Promise((resolve, reject) => {
      if (!playlist || playlist.length === 0) return reject(new Error('empty-playlist'));
      currentIndex = index % playlist.length;
      const src = encodeSrc(playlist[currentIndex]);
      audio.src = src;
      audio.play().then(() => {
        saveState(currentIndex, audio.currentTime || 0, true);
        resolve(true);
      }).catch(err => reject(err));
    });
  }

  async function tryPlayPlaylist(startIndex) {
    if (!playlist || playlist.length === 0) return false;
    let start = startIndex % playlist.length;
    for (let attempt = 0; attempt < playlist.length; attempt++) {
      const tryIdx = (start + attempt) % playlist.length;
      try {
        await playAt(tryIdx);
        return true;
      } catch (err) {
        console.warn('track failed to play:', playlist[tryIdx], err && err.message);
      }
    }
    return false;
  }

  // ---------- file picker fallback ----------
  function openFilePicker() {
    if (!fileInput) {
      fileInput = document.createElement('input');
      fileInput.type = 'file';
      fileInput.accept = '.mp3';
      fileInput.style.display = 'none';
      document.body.appendChild(fileInput);
      fileInput.addEventListener('change', (e) => {
        const f = e.target.files && e.target.files[0];
        if (!f) return;
        const url = URL.createObjectURL(f);
        audio.src = url;
        audio.play().then(()=> {
          saveState(0, audio.currentTime || 0, true);
          startSaving();
          removeResumeButton();
        }).catch(err => console.warn('file-play failed', err));
      });
    }
    fileInput.click();
  }

  // ---------- resume button ----------
  function createResumeButton() {
    if (resumeBtn) return;
    resumeBtn = document.createElement('button');
    resumeBtn.innerText = 'Resume audio';
    resumeBtn.title = 'Resume site audio';
    Object.assign(resumeBtn.style, {
      position: 'fixed',
      right: '12px',
      top: '12px',
      zIndex: 60,
      padding: '8px 10px',
      borderRadius: '8px',
      border: 'none',
      background: 'linear-gradient(90deg,#d94f4f,#ff9a4d)',
      color: '#071018',
      fontWeight: '700',
      cursor: 'pointer',
      boxShadow: '0 6px 18px rgba(0,0,0,0.5)'
    });
    resumeBtn.addEventListener('click', async () => {
      removeResumeButton();
      const st = loadState();
      playlist = getPlaylistFromBody() || defaultPlaylist.slice();
      if (playlist.length === 0) playlist = ['song.mp3'];
      currentIndex = st.idx || 0;
      try {
        await playAt(currentIndex);
        try { if (st.pos && audio.duration && st.pos < audio.duration) audio.currentTime = st.pos; } catch(e){}
        startSaving();
      } catch (err) {
        const ok = await tryPlayPlaylist(Math.floor(Math.random() * playlist.length));
        if (!ok) openFilePicker();
        else startSaving();
      }
    });
    document.body.appendChild(resumeBtn);
  }
  function removeResumeButton() {
    if (resumeBtn && resumeBtn.parentNode) resumeBtn.parentNode.removeChild(resumeBtn);
    resumeBtn = null;
  }

  // ---------- periodic saving ----------
  let saveInterval = null;
  function startSaving() {
    if (saveInterval) return;
    saveInterval = setInterval(() => {
      try { localStorage.setItem(IDX_KEY, String(currentIndex)); localStorage.setItem(POS_KEY, String(audio.currentTime || 0)); localStorage.setItem(PLAYING_KEY, audio.paused ? '0' : '1'); } catch(e){}
    }, 1000);
  }
  function stopSaving() {
    if (saveInterval) { clearInterval(saveInterval); saveInterval = null; }
  }

  // ---------- audio ended => next ----------
  audio.addEventListener('ended', () => {
    if (!playlist || playlist.length === 0) return;
    currentIndex = (currentIndex + 1) % playlist.length;
    const next = encodeSrc(playlist[currentIndex]);
    audio.src = next;
    audio.play().catch(err => {
      console.warn('play next failed', err);
      createResumeButton();
    });
  });

  // ---------- main open handler (user gesture) ----------
  async function handleOpenGesture() {
    try { localStorage.setItem(OPENED_KEY, '1'); } catch(e){}
    if (overlay) overlay.style.display = 'none';

    playlist = getPlaylistFromBody() || defaultPlaylist.slice();
    if (playlist.length === 0) playlist = ['song.mp3'];

    const startIdx = Math.floor(Math.random() * playlist.length);
    const ok = await tryPlayPlaylist(startIdx).catch(()=>false);
    if (ok) {
      startSaving();
      removeResumeButton();
      saveState(currentIndex, audio.currentTime || 0, true);
      return;
    }

    // fallback to song.mp3
    try {
      audio.src = encodeSrc('song.mp3');
      await audio.play();
      currentIndex = 0;
      startSaving();
      return;
    } catch (err) {
      console.warn('fallback song.mp3 play failed', err);
    }

    // final fallback
    openFilePicker();
  }

  // ---------- attempt restore on load (autoplay may be blocked) ----------
  async function attemptRestoreOnLoad() {
    let opened = false;
    try { opened = localStorage.getItem(OPENED_KEY) === '1'; } catch(e){}
    if (!opened) return;

    playlist = getPlaylistFromBody() || defaultPlaylist.slice();
    if (playlist.length === 0) playlist = ['song.mp3'];

    const st = loadState();
    currentIndex = st.idx || 0;
    const pos = st.pos || 0;

    try {
      await playAt(currentIndex);
      try {
        if (pos && audio.duration && pos < audio.duration) {
          audio.currentTime = pos;
        } else if (pos) {
          audio.addEventListener('loadedmetadata', function once() {
            try { if (pos < audio.duration) audio.currentTime = pos; } catch(e){}
            audio.removeEventListener('loadedmetadata', once);
          });
        }
      } catch(e){ console.warn('set time failed', e); }
      startSaving();
      removeResumeButton();
    } catch (err) {
      console.warn('Autoplay restore blocked or failed:', err && err.message);
      // let user manually resume
      createResumeButton();
    }
  }

  // ---------- visits initialization ----------
  function initVisitsElements() {
    visitsEl = document.getElementById('visits-display');
    visCountSpan = document.getElementById('vis-count');
    if (!visCountSpan) {
      // fallback: nothing to do
      return;
    }
    // fetch & update (increment only once per browser)
    fetchAndMaybeIncrementVisits();
  }

  // ---------- DOM ready ----------
  document.addEventListener('DOMContentLoaded', () => {
    // ensure moving gradient exists
    if (!document.querySelector('.body-gradient')) {
      const bg = document.createElement('div');
      bg.className = 'body-gradient';
      document.documentElement.appendChild(bg);
    }

    overlay = document.getElementById('open-overlay');
    fileInput = document.getElementById('file-input') || null;

    // visits
    initVisitsElements();

    // overlay handling (only present on home page)
    if (overlay) {
      let opened = false;
      try { opened = localStorage.getItem(OPENED_KEY) === '1'; } catch(e){}
      if (opened) overlay.style.display = 'none';
      else {
        overlay.addEventListener('click', () => { handleOpenGesture().then(startSaving).catch(startSaving); });
        overlay.addEventListener('keydown', (e) => { if (e.key === 'Enter' || e.key === ' ') handleOpenGesture().then(startSaving).catch(startSaving); });
      }
    }

    // attempt restore on any page
    attemptRestoreOnLoad();
  });

  // save on unload/visibility change
  window.addEventListener('beforeunload', () => {
    try { localStorage.setItem(IDX_KEY, String(currentIndex)); localStorage.setItem(POS_KEY, String(audio.currentTime || 0)); localStorage.setItem(PLAYING_KEY, audio.paused ? '0' : '1'); } catch(e){}
    stopSaving();
  });
  document.addEventListener('visibilitychange', () => {
    if (document.hidden) {
      try { localStorage.setItem(IDX_KEY, String(currentIndex)); localStorage.setItem(POS_KEY, String(audio.currentTime || 0)); localStorage.setItem(PLAYING_KEY, audio.paused ? '0' : '1'); } catch(e){}
    }
  });

  // ---- end of script ----
})();
