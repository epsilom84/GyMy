// ══════════════════════════════════════════════
// APP.JS — Bootstrap, estado global e init
// ══════════════════════════════════════════════

let currentPage=1,currentTipoFilter='',currentGrupoFilter='',currentSubgrupoFilter='',statsCache=null,ejCount=0;

// ── Offline badge ──
function updateOfflineBadge(){
  const bar=document.getElementById('offline-bar');
  const pending=getPendientesOffline().length;
  if(!navigator.onLine){bar.style.display='flex';bar.className='offline-badge offline';bar.innerHTML='⚡ Sin conexión — datos guardados localmente';}
  else if(pending>0){bar.style.display='flex';bar.className='offline-badge online';bar.innerHTML='🔄 '+pending+' sesión(es) pendientes <a href="#" onclick="syncOffline()" style="color:inherit;margin-left:6px">Sincronizar</a>';}
  else{bar.style.display='none';}
}

// ── Sync offline ──
async function syncOffline(){
  const statusEl=document.getElementById('sync-status');
  if(statusEl)statusEl.textContent='Sincronizando...';
  const r=await sincronizarOffline();
  if(r.sincronizadas>0){
    showToast(r.sincronizadas+' sesiones sincronizadas','success');
    loadDashboard();statsCache=null;
    if(statusEl)statusEl.textContent='✓ '+r.sincronizadas+' sesiones sincronizadas';
  } else {
    showToast('No hay datos pendientes','info');
    if(statusEl)statusEl.textContent='Sin datos pendientes';
  }
  updateOfflineBadge();
  setTimeout(()=>{if(statusEl)statusEl.textContent='';},4000);
}

// ── App bootstrap ──
function initApp(){
  document.getElementById('auth-screen').style.display='none';
  document.getElementById('app-screen').style.display='flex';
  const u=getUser();
  if(u){
    const ini=u.username[0].toUpperCase();
    ['top-avatar','panel-avatar','perfil-avatar'].forEach(id=>{const el=document.getElementById(id);if(el)el.textContent=ini;});
    document.getElementById('top-name').textContent=u.username;
    document.getElementById('panel-name').textContent=u.username;
    document.getElementById('panel-email').textContent=u.email;
    document.getElementById('perfil-name').textContent=u.username;
    document.getElementById('perfil-email').textContent=u.email;
    const h=new Date().getHours();
    const g=h<13?'Buenos días':h<20?'Buenas tardes':'Buenas noches';
    document.getElementById('dash-greeting').textContent=g+', '+u.username+' 👋';
  }
  updateOfflineBadge();
  refreshCoach();
  loadDashboard();
  applySettingsUI();
  cargarHistorialLocal();
  loadCatalogo().then(()=>console.log('[Catálogo] Cargado:',Object.keys(_catalogoCache||{}).length,'grupos'));
  loadPlantillas().then(()=>console.log('[Plantillas] Cargadas:',(_plantillasCache||[]).length,'ejercicios'));
  const _pd=JSON.parse(localStorage.getItem(_uk('profile_data'))||'{}');
  window._wkUserPerfil={edad:parseInt(_pd.edad)||null,genero:_pd.genero||null,peso:parseFloat(_pd.peso)||null};
  apiCall('GET','/auth/me').then(r=>{if(r.data&&r.data.ok)window._wkUserPerfil=r.data.usuario;}).catch(()=>{});
  const wtab=document.getElementById('tab-workout');
  if(wtab)wtab.style.display=wkIsActive()?'flex':'none';
  const savedTab=location.search.match(/tab=([a-z]+)/)?.[1];
  if(savedTab){
    const tabBtn=document.getElementById('tab-'+savedTab);
    if(tabBtn&&tabBtn.style.display!=='none')tabBtn.click();
  }
}

window.onload=()=>{
  autoThemeByHour();
  applyTheme();
  if(isLoggedIn())initApp();
  else{
    showAuth();
    const saved=localStorage.getItem('gymy_saved_email');
    if(saved&&localStorage.getItem('gymy_remember')){
      document.getElementById('li-email').value=saved;
      if(document.getElementById('remember-me'))document.getElementById('remember-me').checked=true;
    }
  }
  const params=new URLSearchParams(location.search);
  if(params.get('token'))showResetForm(params.get('token'));
  window.addEventListener('online',()=>{updateOfflineBadge();syncOffline();});
  window.addEventListener('offline',()=>updateOfflineBadge());
};

// ── Cargar historial local (precarga workout desde Postgres) ──
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
    localStorage.setItem(_uk('historial_local'),JSON.stringify(h));
    console.log('[GyMy] Historial local cargado:',h.length,'entradas');
  }catch(e){
    console.warn('[GyMy] No se pudo cargar historial local:',e.message);
  }
}

// Service Worker
if('serviceWorker' in navigator){
  navigator.serviceWorker.register('/sw.js').catch(()=>{});
}
