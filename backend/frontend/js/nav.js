// ══════════════════════════════════════════════
// NAV.JS — Navigation
// ══════════════════════════════════════════════

const _TAB_ORDER=['dashboard','workout','historial','stats','perfil'];
let _lastTabIdx=0;

function goTab(name,btn){
  const newIdx=_TAB_ORDER.indexOf(name);
  const dir=newIdx>_lastTabIdx?'slide-right':'slide-left';
  document.querySelectorAll('.page').forEach(p=>p.classList.remove('active','slide-right','slide-left'));
  document.querySelectorAll('.tab-btn').forEach(b=>b.classList.remove('active'));
  const page=document.getElementById('page-'+name);
  page.classList.add('active');
  void page.offsetWidth; // force reflow so browser registers display:block before animation
  page.classList.add(dir);
  setTimeout(()=>page.classList.remove('slide-right','slide-left'),220);
  if(newIdx>=0)_lastTabIdx=newIdx;
  btn.classList.add('active');
  // Workout FABs: visible on ALL tabs when workout is active
  const fabs=document.getElementById('wk-fabs');
  if(fabs)fabs.classList.toggle('visible',wkStarted);
  // Re-adjust layout in case tabbar height changed
  if(wkStarted)setTimeout(()=>wkAdjustLayout(),50);
  if(name==='historial'){currentPage=1;loadHistorial();populateGrupoFilters();}
  if(name==='stats')initStatsView();
  if(name==='perfil'){renderPlantillasList();renderCatalogoList();loadProfileData();}
  if(name==='workout')wkInit();
}

// ── WORKOUT BUTTON ──
function iniciarWorkout(){
  haptic(15);
  const btn=document.getElementById('tab-workout');
  // Si ya hay workout activo, simplemente ir a la vista
  if(wkIsActive()){goTab('workout',btn);return;}
  // Mostrar modal de confirmación SIN navegar todavía
  wkShow('wk-ov-start');
}

function wkIsActive(){return localStorage.getItem('gymy_workout_active')==='1';}
