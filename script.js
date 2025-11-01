// script.js
(function(){
  const overlay = document.getElementById('open-overlay');
  const fileInput = document.getElementById('file-input');

  const audio = new Audio();
  audio.loop = false; // playlist handled manually
  audio.preload = 'auto';
  audio.crossOrigin = 'anonymous';

  // Default playlist (your provided filenames). Put these files next to HTML.
  const defaultPlaylist = [
    "𝙳 𝚈 𝚂 𝚃 𝙾 𝙿 𝙸 𝙲 - dreamy nights (youtube).mp3",
    "instupendo - comfort chain (speed up) - kew3z (youtube).mp3"
  ];

  // localStorage keys
  const OPENED_KEY = 'afk_opened';
  const IDX_KEY = 'afk_idx';
  const POS_KEY = 'afk_pos';
  const PLAYING_KEY = 'afk_playing';

  function getPlaylistFromBody() {
    const raw = document.body.dataset.playlist;
    if (!raw) return null;
    return raw.split(',').map(s => s.trim()).filter(Boolean);
  }

  function encodeSrc(src) {
    return encodeURI(src);
  }

  function saveState(index, pos, playing) {
    try {
      if (typeof index === 'number') localStorage.setItem(IDX_KEY, String(index));
      if (typeof pos === 'number') localStorage.setItem(POS_KEY, String(pos));
      if (typeof playing !== 'undefined') localStorage.setItem(PLAYING_KEY, playing ? '1' : '0');
    } catch (e) { /* ignore storage errors */ }
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

  function playAt(index, playlist) {
    if (!playlist || playlist.length === 0) return Promise.reject(new Error('empty-playlist'));
    const src = encodeSrc(playlist[index]);
    audio.src = src;
    return audio.play();
  }

  async function tryPlayPlaylist(playlist, startIndex) {
    if (!playlist || playlist.length === 0) return Promise.reject(new Error('no-playlist'));
    let idx = startIndex % playlist.length;
    for (let attempt = 0; attempt < playlist.length; attempt++) {
      const tryIdx = (idx + attempt) % playlist.length;
      try {
        await playAt(tryIdx, playlist);
        currentIndex = tryIdx;
        console.log('Playing:', playlist[currentIndex]);
        return true;
      } catch (err) {
        console.warn('Failed to play', playlist[tryIdx], err && err.message);
      }
    }
    return false;
  }

  async function handleOpen() {
    try { localStorage.setItem(OPENED_KEY,'1'); } catch(e){}
    if (overlay) overlay.style.display = 'none';

    let playlist = getPlaylistFromBody() || defaultPlaylist.slice();
    if (playlist.length === 0) playlist = ["song.mp3"];

    const startIdx = Math.floor(Math.random() * playlist.length);

    const ok = await tryPlayPlaylist(playlist, startIdx);
    if (ok) {
      // resume position from storage if exists (user clicked previously and navigation happened)
      const st = loadState();
      if (st && typeof st.pos === 'number' && st.pos > 0) {
        // if stored index matches current set, jump to that time
        if (st.idx === currentIndex) {
          try { audio.currentTime = st.pos; } catch(e){ console.warn('set currentTime failed', e); }
        }
      }

      audio.onended = () => {
        currentIndex = (currentIndex + 1) % playlist.length;
        const nextSrc = encodeSrc(playlist[currentIndex]);
        audio.src = nextSrc;
        audio.play().catch(err => {
          console.warn('Failed to play next track', nextSrc, err && err.message);
        });
      };

      // mark playing
      saveState(currentIndex, audio.currentTime || 0, true);
      return;
    }

    // fallback to song.mp3
    try {
      await playAt(0, ["song.mp3"]);
      currentIndex = 0;
      saveState(currentIndex, audio.currentTime || 0, true);
      return;
    } catch (err) {
      console.warn('Fallback song.mp3 failed, opening file picker', err && err.message);
    }

    if (fileInput) fileInput.click();
  }

  // file picker handler
  if (fileInput) {
    fileInput.addEventListener('change', (e) => {
      const f = e.target.files && e.target.files[0];
      if (!f) return;
      const url = URL.createObjectURL(f);
      audio.src = url;
      audio.play().then(()=> {
        console.log('Playing selected file');
        saveState(0, audio.currentTime || 0, true);
      }).catch(err=>console.warn(err));
    });
  }

  // periodically save current time and index so it can be resumed across pages
  let saveInterval = null;
  function startSaving() {
    if (saveInterval) return;
    saveInterval = setInterval(() => {
      try {
        saveState(currentIndex, audio.currentTime || 0, !audio.paused);
      } catch(e){}
    }, 1000); // save every second
  }
  function stopSaving() {
    if (saveInterval) { clearInterval(saveInterval); saveInterval = null; }
  }

  // restore on page load if user previously opened overlay and playback was started
  (function attemptRestoreOnLoad(){
    let opened = false;
    try { opened = localStorage.getItem(OPENED_KEY) === '1'; } catch(e){}
    if (!opened) return;

    // build playlist
    let playlist = getPlaylistFromBody() || defaultPlaylist.slice();
    if (playlist.length === 0) playlist = ["song.mp3"];

    // load saved position/index
    const state = loadState();
    currentIndex = (typeof state.idx === 'number') ? state.idx : 0;
    const pos = (typeof state.pos === 'number') ? state.pos : 0;

    // attempt to play the saved track and set currentTime
    (async () => {
      try {
        await playAt(currentIndex, playlist);
        // set position (some browsers require small timeout before setting currentTime)
        try {
          if (pos && audio.duration && pos < audio.duration) {
            audio.currentTime = pos;
          } else if (pos) {
            // try after metadata loads
            audio.addEventListener('loadedmetadata', function once() {
              try { if (pos < audio.duration) audio.currentTime = pos; } catch(e){}
              audio.removeEventListener('loadedmetadata', once);
            });
          }
        } catch(e){ console.warn('set time error', e); }

        // setup onended to continue playlist
        audio.onended = () => {
          currentIndex = (currentIndex + 1) % playlist.length;
          const nextSrc = encodeSrc(playlist[currentIndex]);
          audio.src = nextSrc;
          audio.play().catch(err => console.warn('Failed next', err));
        };

        startSaving();
      } catch (err) {
        console.warn('Restore play attempt failed', err && err.message);
      }
    })();
  })();

  // overlay show logic (only on pages that include it)
  if (overlay) {
    let opened = false;
    try { opened = localStorage.getItem(OPENED_KEY) === '1'; } catch(e){}
    if (opened) {
      overlay.style.display = 'none';
    } else {
      overlay.addEventListener('click', () => {
        handleOpen().then(() => startSaving()).catch(()=>startSaving());
      });
      overlay.addEventListener('keydown', (e) => { if (e.key === 'Enter' || e.key === ' ') { handleOpen().then(()=>startSaving()).catch(()=>startSaving()); } });
    }
  }

  // save state on beforeunload and stop saving
  window.addEventListener('beforeunload', () => {
    try {
      saveState(currentIndex, audio.currentTime || 0, !audio.paused);
    } catch(e){}
    stopSaving();
  });

  // also save when page becomes hidden (user switches tab)
  document.addEventListener('visibilitychange', () => {
    if (document.hidden) {
      try { saveState(currentIndex, audio.currentTime || 0, !audio.paused); } catch(e){}
    }
  });

  // ensure single animated gradient overlay exists across pages
  if (!document.querySelector('.body-gradient')) {
    const bg = document.createElement('div');
    bg.className = 'body-gradient';
    document.documentElement.appendChild(bg);
  }

  // state
  let currentIndex = 0;

})();
