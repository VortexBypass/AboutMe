(function(){
  const overlay = document.getElementById('open-overlay');
  const fileInput = document.getElementById('file-input');
  const audio = new Audio();
  audio.loop = true;
  audio.preload = 'auto';

  function encodeTry(src){
    try { return encodeURI(src); } catch(e){ return src; }
  }
  function tryPlaySrc(src){
    return new Promise((res, rej) => {
      if (!src) return rej('no-src');
      audio.src = encodeTry(src);
      audio.play().then(()=>res()).catch(err=>rej(err));
    });
  }

  async function handleOpen(){
    try { localStorage.setItem('afk_opened','1'); } catch(e){}
    if (overlay) overlay.style.display = 'none';

    const prefer = document.body.dataset.audio || '';
    const parts = prefer.split(/\\||,/).map(s=>s.trim()).filter(Boolean);
    const candidates = parts.concat(['song.mp3']);

    for (const c of candidates){
      try {
        await tryPlaySrc(c);
        console.log('Playing', c);
        return;
      } catch(e){
        console.log('failed', c, e && e.message ? e.message : e);
      }
    }
    if (fileInput) fileInput.click();
  }

  if (overlay){
    const opened = localStorage.getItem('afk_opened') === '1';
    if (opened) overlay.style.display = 'none';
    else {
      overlay.addEventListener('click', handleOpen);
      overlay.addEventListener('keydown', e => { if (e.key==='Enter' || e.key===' ') handleOpen(); });
    }
  }

  // file picker fallback
  if (fileInput){
    fileInput.addEventListener('change', e => {
      const f = e.target.files && e.target.files[0];
      if (!f) return;
      const url = URL.createObjectURL(f);
      audio.src = url;
      audio.play().catch(()=>{});
    });
  }

  // animated gradient element
  if (!document.querySelector('.body-gradient')){
    const bg = document.createElement('div');
    bg.className = 'body-gradient';
    document.documentElement.appendChild(bg);
  }
})();
