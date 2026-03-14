// ══════════════════════════════════════════════
// CATALOG.JS — Catálogo de ejercicios y plantillas
// ══════════════════════════════════════════════

// Caché en memoria (se carga una vez por sesión)
let _catalogoCache=null;
let _catalogoLoading=null;
let _plantillasCache=null;
let _plantillasLoading=null;

async function loadCatalogo(){
  if(_catalogoCache)return _catalogoCache;
  if(_catalogoLoading)return _catalogoLoading;
  _catalogoLoading=(async()=>{
    try{
      const resp=await fetch('/api/catalogo',{headers:{'Authorization':'Bearer '+(getAccessToken()||'')}});
      const r=await resp.json();
      if(r.ok&&r.grupos){
        const db={};
        Object.entries(r.grupos).forEach(([grupo,ejs])=>{
          db[grupo]=ejs.map(e=>({
            em:ejEmoji(e.equipo),
            equipo:e.equipo||null,
            n:e.nombre,
            m:(e.subgrupo||grupo).toUpperCase(),
            sg:e.subgrupo||null,
            id:e.id
          }));
        });
        _catalogoCache=db;
        _ejGrupoLookup=null; // forzar reconstrucción del lookup
        return db;
      }
    }catch(err){console.warn('[Catálogo] Error cargando desde API:',err.message);}
    return {};
  })();
  return _catalogoLoading;
}

async function loadPlantillas(){
  if(_plantillasCache)return _plantillasCache;
  if(_plantillasLoading)return _plantillasLoading;
  _plantillasLoading=(async()=>{
    try{
      const{data}=await apiCall('GET','/plantillas');
      if(data.ok){_plantillasCache=data.plantillas||[];return _plantillasCache;}
    }catch(e){console.warn('[Plantillas] Error:',e.message);}
    return[];
  })();
  return _plantillasLoading;
}
function invalidatePlantillas(){_plantillasCache=null;_plantillasLoading=null;}

// Versión síncrona (usa caché si ya está cargada)
function wkGetDB(){
  const base=_catalogoCache||{};
  const m={};
  Object.keys(base).forEach(k=>{m[k]=[...base[k]];});
  (_plantillasCache||[]).forEach(p=>{
    const g=p.grupo_muscular;
    if(!m[g])m[g]=[];
    if(!m[g].some(e=>e.n===p.nombre)){
      m[g].push({em:ejEmoji(p.equipo),equipo:p.equipo||null,n:p.nombre,m:(p.subgrupo||g).toUpperCase(),id:p.id,db:true,propia:p.propia});
    }
  });
  // localStorage (compat)
  const loc=JSON.parse(localStorage.getItem('gymy_plantillas')||'{}');
  Object.keys(loc).forEach(k=>{
    if(!m[k])m[k]=[];
    loc[k].forEach(e=>{if(!m[k].some(ex=>ex.n===e.n))m[k].push(e);});
  });
  return m;
}

// Versión async: asegura que el catálogo y plantillas están cargados
async function wkGetDBAsync(){
  await Promise.all([loadCatalogo(),loadPlantillas()]);
  return wkGetDB();
}

// ── Render de catálogo en perfil ──
async function renderCatalogoList(){
  const el=document.getElementById('catalogo-list');
  if(!el)return;
  const db=await wkGetDBAsync();
  const grupos=Object.keys(db);
  if(!grupos.length){
    el.innerHTML='<div style="font-size:12px;color:var(--text2);text-align:center;padding:10px">No hay ejercicios en el catálogo</div>';
    return;
  }
  el.innerHTML=grupos.map(grupo=>{
    const ejs=(_catalogoCache||{})[grupo]||[];
    if(!ejs.length)return'';
    const grid='<div class="ej-grid" style="padding:8px 0 4px">'+
      ejs.map(e=>{const _ci=ejHasImg(e.n)?'ej-card--img':'ej-card--svg';return'<div class="ej-card '+_ci+'" style="cursor:default">'
        +'<div class="ej-item-em">'+ejIconHtml(e.n,e.equipo,56)+'</div>'
        +'<div class="ej-card-n">'+e.n+'</div>'
        +(e.m&&e.m!==grupo?'<div class="ej-card-m">'+e.m+'</div>':'')
        +'</div>';}).join('')
      +'</div>';
    return '<details style="margin-bottom:8px">'
      +'<summary style="cursor:pointer;font-size:13px;font-weight:600;padding:10px 12px;background:var(--bg3);border-radius:10px;list-style:none;display:flex;justify-content:space-between;align-items:center">'
      +'<span style="display:inline-flex;align-items:center;gap:8px">'+grupoSVGHtml(grupo,22)+' '+grupo+'</span>'
      +'<span style="font-size:11px;color:var(--text2)">'+ejs.length+' ej.</span></summary>'
      +'<div style="padding:2px 0 0">'+grid+'</div></details>';
  }).join('');
}

// ── Plantillas personalizadas ──
async function renderPlantillasList(){
  const el=document.getElementById('plantillas-list');
  if(!el)return;
  el.innerHTML='<div style="font-size:12px;color:var(--text2);padding:8px 0">Cargando...</div>';
  await loadPlantillas();
  const dbEjs=(_plantillasCache||[]).filter(p=>p.propia);
  const loc=JSON.parse(localStorage.getItem('gymy_plantillas')||'{}');
  const locEjs=Object.entries(loc).flatMap(([grupo,ejs])=>ejs.map(e=>({...e,grupo,db:false})));
  const all=[...dbEjs.map(p=>({n:p.nombre,grupo:p.grupo_muscular,em:ejEmoji(p.equipo),id:p.id,db:true})),...locEjs];
  if(!all.length){el.innerHTML='<p style="font-size:12px;color:var(--text2)">No hay plantillas personalizadas.</p>';return;}
  el.innerHTML='<div style="font-size:11px;color:var(--text2);margin-bottom:6px">'+all.length+' ejercicio(s) personalizados</div>'+
    all.map(e=>{
      const delFn=e.db?`delPlantillaDB(${e.id})`:`delPlantillaLocal('${e.grupo}','${e.n}')`;
      return '<div style="display:flex;justify-content:space-between;align-items:center;padding:8px 10px;background:var(--bg3);border-radius:8px;margin-bottom:5px;font-size:13px">'+
        '<span>'+(e.em||'💪')+' '+e.n+' <span style="color:var(--text2);font-size:11px">('+e.grupo+')</span></span>'+
        '<button onclick="'+delFn+'" style="background:transparent;border:none;color:var(--accent2);cursor:pointer;font-size:14px">✕</button>'+
      '</div>';
    }).join('');
}

function openAddPlantilla(){
  const grupos=[...new Set([...Object.keys(_catalogoCache||{}),...Object.keys(JSON.parse(localStorage.getItem('gymy_plantillas')||'{}')),'General'])].sort();
  const sel=document.getElementById('new-ej-grupo');
  const BASE=['Pecho','Espalda','Piernas','Hombros','Brazos','Core','Cardio','General'];
  const all=[...new Set([...grupos,...BASE])].sort();
  sel.innerHTML=all.map(g=>`<option value="${g}">${g}</option>`).join('');
  document.getElementById('new-ej-nombre').value='';
  document.getElementById('new-ej-musculo').value='';
  openModal('modal-add-plantilla');
}

async function addPlantillaManual(){
  const grupo=document.getElementById('new-ej-grupo').value;
  const nombre=document.getElementById('new-ej-nombre').value.trim();
  const musculo=document.getElementById('new-ej-musculo').value.trim();
  if(!nombre)return showToast('Introduce un nombre','error');
  const{data}=await apiCall('POST','/plantillas',{nombre,grupo_muscular:grupo,subgrupo:musculo||grupo});
  if(!data.ok)return showToast(data.error||'Error al guardar','error');
  invalidatePlantillas();
  closeModal('modal-add-plantilla');
  renderPlantillasList();
  showToast('Ejercicio añadido','success');
}

async function delPlantillaDB(id){
  const{data}=await apiCall('DELETE','/plantillas/'+id);
  if(!data.ok)return showToast(data.error||'Error al eliminar','error');
  invalidatePlantillas();
  renderPlantillasList();
}
function delPlantillaLocal(grupo,nombre){
  const p=JSON.parse(localStorage.getItem('gymy_plantillas')||'{}');
  if(p[grupo])p[grupo]=p[grupo].filter(e=>e.n!==nombre);
  localStorage.setItem('gymy_plantillas',JSON.stringify(p));
  renderPlantillasList();
}
function delPlantilla(grupo,nombre){delPlantillaLocal(grupo,nombre);}

// ── Inferencia de grupo muscular ──
function _inferirGrupo(nombre){
  const n=nombre.toLowerCase();
  if(/pecho|banca|press.*pec|apertura|cruce/.test(n))return'Pecho';
  if(/espalda|jalón|jalon|remo|pull|dominada|hiperexten/.test(n))return'Espalda';
  if(/pierna|sentadilla|prensa|femoral|gemelo|abducc|aducc|zancada|extensión.*pierna|extension.*pierna/.test(n))return'Piernas';
  if(/hombro|deltoid|elevac|face pull|arnold|vuelo/.test(n))return'Hombros';
  if(/tríceps|triceps|fondo|francés|frances|cuerda|extensión.*tri|extension.*tri/.test(n))return'Brazos';
  if(/bíceps|biceps|curl/.test(n))return'Brazos';
  if(/brazo/.test(n))return'Brazos';
  if(/core|abdom|plancha|crunch|oblicuo|rueda|elevación.*pierna/.test(n))return'Core';
  if(/cardio|cinta|bicicleta|elíptica|eliptica|remo ergó|escaladora/.test(n))return'Cardio';
  return'General';
}

// ── Parseo de archivo de plantillas ──
function _parsePlantillasFile(text){
  try{
    const d=JSON.parse(text);
    if(Array.isArray(d))return d.map(e=>({
      nombre:e.nombre||e.name||e.ejercicio||'',
      grupo_muscular:e.grupo_muscular||e.grupo||e.muscle_group||_inferirGrupo(e.nombre||e.name||''),
      subgrupo:e.subgrupo||null,equipo:e.equipo||null,tipo:e.tipo||'fuerza'
    })).filter(e=>e.nombre);
  }catch(e){}
  const lines=text.split('\n').map(l=>l.trim()).filter(Boolean);
  if(!lines.length)return[];
  const sep=lines[0].includes('\t')?'\t':lines[0].includes(';')?';':',';
  const headers=lines[0].split(sep).map(h=>h.toLowerCase().replace(/"/g,'').trim());
  const iNombre=headers.findIndex(h=>/nombre|name|ejercicio|exercise/.test(h));
  const iGrupo=headers.findIndex(h=>/grupo|muscle|muscular|group/.test(h));
  const iSubgrupo=headers.findIndex(h=>/subgrupo|sub/.test(h));
  const iEquipo=headers.findIndex(h=>/equipo|equipment/.test(h));
  if(iNombre===-1&&lines.length>0){
    const startI=headers.some(h=>/nombre|name|grupo|muscle/.test(h))?1:0;
    return lines.slice(startI).map(l=>{
      const nombre=l.replace(/"/g,'').trim();
      return{nombre,grupo_muscular:_inferirGrupo(nombre),subgrupo:null,equipo:null,tipo:'fuerza'};
    }).filter(e=>e.nombre);
  }
  return lines.slice(1).map(line=>{
    const cols=line.split(sep).map(c=>c.replace(/"/g,'').trim());
    const nombre=(iNombre>=0?cols[iNombre]:cols[0])||'';
    const grupoRaw=(iGrupo>=0?cols[iGrupo]:'')||'';
    const grupo_muscular=grupoRaw||_inferirGrupo(nombre);
    return{nombre,grupo_muscular,subgrupo:iSubgrupo>=0?cols[iSubgrupo]||null:null,equipo:iEquipo>=0?cols[iEquipo]||null:null,tipo:'fuerza'};
  }).filter(e=>e.nombre);
}

// ── Importar plantillas ──
let _importPlantillasParsed=[];
function importPlantillasFile(event){
  const file=event.target.files[0];if(!file)return;
  event.target.value='';
  const reader=new FileReader();
  reader.onload=(ev)=>{
    const parsed=_parsePlantillasFile(ev.target.result);
    if(!parsed.length)return showToast('No se encontraron ejercicios en el archivo','error');
    _importPlantillasParsed=parsed;
    const byGrupo={};
    parsed.forEach(e=>{if(!byGrupo[e.grupo_muscular])byGrupo[e.grupo_muscular]=[];byGrupo[e.grupo_muscular].push(e.nombre);});
    const body=document.getElementById('import-plantillas-body');
    body.innerHTML='<div style="font-size:13px;margin-bottom:10px">Se importarán <strong>'+parsed.length+'</strong> ejercicios:</div>'+
      Object.entries(byGrupo).map(([grupo,ejs])=>
        '<div style="margin-bottom:8px"><div style="font-size:12px;font-weight:600;color:var(--accent)">'+grupoEmoji(grupo)+' '+grupo+'</div>'+
        ejs.map(n=>'<div style="font-size:12px;padding:2px 8px;color:var(--text2)">'+n+'</div>').join('')+'</div>'
      ).join('');
    openModal('modal-import-plantillas');
  };
  reader.readAsText(file,'utf-8');
}
async function confirmarImportPlantillas(){
  if(!_importPlantillasParsed.length)return;
  const btn=document.getElementById('btn-confirm-import-plantillas');
  btn.disabled=true;btn.textContent='Importando...';
  const{data}=await apiCall('POST','/plantillas/bulk',{ejercicios:_importPlantillasParsed});
  btn.disabled=false;btn.textContent='Importar';
  closeModal('modal-import-plantillas');
  if(data.ok){
    invalidatePlantillas();
    renderPlantillasList();
    showToast((data.creados||0)+' ejercicios importados','success');
  }else{
    showToast(data.error||'Error al importar','error');
  }
  _importPlantillasParsed=[];
}

// ── Importar catálogo ──
let _importCatalogoParsed=[];
function importCatalogoFile(event){
  const file=event.target.files[0];if(!file)return;
  event.target.value='';
  const reader=new FileReader();
  reader.onload=(ev)=>{
    const parsed=_parsePlantillasFile(ev.target.result);
    if(!parsed.length)return showToast('No se encontraron ejercicios en el archivo','error');
    _importCatalogoParsed=parsed;
    const byGrupo={};
    parsed.forEach(e=>{if(!byGrupo[e.grupo_muscular])byGrupo[e.grupo_muscular]=[];byGrupo[e.grupo_muscular].push(e.nombre);});
    const body=document.getElementById('import-catalogo-body');
    body.innerHTML=
      '<div style="font-size:13px;margin-bottom:10px;color:var(--danger,#e53935)">⚠️ Se reemplazarán <strong>TODOS</strong> los ejercicios del catálogo actual para todos los usuarios.</div>'+
      '<div style="font-size:13px;margin-bottom:10px">Nuevo catálogo: <strong>'+parsed.length+'</strong> ejercicios en <strong>'+Object.keys(byGrupo).length+'</strong> grupos:</div>'+
      Object.entries(byGrupo).map(([grupo,ejs])=>
        '<div style="margin-bottom:8px"><div style="font-size:12px;font-weight:600;color:var(--accent)">'+grupoEmoji(grupo)+' '+grupo+' ('+ejs.length+')</div></div>'
      ).join('');
    openModal('modal-import-catalogo');
  };
  reader.readAsText(file,'utf-8');
}
async function confirmarImportCatalogo(){
  if(!_importCatalogoParsed.length)return;
  const btn=document.getElementById('btn-confirm-import-catalogo');
  btn.disabled=true;btn.textContent='Actualizando...';
  const{data}=await apiCall('POST','/catalogo/import',{ejercicios:_importCatalogoParsed});
  btn.disabled=false;btn.textContent='Actualizar catálogo';
  closeModal('modal-import-catalogo');
  if(data.ok){
    _catalogoCache=null;
    loadCatalogo().then(()=>renderCatalogoList());
    showToast('Catálogo actualizado: '+(data.insertados||0)+' ejercicios','success');
  }else{
    showToast(data.error||'Error al actualizar catálogo','error');
  }
  _importCatalogoParsed=[];
}

function confirmEliminarPlantillas(){
  showConfirm('¿Eliminar todas las plantillas?','Se eliminarán todos los ejercicios personalizados. Los ejercicios base no se ven afectados.','Eliminar todo',async()=>{
    await apiCall('DELETE','/plantillas');
    localStorage.removeItem('gymy_plantillas');
    invalidatePlantillas();
    renderPlantillasList();
    showToast('Plantillas eliminadas','info');
  });
}
