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

  function getPlaylistFromBody() {
    const raw = document.body.dataset.playlist;
    if (!raw) return null;
    return raw.split(',').map(s => s.trim()).filter(Boolean);
  }

  function encodeSrc(src) {
    // encodeURI handles spaces and many characters; keep filenames intact where possible
    return encodeURI(src);
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
    try { localStorage.setItem('afk_opened','1'); } catch(e){}
    if (overlay) overlay.style.display = 'none';

    // choose playlist: body dataset overrides default
    let playlist = getPlaylistFromBody() || defaultPlaylist.slice();
    if (playlist.length === 0) playlist = ["song.mp3"];

    const startIdx = Math.floor(Math.random() * playlist.length);
    const ok = await tryPlayPlaylist(playlist, startIdx);
    if (ok) {
      // when a track ends, play next track (wraps)
      audio.onended = () => {
        currentIndex = (currentIndex + 1) % playlist.length;
        const nextSrc = encodeSrc(playlist[currentIndex]);
        audio.src = nextSrc;
        audio.play().catch(err => {
          console.warn('Failed to play next track', nextSrc, err && err.message);
        });
      };
      return;
    }

    // fallback to song.mp3
    try {
      await playAt(0, ["song.mp3"]);
      currentIndex = 0;
      return;
    } catch (err) {
      console.warn('Fallback song.mp3 failed, opening file picker', err && err.message);
    }

    // final fallback: prompt user to choose
    if (fileInput) fileInput.click();
  }

  // file picker handler
  if (fileInput) {
    fileInput.addEventListener('change', (e) => {
      const f = e.target.files && e.target.files[0];
      if (!f) return;
      const url = URL.createObjectURL(f);
      audio.src = url;
      audio.play().then(()=> console.log('Playing selected file')).catch(err=>console.warn(err));
    });
  }

  // Only attach overlay logic if overlay exists (home page). overlay shows once per browser
  if (overlay) {
    let opened = false;
    try { opened = localStorage.getItem('afk_opened') === '1'; } catch(e){}
    if (opened) {
      overlay.style.display = 'none';
    } else {
      overlay.addEventListener('click', handleOpen);
      overlay.addEventListener('keydown', (e) => { if (e.key === 'Enter' || e.key === ' ') handleOpen(); });
    }
  }

  // ensure single animated gradient overlay exists across pages
  if (!document.querySelector('.body-gradient')) {
    const bg = document.createElement('div');
    bg.className = 'body-gradient';
    document.documentElement.appendChild(bg);
  }

  let currentIndex = 0;
})();
