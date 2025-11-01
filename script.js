// script.js — robust overlay + playlist + resume-across-pages logic
// Usage: put your mp3 files in the same folder and/or set <body data-playlist="a.mp3, b.mp3">

(function(){
  const OPENED_KEY = 'afk_opened';
  const IDX_KEY = 'afk_idx';
  const POS_KEY = 'afk_pos';
  const PLAYING_KEY = 'afk_playing';

  // UI elements (overlay exists only on index/home page)
  let overlay = null;
  let fileInput = null;
  let resumeBtn = null;

  // audio element and state
  const audio = new Audio();
  audio.preload = 'auto';
  audio.crossOrigin = 'anonymous';
  audio.loop = false;

  let currentIndex = 0;
  let playlist = [];

  // default playlist (your two files)
  const defaultPlaylist = [
    "𝙳 𝚈 𝚂 𝚃 𝙾 𝙿 𝙸 𝙲 - dreamy nights (youtube).mp3",
    "instupendo - comfort chain (speed up) - kew3z (youtube).mp3"
  ];

  // helper: build playlist (body dataset overrides)
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
    // encodeURI preserves path-safe chars, and handles spaces & unicode reasonably.
    // If your filenames are in the same folder, this will form a valid URL for the browser to request.
    return encodeURI(src);
  }

  function saveState(index, pos, playing) {
    try {
      if (typeof index === 'number') localStorage.setItem(IDX_KEY, String(index));
      if (typeof pos === 'number') localStorage.setItem(POS_KEY, String(pos));
      if (typeof playing !== 'undefined') localStorage.setItem(PLAYING_KEY, playing ? '1' : '0');
    } catch (e) {
      // ignore storage errors (e.g., private mode)
    }
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

  function tryPlayAt(idx) {
    return new Promise((resolve, reject) => {
      if (!playlist || playlist.length === 0) return reject(new Error('empty-playlist'));
      currentIndex = idx % playlist.length;
      const src = encodeSrc(playlist[currentIndex]);
      audio.src = src;
      // attempt playback
      audio.play().then(() => {
        saveState(currentIndex, audio.currentTime || 0, true);
        resolve(true);
      }).catch(err => {
        reject(err);
      });
    });
  }

  // attempt to play playlist starting at startIndex; try each track once if some fail.
  async function tryPlayPlaylist(startIndex) {
    if (!playlist || playlist.length === 0) return false;
    let start = startIndex % playlist.length;
    for (let attempt = 0; attempt < playlist.length; attempt++) {
      const tryIdx = (start + attempt) % playlist.length;
      try {
        await tryPlayAt(tryIdx);
        return true;
      } catch (err) {
        console.warn('track failed to play:', playlist[tryIdx], err && err.message);
      }
    }
    return false;
  }

  // fallback file picker
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
          hideResumeButton();
        }).catch(err => console.warn('file-play failed', err));
      });
    }
    fileInput.click();
  }

  // small resume button for pages where autoplay is blocked
  function createResumeButton() {
    if (resumeBtn) return;
    resumeBtn = document.createElement('button');
    resumeBtn.innerText = 'Resume audio';
    resumeBtn.title = 'Resume site audio';
    resumeBtn.style.position = 'fixed';
    resumeBtn.style.right = '12px';
    resumeBtn.style.top = '12px';
    resumeBtn.style.zIndex = 60;
    resumeBtn.style.padding = '8px 10px';
    resumeBtn.style.borderRadius = '8px';
    resumeBtn.style.border = 'none';
    resumeBtn.style.background = 'linear-gradient(90deg,#d94f4f,#ff9a4d)';
    resumeBtn.style.color = '#071018';
    resumeBtn.style.fontWeight = '700';
    resumeBtn.style.cursor = 'pointer';
    resumeBtn.style.boxShadow = '0 6px 18px rgba(0,0,0,0.5)';
    resumeBtn.addEventListener('click', async () => {
      hideResumeButton();
      // attempt resume from saved state
      const st = loadState();
      playlist = getPlaylistFromBody() || defaultPlaylist.slice();
      if (playlist.length === 0) playlist = ['song.mp3'];
      currentIndex = st.idx || 0;
      try {
        await tryPlayAt(currentIndex);
        // set time if saved
        try { if (st.pos && audio.duration && st.pos < audio.duration) audio.currentTime = st.pos; } catch(e){}
        startSaving();
      } catch (err) {
        // try to play playlist from random spot
        const ok = await tryPlayPlaylist(Math.floor(Math.random() * playlist.length));
        if (!ok) {
          // fallback: open file picker
          openFilePicker();
        } else {
          startSaving();
        }
      }
    });
    document.body.appendChild(resumeBtn);
  }

  function hideResumeButton() {
    if (resumeBtn && resumeBtn.parentNode) resumeBtn.parentNode.removeChild(resumeBtn);
    resumeBtn = null;
  }

  // save periodically
  let saveInterval = null;
  function startSaving() {
    if (saveInterval) return;
    saveInterval = setInterval(() => {
      try { saveState(currentIndex, audio.currentTime || 0, !audio.paused); } catch(e){}
    }, 1000);
  }
  function stopSaving() {
    if (saveInterval) { clearInterval(saveInterval); saveInterval = null; }
  }

  // handle end-of-track -> play next (wrap)
  audio.addEventListener('ended', () => {
    if (!playlist || playlist.length === 0) return;
    currentIndex = (currentIndex + 1) % playlist.length;
    const next = encodeSrc(playlist[currentIndex]);
    audio.src = next;
    audio.play().catch(err => {
      console.warn('play next failed', err);
      // if fails, show resume button so user can resume manually
      createResumeButton();
    });
  });

  // main "open" invoked by overlay click (user gesture)
  async function handleOpenGesture() {
    try {
      localStorage.setItem(OPENED_KEY, '1');
    } catch (e){}
    if (overlay) overlay.style.display = 'none';
    playlist = getPlaylistFromBody() || defaultPlaylist.slice();
    if (playlist.length === 0) playlist = ['song.mp3'];

    const startIdx = Math.floor(Math.random() * playlist.length);
    const ok = await tryPlayPlaylist(startIdx).catch(()=>false);
    if (ok) {
      startSaving();
      hideResumeButton();
      // save initial state
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

    // final fallback: show file picker
    openFilePicker();
  }

  // Attempt restoration on page load (may be blocked by autoplay)
  async function attemptRestoreOnLoad() {
    // only try if overlay was previously opened
    let opened = false;
    try { opened = localStorage.getItem(OPENED_KEY) === '1'; } catch(e){}
    if (!opened) return;

    playlist = getPlaylistFromBody() || defaultPlaylist.slice();
    if (playlist.length === 0) playlist = ['song.mp3'];

    const st = loadState();
    currentIndex = st.idx || 0;
    const pos = st.pos || 0;

    try {
      await tryPlayAt(currentIndex);
      // set time if possible
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
      hideResumeButton();
    } catch (err) {
      // autoplay blocked or failed — show resume button to let the user click once to resume
      console.warn('Autoplay restore blocked or failed:', err && err.message);
      createResumeButton();
    }
  }

  // hook up overlay and DOM
  document.addEventListener('DOMContentLoaded', () => {
    // ensure animated gradient exists one time
    if (!document.querySelector('.body-gradient')) {
      const bg = document.createElement('div');
      bg.className = 'body-gradient';
      document.documentElement.appendChild(bg);
    }

    overlay = document.getElementById('open-overlay');
    // ensure fileInput exists (some pages may already have it)
    fileInput = document.getElementById('file-input') || null;

    // attach overlay handler (if overlay exists on this page)
    if (overlay) {
      // only show overlay if not already opened
      let opened = false;
      try { opened = localStorage.getItem(OPENED_KEY) === '1'; } catch(e){}
      if (opened) overlay.style.display = 'none';
      else {
        // attach safe handlers
        overlay.addEventListener('click', () => {
          // handleOpenGesture returns a promise; start saving after it completes or fails
          handleOpenGesture().then(startSaving).catch(startSaving);
        });
        overlay.addEventListener('keydown', (e) => { if (e.key === 'Enter' || e.key === ' ') { handleOpenGesture().then(startSaving).catch(startSaving); } });
      }
    }

    // attempt to restore on this page (will show resume button if blocked)
    attemptRestoreOnLoad();
  });

  // save on visibility change / unload
  window.addEventListener('beforeunload', () => {
    try { saveState(currentIndex, audio.currentTime || 0, !audio.paused); } catch(e){}
    stopSaving();
  });
  document.addEventListener('visibilitychange', () => {
    if (document.hidden) {
      try { saveState(currentIndex, audio.currentTime || 0, !audio.paused); } catch(e){}
    }
  });

})();
