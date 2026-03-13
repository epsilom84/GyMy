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

// ── Export ──
async function doExport(){showToast('Descargando CSV...','info');await exportarCSV();closeModal('modal-export');}

// ── Historial CSV export ──
async function exportHistorialCSV(){
  showToast('Preparando CSV...','info');
  const{data}=await getSesiones({limit:1000});
  let rows=['fecha,tipo,duracion_min,calorias,ejercicio,series,reps,peso_kg,notas'];
  const sesiones=data.ok?data.sesiones:[];
  if(!sesiones.length){showToast('No hay sesiones para exportar','error');return;}
  sesiones.forEach(s=>{
    if(s.ejercicios&&s.ejercicios.length){
      s.ejercicios.forEach(e=>{
        rows.push([s.fecha,s.tipo,s.duracion_min||'',s.calorias||'',
          '"'+(e.nombre||'')+'"',e.series||1,e.reps||0,e.peso_kg||0,
          '"'+(s.notas||'')+'"'].join(','));
      });
    } else {
      rows.push([s.fecha,s.tipo,s.duracion_min||'',s.calorias||'','',0,0,0,'"'+(s.notas||'')+'"'].join(','));
    }
  });
  const csv=rows.join('\n');
  const blob=new Blob([csv],{type:'text/csv;charset=utf-8;'});
  const url=URL.createObjectURL(blob);
  const a=document.createElement('a');
  a.href=url;a.download='gymy_historial_'+new Date().toISOString().slice(0,10)+'.csv';
  a.click();URL.revokeObjectURL(url);
  showToast('CSV exportado','success');
}

// ── App bootstrap ──
function showAuth(){document.getElementById('auth-screen').style.display='flex';document.getElementById('app-screen').style.display='none';}

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
  const _pd=JSON.parse(localStorage.getItem('gymy_profile_data')||'{}');
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
