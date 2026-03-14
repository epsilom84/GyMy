// ══════════════════════════════════════════════
// HISTORY.JS — Lista de sesiones, filtros y exportación
// Depende de: history-card.js, history-detail.js
// ══════════════════════════════════════════════

let _histSearchTimer=null;

function onHistSearch(){
  clearTimeout(_histSearchTimer);
  _histSearchTimer=setTimeout(()=>{currentPage=1;loadHistorial();},320);
}

async function loadHistorial(){
  const q=(document.getElementById('search-q')?.value||'').trim();
  const params={page:currentPage,limit:30};
  if(currentTipoFilter)params.tipo=currentTipoFilter;
  if(currentGrupoFilter)params.grupo=currentGrupoFilter;
  if(currentSubgrupoFilter)params.subgrupo=currentSubgrupoFilter;
  if(q)params.q=q;
  const el=document.getElementById('historial-lista');
  el.innerHTML=Array(4).fill('<div class="skeleton skel-session"></div>').join('');
  const{data}=await getSesiones(params);if(!data.ok){el.innerHTML='';return;}
  if(!data.sesiones.length){
    const emptyMsg=q?`Sin resultados para <em>"${q}"</em>`:'Aún no tienes sesiones registradas.<br>¡Empieza tu primer entrenamiento!';
    el.innerHTML='<div class="empty-state"><img class="empty-state-icon" src="/assets/musculos.svg" alt=""/><div class="empty-state-title">'+(q?'Sin resultados':'Sin sesiones')+'</div><div class="empty-state-sub">'+emptyMsg+'</div></div>';
    document.getElementById('pagination').innerHTML='';
    document.querySelector('.section-sub[id="hist-sub"]')&&(document.getElementById('hist-sub').textContent='Todas tus sesiones');
    return;
  }
  el.innerHTML=data.sesiones.map(s=>sessionCard(s)).join('');
  _initSwipeDelete();
  const subEl=document.getElementById('hist-sub');
  if(subEl){
    const desde=(currentPage-1)*30+1;const hasta=Math.min(currentPage*30,data.total);
    subEl.textContent=data.total>30?`Mostrando ${desde}–${hasta} de ${data.total} sesiones`:`${data.total} sesión${data.total===1?'':'es'}`;
  }
  renderPagination(data.page,data.pages,data.total);
}

// ── Filtros ──
function setTipoFilter(tipo,el){
  currentTipoFilter=tipo;currentPage=1;
  document.querySelectorAll('#tipo-filters .filter-chip').forEach(c=>c.classList.remove('active'));
  el.classList.add('active');
  clearTimeout(_histSearchTimer);
  loadHistorial();
}

async function populateGrupoFilters(){
  await loadCatalogo();
  const cache=window._catalogoCache||{};
  const grupos=Object.keys(cache).sort();
  const gEl=document.getElementById('grupo-filters');
  if(!gEl||!grupos.length)return;
  gEl.innerHTML=
    '<div class="filter-chip'+(currentGrupoFilter?'':' active')+'" onclick="setGrupoFilter(\'\',this)">Todos los grupos</div>'+
    grupos.map(g=>'<div class="filter-chip'+(currentGrupoFilter===g?' active':'')+'" onclick="setGrupoFilter('+JSON.stringify(g)+',this)">'+tipoIcon(g)+' '+g+'</div>').join('');
  gEl.style.display='flex';
  _renderSubgrupoFilters();
}

function _renderSubgrupoFilters(){
  const sEl=document.getElementById('subgrupo-filters');if(!sEl)return;
  if(!currentGrupoFilter){sEl.style.display='none';sEl.innerHTML='';return;}
  const cache=window._catalogoCache||{};
  const ejs=cache[currentGrupoFilter]||[];
  const subgrupos=[...new Set(ejs.map(e=>e.sg).filter(Boolean))].sort();
  if(!subgrupos.length){sEl.style.display='none';return;}
  sEl.innerHTML=
    '<div class="filter-chip'+(currentSubgrupoFilter?'':' active')+'" onclick="setSubgrupoFilter(\'\',this)">Todos</div>'+
    subgrupos.map(sg=>'<div class="filter-chip'+(currentSubgrupoFilter===sg?' active':'')+'" onclick="setSubgrupoFilter('+JSON.stringify(sg)+',this)">'+sg+'</div>').join('');
  sEl.style.display='flex';
}

function setGrupoFilter(grupo,el){
  currentGrupoFilter=grupo;currentSubgrupoFilter='';currentPage=1;
  document.querySelectorAll('#grupo-filters .filter-chip').forEach(c=>c.classList.remove('active'));
  el.classList.add('active');
  _renderSubgrupoFilters();
  loadHistorial();
}

function setSubgrupoFilter(sg,el){
  currentSubgrupoFilter=sg;currentPage=1;
  document.querySelectorAll('#subgrupo-filters .filter-chip').forEach(c=>c.classList.remove('active'));
  el.classList.add('active');
  loadHistorial();
}

// ── Paginación ──
function renderPagination(page,pages,total){
  const el=document.getElementById('pagination');
  if(pages<=1){el.innerHTML='';return;}
  el.innerHTML='<button class="page-btn" onclick="changePage('+(page-1)+')" '+(page<=1?'disabled':'')+'>← Anterior</button>'+
    '<span class="page-info">'+page+' / '+pages+(total?' <span style="opacity:.5;font-size:11px">('+total+')</span>':'')+'</span>'+
    '<button class="page-btn" onclick="changePage('+(page+1)+')" '+(page>=pages?'disabled':'')+'>Siguiente →</button>';
}
function changePage(p){currentPage=p;loadHistorial();window.scrollTo(0,0);}

// ── Eliminar historial ──
async function eliminarTodoHistorial(){
  const{data}=await apiCall('DELETE','/sesiones');
  if(data.ok){
    localStorage.removeItem(_uk('historial_local'));
    statsCache=null;currentPage=1;
    loadDashboard();loadHistorial();
    showToast('Historial eliminado','info');
  }else showToast(data.error||'Error al eliminar','error');
}
function confirmarEliminarHistorial(){
  showConfirm('¿Eliminar todo el historial?','Se borrarán todas tus sesiones y ejercicios. Esta acción no se puede deshacer.','Eliminar todo',eliminarTodoHistorial);
}

// ── Exportación ──
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
    }else{
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

async function doExport(){showToast('Descargando CSV...','info');await exportarCSV();closeModal('modal-export');}
