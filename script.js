// script.js — overlay + robust playlist + song menu controls + cross-page resume
(function(){
  const OPENED_KEY = 'afk_opened';
  const IDX_KEY = 'afk_idx';
  const POS_KEY = 'afk_pos';
  const PLAYING_KEY = 'afk_playing';

  // UI
  let overlay = null;
  let fileInput = null;
  const menuBtnId = 'song-menu-btn';
  const menuId = 'song-menu';
  const titleId = 'song-title';
  const playPauseId = 'song-playpause';
  const prevId = 'song-prev';
  const nextId = 'song-next';

  // audio
  const audio = new Audio();
  audio.preload = 'auto';
  audio.crossOrigin = 'anonymous';
  audio.loop = false;

  let playlist = [];
  let currentIndex = 0;
  let saveInterval = null;

  const defaultPlaylist = [
    "Dystopic - dreamy nights.mp3",
    "Comfort Chain (speed up).mp3"
  ];

  // helpers
  function getPlaylistFromBody() {
    try {
      const raw = document.body.getAttribute('data-playlist') || document.body.dataset.playlist;
      if (!raw) return null;
      return raw.split(',').map(s => s.trim()).filter(Boolean);
    } catch(e){ return null; }
  }

  function encodeSrc(src) { return encodeURI(src); }

  function saveState(index, pos, playing) {
    try {
      if (typeof index === 'number') localStorage.setItem(IDX_KEY, String(index));
      if (typeof pos === 'number') localStorage.setItem(POS_KEY, String(pos));
      if (typeof playing !== 'undefined') localStorage.setItem(PLAYING_KEY, playing ? '1' : '0');
    } catch(e){}
  }

  function loadState() {
    try {
      const idx = parseInt(localStorage.getItem(IDX_KEY) || '0', 10) || 0;
      const pos = parseFloat(localStorage.getItem(POS_KEY) || '0') || 0;
      const playing = localStorage.getItem(PLAYING_KEY) === '1';
      return { idx, pos, playing };
    } catch(e){ return { idx:0, pos:0, playing:false }; }
  }

  // playlist playback helpers
  function setSongTitle(text) {
    const el = document.getElementById(titleId);
    if (el) el.textContent = text || '—';
  }
  
  function setPlayPauseIcon(paused) {
    const el = document.getElementById(playPauseId);
    if (el) el.textContent = paused ? '▶️' : '⏸️';
  }

  function startSaving() {
    if (saveInterval) return;
    saveInterval = setInterval(()=> {
      try { saveState(currentIndex, audio.currentTime || 0, !audio.paused); } catch(e){}
    }, 1000);
  }
  
  function stopSaving() { if (saveInterval) { clearInterval(saveInterval); saveInterval = null; } }

  function updateUIForCurrent() {
    const item = playlist[currentIndex] || '';
    setSongTitle(item);
    setPlayPauseIcon(audio.paused);
  }

  function playIndex(idx) {
    return new Promise((resolve, reject) => {
      if (!playlist || playlist.length === 0) return reject(new Error('empty-playlist'));
      currentIndex = ((idx % playlist.length) + playlist.length) % playlist.length;
      audio.src = encodeSrc(playlist[currentIndex]);
      audio.play().then(() => {
        saveState(currentIndex, audio.currentTime || 0, true);
        updateUIForCurrent();
        resolve();
      }).catch(err => reject(err));
    });
  }

  // try playing playlist starting at startIndex, try each track until one plays
  async function tryPlayPlaylist(startIndex) {
    if (!playlist || playlist.length === 0) return false;
    let start = startIndex % playlist.length;
    for (let attempt = 0; attempt < playlist.length; attempt++) {
      const tryIdx = (start + attempt) % playlist.length;
      try {
        await playIndex(tryIdx);
        return true;
      } catch (err) {
        console.warn('track failed to play', playlist[tryIdx], err && err.message);
      }
    }
    return false;
  }

  // overlay click open logic (user gesture)
  async function handleOpenGesture() {
    try { localStorage.setItem(OPENED_KEY, '1'); } catch(e){}
    if (overlay) overlay.style.display = 'none';

    playlist = getPlaylistFromBody() || defaultPlaylist.slice();
    if (playlist.length === 0) playlist = ['song.mp3'];

    const startIdx = Math.floor(Math.random() * playlist.length);
    const ok = await tryPlayPlaylist(startIdx).catch(()=>false);
    if (ok) {
      startSaving();
      return;
    }

    // try fallback song
    try {
      audio.src = encodeSrc('song.mp3');
      await audio.play();
      currentIndex = 0;
      startSaving();
      updateUIForCurrent();
      return;
    } catch (err) { console.warn('fallback song failed', err); }

    openFilePicker();
  }

  // file picker fallback
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
          updateUIForCurrent();
        }).catch(err=>console.warn('file play failed', err));
      });
    }
    fileInput.click();
  }

  // song menu UI toggling
  function toggleSongMenu(show) {
    const menu = document.getElementById(menuId);
    const btn = document.getElementById(menuBtnId);
    if (!menu || !btn) return;
    const isOpen = menu.getAttribute('aria-hidden') === 'false';
    const target = (typeof show === 'boolean') ? show : !isOpen;
    menu.setAttribute('aria-hidden', target ? 'false' : 'true');
    btn.setAttribute('aria-expanded', target ? 'true' : 'false');
    if (target) {
      updateUIForCurrent();
    }
  }

  // Attach DOM handlers after DOMContentLoaded
  document.addEventListener('DOMContentLoaded', () => {
    // ensure animated gradient exists once
    if (!document.querySelector('.body-gradient')) {
      const bg = document.createElement('div'); bg.className = 'body-gradient'; document.documentElement.appendChild(bg);
    }

    overlay = document.getElementById('open-overlay');
    fileInput = document.getElementById('file-input') || null;

    // song menu button wiring (exists in header)
    const menuBtn = document.getElementById(menuBtnId);
    const menu = document.getElementById(menuId);
    if (menuBtn && menu) {
      menuBtn.addEventListener('click', (e) => {
        e.preventDefault();
        toggleSongMenu();
      });
      // close when clicking outside
      document.addEventListener('click', (e) => {
        if (!menu.contains(e.target) && !menuBtn.contains(e.target)) {
          toggleSongMenu(false);
        }
      });
      // wire up controls inside menu
      const playBtn = document.getElementById(playPauseId);
      const prevBtn = document.getElementById(prevId);
      const nextBtn = document.getElementById(nextId);
      const titleEl = document.getElementById(titleId);

      if (playBtn) {
        playBtn.addEventListener('click', async (ev) => {
          ev.preventDefault();
          if (!playlist || playlist.length === 0) playlist = getPlaylistFromBody() || defaultPlaylist.slice();
          if (audio.paused) {
            try {
              await audio.play();
              setPlayPauseIcon(false);
              startSaving();
            } catch (err) {
              console.warn('Play failed:', err);
            }
          } else {
            audio.pause();
            setPlayPauseIcon(true);
            saveState(currentIndex, audio.currentTime || 0, false);
          }
          updateUIForCurrent();
        });
      }
      if (prevBtn) {
        prevBtn.addEventListener('click', async (ev) => {
          ev.preventDefault();
          if (!playlist || playlist.length === 0) playlist = getPlaylistFromBody() || defaultPlaylist.slice();
          currentIndex = (currentIndex - 1 + playlist.length) % playlist.length;
          try {
            await playIndex(currentIndex);
            startSaving();
          } catch (err) { console.warn('Prev track failed:', err); }
        });
      }
      if (nextBtn) {
        nextBtn.addEventListener('click', async (ev) => {
          ev.preventDefault();
          if (!playlist || playlist.length === 0) playlist = getPlaylistFromBody() || defaultPlaylist.slice();
          currentIndex = (currentIndex + 1) % playlist.length;
          try {
            await playIndex(currentIndex);
            startSaving();
          } catch (err) { console.warn('Next track failed:', err); }
        });
      }
    }

    // overlay attach; only show overlay if not already opened
    if (overlay) {
      let opened = false;
      try { opened = localStorage.getItem(OPENED_KEY) === '1'; } catch(e){}
      if (opened) overlay.style.display = 'none';
      else {
        overlay.addEventListener('click', () => { handleOpenGesture().then(startSaving).catch(startSaving); });
        overlay.addEventListener('keydown', (e) => { if (e.key === 'Enter' || e.key === ' ') { handleOpenGesture().then(startSaving).catch(startSaving); } });
      }
    }

    // attempt auto-restore (may be blocked by autoplay)
    (async function attemptRestore() {
      let opened = false;
      try { opened = localStorage.getItem(OPENED_KEY) === '1'; } catch(e){}
      if (!opened) return;

      playlist = getPlaylistFromBody() || defaultPlaylist.slice();
      if (playlist.length === 0) playlist = ['song.mp3'];

      const st = loadState();
      currentIndex = st.idx || 0;
      const pos = st.pos || 0;

      try {
        await playIndex(currentIndex);
        // try to set position when metadata is available
        try {
          if (pos && audio.duration && pos < audio.duration) audio.currentTime = pos;
          else if (pos) {
            audio.addEventListener('loadedmetadata', function once() {
              try { if (pos < audio.duration) audio.currentTime = pos; } catch(e){}
              audio.removeEventListener('loadedmetadata', once);
            });
          }
        } catch(e){ console.warn('set time failed', e); }
        startSaving();
      } catch (err) {
        console.warn('Auto-restore failed:', err);
      }
    })();

  }); // DOMContentLoaded

  // audio ended => next
  audio.addEventListener('ended', () => {
    if (!playlist || playlist.length === 0) return;
    currentIndex = (currentIndex + 1) % playlist.length;
    audio.src = encodeSrc(playlist[currentIndex]);
    audio.play().catch(err => {
      console.warn('play next failed', err);
    });
    updateUIForCurrent();
  });

  // update UI when play/pause toggles (for menu)
  audio.addEventListener('play', () => { setPlayPauseIcon(false); startSaving(); updateUIForCurrent(); });
  audio.addEventListener('pause', () => { setPlayPauseIcon(true); stopSaving(); updateUIForCurrent(); });

  // before unload save
  window.addEventListener('beforeunload', () => {
    try { saveState(currentIndex, audio.currentTime || 0, !audio.paused); } catch(e){}
    stopSaving();
  });
  document.addEventListener('visibilitychange', () => {
    if (document.hidden) try { saveState(currentIndex, audio.currentTime || 0, !audio.paused); } catch(e){}
  });

  // expose small API for dev console debugging (optional)
  window.__afk_audio = { audio, get playlist(){ return playlist; }, get index(){ return currentIndex; } };

})();
