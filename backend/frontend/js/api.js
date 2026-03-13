// ══════════════════════════════════════════════
// API.JS — Token management + apiCall + offline queue
// ══════════════════════════════════════════════

const API_URL=(location.hostname==='localhost'||location.hostname==='127.0.0.1')?'http://localhost:3000/api':'/api';

// ── TOKEN STORAGE ──
function getAccessToken(){return localStorage.getItem('gymy_access');}
function getRefreshToken(){return localStorage.getItem('gymy_refresh');}
function setTokens(a,r){localStorage.setItem('gymy_access',a);if(r)localStorage.setItem('gymy_refresh',r);}
function isLoggedIn(){return!!getAccessToken();}

// ── FETCH CON AUTO-REFRESH ──
async function apiCall(m,ep,body=null,retry=false){
  const h={'Content-Type':'application/json'};const t=getAccessToken();if(t)h['Authorization']='Bearer '+t;
  const o={method:m,headers:h};if(body)o.body=JSON.stringify(body);
  try{
    const r=await fetch(API_URL+ep,o);const d=await r.json();
    if(r.status===401&&d.error==='TOKEN_EXPIRED'&&!retry){
      const rf=getRefreshToken();if(!rf){logout();return{data:{ok:false}};}
      const rr=await fetch(API_URL+'/auth/refresh',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({refreshToken:rf})});
      const rd=await rr.json();
      if(rd.ok){setTokens(rd.accessToken,rd.refreshToken);return apiCall(m,ep,body,true);}
      logout();return{data:{ok:false}};
    }
    return{data:d};
  }catch(e){return{data:{ok:false,error:'Sin conexion'}};}
}

// ── AUTH HELPERS ──
async function getSesiones(p={}){const qs=new URLSearchParams(p).toString();return apiCall('GET','/sesiones'+(qs?'?'+qs:''));}
async function getStats(){return apiCall('GET','/sesiones/stats');}
async function getSesion(id){return apiCall('GET','/sesiones/'+id);}
async function crearSesion(d){return apiCall('POST','/sesiones',d);}
async function actualizarSesion(id,d){return apiCall('PUT','/sesiones/'+id,d);}
async function eliminarSesion(id){return apiCall('DELETE','/sesiones/'+id);}
async function forgotPassword(e){return apiCall('POST','/auth/forgot-password',{email:e});}
async function resetPassword(t,p){return apiCall('POST','/auth/reset-password',{token:t,password:p});}
async function register(u,e,p){
  const r=await apiCall('POST','/auth/register',{username:u,email:e,password:p});
  if(r.data.ok){setTokens(r.data.accessToken,r.data.refreshToken);localStorage.setItem('gymy_user',JSON.stringify(r.data.usuario));}
  return r;
}
async function login(e,p){
  const r=await apiCall('POST','/auth/login',{email:e,password:p});
  if(r.data.ok){setTokens(r.data.accessToken,r.data.refreshToken);localStorage.setItem('gymy_user',JSON.stringify(r.data.usuario));}
  return r;
}
function logout(){
  apiCall('POST','/auth/logout').catch(()=>{});
  ['gymy_access','gymy_refresh','gymy_user','gymy_offline_queue'].forEach(k=>localStorage.removeItem(k));
  window.location.href='/';
}

// ── EXPORT CSV ──
async function exportarCSV(){
  const t=getAccessToken();
  const r=await fetch(API_URL+'/sesiones/export/csv',{headers:{'Authorization':'Bearer '+t}});
  const b=await r.blob();const u=URL.createObjectURL(b);
  const a=document.createElement('a');a.href=u;a.download='gymy_export.csv';a.click();URL.revokeObjectURL(u);
}

// ── OFFLINE QUEUE ──
function guardarOffline(s){const q=JSON.parse(localStorage.getItem('gymy_offline_queue')||'[]');s._offline_id=Date.now();q.push(s);localStorage.setItem('gymy_offline_queue',JSON.stringify(q));}
async function sincronizarOffline(){
  const q=JSON.parse(localStorage.getItem('gymy_offline_queue')||'[]');if(!q.length)return{sincronizadas:0};
  const r=await apiCall('POST','/sesiones/sync',{sesiones:q});
  if(r.data.ok){localStorage.removeItem('gymy_offline_queue');return{sincronizadas:q.length};}
  return{sincronizadas:0};
}
function getPendientesOffline(){return JSON.parse(localStorage.getItem('gymy_offline_queue')||'[]');}

