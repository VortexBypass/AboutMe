// Handles overlay click, audio playback and file fallback.
// Overlay will only show once per browser (using localStorage 'afk_opened') and only on pages that include the overlay element.
// See index.html body data-audio attribute to set default audio file name: e.g. <body data-audio="mysong.mp3">

(function(){
  const overlay = document.getElementById('open-overlay');
  const fileInput = document.getElementById('file-input');

  // create an audio element but don't load source until needed
  const audio = new Audio();
  audio.loop = true;
  audio.preload = 'auto';
  audio.crossOrigin = 'anonymous';

  async function tryPlay(src) {
    return new Promise((resolve, reject) => {
      if (!src) return reject(new Error('no-src'));
      audio.src = src;
      audio.play().then(() => resolve()).catch(err => reject(err));
    });
  }

  async function handleOpen() {
    // set flag so overlay won't show again
    try { localStorage.setItem('afk_opened','1'); } catch(e){}

    // hide overlay immediately if it exists
    if (overlay) overlay.style.display = 'none';

    const prefer = document.body.dataset.audio && document.body.dataset.audio.trim();
    const candidates = [];
    if (prefer) candidates.push(prefer);
    candidates.push('song.mp3');

    for (const c of candidates) {
      try {
        await tryPlay(c);
        console.log('Playing audio:', c);
        return;
      } catch (err) {
        console.log('Failed to play', c, err && err.message);
      }
    }

    // fallback: show file picker
    if (fileInput) fileInput.click();
  }

  // file input handler
  if (fileInput) {
    fileInput.addEventListener('change', (e) => {
      const f = e.target.files && e.target.files[0];
      if (!f) return;
      const url = URL.createObjectURL(f);
      audio.src = url;
      audio.play().then(()=> console.log('Playing selected file')).catch(err=>console.warn(err));
    });
  }

  // Only attach overlay handlers if overlay element exists
  if (overlay) {
    // if we've already opened before, hide overlay
    let opened = false;
    try { opened = localStorage.getItem('afk_opened') === '1'; } catch(e){}
    if (opened) {
      overlay.style.display = 'none';
    } else {
      overlay.addEventListener('click', handleOpen);
      overlay.addEventListener('keydown', (e) => { if (e.key === 'Enter' || e.key === ' ') handleOpen(); });
    }
  }

  // add animated background element (ensures only one exists)
  if (!document.querySelector('.body-gradient')) {
    const bg = document.createElement('div');
    bg.className = 'body-gradient';
    document.documentElement.appendChild(bg);
  }

})();
