// ══════════════════════════════════════════════
// WORKOUT.JS — Workout engine
// ══════════════════════════════════════════════

// ── Historial local (precarga workout desde Postgres) ──
async function cargarHistorialLocal(){
  try{
    const res=await apiCall('GET','/sesiones?limit=100&page=1');
    if(!res.data?.ok||!res.data.sesiones)return;
    const sesiones=res.data.sesiones;
    // Agrupar ejercicios por nombre y sesión
    const byNombreSession={};
    for(const sesion of sesiones){
      // Intentar usar ejercicios embebidos, o fetch individual como fallback
      let ejercicios=sesion.ejercicios||[];
      if(!ejercicios.length&&sesion.id){
        try{
          const det=await apiCall('GET','/sesiones/'+sesion.id);
          ejercicios=det.data?.sesion?.ejercicios||[];
        }catch(e){}
      }
      // Group sets by nombre within this session
      // series||1: supports old format (1 row, series=N) and new format (1 row per set, series=1)
      const byNombre={};
      ejercicios.forEach(e=>{
        if(!byNombre[e.nombre])byNombre[e.nombre]=[];
        // Usar sets_data (datos reales por serie) si está disponible
        if(e.sets_data){
          try{
            const sd=typeof e.sets_data==='string'?JSON.parse(e.sets_data):e.sets_data;
            sd.forEach(s=>byNombre[e.nombre].push({kg:s.kg!=null?s.kg:(s.peso_kg||0),reps:s.reps||0}));
            return;
          }catch(x){}
        }
        // Fallback: formato antiguo (peso_kg y reps son el máximo de todas las series)
        const n=e.series||1;
        for(let i=0;i<n;i++) byNombre[e.nombre].push({kg:e.peso_kg||0,reps:e.reps||0});
      });
      Object.entries(byNombre).forEach(([nombre,sets])=>{
        if(!byNombreSession[nombre])byNombreSession[nombre]=[];
        byNombreSession[nombre].push({nombre,sets,ts:new Date(sesion.fecha).getTime()||0});
      });
    }
    // Build flat array sorted by ts
    const h=[];
    Object.values(byNombreSession).forEach(entries=>{
      entries.sort((a,b)=>a.ts-b.ts).forEach(e=>h.push(e));
    });
    if(h.length>500)h.splice(0,h.length-500);
    localStorage.setItem('gymy_historial_local',JSON.stringify(h));
    console.log('[GyMy] Historial local cargado:',h.length,'entradas');
  }catch(e){
    console.warn('[GyMy] No se pudo cargar historial local:',e.message);
  }
}

// ── Preload helpers ──
function wkGetPreload(nombre){
  const mode=wkGetPreloadMode();
  const h=JSON.parse(localStorage.getItem('gymy_historial_local')||'[]')
    .filter(e=>e.nombre===nombre);
  if(!h.length)return null;
  function normalize(entry){
    if(entry.sets&&entry.sets.length){
      const sets=entry.sets.map(s=>({kg:Number(s.kg)||0,reps:Number(s.reps)||0}));
      return{sets,vol:sets.reduce((a,s)=>a+s.kg*s.reps,0)};
    }
    const kg=Number(entry.kg)||0,reps=Number(entry.reps)||0;
    return{sets:[{kg,reps}],vol:kg*reps};
  }
  if(mode==='ultimo')return{sets:normalize(h[h.length-1]).sets};
  let best=null,bestVol=-1;
  h.forEach(entry=>{const n=normalize(entry);if(n.vol>bestVol){bestVol=n.vol;best=n;}});
  return best?{sets:best.sets}:null;
}

// Versión async — consulta la BD directamente, incluye ejercicios importados
async function wkGetPreloadFromDB(nombre){
  const mode=wkGetPreloadMode();
  try{
    const{data}=await apiCall('GET','/ejercicios/historial?nombre='+encodeURIComponent(nombre));
    if(!data.ok||!data.historial||!data.historial.length)return null;

    // Convertir cada fila de BD en {sets:[{kg,reps}], vol}
    function rowToBlock(row){
      let sets=null;
      if(row.sets_data){
        try{
          const sd=typeof row.sets_data==='string'?JSON.parse(row.sets_data):row.sets_data;
          sets=sd.map(s=>({kg:Number(s.kg??s.peso_kg??0),reps:Number(s.reps??0)}));
        }catch(x){sets=null;}
      }
      if(!sets){
        // Sin sets_data (importado o legacy): series×(reps,kg) repetidos
        const n=Number(row.series)||1;
        const kg=Number(row.peso_kg)||0;
        const reps=Number(row.reps)||0;
        sets=Array.from({length:n},()=>({kg,reps}));
      }
      const vol=sets.reduce((a,s)=>a+s.kg*s.reps,0);
      return{sets,vol};
    }

    if(mode==='ultimo'){
      // historial viene ORDER BY fecha DESC → el primero es el más reciente
      return{sets:rowToBlock(data.historial[0]).sets};
    }
    // mode==='maximo': bloque con mayor volumen total
    let best=null,bestVol=-1;
    data.historial.forEach(row=>{
      const b=rowToBlock(row);
      if(b.vol>bestVol){bestVol=b.vol;best=b;}
    });
    return best?{sets:best.sets}:null;
  }catch(err){
    console.warn('[GyMy] wkGetPreloadFromDB error:',err.message);
    return null;
  }
}
function wkSaveLocalHistorial(exs){
  // exs is wkExs array: [{n, sets:[{kg,reps,done},...]}]
  const h=JSON.parse(localStorage.getItem('gymy_historial_local')||'[]');
  const ts=Date.now();
  exs.forEach(ex=>{
    const doneSets=ex.sets.filter(s=>s.done).map(s=>({kg:s.kg,reps:s.reps}));
    if(doneSets.length>0) h.push({nombre:ex.n,sets:doneSets,ts});
  });
  if(h.length>500)h.splice(0,h.length-500);
  localStorage.setItem('gymy_historial_local',JSON.stringify(h));
}

// ── State ──
let wkExs=[],wkEid=0,wkSecs=0,wkRunning=false;
let wkRestSecs=0,wkRestRunning=false,wkRestInterval=null;
let _wkGaussCharts={};
let wkCurTipo='',wkStarted=false,wkSecInterval=null,wkAutoSaveInterval=null;
const WK_KEY='gymy_workout_live';

function wkSaveState(){
  if(!wkStarted)return;
  localStorage.setItem(WK_KEY,JSON.stringify({exs:wkExs,eid:wkEid,secs:wkSecs,tipo:wkCurTipo,ts:Date.now()}));
}
function wkLoadState(){
  try{const r=localStorage.getItem(WK_KEY);return r?JSON.parse(r):null;}catch(e){return null;}
}
function wkClearState(){
  localStorage.removeItem(WK_KEY);
  localStorage.removeItem('gymy_workout_active');
}

// ── Init workout tab ──
function wkInit(){
  // Refrescar historial desde API para preload multi-dispositivo
  cargarHistorialLocal();
  // Set date
  const d=new Date();
  const dias=['Dom','Lun','Mar','Mié','Jue','Vie','Sáb'];
  const mes=['enero','febrero','marzo','abril','mayo','junio','julio','agosto','septiembre','octubre','noviembre','diciembre'];
  document.getElementById('wk-date-bar').textContent=dias[d.getDay()]+' '+d.getDate()+' de '+mes[d.getMonth()];

  // Check preload from historial (repetir workout)
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

  // Restore active workout
  if(wkIsActive()){
    if(!wkStarted){
      // First time loading this session after restore
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
  // No active workout — show empty state (FAB initiates)
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
  // Show workout tab in tabbar
  const tab=document.getElementById('tab-workout');
  if(tab)tab.style.display='flex';
  // Show mini-bar above tabs, hide FAB +
  document.getElementById('wk-banner').classList.add('active');
  document.getElementById('fab-iniciar').style.display='none';
  // Adjust FAB and body padding to clear the taller tabbar
  setTimeout(()=>wkAdjustLayout(),80);
  // Session timer
  if(!wkSecInterval){
    wkSecInterval=setInterval(()=>{
      if(!wkRunning)return;
      wkSecs++;
      const m=String(Math.floor(wkSecs/60)).padStart(2,'0');
      const s=String(wkSecs%60).padStart(2,'0');
      document.getElementById('wk-session-secs').textContent='⏱ '+m+':'+s;
      wkRefreshStats(); // wkRefreshStats updates wkb-dur and all banner stats
    },1000);
  }
  if(!wkAutoSaveInterval)wkAutoSaveInterval=setInterval(wkSaveState,15000);
  window.addEventListener('beforeunload',wkSaveState);
}

function wkShow(id){
  const el=document.getElementById(id);
  el.classList.add('open');
  // Click-outside solo para overlays que NO son selectores de tipo/ej
  // (esos tienen lógica de cierre seguro propia)
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

async function wkRenderTipoGrid(){
  const db=await wkGetDBAsync();
  const grid=document.getElementById('wk-tipo-grid');
  if(!grid)return;
  let grupos=Object.keys(db);
  if(!grupos.length){
    grid.innerHTML='<div style="text-align:center;color:var(--text2);font-size:13px;grid-column:1/-1;padding:20px 0">Sin ejercicios disponibles</div>';
    return;
  }
  // Ordenar por frecuencia de uso en historial local
  const hist=JSON.parse(localStorage.getItem('gymy_historial_local')||'[]');
  const nameToGrupo={};
  grupos.forEach(g=>db[g].forEach(e=>{nameToGrupo[e.n]=g;}));
  const freq={};
  hist.forEach(e=>{const g=nameToGrupo[e.nombre];if(g)freq[g]=(freq[g]||0)+1;});
  grupos.sort((a,b)=>(freq[b]||0)-(freq[a]||0));
  grid.innerHTML=grupos.map(g=>
    `<div class="tipo-card" onclick="wkPickTipo('${g}')">${grupoSVGHtml(g,110)}<div style="margin-top:1px;text-align:center;width:100%;word-break:break-word">${g}</div></div>`
  ).join('');
}

function wkOpenTipo(){wkRenderTipoGrid();wkShow('wk-ov-tipo');}

// Cerrar selector tipo: si no hay ejercicios y workout fue recién iniciado → abortar
function wkCloseTipoSafe(){
  wkHide('wk-ov-tipo');
  if(wkStarted && wkExs.length===0){
    // Ningún ejercicio añadido aún — descartar el workout silenciosamente
    wkDoDiscard();
  }
}
// Cerrar selector ejercicio: si no hay ejercicios → abortar workout
function wkCloseEjSafe(){
  wkHide('wk-ov-ej');
  if(wkStarted && wkExs.length===0){
    wkDoDiscard();
  }
}
// Volver al selector de tipo desde ej
function wkCloseEjBack(){
  wkHide('wk-ov-ej');
  setTimeout(()=>{wkRenderTipoGrid();wkShow('wk-ov-tipo');},150);
}
function wkPickTipo(tipo){
  if(!wkCurTipo)wkCurTipo=tipo;
  wkCurEjGrupo=tipo;
  wkHide('wk-ov-tipo');
  document.getElementById('wk-ov-ej-title').textContent=tipo;
  document.getElementById('wk-ej-q').value='';
  wkRenderEjList(wkGetDB()[tipo]||[]);
  setTimeout(()=>wkShow('wk-ov-ej'),180);
}
const WK_EJ_PAGE=40;
let _wkEjListRest=[],_wkEjListShowGroup=false;
function _wkEjCard(e,showGroup){
  const pre=wkGetPreload(e.n);
  const hint=pre?(()=>{
    const maxKg=Math.max(...pre.sets.map(s=>s.kg));
    const avgReps=Math.round(pre.sets.reduce((a,s)=>a+s.reps,0)/pre.sets.length);
    return maxKg+'kg×'+avgReps;
  })():'';
  const safeE=JSON.stringify({em:e.em,equipo:e.equipo||null,n:e.n,m:e.m}).replace(/'/g,"&#39;");
  const _hasImg=ejHasImg(e.n);
  const _ci=_hasImg?'ej-card--img':'ej-card--svg';
  return '<div class="ej-card '+_ci+'" onclick=\'wkAddEx('+safeE+')\'>'
    +(_hasImg?'<div class="ej-item-em">'+ejIconHtml(e.n,e.equipo,56)+'</div>':'')
    +'<div class="ej-card-n">'+e.n+'</div>'
    +(e.sg?'<div class="ej-card-sg">'+e.sg+'</div>':'')
    +(hint?'<div class="ej-card-hint">'+hint+'</div>':'')
    +(showGroup?'<div class="ej-card-m">'+e.m+'</div>':'')
    +'</div>';
}
function wkRenderEjList(list,showGroup){
  const hist=JSON.parse(localStorage.getItem('gymy_historial_local')||'[]');
  const freq={};
  hist.forEach(e=>{freq[e.nombre]=(freq[e.nombre]||0)+1;});
  const sorted=[...list].sort((a,b)=>(freq[b.n]||0)-(freq[a.n]||0));
  _wkEjListRest=sorted.slice(WK_EJ_PAGE);
  _wkEjListShowGroup=!!showGroup;
  const visible=sorted.slice(0,WK_EJ_PAGE);
  const cards=visible.map(e=>_wkEjCard(e,showGroup)).join('');
  const verMasBtn=_wkEjListRest.length
    ?'<div class="ej-ver-mas" onclick="_wkVerMasEj(this)" style="grid-column:1/-1;text-align:center;padding:10px;color:var(--accent);font-size:13px;cursor:pointer;font-weight:600">Ver todos ('+_wkEjListRest.length+' más)</div>'
    :'';
  document.getElementById('wk-ej-scroll').innerHTML='<div class="ej-grid">'
    +(cards||'<div style="grid-column:1/-1;text-align:center;padding:24px;color:var(--text2);font-size:13px">Sin resultados</div>')
    +verMasBtn+'</div>';
}
function _wkVerMasEj(btn){
  const grid=btn.parentElement;
  btn.remove();
  grid.insertAdjacentHTML('beforeend',_wkEjListRest.map(e=>_wkEjCard(e,_wkEjListShowGroup)).join(''));
  _wkEjListRest=[];
}
function wkFilterEj(){
  const q=_normQ(document.getElementById('wk-ej-q').value);
  const db=wkGetDB();
  if(!q){
    const titulo=document.getElementById('wk-ov-ej-title').textContent;
    wkRenderEjList(db[titulo]||[]);
    return;
  }
  const all=[];
  Object.values(db).forEach(ejs=>ejs.forEach(e=>{
    if(_normQ(e.n).includes(q)||_normQ(e.m).includes(q)||_normQ(e.sg||'').includes(q))all.push(e);
  }));
  wkRenderEjList(all,true);
}
async function wkAddEx(e){
  wkHide('wk-ov-ej');
  const id=wkEid++;
  // Añadir placeholder con datos de localStorage (rápido) mientras carga BD
  const localPre0=wkGetPreload(e.n);
  const placeholderSets=localPre0&&localPre0.sets.length
    ?localPre0.sets.map(s=>({kg:s.kg,reps:s.reps,done:false,pre:true}))
    :[{kg:60,reps:10,done:false,pre:false}];
  const placeholder={id,em:e.em,equipo:e.equipo||null,n:e.n,m:e.m,sets:placeholderSets};
  wkExs.push(placeholder);
  wkRender();
  setTimeout(()=>document.getElementById('wk-ex-'+id)?.scrollIntoView({behavior:'smooth',block:'nearest'}),80);

  // Consultar BD para obtener precarga real (nativa + importada)
  let sets;
  const pre=await wkGetPreloadFromDB(e.n);
  if(pre&&pre.sets.length){
    sets=pre.sets.map(s=>({kg:s.kg,reps:s.reps,done:false,pre:true}));
  }else{
    // Fallback: localStorage (por si offline o sin historial en BD)
    const localPre=wkGetPreload(e.n);
    sets=localPre&&localPre.sets.length
      ?localPre.sets.map(s=>({kg:s.kg,reps:s.reps,done:false,pre:true}))
      :[{kg:60,reps:10,done:false,pre:false}];
  }
  // Reemplazar placeholder con datos reales
  const idx=wkExs.findIndex(ex=>ex.id===id);
  if(idx>=0){wkExs[idx].sets=sets;wkRender();}
}

// ── Crear nuevo ejercicio desde el selector de workout ──────────────────────
function wkNuevoEjercicio(){
  // Populate grupo select with current DB groups
  const grupos=Object.keys(wkGetDB());
  const sel=document.getElementById('wk-new-grupo');
  const cur=wkCurEjGrupo||grupos[0]||'General';
  sel.innerHTML=grupos.map(g=>`<option value="${g}"${g===cur?' selected':''}>${g}</option>`).join('')
    +'<option value="General"'+(cur==='General'?' selected':'')+'>General</option>';
  document.getElementById('wk-new-nombre').value='';
  openModal('modal-wk-nuevo-ej');
}
async function wkCrearNuevoEjercicio(){
  const nombre=document.getElementById('wk-new-nombre').value.trim();
  const grupo=document.getElementById('wk-new-grupo').value;
  if(!nombre)return showToast('Introduce un nombre','error');
  const{data}=await apiCall('POST','/plantillas',{nombre,grupo_muscular:grupo});
  if(!data.ok)return showToast(data.error||'Error al guardar','error');
  invalidatePlantillas();
  await loadPlantillas();
  closeModal('modal-wk-nuevo-ej');
  // Add exercise to workout immediately
  wkAddEx({em:'💪',n:nombre,m:grupo.toUpperCase()});
  showToast('Ejercicio creado y añadido','success');
}

// ── Gaussian helpers ──
function _gaussErf(x){
  const s=x>=0?1:-1;x=Math.abs(x);
  const t=1/(1+0.3275911*x);
  return s*(1-(((((1.061405429*t-1.453152027)*t+1.421413741)*t-0.284496736)*t+0.254829592)*t)*Math.exp(-x*x));
}
function _gaussCDF(x,mu,sg){return sg===0?(x>=mu?1:0):0.5*(1+_gaussErf((x-mu)/(sg*Math.SQRT2)));}
function _gaussPDF(x,mu,sg){return sg===0?0:Math.exp(-0.5*((x-mu)/sg)**2)/(sg*Math.sqrt(2*Math.PI));}
function _wkHistVols(nombre){
  return JSON.parse(localStorage.getItem('gymy_historial_local')||'[]')
    .filter(h=>h.nombre===nombre)
    .map(h=>(h.sets||[]).reduce((a,s)=>a+(s.kg||0)*(s.reps||0),0))
    .filter(v=>v>0);
}
function wkInitGauss(ex){
  const canvasId='wk-gauss-cv-'+ex.id;
  const pctId='wk-gauss-pct-'+ex.id;
  const canvas=document.getElementById(canvasId);
  if(!canvas)return;
  if(_wkGaussCharts[ex.id]){_wkGaussCharts[ex.id].destroy();delete _wkGaussCharts[ex.id];}
  const vols=_wkHistVols(ex.n);
  if(vols.length<3)return;
  const n=vols.length;
  const mu=vols.reduce((a,b)=>a+b,0)/n;
  let sg=Math.sqrt(vols.reduce((s,v)=>s+(v-mu)**2,0)/n);
  if(sg<1)sg=Math.max(1,mu*0.05);
  const lo=Math.max(0,mu-3.5*sg),hi=mu+3.5*sg;
  const pts=80,step=(hi-lo)/(pts-1);
  const curVol=ex.sets.filter(s=>s.done).reduce((a,s)=>a+s.kg*s.reps,0);
  const pct=Math.round(_gaussCDF(curVol,mu,sg)*100);
  const peakPDF=_gaussPDF(mu,mu,sg);
  const bellData=Array.from({length:pts},(_,i)=>{const x=lo+i*step;return{x,y:_gaussPDF(x,mu,sg)};});
  const markerData=curVol>0?[{x:curVol,y:0},{x:curVol,y:peakPDF}]:[];
  const isDark=!document.body.classList.contains('theme-light')&&!document.body.classList.contains('theme-material-light');
  const gridColor=isDark?'rgba(255,255,255,.04)':'rgba(0,0,0,.06)';
  _wkGaussCharts[ex.id]=new Chart(canvas,{
    type:'line',
    data:{datasets:[
      {data:bellData,borderColor:'rgba(108,71,255,.7)',backgroundColor:'rgba(108,71,255,.18)',
       fill:true,tension:0,pointRadius:0,borderWidth:1.5,parsing:false},
      {data:markerData,type:'scatter',showLine:true,borderColor:'#e8ff47',backgroundColor:'#e8ff47',
       pointRadius:0,borderWidth:2,parsing:false}
    ]},
    options:{responsive:true,maintainAspectRatio:false,animation:false,
      plugins:{legend:{display:false},tooltip:{enabled:false}},
      scales:{
        x:{type:'linear',display:false,grid:{display:false}},
        y:{display:false,grid:{color:gridColor}}
      }
    }
  });
  const pctEl=document.getElementById(pctId);
  if(pctEl){
    if(curVol>0)pctEl.textContent='Volumen actual: '+curVol+' kg · Percentil '+pct+'%';
    else pctEl.textContent=n+' sesiones previas · media '+Math.round(mu)+' kg';
  }
}

// ── Render ──
function wkRender(){
  document.getElementById('wk-ex-container').innerHTML=wkExs.map(ex=>wkCardHTML(ex)).join('');
  wkExs.forEach(ex=>wkInitGauss(ex));
  wkRefreshStats();
  wkSaveState();
}
function wkCardHTML(ex){
  const hist=JSON.parse(localStorage.getItem('gymy_historial_local')||'[]').filter(h=>h.nombre===ex.n);
  const prKg=hist.length?Math.max(...hist.map(h=>h.sets?Math.max(...h.sets.map(s=>s.kg)):h.kg||0)):0;
  const doneSets=ex.sets.filter(s=>s.done);
  const vol=doneSets.reduce((a,s)=>a+s.kg*s.reps,0);
  const prVol=hist.length?Math.max(...hist.map(h=>h.sets?h.sets.reduce((a,s)=>a+s.kg*s.reps,0):(h.kg||0)*(h.reps||0))):0;
  const pct=prVol>0?Math.min(100,Math.round(vol/prVol*100)):0;
  const vsHtml=vol>0&&prVol>0?
    '<div class="vs-box"><div class="vs-top"><span class="vs-label">VS RECORD</span>'
    +'<span class="vs-right">'+vol+'/'+prVol+'kg<span class="vs-pct"> '+pct+'%</span></span></div>'
    +'<div class="vs-track"><div class="vs-fill" style="width:'+pct+'%"></div></div></div>':'';
  const setsHtml=ex.sets.map((s,i)=>{
    const isPR=s.done&&prKg>0&&s.kg>prKg;
    return '<div class="set-row '+(s.done?'is-done':'')+'" id="wk-sr-'+ex.id+'-'+i+'">'
      +'<div class="set-num '+(s.done?'done':'')+'">'+( i+1)+'</div>'
      +'<div class="stepper '+(s.pre&&!s.done?'preloaded':'')+'">'
        +'<button class="st-btn" onclick="wkStep('+ex.id+','+i+',\'kg\',-2.5)">−</button>'
        +'<div class="st-val" id="wk-kg-'+ex.id+'-'+i+'">'+s.kg+'</div>'
        +'<button class="st-btn" onclick="wkStep('+ex.id+','+i+',\'kg\',2.5)">+</button>'
      +'</div>'
      +'<div class="stepper '+(s.pre&&!s.done?'preloaded':'')+'">'
        +'<button class="st-btn" onclick="wkStep('+ex.id+','+i+',\'reps\',-1)">−</button>'
        +'<div class="st-val" id="wk-rp-'+ex.id+'-'+i+'">'+s.reps+'</div>'
        +'<button class="st-btn" onclick="wkStep('+ex.id+','+i+',\'reps\',1)">+</button>'
      +'</div>'
      +'<div class="mid-icon">'
        +'<span class="mid-eq">'+(s.done?'=':'')+'</span>'
        +'<span class="mid-star '+(isPR?'show':'')+'">★</span>'
        +'<button class="check-circle '+(s.done?'done':'')+'" onclick="wkToggleDone('+ex.id+','+i+')">'
          +'<svg viewBox="0 0 24 24"><polyline points="20 6 9 17 4 12"/></svg>'
        +'</button>'
      +'</div>'
      +'<button class="del-btn" onclick="wkDelSet('+ex.id+','+i+')">✕</button>'
    +'</div>';
  }).join('');
  const dotsHtml='<div class="sets-dots">'+ex.sets.map((s,i)=>{
    const isPRDot=s.done&&prKg>0&&s.kg>prKg;
    return'<div class="set-dot'+(s.done?(isPRDot?' pr':' done')+'':'')+'" title="Serie '+(i+1)+(s.done?' ✓':'')+'"></div>';
  }).join('')+'</div>';
  return '<div class="ex-card" id="wk-ex-'+ex.id+'">'
    +'<div class="ex-header">'
      +'<div class="ex-left"><div class="ex-emoji">'+ejIconHtml(ex.n,ex.equipo,28)+'</div>'
      +'<div><div class="ex-name">'+ex.n+'</div><div class="ex-muscle">'+ex.m+'</div></div></div>'
      +'<div style="display:flex;align-items:center;gap:6px">'
        +(prKg?'<div class="pr-badge">PR '+prKg+'kg</div>':'')
        +'<button class="ex-del-btn" onclick="wkDelExercise('+ex.id+')">🗑</button>'
      +'</div>'
    +'</div>'
    +dotsHtml
    +vsHtml
    +(hist.length>=3?'<div class="gauss-wrap"><canvas id="wk-gauss-cv-'+ex.id+'"></canvas><div class="gauss-pct" id="wk-gauss-pct-'+ex.id+'"></div></div>':'')
    +'<div class="col-heads"><span>SET</span><span>KG</span><span>REPS</span><span></span><span></span></div>'
    +setsHtml
    +'<button class="add-serie-btn" onclick="wkAddSet('+ex.id+')">＋ Serie</button>'
  +'</div>';
}

// ── Set actions ──
function wkStep(exId,si,field,delta){
  const ex=wkExs.find(e=>e.id===exId);if(!ex)return;
  const s=ex.sets[si];s.pre=false;
  if(field==='kg')s.kg=Math.max(0,Math.round((s.kg+delta)*2)/2);
  else s.reps=Math.max(1,s.reps+delta);
  const elId=field==='kg'?'wk-kg-'+exId+'-'+si:'wk-rp-'+exId+'-'+si;
  const el=document.getElementById(elId);
  if(el)el.textContent=field==='kg'?s.kg:s.reps;
  const row=document.getElementById('wk-sr-'+exId+'-'+si);
  if(row)row.querySelectorAll('.stepper').forEach(st=>st.classList.remove('preloaded'));
  wkRefreshStats();wkSaveState();
}
function calcKcalSerie(kg,reps,grupoMuscular,restSecs){
  // Factor por grupo muscular (compuestos gastan más energía)
  const MET={'Piernas':1.00,'Espalda':0.90,'Pecho':0.85,'Hombros':0.75,'Brazos':0.65,'Core':0.70};
  const grupoBase=(grupoMuscular||'').split(' ')[0];
  const metFactor=MET[grupoBase]||0.80;
  // Volumen de trabajo como componente principal
  const volKcal=kg*reps*0.1*metFactor;
  // Descanso corto = mayor demanda metabólica (EPOC)
  const restFactor=restSecs<60?1.15:restSecs>180?0.88:1.0;
  // Datos del usuario (cargados tras login, o desde localStorage como fallback)
  const u=window._wkUserPerfil||{};
  const edad=u.edad||30;
  const genero=u.genero||'M';
  const pesoCorp=u.peso_corporal||u.peso||75;
  // Factor género (acepta 'F'/'mujer' de BD/localStorage respectivamente)
  const genFactor=(genero==='F'||genero==='mujer')?0.85:1.0;
  // Factor edad (~3% menos por década a partir de 30)
  const ageFactor=edad<30?1.05:edad<40?1.0:edad<50?0.95:0.88;
  // Factor peso corporal normalizado a 75 kg
  const bwFactor=Math.sqrt(pesoCorp/75);
  return Math.max(1,Math.round(volKcal*restFactor*genFactor*ageFactor*bwFactor));
}
function wkToggleDone(exId,si){
  const ex=wkExs.find(e=>e.id===exId);if(!ex)return;
  ex.sets[si].done=!ex.sets[si].done;
  if(ex.sets[si].done){
    ex.sets[si].pre=false;
    const restDef=parseInt(localStorage.getItem('gymy_rest_secs')||'90');
    ex.sets[si].kcal=calcKcalSerie(ex.sets[si].kg,ex.sets[si].reps,ex.m,restDef);
    haptic(18);
    wkStartRestTimer();
    const hist=JSON.parse(localStorage.getItem('gymy_historial_local')||'[]').filter(h=>h.nombre===ex.n);
    const prKg=hist.length?Math.max(...hist.map(h=>h.kg)):0;
    const isPR=prKg>0&&ex.sets[si].kg>prKg;
    if(isPR){haptic([30,20,30]);showToast('🏆 Nuevo PR en '+ex.n+'!','success');}
    else showToast('Serie completada ✓ +'+ex.sets[si].kcal+'kcal');
  } else { delete ex.sets[si].kcal; haptic(8); wkSkipRest(); }
  wkReRenderCard(ex);
  // Bounce animation on check circle
  setTimeout(()=>{
    const cc=document.querySelector('#wk-sr-'+exId+'-'+si+' .check-circle');
    if(cc&&ex.sets[si].done){cc.classList.add('just-done');setTimeout(()=>cc.classList.remove('just-done'),300);}
  },10);
  wkRefreshStats();wkSaveState();
}
function wkAddSet(exId){
  const ex=wkExs.find(e=>e.id===exId);if(!ex)return;
  const l=ex.sets[ex.sets.length-1];
  ex.sets.push({kg:l.kg,reps:l.reps,done:false,pre:false});
  haptic(10);
  wkReRenderCard(ex);wkSaveState();
}
function wkDelSet(exId,si){
  const ex=wkExs.find(e=>e.id===exId);if(!ex||ex.sets.length<=1)return;
  ex.sets.splice(si,1);wkReRenderCard(ex);wkRefreshStats();
}
function wkDelExercise(exId){wkExs=wkExs.filter(e=>e.id!==exId);wkRender();}
function wkReRenderCard(ex){
  if(_wkGaussCharts[ex.id]){_wkGaussCharts[ex.id].destroy();delete _wkGaussCharts[ex.id];}
  const el=document.getElementById('wk-ex-'+ex.id);
  if(el)el.outerHTML=wkCardHTML(ex);
  wkInitGauss(ex);
}

function wkRefreshStats(){
  let vol=0,ser=0,kcal=0;
  wkExs.forEach(ex=>ex.sets.forEach(s=>{if(s.done){vol+=s.kg*s.reps;ser++;kcal+=(s.kcal||0);}}));
  const m=String(Math.floor(wkSecs/60)).padStart(2,'0');
  const s=String(wkSecs%60).padStart(2,'0');
  document.getElementById('wkb-dur').textContent=m+':'+s;
  document.getElementById('wkb-vol').textContent=vol;
  document.getElementById('wkb-ser').textContent=ser;
  document.getElementById('wkb-kcal').textContent=kcal;
}

// ── Rest timer ──
const RT_CIRCUMFERENCE=62.83;
function _rtUpdateRing(secs,total){
  const prog=document.getElementById('rt-prog');if(!prog)return;
  const offset=RT_CIRCUMFERENCE*(1-secs/total);
  prog.style.strokeDashoffset=RT_CIRCUMFERENCE-offset;
}
function wkStartRestTimer(){
  const def=parseInt(localStorage.getItem('gymy_rest_secs')||'90');
  wkRestSecs=def;wkRestRunning=true;
  document.getElementById('rest-timer').classList.add('active');
  _rtUpdateRing(def,def);
  haptic(12);
  clearInterval(wkRestInterval);
  wkRestInterval=setInterval(()=>{
    if(!wkRestRunning)return;
    wkRestSecs--;
    if(wkRestSecs<=0){
      clearInterval(wkRestInterval);wkRestRunning=false;
      document.getElementById('rest-timer').classList.remove('active');
      haptic([50,30,50]);
      showToast('¡Descanso terminado! 💪');return;
    }
    const m=String(Math.floor(wkRestSecs/60)).padStart(2,'0');
    const s=String(wkRestSecs%60).padStart(2,'0');
    document.getElementById('rt-display').textContent=m+':'+s;
    _rtUpdateRing(wkRestSecs,def);
  },1000);
}
function wkSkipRest(){
  clearInterval(wkRestInterval);wkRestRunning=false;
  document.getElementById('rest-timer').classList.remove('active');
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
  // Reset state
  wkExs=[];wkEid=0;wkSecs=0;wkRunning=false;wkStarted=false;wkCurTipo='';
  clearInterval(wkSecInterval);clearInterval(wkAutoSaveInterval);clearInterval(wkRestInterval);
  wkSecInterval=null;wkAutoSaveInterval=null;
  document.getElementById('wk-fabs').classList.remove('visible');
  document.getElementById('wk-add-ex-btn').style.display='none';
  document.getElementById('wk-ex-container').innerHTML='';
  document.getElementById('wk-session-secs').textContent='⏱ 00:00';
  const tab=document.getElementById('tab-workout');if(tab)tab.style.display='none';
  wkDeactivateBanner();
  // Go to dashboard
  goTab('dashboard',document.getElementById('tab-dashboard'));
}
async function wkDoSave(){
  wkHide('wk-ov-save');wkRunning=false;wkSkipRest();
  const fab=document.getElementById('wk-fab-ok');
  fab.classList.add('saving');
  fab.innerHTML='<svg width="22" height="22" fill="none" stroke="#fff" stroke-width="2.5" viewBox="0 0 24 24"><circle cx="12" cy="12" r="9" stroke-dasharray="28" stroke-dashoffset="8"/></svg>';
  // Una fila por ejercicio con sets_data para guardar cada serie real (incluye kcal por serie)
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
  // Pass wkExs directly so historial stores all sets grouped by exercise
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
  // Ahora sí: mostrar tab y navegar a workout
  const btn=document.getElementById('tab-workout');
  btn.style.display='flex';
  goTab('workout',btn);
  wkActivate();
  setTimeout(()=>{wkRenderTipoGrid();wkShow('wk-ov-tipo');},200);
}
function wkCancelStart(){
  wkHide('wk-ov-start');
  // Tab workout sigue oculto, no hacer nada más
}
