const OPENED_KEY='afk_opened',IDX_KEY='afk_idx',POS_KEY='afk_pos',PLAYING_KEY='afk_playing',VISITED_KEY='afk_visited';
const visCountEl=document.getElementById('vis-count');
async function pingVisit(op){try{const r=await fetch(`/api/visit${op==='get'? '?op=get':''}`,{method:op==='get'?'GET':'POST'});const j=await r.json();return j.count}catch(e){console.warn(e);return null}}
(async()=>{if(localStorage.getItem(VISITED_KEY)==='1'){const c=await pingVisit('get');if(c!==null)visCountEl.textContent=c}else{const c=await pingVisit();if(c!==null)visCountEl.textContent=c;localStorage.setItem(VISITED_KEY,'1')}})();
(function(){
  let overlay=document.getElementById('open-overlay');
  let audio=new Audio();
  let playlist=(document.body.getAttribute('data-playlist')||document.body.dataset.playlist||'').split(',').map(s=>s.trim()).filter(Boolean);
  if(playlist.length===0)playlist=['song.mp3'];
  let idx=0;
  async function playFrom(i){
    idx=i%playlist.length;
    try{audio.src=encodeURI(playlist[idx]);await audio.play();save();}catch(e){console.warn('play fail',e);return}
    audio.onended=()=>{playFrom(idx+1)};
  }
  function save(){try{localStorage.setItem(IDX_KEY,String(idx));localStorage.setItem(POS_KEY,String(audio.currentTime||0));localStorage.setItem(PLAYING_KEY, audio.paused?'0':'1')}catch(e){}}
  async function restore(){let s=JSON.parse(JSON.stringify({idx:parseInt(localStorage.getItem(IDX_KEY)||'0',10),pos:parseFloat(localStorage.getItem(POS_KEY)||'0')}));await playFrom(s.idx);try{if(s.pos&&audio.duration&&s.pos<audio.duration)audio.currentTime=s.pos}catch(e){}}
  if(overlay){if(localStorage.getItem(OPENED_KEY)==='1'){overlay.style.display='none';restore()}else{overlay.addEventListener('click',()=>{overlay.style.display='none';localStorage.setItem(OPENED_KEY,'1');playFrom(Math.floor(Math.random()*playlist.length))})}}
})();
