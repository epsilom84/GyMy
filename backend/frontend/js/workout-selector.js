// ══════════════════════════════════════════════
// WORKOUT-SELECTOR.JS — Selector de tipo y ejercicio
// ══════════════════════════════════════════════

const WK_EJ_PAGE=40;
let _wkEjListRest=[],_wkEjListShowGroup=false;

async function wkRenderTipoGrid(){
  const db=await wkGetDBAsync();
  const grid=document.getElementById('wk-tipo-grid');
  if(!grid)return;
  let grupos=Object.keys(db);
  if(!grupos.length){
    grid.innerHTML='<div style="text-align:center;color:var(--text2);font-size:13px;grid-column:1/-1;padding:20px 0">Sin ejercicios disponibles</div>';
    return;
  }
  const hist=JSON.parse(localStorage.getItem(_uk('historial_local'))||'[]');
  const nameToGrupo={};
  grupos.forEach(g=>db[g].forEach(e=>{nameToGrupo[e.n]=g;}));
  const freq={};
  hist.forEach(e=>{const g=nameToGrupo[e.nombre];if(g)freq[g]=(freq[g]||0)+1;});
  grupos.sort((a,b)=>(freq[b]||0)-(freq[a]||0));
  grid.innerHTML=grupos.map(g=>
    `<div class="tipo-card" onclick="wkPickTipo('${g}')">${grupoSVGHtml(g,110)}<div style="margin-top:1px;text-align:center;width:100%;word-break:break-word">${g}</div></div>`
  ).join('');
}

function wkOpenTipo(){wkRenderTipoGrid();wkShow('wk-ov-tipo');}

function wkCloseTipoSafe(){
  wkHide('wk-ov-tipo');
  if(wkStarted&&wkExs.length===0)wkDoDiscard();
}

function wkCloseEjSafe(){
  wkHide('wk-ov-ej');
  if(wkStarted&&wkExs.length===0)wkDoDiscard();
}

function wkCloseEjBack(){
  wkHide('wk-ov-ej');
  setTimeout(()=>{wkRenderTipoGrid();wkShow('wk-ov-tipo');},150);
}

function wkPickTipo(tipo){
  if(!wkCurTipo)wkCurTipo=tipo;
  wkCurEjGrupo=tipo;
  wkHide('wk-ov-tipo');
  document.getElementById('wk-ov-ej-title').textContent=tipo;
  document.getElementById('wk-ej-q').value='';
  wkRenderEjList(wkGetDB()[tipo]||[]);
  setTimeout(()=>wkShow('wk-ov-ej'),180);
}

function _wkEjCard(e,showGroup){
  const pre=wkGetPreload(e.n);
  const hint=pre?(()=>{
    const maxKg=Math.max(...pre.sets.map(s=>s.kg));
    const avgReps=Math.round(pre.sets.reduce((a,s)=>a+s.reps,0)/pre.sets.length);
    return maxKg+'kg×'+avgReps;
  })():'';
  const safeE=JSON.stringify({em:e.em,equipo:e.equipo||null,n:e.n,m:e.m}).replace(/'/g,"&#39;");
  const _hasImg=ejHasImg(e.n);
  const _ci=_hasImg?'ej-card--img':'ej-card--svg';
  return '<div class="ej-card '+_ci+'" onclick=\'wkAddEx('+safeE+')\'>'
    +(_hasImg?'<div class="ej-item-em">'+ejIconHtml(e.n,e.equipo,56)+'</div>':'')
    +'<div class="ej-card-n">'+e.n+'</div>'
    +(e.sg?'<div class="ej-card-sg">'+e.sg+'</div>':'')
    +(hint?'<div class="ej-card-hint">'+hint+'</div>':'')
    +(showGroup?'<div class="ej-card-m">'+e.m+'</div>':'')
    +'</div>';
}

function wkRenderEjList(list,showGroup){
  const hist=JSON.parse(localStorage.getItem(_uk('historial_local'))||'[]');
  const freq={};
  hist.forEach(e=>{freq[e.nombre]=(freq[e.nombre]||0)+1;});
  const sorted=[...list].sort((a,b)=>(freq[b.n]||0)-(freq[a.n]||0));
  _wkEjListRest=sorted.slice(WK_EJ_PAGE);
  _wkEjListShowGroup=!!showGroup;
  const visible=sorted.slice(0,WK_EJ_PAGE);
  const cards=visible.map(e=>_wkEjCard(e,showGroup)).join('');
  const verMasBtn=_wkEjListRest.length
    ?'<div class="ej-ver-mas" onclick="_wkVerMasEj(this)" style="grid-column:1/-1;text-align:center;padding:10px;color:var(--accent);font-size:13px;cursor:pointer;font-weight:600">Ver todos ('+_wkEjListRest.length+' más)</div>'
    :'';
  document.getElementById('wk-ej-scroll').innerHTML='<div class="ej-grid">'
    +(cards||'<div style="grid-column:1/-1;text-align:center;padding:24px;color:var(--text2);font-size:13px">Sin resultados</div>')
    +verMasBtn+'</div>';
}

function _wkVerMasEj(btn){
  const grid=btn.parentElement;
  btn.remove();
  grid.insertAdjacentHTML('beforeend',_wkEjListRest.map(e=>_wkEjCard(e,_wkEjListShowGroup)).join(''));
  _wkEjListRest=[];
}

function wkFilterEj(){
  const q=_normQ(document.getElementById('wk-ej-q').value);
  const db=wkGetDB();
  if(!q){
    const titulo=document.getElementById('wk-ov-ej-title').textContent;
    wkRenderEjList(db[titulo]||[]);
    return;
  }
  const all=[];
  Object.values(db).forEach(ejs=>ejs.forEach(e=>{
    if(_normQ(e.n).includes(q)||_normQ(e.m).includes(q)||_normQ(e.sg||'').includes(q))all.push(e);
  }));
  wkRenderEjList(all,true);
}

async function wkAddEx(e){
  wkHide('wk-ov-ej');
  const id=wkEid++;
  const localPre0=wkGetPreload(e.n);
  const placeholderSets=localPre0&&localPre0.sets.length
    ?localPre0.sets.map(s=>({kg:s.kg,reps:s.reps,done:false,pre:true}))
    :[{kg:60,reps:10,done:false,pre:false}];
  const placeholder={id,em:e.em,equipo:e.equipo||null,n:e.n,m:e.m,sets:placeholderSets};
  wkExs.push(placeholder);
  wkRender();
  setTimeout(()=>document.getElementById('wk-ex-'+id)?.scrollIntoView({behavior:'smooth',block:'nearest'}),80);
  let sets;
  const pre=await wkGetPreloadFromDB(e.n);
  if(pre&&pre.sets.length){
    sets=pre.sets.map(s=>({kg:s.kg,reps:s.reps,done:false,pre:true}));
  }else{
    const localPre=wkGetPreload(e.n);
    sets=localPre&&localPre.sets.length
      ?localPre.sets.map(s=>({kg:s.kg,reps:s.reps,done:false,pre:true}))
      :[{kg:60,reps:10,done:false,pre:false}];
  }
  const idx=wkExs.findIndex(ex=>ex.id===id);
  if(idx>=0){wkExs[idx].sets=sets;wkRender();}
}

function wkNuevoEjercicio(){
  const grupos=Object.keys(wkGetDB());
  const sel=document.getElementById('wk-new-grupo');
  const cur=wkCurEjGrupo||grupos[0]||'General';
  sel.innerHTML=grupos.map(g=>`<option value="${g}"${g===cur?' selected':''}>${g}</option>`).join('')
    +'<option value="General"'+(cur==='General'?' selected':'')+'>General</option>';
  document.getElementById('wk-new-nombre').value='';
  openModal('modal-wk-nuevo-ej');
}

async function wkCrearNuevoEjercicio(){
  const nombre=document.getElementById('wk-new-nombre').value.trim();
  const grupo=document.getElementById('wk-new-grupo').value;
  if(!nombre)return showToast('Introduce un nombre','error');
  const{data}=await apiCall('POST','/plantillas',{nombre,grupo_muscular:grupo});
  if(!data.ok)return showToast(data.error||'Error al guardar','error');
  invalidatePlantillas();
  await loadPlantillas();
  closeModal('modal-wk-nuevo-ej');
  wkAddEx({em:'💪',n:nombre,m:grupo.toUpperCase()});
  showToast('Ejercicio creado y añadido','success');
}
