// script.js — playlist + overlay + dropdown controls + resume across pages
(function(){
  const OPENED_KEY = 'afk_opened';
  const IDX_KEY = 'afk_idx';
  const POS_KEY = 'afk_pos';
  const PLAYING_KEY = 'afk_playing';

  // DOM references
  let overlay = null;
  let fileInput = null;
  const songToggleBtn = () => document.getElementById('song-toggle');
  const songDropdown = () => document.getElementById('song-dropdown');
  const songTitleEl = () => document.getElementById('song-title');
  const btnPlay = () => document.getElementById('song-play');
  const btnPause = () => document.getElementById('song-pause');
  const btnNext = () => document.getElementById('song-next');
  const btnPrev = () => document.getElementById('song-prev');

  // audio & state
  const audio = new Audio();
  audio.preload = 'auto';
  audio.crossOrigin = 'anonymous';
  audio.loop = false;

  let playlist = [];
  let currentIndex = 0;
  let saveInterval = null;

  const defaultPlaylist = [
    "𝙳 𝚈 𝚂 𝚃 𝙾 𝙿 𝙸 𝙲 - dreamy nights (youtube).mp3",
    "instupendo - comfort chain (speed up) - kew3z (youtube).mp3"
  ];

  function getPlaylistFromBody() {
    try {
      const raw = document.body.getAttribute('data-playlist') || document.body.dataset.playlist;
      if (!raw) return null;
      return raw.split(',').map(s => s.trim()).filter(Boolean);
    } catch (e) { return null; }
  }

  function encodeSrc(s){ return encodeURI(s); }

  function saveState(idx, pos, playing){
    try {
      if (typeof idx === 'number') localStorage.setItem(IDX_KEY, String(idx));
      if (typeof pos === 'number') localStorage.setItem(POS_KEY, String(pos));
      if (typeof playing !== 'undefined') localStorage.setItem(PLAYING_KEY, playing ? '1' : '0');
    } catch(e){}
  }

  function loadState(){
    try {
      const idx = parseInt(localStorage.getItem(IDX_KEY) || '0', 10) || 0;
      const pos = parseFloat(localStorage.getItem(POS_KEY) || '0') || 0;
      const playing = localStorage.getItem(PLAYING_KEY) === '1';
      return { idx, pos, playing };
    } catch(e){ return { idx:0, pos:0, playing:false }; }
  }

  // Update visible song title in dropdown
  function updateSongTitle(){
    const el = songTitleEl();
    if (!el) return;
    const title = playlist && playlist[currentIndex] ? playlist[currentIndex] : '—';
    el.textContent = title;
  }

  // play a track at index (returns promise)
  function playAt(index){
    return new Promise((resolve, reject) => {
      if (!playlist || playlist.length === 0) return reject(new Error('empty-playlist'));
      currentIndex = index % playlist.length;
      const src = encodeSrc(playlist[currentIndex]);
      audio.src = src;
      audio.play().then(() => {
        saveState(currentIndex, audio.currentTime || 0, true);
        updateSongTitle();
        resolve();
      }).catch(err => reject(err));
    });
  }

  // try to play starting at startIndex, falling back to other tracks if one fails
  async function tryPlayPlaylist(startIndex){
    if (!playlist || playlist.length === 0) return false;
    let start = startIndex % playlist.length;
    for (let attempt = 0; attempt < playlist.length; attempt++){
      const tryIdx = (start + attempt) % playlist.length;
      try {
        await playAt(tryIdx);
        return true;
      } catch(e){
        console.warn('track play failed:', playlist[tryIdx], e && e.message);
      }
    }
    return false;
  }

  // start periodic saves
  function startSaving(){
    if (saveInterval) return;
    saveInterval = setInterval(()=> {
      try { saveState(currentIndex, audio.currentTime || 0, !audio.paused); } catch(e){}
    }, 1000);
  }
  function stopSaving(){ if (saveInterval) { clearInterval(saveInterval); saveInterval = null; } }

  // file picker fallback
  function openFilePicker(){
    if (!fileInput){
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
          // treat as single-file playlist
          playlist = [f.name];
          currentIndex = 0;
          updateSongTitle();
          saveState(currentIndex, audio.currentTime || 0, true);
          startSaving();
        }).catch(err => console.warn(err));
      });
    }
    fileInput.click();
  }

  // overlay click first-open
  async function handleOpenGesture(){
    try { localStorage.setItem(OPENED_KEY,'1'); } catch(e){}
    if (overlay) overlay.style.display = 'none';
    playlist = getPlaylistFromBody() || defaultPlaylist.slice();
    if (!playlist || playlist.length === 0) playlist = ['song.mp3'];

    const startIdx = Math.floor(Math.random() * playlist.length);
    const ok = await tryPlayPlaylist(startIdx).catch(()=>false);
    if (ok) {
      // resume pos if saved and relevant
      const st = loadState();
      if (st && st.pos && st.idx === currentIndex) {
        try { if (audio.duration && st.pos < audio.duration) audio.currentTime = st.pos; } catch(e){}
      }
      audio.onended = ()=> {
        currentIndex = (currentIndex + 1) % playlist.length;
        playAt(currentIndex).catch(err => {
          console.warn('Auto next failed', err);
        });
      };
      updateSongTitle();
      startSaving();
      return;
    }

    // fallback to song.mp3
    try {
      await playAt(0);
      startSaving();
      return;
    } catch(e){ console.warn('fallback song failed', e); }

    // final fallback to file picker
    openFilePicker();
  }

  // Attempt restore on load (autoplay may be blocked)
  async function attemptRestoreOnLoad(){
    let opened = false;
    try { opened = localStorage.getItem(OPENED_KEY) === '1'; } catch(e){}
    if (!opened) return;

    playlist = getPlaylistFromBody() || defaultPlaylist.slice();
    if (!playlist || playlist.length === 0) playlist = ['song.mp3'];

    const st = loadState();
    currentIndex = st.idx || 0;
    const pos = st.pos || 0;

    try {
      await playAt(currentIndex);
      // try set time
      try {
        if (pos && audio.duration && pos < audio.duration) audio.currentTime = pos;
        else if (pos) {
          audio.addEventListener('loadedmetadata', function once() {
            try { if (pos < audio.duration) audio.currentTime = pos; } catch(e){}
            audio.removeEventListener('loadedmetadata', once);
          });
        }
      } catch(e){}
      audio.onended = ()=> {
        currentIndex = (currentIndex + 1) % playlist.length;
        playAt(currentIndex).catch(()=>{});
      };
      startSaving();
      updateSongTitle();
    } catch(e) {
      // autoplay blocked; show Resume button inside dropdown to let user resume manually
      // We will still show the dropdown / button; user must click Song -> Play or click Resume as needed.
      updateSongTitle();
      console.warn('Autoplay restore failed:', e && e.message);
    }
  }

  // Hook up dropdown controls
  function setupControls(){
    const toggle = songToggleBtn();
    const dropdown = songDropdown();
    if (!toggle || !dropdown) return;

    // toggle dropdown
    toggle.addEventListener('click', () => {
      const isOpen = dropdown.getAttribute('aria-hidden') === 'false';
      dropdown.setAttribute('aria-hidden', isOpen ? 'true' : 'false');
      toggle.setAttribute('aria-expanded', String(!isOpen));
      // update title whenever opened
      if (!isOpen) updateSongTitle();
    });

    // Prevent the Song button from navigating if placed as link
    toggle.addEventListener('keydown', (e) => {
      if (e.key === 'Enter' || e.key === ' ') {
        e.preventDefault();
        toggle.click();
      }
    });

    // play/pause/next/prev buttons
    if (btnPlay()) btnPlay().addEventListener('click', async () => {
      try {
        // if audio has src, play; otherwise attempt to start playlist
        if (!audio.src) {
          playlist = getPlaylistFromBody() || defaultPlaylist.slice();
          const ok = await tryPlayPlaylist(Math.floor(Math.random()*playlist.length)).catch(()=>false);
          if (!ok) openFilePicker();
        } else {
          await audio.play();
        }
        updateSongTitle();
        startSaving();
      } catch(e){ console.warn('Play failed', e); }
    });

    if (btnPause()) btnPause().addEventListener('click', () => {
      try { audio.pause(); saveState(currentIndex, audio.currentTime || 0, false); } catch(e){}
    });

    if (btnNext()) btnNext().addEventListener('click', async () => {
      try {
        if (!playlist || playlist.length === 0) return;
        currentIndex = (currentIndex + 1) % playlist.length;
        await playAt(currentIndex);
        startSaving();
      } catch(e){ console.warn('Next failed', e); }
    });

    if (btnPrev()) btnPrev().addEventListener('click', async () => {
      try {
        if (!playlist || playlist.length === 0) return;
        currentIndex = (currentIndex - 1 + playlist.length) % playlist.length;
        await playAt(currentIndex);
        startSaving();
      } catch(e){ console.warn('Prev failed', e); }
    });
  }

  // DOM ready
  document.addEventListener('DOMContentLoaded', () => {
    // ensure gradient element exists once
    if (!document.querySelector('.body-gradient')) {
      const bg = document.createElement('div');
      bg.className = 'body-gradient';
      document.documentElement.appendChild(bg);
    }

    overlay = document.getElementById('open-overlay');
    fileInput = document.getElementById('file-input') || null;

    // attach overlay behavior (only on pages that include it)
    if (overlay) {
      // hide overlay if already opened before
      let opened = false;
      try { opened = localStorage.getItem(OPENED_KEY) === '1'; } catch(e){}
      if (opened) overlay.style.display = 'none';
      else {
        overlay.addEventListener('click', () => {
          handleOpenGesture().then(()=>startSaving()).catch(()=>startSaving());
        });
        overlay.addEventListener('keydown', (e) => { if (e.key === 'Enter' || e.key === ' ') { handleOpenGesture().then(()=>startSaving()).catch(()=>startSaving()); }});
      }
    }

    // set up song dropdown controls
    setupControls();

    // attempt to restore playback state on page load
    attemptRestoreOnLoad();
  });

  // save periodically on unload / visibilitychange
  window.addEventListener('beforeunload', () => {
    try { saveState(currentIndex, audio.currentTime || 0, !audio.paused); } catch(e){}
    stopSaving();
  });
  document.addEventListener('visibilitychange', () => {
    if (document.hidden) {
      try { saveState(currentIndex, audio.currentTime || 0, !audio.paused); } catch(e){}
    }
  });

  // update title when track loads
  audio.addEventListener('loadedmetadata', () => updateSongTitle());
})();
