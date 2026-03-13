// ══════════════════════════════════════════════
// STATS.JS — Estadísticas
// ══════════════════════════════════════════════

let currentStatsType='ejercicio',selectedStatsEj=null,chartEjPeso=null,chartEjVol=null,chartDias=null;

function setStatsType(type){
  currentStatsType=type;
  document.getElementById('stype-ej').classList.toggle('active',type==='ejercicio');
  document.getElementById('stype-dias').classList.toggle('active',type==='dias');
  document.getElementById('stats-ejercicio-view').style.display=type==='ejercicio'?'block':'none';
  document.getElementById('stats-dias-view').style.display=type==='dias'?'block':'none';
  if(type==='dias')loadStatssDias();
}

async function initStatsView(){
  loadStatsEjercicios();
}

async function loadStatsEjercicios(){
  const{data}=await getSesiones({limit:500});
  if(!data.ok)return;
  const all=data.sesiones||[];
  // Extract unique exercise names from all sessions
  const ejMap={};
  all.forEach(s=>{
    (s.ejercicios||[]).forEach(e=>{
      const nm=e.nombre;
      if(!ejMap[nm])ejMap[nm]={nombre:nm,maxKg:0,maxVol:0,maxKgFecha:'',maxVolFecha:'',maxKgSesionId:null,maxVolSesionId:null,entries:[]};
      const kg=e.peso_kg||0;
      const vol=kg*(e.reps||1)*(e.series||1);
      if(kg>ejMap[nm].maxKg){ejMap[nm].maxKg=kg;ejMap[nm].maxKgFecha=s.fecha;ejMap[nm].maxKgSesionId=s.id;}
      if(vol>ejMap[nm].maxVol){ejMap[nm].maxVol=vol;ejMap[nm].maxVolFecha=s.fecha;ejMap[nm].maxVolSesionId=s.id;}
      ejMap[nm].entries.push({fecha:s.fecha,sesionId:s.id,kg,vol,reps:e.reps||0,series:e.series||1});
    });
  });
  window._statsEjMap=ejMap;
  window._statsAllSessions=all;
  renderStatsGrupoChips();
  renderStatsEjList(Object.values(ejMap));
}

// ── Stats ejercicio modal ──
function detectarGrupoStats(nombre){
  if(_catalogoCache){
    const n=nombre.toLowerCase();
    for(const[grupo,ejs]of Object.entries(_catalogoCache)){
      if(ejs.some(e=>(e.n||'').toLowerCase()===n))return grupo;
    }
  }
  return 'Otros';
}

function renderStatsGrupoChips(){
  const ejMap=window._statsEjMap||{};
  const selParent=window._statsGrupoParent||'';
  const selSub=window._statsGrupoSub||'';
  // Parent groups used in data
  const usedParents=new Set(Object.values(ejMap).map(e=>_normGrupoSimple(detectarGrupoStats(e.nombre))));
  const parentOrder=['Pecho','Espalda','Piernas','Hombros','Brazos','Core','Otros'];
  const chips=['<div class="day-chip'+(selParent===''?' active':'')+'" onclick="setStatsGrupoParent(\'\')">Todos</div>'];
  parentOrder.filter(g=>usedParents.has(g)).forEach(g=>{
    chips.push('<div class="day-chip'+(selParent===g?' active':'')+'" onclick="setStatsGrupoParent(\''+g+'\')">'+g+'</div>');
  });
  const el=document.getElementById('stats-grupo-filter');
  if(el)el.innerHTML=chips.join('');
  // Subgroup chips
  const subEl=document.getElementById('stats-subgrupo-filter');
  if(!subEl)return;
  if(!selParent){subEl.innerHTML='';subEl.style.display='none';return;}
  const subgroups=new Set();
  if(_catalogoCache){Object.keys(_catalogoCache).forEach(g=>{if(_normGrupoSimple(g)===selParent)subgroups.add(g);});}
  Object.values(ejMap).forEach(e=>{const g=detectarGrupoStats(e.nombre);if(_normGrupoSimple(g)===selParent)subgroups.add(g);});
  if(subgroups.size<=1){subEl.innerHTML='';subEl.style.display='none';return;}
  const subChips=['<div class="day-chip'+(selSub===''?' active':'')+'" onclick="setStatsGrupoSub(\'\')">Todos</div>'];
  [...subgroups].forEach(g=>{subChips.push('<div class="day-chip'+(selSub===g?' active':'')+'" onclick="setStatsGrupoSub(\''+g+'\')">'+g+'</div>');});
  subEl.innerHTML=subChips.join('');
  subEl.style.display='flex';
}

function setStatsGrupoParent(g){
  window._statsGrupoParent=g;
  window._statsGrupoSub='';
  renderStatsGrupoChips();
  statsRenderEjGrid();
}

function setStatsGrupoSub(g){
  window._statsGrupoSub=g;
  renderStatsGrupoChips();
  statsRenderEjGrid();
}

function setStatsGrupo(g){setStatsGrupoParent(g);}

function statsRenderEjGrid(){
  const all=window._statsEjAll||Object.values(window._statsEjMap||{});
  const q=_normQ(document.getElementById('stats-ej-q')?.value||'');
  const gParent=window._statsGrupoParent||'';
  const gSub=window._statsGrupoSub||'';
  let list=[...all];
  if(gSub)list=list.filter(e=>detectarGrupoStats(e.nombre)===gSub);
  else if(gParent)list=list.filter(e=>_normGrupoSimple(detectarGrupoStats(e.nombre))===gParent);
  if(q)list=list.filter(e=>_normQ(e.nombre).includes(q));
  list.sort((a,b)=>b.maxKg-a.maxKg);
  const body=document.getElementById('stats-modal-body');
  if(!list.length){body.innerHTML='<div style="text-align:center;padding:32px;color:var(--text2);font-size:13px">Sin resultados</div>';return;}
  body.innerHTML='<div class="ej-grid" style="padding:4px 12px 8px">'+
    list.map(e=>{const _ci=ejHasImg(e.nombre)?'ej-card--img':'ej-card--svg';return'<div class="ej-card '+_ci+'" onclick=\'selectStatsEjFromModal("'+e.nombre.replace(/"/g,'&quot;')+'")\'>'
      +'<div class="ej-item-em">'+ejIconHtml(e.nombre,null,56)+'</div>'
      +'<div class="ej-card-n">'+e.nombre+'</div>'
      +'<div class="ej-card-hint">'+e.maxKg+'kg</div>'
      +'</div>';}).join('')
    +'</div>';
}

function openStatsEjModal(){
  const ejMap=window._statsEjMap||{};
  const all=Object.values(ejMap);
  if(!all.length){showToast('Sin datos de ejercicios todavía','info');return;}
  window._statsEjAll=all;
  const qEl=document.getElementById('stats-ej-q');
  if(qEl)qEl.value='';
  document.getElementById('stats-modal-title').textContent='Seleccionar ejercicio';
  statsRenderEjGrid();
  openModal('modal-stats-ej');
}

function selectStatsEjFromModal(nombre){
  closeModal('modal-stats-ej');
  const label=document.getElementById('stats-ej-selected-label');
  if(label)label.textContent=nombre;
  selectStatsEj(nombre);
}

function renderStatsEjList(list){
  // No-op: lista ahora se muestra en modal
}

function filterStatsEjercicios(){
  // No-op: búsqueda ahora en modal
}

function selectStatsEj(nombre){
  selectedStatsEj=nombre;
  const ej=window._statsEjMap[nombre];if(!ej)return;
  // Max highlights with dates
  document.getElementById('ej-max-kg').textContent=ej.maxKg+'kg';
  document.getElementById('ej-max-vol').textContent=ej.maxVol+'kg';
  const kgFechaEl=document.getElementById('ej-max-kg-fecha');
  const volFechaEl=document.getElementById('ej-max-vol-fecha');
  if(kgFechaEl)kgFechaEl.textContent=ej.maxKgFecha?formatFecha(ej.maxKgFecha):'';
  if(volFechaEl)volFechaEl.textContent=ej.maxVolFecha?formatFecha(ej.maxVolFecha):'';
  document.getElementById('ej-chart-title').textContent='Progresión de peso · '+nombre;
  document.getElementById('stats-ej-detail').style.display='block';
  const entries=ej.entries.sort((a,b)=>a.fecha.localeCompare(b.fecha));
  // X-axis: show year only at year boundaries, empty otherwise
  const labels=entries.map((e,i)=>{
    const yr=e.fecha.slice(0,4);
    return(i===0||yr!==entries[i-1].fecha.slice(0,4))?yr:'';
  });
  const kgData=entries.map(e=>e.kg);
  const volData=entries.map(e=>e.vol);
  const isDark=!document.body.classList.contains('theme-light')&&!document.body.classList.contains('theme-material-light');
  const gridC=isDark?'rgba(255,255,255,.05)':'rgba(0,0,0,.06)';
  const tickC=isDark?'#8888a0':'#999';
  const tooltipBg=isDark?'rgba(18,18,28,.95)':'rgba(255,255,255,.98)';
  const tooltipBorder=isDark?'rgba(255,255,255,.08)':'rgba(0,0,0,.08)';
  const tooltipTitleC=isDark?'#fff':'#111';
  const tooltipBodyC=isDark?'#aaa':'#555';
  const commonOpts={responsive:true,maintainAspectRatio:false,interaction:{mode:'index',intersect:false},animation:{duration:600,easing:'easeInOutQuart'},plugins:{legend:{display:false},tooltip:{backgroundColor:tooltipBg,borderColor:tooltipBorder,borderWidth:1,titleColor:tooltipTitleC,bodyColor:tooltipBodyC,padding:12,cornerRadius:10,displayColors:false}},scales:{x:{grid:{color:gridC,drawTicks:false},border:{display:false},ticks:{color:tickC,font:{size:10},maxRotation:0,padding:6}},y:{grid:{color:gridC,drawTicks:false},border:{display:false},ticks:{color:tickC,font:{size:10},padding:8}}}};
  if(chartEjPeso)chartEjPeso.destroy();
  const pesoCtx=document.getElementById('chart-ej-peso').getContext('2d');
  const pesoGrad=pesoCtx.createLinearGradient(0,0,0,230);
  pesoGrad.addColorStop(0,'rgba(232,255,71,.3)');pesoGrad.addColorStop(1,'rgba(232,255,71,0)');
  chartEjPeso=new Chart(pesoCtx,{type:'line',data:{labels,datasets:[{data:kgData,borderColor:'#e8ff47',backgroundColor:pesoGrad,fill:true,tension:.4,borderWidth:2.5,pointRadius:3,pointHoverRadius:7,pointBackgroundColor:'#e8ff47',pointBorderColor:isDark?'#1a1a2e':'#fff',pointBorderWidth:2}]},options:{...commonOpts,plugins:{...commonOpts.plugins,tooltip:{...commonOpts.plugins.tooltip,callbacks:{title:ctx=>{const e=entries[ctx[0].dataIndex];return e?formatFecha(e.fecha):'';},label:ctx=>{const e=entries[ctx.dataIndex];return e?ctx.parsed.y+'kg · '+e.reps+' reps':''+ctx.parsed.y+'kg';}}}}}});
  if(chartEjVol)chartEjVol.destroy();
  const volCtx=document.getElementById('chart-ej-vol').getContext('2d');
  const volGrad=volCtx.createLinearGradient(0,0,0,230);
  volGrad.addColorStop(0,'rgba(108,71,255,.35)');volGrad.addColorStop(1,'rgba(108,71,255,0)');
  chartEjVol=new Chart(volCtx,{type:'line',data:{labels,datasets:[{data:volData,borderColor:'#6c47ff',backgroundColor:volGrad,fill:true,tension:.4,borderWidth:2.5,pointRadius:3,pointHoverRadius:7,pointBackgroundColor:'#6c47ff',pointBorderColor:isDark?'#1a1a2e':'#fff',pointBorderWidth:2}]},options:{...commonOpts,plugins:{...commonOpts.plugins,tooltip:{...commonOpts.plugins.tooltip,callbacks:{title:ctx=>{const e=entries[ctx[0].dataIndex];return e?formatFecha(e.fecha):'';},label:ctx=>{const e=entries[ctx.dataIndex];return e?ctx.parsed.y+'kg vol · '+e.reps+' reps':''+ctx.parsed.y+'kg vol';}}}}}});
  _setupChartLongPress('chart-ej-peso',entries);
  _setupChartLongPress('chart-ej-vol',entries);
  renderStatsEjList(Object.values(window._statsEjMap||{}));
}

function _setupChartLongPress(canvasId,entries){
  const canvas=document.getElementById(canvasId);
  if(!canvas)return;
  let timer=null;
  let pressX=0,pressY=0;
  const clear=()=>{if(timer){clearTimeout(timer);timer=null;}};
  const start=(cx,cy)=>{
    pressX=cx;pressY=cy;
    clear();
    timer=setTimeout(()=>{
      timer=null;
      const chart=Chart.getChart(canvas);
      if(!chart)return;
      const ev=new MouseEvent('mousemove',{clientX:pressX,clientY:pressY,bubbles:true});
      const pts=chart.getElementsAtEventForMode(ev,'index',{intersect:false},false);
      if(!pts.length)return;
      const entry=entries[pts[0].index];
      if(!entry)return;
      if(confirm('Ver sesión del '+formatFecha(entry.fecha)+'?')){
        const qEl=document.getElementById('hist-search');
        if(qEl){qEl.value=formatFecha(entry.fecha);}
        showScreen('historial');
        loadHistorial();
      }
    },600);
  };
  canvas.removeEventListener('touchstart',canvas._lpTs);
  canvas.removeEventListener('touchend',canvas._lpTe);
  canvas.removeEventListener('touchmove',canvas._lpTe);
  canvas.removeEventListener('mousedown',canvas._lpMd);
  canvas.removeEventListener('mouseup',canvas._lpMu);
  canvas._lpTs=e=>{if(e.touches.length){start(e.touches[0].clientX,e.touches[0].clientY);}};
  canvas._lpTe=clear;
  canvas._lpMd=e=>start(e.clientX,e.clientY);
  canvas._lpMu=clear;
  canvas.addEventListener('touchstart',canvas._lpTs,{passive:true});
  canvas.addEventListener('touchend',canvas._lpTe);
  canvas.addEventListener('touchmove',canvas._lpTe,{passive:true});
  canvas.addEventListener('mousedown',canvas._lpMd);
  canvas.addEventListener('mouseup',canvas._lpMu);
}

async function loadStatssDias(){
  const{data}=await getSesiones({limit:500});
  if(!data.ok)return;
  window._statsDiasAll=data.sesiones||[];
  if(!window._diasMetric)window._diasMetric='vol';
  _renderDiasChart();
  _renderHeatmap();
}

function _renderDiasChart(){
  const all=(window._statsDiasAll||[]).slice().sort((a,b)=>a.fecha.localeCompare(b.fecha));
  const metric=window._diasMetric||'vol';
  const metricData=all.map(s=>{
    if(metric==='cal')return s.calorias||0;
    if(metric==='freq')return 1;
    return(s.ejercicios||[]).reduce((sum,e)=>sum+(e.peso_kg||0)*(e.reps||1)*(e.series||1),0);
  });
  const labels=all.map((s,i)=>{
    const yr=s.fecha.slice(0,4);
    return(i===0||yr!==all[i-1].fecha.slice(0,4))?yr:'';
  });
  const titleEl=document.getElementById('dias-chart-title');
  if(titleEl)titleEl.textContent=metric==='cal'?'Calorías a lo largo del tiempo':metric==='freq'?'Frecuencia de entrenamiento':'Volumen a lo largo del tiempo (kg)';
  const volBtn=document.getElementById('dias-metric-vol');
  const calBtn=document.getElementById('dias-metric-cal');
  if(volBtn)volBtn.classList.toggle('active',metric==='vol');
  if(calBtn)calBtn.classList.toggle('active',metric==='cal');
  if(chartDias)chartDias.destroy();
  const isDarkD=!document.body.classList.contains('theme-light')&&!document.body.classList.contains('theme-material-light');
  const accentColor=isDarkD?'rgba(232,255,71,1)':'rgba(100,180,255,1)';
  const accentFill=isDarkD?'rgba(232,255,71,.15)':'rgba(100,180,255,.15)';
  const gridCD=isDarkD?'rgba(255,255,255,.05)':'rgba(0,0,0,.06)';
  const tickCD=isDarkD?'#8888a0':'#999';
  const tooltipBgD=isDarkD?'rgba(18,18,28,.95)':'rgba(255,255,255,.98)';
  const tooltipBorderD=isDarkD?'rgba(255,255,255,.08)':'rgba(0,0,0,.08)';
  const diasCtx=document.getElementById('chart-dias').getContext('2d');
  chartDias=new Chart(diasCtx,{type:'line',data:{labels,datasets:[{data:metricData,borderColor:accentColor,backgroundColor:accentFill,borderWidth:2,pointRadius:2,pointHoverRadius:5,fill:true,tension:0.3}]},options:{responsive:true,maintainAspectRatio:false,animation:{duration:500,easing:'easeInOutQuart'},plugins:{legend:{display:false},tooltip:{backgroundColor:tooltipBgD,borderColor:tooltipBorderD,borderWidth:1,titleColor:isDarkD?'#fff':'#111',bodyColor:isDarkD?'#aaa':'#555',padding:12,cornerRadius:10,displayColors:false,callbacks:{title:ctx=>{const s=all[ctx[0].dataIndex];return s?formatFecha(s.fecha):'';},label:ctx=>ctx.parsed.y+(metric==='cal'?' kcal':' kg vol')}}},scales:{x:{grid:{display:false},border:{display:false},ticks:{color:tickCD,font:{size:10},maxRotation:0,padding:4}},y:{grid:{color:gridCD,drawTicks:false},border:{display:false},ticks:{color:tickCD,font:{size:10},padding:6}}}}});
  document.getElementById('dias-sesiones').innerHTML=all.length?all.slice().reverse().slice(0,20).map(s=>sessionCard(s)).join(''):'';
}

function setDiasMetric(m){
  window._diasMetric=m;
  const freqBtn=document.getElementById('dias-metric-freq');
  if(freqBtn)freqBtn.classList.toggle('active',m==='freq');
  _renderDiasChart();
  _renderHeatmap();
}

// ── Heatmap anual ──
function _renderHeatmap(){
  const all=window._statsDiasAll||[];
  const metric=window._diasMetric||'vol';
  const isDark=!document.body.classList.contains('theme-light')&&!document.body.classList.contains('theme-material-light');

  // Build map: 'YYYY-MM-DD' → value
  const dayMap={};
  all.forEach(s=>{
    const d=s.fecha.slice(0,10);
    let val=0;
    if(metric==='cal') val=s.calorias||0;
    else if(metric==='freq') val=1;
    else val=(s.ejercicios||[]).reduce((sum,e)=>sum+(e.peso_kg||0)*(e.reps||1)*(e.series||1),0);
    dayMap[d]=(dayMap[d]||0)+val;
  });

  // Date range: last 52 weeks aligned to Monday
  const today=new Date();
  today.setHours(0,0,0,0);
  const startDate=new Date(today);
  startDate.setDate(today.getDate()-364);
  const dow=startDate.getDay();
  const offset=dow===0?-6:1-dow;
  startDate.setDate(startDate.getDate()+offset);

  // Build weeks array: each week is [Mon..Sun]
  const weeks=[];
  let d=new Date(startDate);
  while(d<=today){
    const week=[];
    for(let i=0;i<7;i++){
      const ds=d.toISOString().slice(0,10);
      week.push({date:new Date(d),ds,val:dayMap[ds]||0,inRange:d<=today});
      d.setDate(d.getDate()+1);
    }
    weeks.push(week);
  }

  const maxVal=Math.max(1,...Object.values(dayMap));
  const emptyC=isDark?'#1e1e2e':'#e8e8e0';

  let colors;
  if(metric==='freq'){
    colors=[isDark?'#1e3a1e':'#d4f0d4',isDark?'#2d6b2d':'#a8e0a8',isDark?'#3d9a3d':'#6cc96c',isDark?'#47ff7a':'#22a83a'];
  } else if(metric==='cal'){
    colors=[isDark?'#3a1e2a':'#f0d4e0',isDark?'#7a2a4a':'#e08ab8',isDark?'#cc3a70':'#d44a80','#ff4747'];
  } else {
    colors=[isDark?'#1e2a1e':'#d4e8d4',isDark?'#2a4a2a':'#8ec88e',isDark?'#3a7a3a':'#4a9f4a','#e8ff47'];
  }

  function getColor(val){
    if(!val)return emptyC;
    const pct=val/maxVal;
    if(pct<0.25)return colors[0];
    if(pct<0.5)return colors[1];
    if(pct<0.75)return colors[2];
    return colors[3];
  }

  const cellSz=window.innerWidth<380?10:11;
  document.documentElement.style.setProperty('--hm-cell',cellSz+'px');

  // Weekday labels
  const wdEl=document.getElementById('heatmap-weekdays');
  if(wdEl){
    const wdLabels=['L','','M','','J','','S'];
    wdEl.innerHTML=wdLabels.map(l=>`<div class="hm-wd-lbl" style="height:${cellSz}px">${l}</div>`).join('');
  }

  // Month labels
  const monthEl=document.getElementById('heatmap-months');
  if(monthEl){
    const mNames=['Ene','Feb','Mar','Abr','May','Jun','Jul','Ago','Sep','Oct','Nov','Dic'];
    let lastM=-1;
    monthEl.innerHTML=weeks.map(wk=>{
      const m=wk[0].date.getMonth();
      const lbl=m!==lastM?mNames[m]:'';
      lastM=m;
      return`<div class="hm-month-lbl" style="width:${cellSz+3}px">${lbl}</div>`;
    }).join('');
  }

  // Grid
  const grid=document.getElementById('heatmap-grid');
  if(!grid)return;
  grid.innerHTML=weeks.map(wk=>{
    const cells=wk.map(day=>{
      if(!day.inRange)return`<div style="width:${cellSz}px;height:${cellSz}px"></div>`;
      const bg=getColor(day.val);
      const label=day.val?(metric==='freq'?'1 sesión':`${Math.round(day.val)}${metric==='cal'?' kcal':' kg'}`):'Sin entreno';
      return`<div class="hm-cell" style="width:${cellSz}px;height:${cellSz}px;background:${bg}" title="${day.ds}: ${label}" onclick="_heatmapClickDay('${day.ds}')"></div>`;
    }).join('');
    return`<div class="hm-col">${cells}</div>`;
  }).join('');

  // Streak
  let streak=0;const cur=new Date(today);
  while(true){
    const ds=cur.toISOString().slice(0,10);
    if(dayMap[ds]){streak++;cur.setDate(cur.getDate()-1);}
    else break;
  }
  const streakEl=document.getElementById('heatmap-streak');
  if(streakEl)streakEl.textContent=streak>1?`🔥 ${streak} días seguidos`
    :streak===1?'🔥 1 día seguido'
    :`${Object.keys(dayMap).length} días entrenados`;

  // Legend
  const legEl=document.getElementById('heatmap-legend');
  if(legEl){
    const ls=cellSz;
    legEl.innerHTML=`<span style="font-size:9px;color:var(--text2)">Menos</span>`
      +[emptyC,...colors].map(c=>`<div class="hm-legend-cell" style="width:${ls}px;height:${ls}px;background:${c}"></div>`).join('')
      +`<span style="font-size:9px;color:var(--text2)">Más</span>`;
  }
}

function _heatmapClickDay(ds){
  const all=window._statsDiasAll||[];
  if(!all.some(s=>s.fecha.slice(0,10)===ds)){showToast('Sin entreno ese día','info');return;}
  const parts=ds.split('-');
  const mNames=['ene','feb','mar','abr','may','jun','jul','ago','sep','oct','nov','dic'];
  const displayDate=`${parseInt(parts[2])} ${mNames[parseInt(parts[1])-1]} ${parts[0]}`;
  const qEl=document.getElementById('hist-search');
  if(qEl)qEl.value=displayDate;
  goTab('historial',document.getElementById('tab-historial'));
  loadHistorial();
}
