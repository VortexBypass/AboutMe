// Handles overlay click, audio playback and file fallback.
// Behavior:
// - On load, the overlay blocks interaction. When user clicks overlay it will:
//   1) Try to play the file named in document.body.dataset.audio (if present).
//   2) If that fails, try 'song.mp3'.
//   3) If that fails, open a file picker so you can select an mp3 file manually.
// - This satisfies autoplay policy because playback happens after a user gesture (click).
// - To change the file name by hand, edit the body tag to include: data-audio="yourfile.mp3"

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
      // Attempt to play after loadedmetadata or try directly
      audio.play().then(() => resolve()).catch(err => reject(err));
    });
  }

  async function handleOpen() {
    // hide overlay immediately
    overlay.style.display = 'none';

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
    fileInput.click();
  }

  // file input handler
  fileInput.addEventListener('change', (e) => {
    const f = e.target.files && e.target.files[0];
    if (!f) return;
    const url = URL.createObjectURL(f);
    audio.src = url;
    audio.play().then(()=> console.log('Playing selected file')).catch(err=>console.warn(err));
  });

  // on overlay click or keypress, attempt to open
  overlay.addEventListener('click', handleOpen);
  overlay.addEventListener('keydown', (e) => { if (e.key === 'Enter' || e.key === ' ') handleOpen(); });

  // add animated background element
  const bg = document.createElement('div');
  bg.className = 'body-gradient';
  document.documentElement.appendChild(bg);

})();
