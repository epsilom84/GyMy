// ══════════════════════════════════════════════
// NAV.JS — Navigation
// ══════════════════════════════════════════════

const _TAB_ORDER=['dashboard','workout','historial','stats','perfil'];
let _lastTabIdx=0;

function goTab(name,btn){
  const newIdx=_TAB_ORDER.indexOf(name);
  const dir=newIdx>_lastTabIdx?'slide-right':'slide-left';
  const exitDir=dir==='slide-right'?'slide-out-left':'slide-out-right';

  const oldPage=document.querySelector('.page.active');
  const page=document.getElementById('page-'+name);
  if(oldPage===page)return; // ya estamos aquí

  // Limpiar clases de animación sobrantes de navegaciones anteriores
  document.querySelectorAll('.page').forEach(p=>
    p.classList.remove('slide-right','slide-left','slide-out-left','slide-out-right','page-exit')
  );
  document.querySelectorAll('.tab-btn').forEach(b=>b.classList.remove('active'));

  // Animar salida de la página actual (queda visible como overlay absoluto)
  if(oldPage){
    oldPage.classList.add('page-exit',exitDir);
    setTimeout(()=>oldPage.classList.remove('active','page-exit','slide-out-left','slide-out-right'),230);
  }

  // Ocultar el resto (no la que sale ni la que entra)
  document.querySelectorAll('.page').forEach(p=>{
    if(p!==oldPage&&p!==page)p.classList.remove('active');
  });

  // Animar entrada de la nueva página
  page.classList.add('active');
  void page.offsetWidth; // fuerza reflow para que el browser detecte display:block antes del slide
  page.classList.add(dir);
  setTimeout(()=>page.classList.remove('slide-right','slide-left'),230);

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
