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

// Service Worker
if('serviceWorker' in navigator){
  navigator.serviceWorker.register('/sw.js').catch(()=>{});
}
