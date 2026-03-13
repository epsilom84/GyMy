// ══════════════════════════════════════════════
// HISTORY.JS — Historial
// ══════════════════════════════════════════════

let _histSearchTimer=null;

// ── Lookup ejercicio → grupo muscular (desde catálogo) ──
let _ejGrupoLookup=null;
function _buildEjGrupoLookup(){
  if(!_catalogoCache)return{};
  const m={};
  for(const grupo of Object.keys(_catalogoCache)){
    for(const ej of _catalogoCache[grupo]){if(ej.n)m[ej.n.toLowerCase().trim()]=grupo;}
  }
  return m;
}
function getEjGrupoLookup(){
  if(!_ejGrupoLookup&&_catalogoCache)_ejGrupoLookup=_buildEjGrupoLookup();
  return _ejGrupoLookup||{};
}
function _normGrupoSimple(g){
  if(!g)return'';
  if(g.startsWith('Brazos'))return'Brazos';
  if(g.startsWith('Piernas'))return'Piernas';
  if(g.startsWith('Espalda'))return'Espalda';
  return g;
}
function getSessionGrupos(ejercicios){
  if(!ejercicios?.length)return[];
  const lk=getEjGrupoLookup();
  const seen=new Set(),res=[];
  for(const e of ejercicios){
    const g=lk[(e.nombre||'').toLowerCase().trim()];
    if(g){const s=_normGrupoSimple(g);if(!seen.has(s)){seen.add(s);res.push(s);}}
  }
  return res;
}

function sessionIconHtml(grupos,tipo){
  if(!grupos.length)return'<div class="session-icon tipo-'+tipo+'">'+tipoSVGHtml(tipo,26)+'</div>';
  const col0=GRUPO_COLORS[grupos[0]]||'var(--accent)';
  let bg;
  if(grupos.length===1){
    bg='background:'+col0+'22;box-shadow:0 0 0 1px '+col0+'33';
  }else{
    const cols=grupos.slice(0,4).map(g=>GRUPO_COLORS[g]||'#888');
    const stops=cols.map((c,i)=>c+'44 '+Math.round(i*100/Math.max(1,cols.length-1))+'%').join(',');
    bg='background:linear-gradient(135deg,'+stops+')';
  }
  return'<div class="session-icon" style="'+bg+'">'+grupoSVGHtml(grupos[0],28)+'</div>';
}

function sessionCard(s){
  const tipo=normTipo(s);
  const grupos=getSessionGrupos(s.ejercicios);
  const stars=s.valoracion?'★'.repeat(s.valoracion)+'☆'.repeat(Math.max(0,5-s.valoracion)):'';
  const ejCount=s.ejercicios?.length?new Set(s.ejercicios.map(e=>e.nombre.toLowerCase())).size:0;
  let volKg=0;
  if(s.ejercicios?.length){for(const e of s.ejercicios){if(e.series&&e.reps&&e.peso_kg)volKg+=e.series*e.reps*e.peso_kg;}}
  volKg=Math.round(volKg);
  const gruposHtml=grupos.length
    ?grupos.map(g=>'<span style="display:inline-flex;align-items:center;gap:3px"><span style="display:inline-block;width:7px;height:7px;background:'+(GRUPO_COLORS[g]||'var(--accent)')+';border-radius:50%"></span><span style="font-size:13px;font-weight:600">'+g+'</span></span>').join('<span style="color:var(--text2);margin:0 2px"> · </span>')
    :'<span style="font-weight:600;font-size:14px">'+tipo+'</span>';
  const meta1=[formatFecha(s.fecha),ejCount?ejCount+' ej.':null].filter(Boolean).join(' · ');
  const meta2=[s.duracion_min?s.duracion_min+' min':null,volKg>0?volKg.toLocaleString()+'kg vol':null,s.calorias?s.calorias+' kcal':null].filter(Boolean).join(' · ');
  const sColor=GRUPO_COLORS[grupos[0]]||GRUPO_COLORS[tipo]||'var(--accent)';
  return'<div class="swipe-wrap" data-id="'+s.id+'">'
    +'<div class="swipe-del-bg">🗑</div>'
    +'<div class="session-item" style="--s-color:'+sColor+'" onclick="openDetalle('+s.id+')">'
    +sessionIconHtml(grupos,tipo)
    +'<div class="session-info">'
    +'<div class="session-tipo">'+gruposHtml+'</div>'
    +'<div class="session-meta">'+meta1+'</div>'
    +(meta2?'<div class="session-meta">'+meta2+'</div>':'')
    +(stars?'<div class="session-stars" style="font-size:11px;letter-spacing:1px">'+stars+'</div>':'')
    +'</div></div>'
  +'</div>';
}

// ── Swipe-to-delete ──
function _initSwipeDelete(){
  document.querySelectorAll('.swipe-wrap').forEach(wrap=>{
    const item=wrap.querySelector('.session-item');
    if(!item||wrap._swipeInit)return;
    wrap._swipeInit=true;
    let sx=0,dx=0,dragging=false;
    const threshold=60;
    item.addEventListener('touchstart',e=>{sx=e.touches[0].clientX;dx=0;dragging=true;},{passive:true});
    item.addEventListener('touchmove',e=>{
      if(!dragging)return;
      dx=e.touches[0].clientX-sx;
      if(dx<0){item.style.transform='translateX('+Math.max(dx,-76)+'px)';}
      else{item.style.transform='translateX(0)';}
    },{passive:true});
    item.addEventListener('touchend',()=>{
      dragging=false;
      if(dx<-threshold){
        item.style.transform='translateX(-76px)';
        const id=+wrap.dataset.id;
        setTimeout(()=>showConfirm('¿Eliminar sesión?','Esta acción no se puede deshacer.','Eliminar',async()=>{
          const{data}=await eliminarSesion(id);
          if(data.ok){
            wrap.style.transition='opacity .25s,max-height .3s';
            wrap.style.opacity='0';wrap.style.maxHeight='0';wrap.style.overflow='hidden';
            setTimeout(()=>{wrap.remove();loadDashboard();},320);
            showToast('Sesión eliminada','info');
          } else {item.style.transform='';showToast(data.error,'error');}
        }),150);
      } else {
        item.style.transition='transform .18s ease';
        item.style.transform='';
        setTimeout(()=>item.style.transition='',200);
      }
    });
  });
}

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
  // Skeleton while loading
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
  // Mostrar total
  const subEl=document.getElementById('hist-sub');
  if(subEl){
    const desde=(currentPage-1)*30+1;const hasta=Math.min(currentPage*30,data.total);
    subEl.textContent=data.total>30?`Mostrando ${desde}–${hasta} de ${data.total} sesiones`:`${data.total} sesión${data.total===1?'':'es'}`;
  }
  renderPagination(data.page,data.pages,data.total);
}

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

function renderPagination(page,pages,total){
  const el=document.getElementById('pagination');
  if(pages<=1){el.innerHTML='';return;}
  el.innerHTML='<button class="page-btn" onclick="changePage('+(page-1)+')" '+(page<=1?'disabled':'')+'>← Anterior</button>'+
    '<span class="page-info">'+page+' / '+pages+(total?' <span style="opacity:.5;font-size:11px">('+total+')</span>':'')+'</span>'+
    '<button class="page-btn" onclick="changePage('+(page+1)+')" '+(page>=pages?'disabled':'')+'>Siguiente →</button>';
}

function changePage(p){currentPage=p;loadHistorial();window.scrollTo(0,0);}

// ── DETALLE SESIÓN ──
async function openDetalle(id){
  const{data}=await getSesion(id);if(!data.ok)return;
  const s=data.sesion;
  const _tipo=normTipo(s);
  document.getElementById('md-tipo').textContent=tipoIcon(_tipo)+' '+_tipo;
  const cells=[['Fecha',formatFecha(s.fecha)],['Duración',s.duracion_min?s.duracion_min+' min':'—'],['Calorías',s.calorias?s.calorias+' kcal':'—'],['Valoración',s.valoracion?'⭐'.repeat(s.valoracion):'—']];
  let html='<div class="detail-grid">'+cells.map(([l,v])=>'<div class="detail-cell"><div class="detail-cell-label">'+l+'</div><div class="detail-cell-val">'+v+'</div></div>').join('')+'</div>';
  if(s.notas)html+='<div class="card" style="margin-bottom:14px"><div class="card-title">Notas</div><p style="font-size:14px;line-height:1.65">'+s.notas+'</p></div>';
  if(s.ejercicios?.length){
    // Agrupar filas por nombre (retrocompat: datos anteriores tienen 1 fila por serie)
    const ejIdx={};const ejOrd=[];
    s.ejercicios.forEach(e=>{
      const k=e.nombre.toLowerCase();
      if(!ejIdx[k]){ejIdx[k]={...e,_rows:[e]};ejOrd.push(k);}
      else{ejIdx[k]._rows.push(e);ejIdx[k].series=(ejIdx[k].series||0)+(e.series||1);ejIdx[k].reps=Math.max(ejIdx[k].reps||0,e.reps||0);ejIdx[k].peso_kg=Math.max(ejIdx[k].peso_kg||0,e.peso_kg||0);}
    });
    const ejList=ejOrd.map(k=>ejIdx[k]);
    html+='<div class="card-title" style="margin-bottom:8px">Ejercicios ('+ejList.length+')</div>';
    html+=ejList.map(e=>{
      // Series: 1) sets_data JSON (workout nativo), 2) filas legacy (una por serie), 3) agregados BD (importados)
      let sets=null;
      const firstWithData=e._rows.find(r=>r.sets_data);
      if(firstWithData?.sets_data){try{sets=JSON.parse(firstWithData.sets_data);}catch(x){}}
      if(!sets&&e._rows.length>1){sets=e._rows.map(r=>({reps:r.reps??0,kg:r.peso_kg??0}));}
      // Importados: series/reps/peso_kg guardados como agregado → expandir N filas iguales
      if(!sets&&(e.series>0||e.reps>0||e.peso_kg>0)){const n=e.series||1;sets=Array.from({length:n},()=>({reps:e.reps??0,kg:e.peso_kg??0}));}
      const hasSets=sets?.length>0;

      // Calcular resumen desde sets_data cuando está disponible (más preciso que el MAX del DB)
      const nSeries=hasSets?sets.length:(e.series||0);
      const maxKg=hasSets?Math.max(...sets.map(s=>s.kg??s.peso_kg??0)):(e.peso_kg??0);
      const maxReps=hasSets?Math.max(...sets.map(s=>s.reps??0)):(e.reps??0);

      // Formato resumen: "4 × 10 reps × 80kg" (gym notation)
      const partes=[];
      if(nSeries>0)partes.push(nSeries+(nSeries===1?' serie':' series'));
      if(maxReps>0)partes.push(maxReps+' reps');
      if(maxKg>0)partes.push(maxKg+'kg');
      const resumen=partes.length?partes.join(' · '):'Sin datos';

      const setsHtml=hasSets?sets.map((st,i)=>{
        const kg=st.kg??st.peso_kg??0;
        const reps=st.reps??0;
        return '<div class="ej-set-row"><span class="ej-set-num">'+(i+1)+'</span>'
          +'<span class="ej-set-weight">'+(kg>0?kg+'kg':'PC')+'</span>'
          +'<span style="color:var(--text2);font-size:11px">×</span>'
          +'<span class="ej-set-reps">'+(reps>0?reps+' reps':'—')+'</span>'
          +'</div>';
      }).join(''):'';

      return '<div class="ej-group'+(hasSets?'" onclick="this.classList.toggle(\'expanded\')"':'" style="cursor:default"')+'>'
        +'<div class="session-ej-row" style="margin-bottom:0">'
        +'<div class="session-icon" style="background:var(--bg2);width:38px;height:38px;flex-shrink:0;">'+ejIconHtml(e.nombre,e.equipo,26)+'</div>'
        +'<div class="session-info"><div class="session-tipo">'+e.nombre+'</div>'
        +(e.subgrupo?'<div style="font-size:11px;color:var(--text2);line-height:1.3;margin-bottom:1px">'+e.subgrupo+'</div>':'')
        +'<div class="session-meta">'+resumen+'</div></div>'
        +(hasSets?'<svg class="ej-expand-arrow" width="16" height="16" viewBox="0 0 24 24" fill="currentColor"><path d="M7 10l5 5 5-5z"/></svg>':'')
        +'</div>'
        +(hasSets?'<div class="ej-sets-collapse">'+setsHtml+'</div>':'')
        +'</div>';
    }).join('');
  }
  html+='<div style="display:flex;gap:8px;margin-top:16px">'+
    '<button class="btn btn-secondary" style="flex:1" onclick="borrarSesionConfirm('+s.id+')">🗑 Eliminar</button>'+
    '<button class="btn btn-primary" style="flex:2" onclick="repetirWorkout('+s.id+')">🏋️ Repetir Workout</button>'+
    '</div>';
  document.getElementById('md-content').innerHTML=html;
  openModal('modal-detalle');
}

function repetirWorkout(id){
  closeModal('modal-detalle');
  showConfirm(
    '¿Repetir este workout?',
    'Se abrirá el workout precargado con los ejercicios y pesos de esta sesión.',
    '🏋️ Cargar workout',
    async () => {
      const {data} = await getSesion(id);
      if(!data.ok){ showToast('Error al cargar sesión','error'); return; }
      const s = data.sesion;
      // Construir lookup nombre→{em,equipo,m} desde catálogo
      const catFlat={};
      if(_catalogoCache){
        for(const [grupo,ejs] of Object.entries(_catalogoCache)){
          for(const ej of ejs){
            if(ej.n) catFlat[ej.n.toLowerCase().trim()]={em:ej.em,equipo:ej.equipo||null,m:grupo};
          }
        }
      }
      // Agrupar ejercicios por nombre preservando sets exactos
      const ejMap={}, ejOrder=[];
      (s.ejercicios||[]).forEach(e=>{
        const key=e.nombre.toLowerCase().trim();
        if(!ejMap[key]){
          const cat=catFlat[key]||{};
          ejMap[key]={em:cat.em||'💪',equipo:cat.equipo||null,n:e.nombre,m:cat.m||e.nombre.toUpperCase(),sets:[]};
          ejOrder.push(key);
        }
        // Preferir sets_data (datos por serie exactos)
        let sets=null;
        if(e.sets_data){try{sets=JSON.parse(e.sets_data);}catch(x){}}
        if(sets?.length){
          // Compatibilidad: nativo guarda {kg,reps}, CSV antiguo guardaba {peso_kg,reps}
          sets.forEach(s=>ejMap[key].sets.push({kg:s.kg!=null?s.kg:(s.peso_kg!=null?s.peso_kg:0),reps:s.reps||0}));
        }else{
          // Fallback: N series iguales (formato antiguo / CSV import)
          const n=e.series||1;
          for(let i=0;i<n;i++) ejMap[key].sets.push({kg:e.peso_kg||60,reps:e.reps||10});
        }
      });
      const preload={tipo:s.tipo,fromHistory:true,ejercicios:ejOrder.map(k=>ejMap[k])};
      sessionStorage.setItem('gymy_preload_workout',JSON.stringify(preload));
      const wtab=document.getElementById('tab-workout');
      if(wtab)wtab.style.display='flex';
      goTab('workout',wtab);
    },
    'primary'
  );
}

function borrarSesionConfirm(id){
  closeModal('modal-detalle');
  showConfirm('¿Eliminar sesión?','Esta acción no se puede deshacer.','Eliminar',async()=>{
    const{data}=await eliminarSesion(id);
    if(data.ok){showToast('Sesión eliminada','info');loadDashboard();loadHistorial();}
    else showToast(data.error,'error');
  });
}

async function eliminarTodoHistorial(){
  const{data}=await apiCall('DELETE','/sesiones');
  if(data.ok){
    localStorage.removeItem('gymy_historial_local');
    statsCache=null;currentPage=1;
    loadDashboard();loadHistorial();
    showToast('Historial eliminado','info');
  } else showToast(data.error||'Error al eliminar','error');
}

function confirmarEliminarHistorial(){
  showConfirm('¿Eliminar todo el historial?','Se borrarán todas tus sesiones y ejercicios. Esta acción no se puede deshacer.','Eliminar todo',eliminarTodoHistorial);
}

async function exportHistorialCSV(){
  showToast('Preparando CSV...','info');
  // Try API first, fallback to local
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

async function doExport(){showToast('Descargando CSV...','info');await exportarCSV();closeModal('modal-export');}
