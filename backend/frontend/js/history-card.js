// ══════════════════════════════════════════════
// HISTORY-CARD.JS — Tarjeta de sesión, lookup de grupos y swipe-to-delete
// ══════════════════════════════════════════════

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

// ── HTML de tarjeta de sesión ──
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
          }else{item.style.transform='';showToast(data.error,'error');}
        }),150);
      }else{
        item.style.transition='transform .18s ease';
        item.style.transform='';
        setTimeout(()=>item.style.transition='',200);
      }
    });
  });
}
