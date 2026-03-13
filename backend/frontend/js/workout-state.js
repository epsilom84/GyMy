// ══════════════════════════════════════════════
// WORKOUT-STATE.JS — Estado, persistencia y preload
// ══════════════════════════════════════════════

// ── State ──
let wkExs=[],wkEid=0,wkSecs=0,wkRunning=false;
let wkRestSecs=0,wkRestRunning=false,wkRestInterval=null;
let _wkGaussCharts={};
let wkCurTipo='',wkCurEjGrupo='',wkStarted=false,wkSecInterval=null,wkAutoSaveInterval=null;
const WK_KEY='gymy_workout_live';

function wkIsActive(){return!!localStorage.getItem('gymy_workout_active');}
function wkGetPreloadMode(){return localStorage.getItem('gymy_preload_mode')||'ultimo';}

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

// ── Historial local (precarga workout desde Postgres) ──
async function cargarHistorialLocal(){
  try{
    const res=await apiCall('GET','/sesiones?limit=100&page=1');
    if(!res.data?.ok||!res.data.sesiones)return;
    const sesiones=res.data.sesiones;
    const byNombreSession={};
    for(const sesion of sesiones){
      let ejercicios=sesion.ejercicios||[];
      if(!ejercicios.length&&sesion.id){
        try{
          const det=await apiCall('GET','/sesiones/'+sesion.id);
          ejercicios=det.data?.sesion?.ejercicios||[];
        }catch(e){}
      }
      const byNombre={};
      ejercicios.forEach(e=>{
        if(!byNombre[e.nombre])byNombre[e.nombre]=[];
        if(e.sets_data){
          try{
            const sd=typeof e.sets_data==='string'?JSON.parse(e.sets_data):e.sets_data;
            sd.forEach(s=>byNombre[e.nombre].push({kg:s.kg!=null?s.kg:(s.peso_kg||0),reps:s.reps||0}));
            return;
          }catch(x){}
        }
        const n=e.series||1;
        for(let i=0;i<n;i++) byNombre[e.nombre].push({kg:e.peso_kg||0,reps:e.reps||0});
      });
      Object.entries(byNombre).forEach(([nombre,sets])=>{
        if(!byNombreSession[nombre])byNombreSession[nombre]=[];
        byNombreSession[nombre].push({nombre,sets,ts:new Date(sesion.fecha).getTime()||0});
      });
    }
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

async function wkGetPreloadFromDB(nombre){
  const mode=wkGetPreloadMode();
  try{
    const{data}=await apiCall('GET','/ejercicios/historial?nombre='+encodeURIComponent(nombre));
    if(!data.ok||!data.historial||!data.historial.length)return null;
    function rowToBlock(row){
      let sets=null;
      if(row.sets_data){
        try{
          const sd=typeof row.sets_data==='string'?JSON.parse(row.sets_data):row.sets_data;
          sets=sd.map(s=>({kg:Number(s.kg??s.peso_kg??0),reps:Number(s.reps??0)}));
        }catch(x){sets=null;}
      }
      if(!sets){
        const n=Number(row.series)||1;
        const kg=Number(row.peso_kg)||0;
        const reps=Number(row.reps)||0;
        sets=Array.from({length:n},()=>({kg,reps}));
      }
      const vol=sets.reduce((a,s)=>a+s.kg*s.reps,0);
      return{sets,vol};
    }
    if(mode==='ultimo')return{sets:rowToBlock(data.historial[0]).sets};
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
  const h=JSON.parse(localStorage.getItem('gymy_historial_local')||'[]');
  const ts=Date.now();
  exs.forEach(ex=>{
    const doneSets=ex.sets.filter(s=>s.done).map(s=>({kg:s.kg,reps:s.reps}));
    if(doneSets.length>0) h.push({nombre:ex.n,sets:doneSets,ts});
  });
  if(h.length>500)h.splice(0,h.length-500);
  localStorage.setItem('gymy_historial_local',JSON.stringify(h));
}
