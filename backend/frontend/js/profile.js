// ══════════════════════════════════════════════
// PROFILE.JS — Datos de perfil del usuario
// Depende de: catalog.js, settings.js
// ══════════════════════════════════════════════

function saveProfileData(){
  const fields=['edad','genero','altura','peso','actividad','objetivo'];
  const data={};
  fields.forEach(f=>{
    const el=document.getElementById('p-'+f);
    if(el)data[f]=el.value;
  });
  localStorage.setItem(_uk('profile_data'),JSON.stringify(data));
  window._wkUserPerfil=Object.assign(window._wkUserPerfil||{},data);
}

function loadProfileData(){
  const data=JSON.parse(localStorage.getItem(_uk('profile_data'))||'{}');
  const fields=['edad','genero','altura','peso','actividad','objetivo'];
  fields.forEach(f=>{
    const el=document.getElementById('p-'+f);
    if(el&&data[f]!==undefined)el.value=data[f];
  });
}

async function guardarPerfilFisicoEnBD(){
  const pd=JSON.parse(localStorage.getItem(_uk('profile_data'))||'{}');
  const genMap={'hombre':'M','mujer':'F','otro':'O'};
  const body={
    edad:parseInt(pd.edad)||null,
    genero:genMap[pd.genero]||pd.genero||null,
    peso_corporal:parseFloat(pd.peso)||null,
  };
  const r=await apiCall('PUT','/auth/me',body);
  if(r.data&&r.data.ok){
    window._wkUserPerfil=Object.assign(window._wkUserPerfil||{},body);
    showToast('Datos físicos sincronizados con tu cuenta ✓','success');
  }else{
    showToast((r.data&&r.data.error)||'Error al sincronizar','error');
  }
}
