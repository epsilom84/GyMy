// ══════════════════════════════════════════════
// WORKOUT.JS — Orquestador principal del workout
// Depende de: workout-state.js, workout-selector.js, workout-card.js
// ══════════════════════════════════════════════

// ── Init workout tab ──
function wkInit(){
  cargarHistorialLocal();
  const d=new Date();
  const dias=['Dom','Lun','Mar','Mié','Jue','Vie','Sáb'];
  const mes=['enero','febrero','marzo','abril','mayo','junio','julio','agosto','septiembre','octubre','noviembre','diciembre'];
  document.getElementById('wk-date-bar').textContent=dias[d.getDay()]+' '+d.getDate()+' de '+mes[d.getMonth()];

  // Cargar workout preload desde sessionStorage (repetir workout)
  const preloadData=sessionStorage.getItem('gymy_preload_workout');
  if(preloadData){
    sessionStorage.removeItem('gymy_preload_workout');
    try{
      const pw=JSON.parse(preloadData);
      wkCurTipo=pw.tipo||'Fuerza';
      pw.ejercicios.forEach(e=>{
        const id=wkEid++;
        const sets=(e.sets&&e.sets.length)
          ?e.sets.map(s=>({kg:s.kg!=null?s.kg:60,reps:s.reps||10,done:false,pre:true}))
          :[{kg:e.kg!=null?e.kg:60,reps:e.reps||10,done:false,pre:true}];
        wkExs.push({id,em:e.em||'💪',equipo:e.equipo||null,n:e.n,m:e.m||e.n.toUpperCase(),sets});
      });
      wkActivate();
      wkRender();
      showToast('Workout cargado desde historial ✓','success');
      return;
    }catch(e){}
  }

  // Restaurar workout activo
  if(wkIsActive()){
    if(!wkStarted){
      const saved=wkLoadState();
      if(saved){
        wkExs=saved.exs||[];
        wkEid=saved.eid||0;
        wkSecs=saved.secs||0;
        wkCurTipo=saved.tipo||'';
        let maxId=0;wkExs.forEach(ex=>{if(ex.id>maxId)maxId=ex.id;});
        wkEid=maxId+1;
      }
      wkActivate();
    }
    wkRender();
    return;
  }

  // Sin workout activo — empty state
  document.getElementById('wk-ex-container').innerHTML=
    '<div style="text-align:center;padding:60px 20px;color:var(--text2)">'
    +'<div style="font-size:48px;margin-bottom:16px">🏋️</div>'
    +'<div style="font-size:16px;font-weight:600;color:var(--text);margin-bottom:8px">Sin workout activo</div>'
    +'<div style="font-size:14px">Pulsa el botón <strong style="color:var(--accent)">+</strong> para iniciar</div>'
    +'</div>';
}

function wkAdjustLayout(){
  const h=document.getElementById('main-tabbar')?.offsetHeight||82;
  document.documentElement.style.setProperty('--fab-bottom',(h+10)+'px');
  document.documentElement.style.setProperty('--body-pb',(h+18)+'px');
}

function wkActivate(){
  wkStarted=true;wkRunning=true;
  localStorage.setItem('gymy_workout_active','1');
  document.getElementById('wk-add-ex-btn').style.display='block';
  document.getElementById('wk-fabs').classList.add('visible');
  const tab=document.getElementById('tab-workout');
  if(tab)tab.style.display='flex';
  document.getElementById('wk-banner').classList.add('active');
  document.getElementById('fab-iniciar').style.display='none';
  setTimeout(()=>wkAdjustLayout(),80);
  if(!wkSecInterval){
    wkSecInterval=setInterval(()=>{
      if(!wkRunning)return;
      wkSecs++;
      const m=String(Math.floor(wkSecs/60)).padStart(2,'0');
      const s=String(wkSecs%60).padStart(2,'0');
      document.getElementById('wk-session-secs').textContent='⏱ '+m+':'+s;
      wkRefreshStats();
    },1000);
  }
  if(!wkAutoSaveInterval)wkAutoSaveInterval=setInterval(wkSaveState,15000);
  window.addEventListener('beforeunload',wkSaveState);
}

function wkShow(id){
  const el=document.getElementById(id);
  el.classList.add('open');
  if(id!=='wk-ov-tipo'&&id!=='wk-ov-ej'){
    el._wkClose=function(e){if(e.target===el)wkHide(id);};
    el.addEventListener('click',el._wkClose);
  }
}
function wkHide(id){
  const el=document.getElementById(id);
  el.classList.remove('open');
  if(el._wkClose){el.removeEventListener('click',el._wkClose);delete el._wkClose;}
}

// ── Save / Discard ──
function wkSaveWorkout(){
  const done=wkExs.reduce((a,ex)=>a+ex.sets.filter(s=>s.done).length,0);
  if(!wkExs.length){showToast('Añade al menos un ejercicio','error');return;}
  if(!done){showToast('Completa al menos una serie','error');return;}
  document.getElementById('wk-ov-save-msg').textContent='Se guardarán '+done+' serie'+(done>1?'s':'')+' de '+wkExs.length+' ejercicio'+(wkExs.length>1?'s':'');
  wkShow('wk-ov-save');
}

function wkConfirmDiscard(){wkShow('wk-ov-discard');}

function wkDeactivateBanner(){
  document.getElementById('wk-banner').classList.remove('active');
  document.getElementById('fab-iniciar').style.display='flex';
  document.documentElement.style.setProperty('--fab-bottom','86px');
  document.documentElement.style.setProperty('--body-pb','100px');
  document.getElementById('wkb-dur').textContent='00:00';
  document.getElementById('wkb-vol').textContent='0';
  document.getElementById('wkb-ser').textContent='0';
  document.getElementById('wkb-kcal').textContent='0';
  document.getElementById('wkb-dur').textContent='⏱ 00:00';
}

function wkDoDiscard(){
  wkHide('wk-ov-discard');
  wkClearState();
  wkExs=[];wkEid=0;wkSecs=0;wkRunning=false;wkStarted=false;wkCurTipo='';
  clearInterval(wkSecInterval);clearInterval(wkAutoSaveInterval);clearInterval(wkRestInterval);
  wkSecInterval=null;wkAutoSaveInterval=null;
  document.getElementById('wk-fabs').classList.remove('visible');
  document.getElementById('wk-add-ex-btn').style.display='none';
  document.getElementById('wk-ex-container').innerHTML='';
  document.getElementById('wk-session-secs').textContent='⏱ 00:00';
  const tab=document.getElementById('tab-workout');if(tab)tab.style.display='none';
  wkDeactivateBanner();
  goTab('dashboard',document.getElementById('tab-dashboard'));
}

async function wkDoSave(){
  wkHide('wk-ov-save');wkRunning=false;wkSkipRest();
  const fab=document.getElementById('wk-fab-ok');
  fab.classList.add('saving');
  fab.innerHTML='<svg width="22" height="22" fill="none" stroke="#fff" stroke-width="2.5" viewBox="0 0 24 24"><circle cx="12" cy="12" r="9" stroke-dasharray="28" stroke-dashoffset="8"/></svg>';
  const ejercicios=wkExs.filter(ex=>ex.sets.some(s=>s.done)).map(ex=>{
    const done=ex.sets.filter(s=>s.done);
    return{nombre:ex.n,series:done.length,
      reps:done.reduce((m,s)=>Math.max(m,s.reps),0),
      peso_kg:done.reduce((m,s)=>Math.max(m,s.kg),0),
      sets_data:JSON.stringify(done.map(s=>({reps:s.reps,kg:s.kg,kcal:s.kcal||0})))};
  });
  const totalVol=ejercicios.reduce((a,e)=>a+(e.peso_kg||0)*(e.reps||0)*(e.series||1),0);
  const kcal=wkExs.flatMap(ex=>ex.sets.filter(s=>s.done)).reduce((t,s)=>t+(s.kcal||0),0);
  const sesion={fecha:new Date().toISOString().split('T')[0],tipo:wkCurTipo||'Fuerza',
    duracion_min:Math.max(1,Math.round(wkSecs/60)),calorias:kcal,
    notas:'Volumen: '+totalVol+'kg',ejercicios};
  wkSaveLocalHistorial(wkExs);
  wkClearState();
  if(!navigator.onLine){
    guardarOffline(sesion);
    fab.classList.remove('saving');
    showToast('Sin conexión — guardado localmente');
    wkDoDiscard();
    return;
  }
  const{data}=await crearSesion(sesion);
  fab.classList.remove('saving');
  fab.innerHTML='<svg width="22" height="22" fill="none" stroke="#fff" stroke-width="2.5" viewBox="0 0 24 24"><polyline points="20 6 9 17 4 12"/></svg>';
  if(data.ok){
    showToast('Sesión guardada ✓','success');
    updateOfflineBadge();loadDashboard();
    setTimeout(()=>wkDoDiscard(),1200);
  }else{
    showToast(data.error||'Error al guardar','error');
    wkRunning=true;
  }
}

// ── Start / Cancel ──
function wkStartWorkout(){
  wkHide('wk-ov-start');
  const btn=document.getElementById('tab-workout');
  btn.style.display='flex';
  goTab('workout',btn);
  wkActivate();
  setTimeout(()=>{wkRenderTipoGrid();wkShow('wk-ov-tipo');},200);
}
function wkCancelStart(){
  wkHide('wk-ov-start');
}

// ── Repetir workout desde historial ──
function repetirWorkout(sesionId){
  closeModal('modal-detalle');
  getSesion(sesionId).then(({data})=>{
    if(!data.ok)return;
    const s=data.sesion;
    const ejercicios=(s.ejercicios||[]).map(e=>{
      let sets=null;
      if(e.sets_data){
        try{const sd=typeof e.sets_data==='string'?JSON.parse(e.sets_data):e.sets_data;
          sets=sd.map(s=>({kg:Number(s.kg??s.peso_kg??0),reps:Number(s.reps??0)}));}catch(x){}
      }
      if(!sets){const n=Number(e.series)||1;sets=Array.from({length:n},()=>({kg:Number(e.peso_kg)||0,reps:Number(e.reps)||0}));}
      return{n:e.nombre,m:(e.grupo_muscular||e.nombre).toUpperCase(),em:'💪',equipo:null,sets};
    });
    sessionStorage.setItem('gymy_preload_workout',JSON.stringify({tipo:s.tipo,ejercicios}));
    const btn=document.getElementById('tab-workout');
    if(btn){btn.style.display='flex';goTab('workout',btn);}
    showToast('Cargando workout...','info');
    setTimeout(()=>wkInit(),200);
  });
}
