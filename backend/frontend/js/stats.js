// ══════════════════════════════════════════════
// STATS.JS — Estadísticas
// ══════════════════════════════════════════════

let currentStatsType='ejercicio',selectedStatsEj=null,chartEjPeso=null,chartEjVol=null,chartDias=null;

function setStatsType(type){
  currentStatsType=type;
  document.getElementById('stype-ej').classList.toggle('active',type==='ejercicio');
  document.getElementById('stype-dias').classList.toggle('active',type==='dias');
  document.getElementById('stype-mus')?.classList.toggle('active',type==='musculos');
  document.getElementById('stats-ejercicio-view').style.display=type==='ejercicio'?'block':'none';
  document.getElementById('stats-dias-view').style.display=type==='dias'?'block':'none';
  document.getElementById('stats-musculos-view') && (document.getElementById('stats-musculos-view').style.display=type==='musculos'?'block':'none');
  if(type==='dias')loadStatssDias();
  if(type==='musculos')loadStatsMusculos();
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
}

function _renderDiasChart(){
  const all=(window._statsDiasAll||[]).slice().sort((a,b)=>a.fecha.localeCompare(b.fecha));
  const metric=window._diasMetric||'vol';
  const metricData=all.map(s=>{
    if(metric==='cal')return s.calorias||0;
    return(s.ejercicios||[]).reduce((sum,e)=>sum+(e.peso_kg||0)*(e.reps||1)*(e.series||1),0);
  });
  const labels=all.map((s,i)=>{
    const yr=s.fecha.slice(0,4);
    return(i===0||yr!==all[i-1].fecha.slice(0,4))?yr:'';
  });
  const titleEl=document.getElementById('dias-chart-title');
  if(titleEl)titleEl.textContent=metric==='cal'?'Calorías a lo largo del tiempo':'Volumen a lo largo del tiempo (kg)';
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
  _renderDiasChart();
}

function renderStatsEjList(list){
  // No-op: lista ahora se muestra en modal
}
function filterStatsEjercicios(){
  // No-op: búsqueda ahora en modal
}

// ── POR MÚSCULO ───────────────────────────────────
let chartMusDonut=null;

function _getMusculoLabel(nombreEj){
  if(_catalogoCache){
    const n=nombreEj.toLowerCase();
    for(const[grupo,ejs]of Object.entries(_catalogoCache)){
      const found=ejs.find(e=>(e.n||'').toLowerCase()===n);
      if(found)return found.sg||grupo;
    }
  }
  return 'Otros';
}

async function loadStatsMusculos(){
  if(!window._statsAllSessions){
    const{data}=await getSesiones({limit:500});
    if(!data.ok)return;
    window._statsAllSessions=data.sesiones||[];
  }
  await loadCatalogo();
  _renderBodyHeatmap();
  _renderMusculosCharts();
}

function _renderMusculosCharts(){
  const all=window._statsAllSessions||[];
  const seriesCount={};
  all.forEach(s=>{
    (s.ejercicios||[]).forEach(e=>{
      const lbl=_getMusculoLabel(e.nombre);
      seriesCount[lbl]=(seriesCount[lbl]||0)+(e.series||1);
    });
  });
  const entries=Object.entries(seriesCount).sort((a,b)=>b[1]-a[1]);
  const labels=entries.map(([k])=>k);
  const counts=entries.map(([,v])=>v);
  const totalSeries=counts.reduce((a,b)=>a+b,0);
  const PALETTE=['#ef5350','#42a5f5','#66bb6a','#ab47bc','#ffa726','#26c6da','#ec407a','#8d6e63','#78909c','#d4e157','#ff7043','#29b6f6'];
  const colors=labels.map((_,i)=>PALETTE[i%PALETTE.length]);
  const isDark=!document.body.classList.contains('theme-light')&&!document.body.classList.contains('theme-material-light');
  const tooltipBg=isDark?'rgba(18,18,28,.95)':'rgba(255,255,255,.98)';
  const tooltipBorder=isDark?'rgba(255,255,255,.08)':'rgba(0,0,0,.08)';
  const legendC=isDark?'#ccc':'#444';
  const tooltipTitle=isDark?'#fff':'#111';
  const tooltipBody=isDark?'#aaa':'#555';

  if(chartMusDonut)chartMusDonut.destroy();
  chartMusDonut=new Chart(document.getElementById('chart-mus-donut').getContext('2d'),{
    type:'doughnut',
    data:{labels,datasets:[{data:counts,backgroundColor:colors,borderWidth:2,borderColor:isDark?'#1a1a2e':'#fff',hoverOffset:8}]},
    options:{
      responsive:true,maintainAspectRatio:false,cutout:'62%',
      animation:{duration:600,easing:'easeInOutQuart'},
      plugins:{
        legend:{display:false},
        tooltip:{backgroundColor:tooltipBg,borderColor:tooltipBorder,borderWidth:1,titleColor:tooltipTitle,bodyColor:tooltipBody,padding:10,cornerRadius:10,
          callbacks:{label:ctx=>{const pct=totalSeries>0?Math.round(ctx.parsed/totalSeries*100):0;return ' '+ctx.parsed+' series ('+pct+'%)';}}}
      }
    }
  });
}

const BODY_REGION_MAP={
  'Pecho':['hm-pecho-l','hm-pecho-r'],
  'Hombros':['hm-hombro-fl','hm-hombro-fr','hm-hombro-bl','hm-hombro-br'],
  'Brazos Bíceps':['hm-bicep-l','hm-bicep-r'],
  'Brazos Tríceps':['hm-tricep-l','hm-tricep-r'],
  'Core':['hm-core'],
  'Dorsal':['hm-dorsal-l','hm-dorsal-r'],
  'Trapecio':['hm-trapecio'],
  'Lumbar':['hm-lumbar'],
  'Cuádriceps':['hm-quad-l','hm-quad-r'],
  'Femoral':['hm-femoral-l','hm-femoral-r'],
  'Glúteo':['hm-gluteo-l','hm-gluteo-r'],
  'Gemelos':['hm-gemelo-l','hm-gemelo-r'],
  'Espalda':['hm-dorsal-l','hm-dorsal-r','hm-trapecio','hm-lumbar'],
  'Piernas':['hm-quad-l','hm-quad-r','hm-femoral-l','hm-femoral-r','hm-gluteo-l','hm-gluteo-r'],
  'Brazos':['hm-bicep-l','hm-bicep-r','hm-tricep-l','hm-tricep-r'],
};
const HM_ID_LABELS={
  'hm-hombro-fl':'Hombros','hm-hombro-fr':'Hombros',
  'hm-hombro-bl':'Hombros (espalda)','hm-hombro-br':'Hombros (espalda)',
  'hm-pecho-l':'Pecho','hm-pecho-r':'Pecho',
  'hm-bicep-l':'Bíceps','hm-bicep-r':'Bíceps',
  'hm-core':'Core',
  'hm-quad-l':'Cuádriceps','hm-quad-r':'Cuádriceps',
  'hm-trapecio':'Trapecio',
  'hm-tricep-l':'Tríceps','hm-tricep-r':'Tríceps',
  'hm-dorsal-l':'Dorsal','hm-dorsal-r':'Dorsal',
  'hm-lumbar':'Lumbar',
  'hm-gluteo-l':'Glúteo','hm-gluteo-r':'Glúteo',
  'hm-femoral-l':'Femoral','hm-femoral-r':'Femoral',
  'hm-gemelo-l':'Gemelos','hm-gemelo-r':'Gemelos',
};

function _heatColor(ratio){
  if(ratio<=0)return null;
  let r,g,b;
  if(ratio<0.33){const t=ratio/0.33;r=Math.round(102+(255-102)*t);g=Math.round(187+(235-187)*t);b=Math.round(106*(1-t));}
  else if(ratio<0.66){const t=(ratio-0.33)/0.33;r=255;g=Math.round(235+(152-235)*t);b=0;}
  else{const t=(ratio-0.66)/0.34;r=255;g=Math.round(152*(1-t)+67*t);b=Math.round(54*t);}
  return `rgb(${r},${g},${b})`;
}

function _renderBodyHeatmap(){
  const all=window._statsAllSessions||[];
  const seriesMap={};
  all.forEach(s=>{
    (s.ejercicios||[]).forEach(e=>{
      const lbl=_getMusculoLabel(e.nombre);
      seriesMap[lbl]=(seriesMap[lbl]||0)+(e.series||1);
    });
  });
  const el=document.getElementById('body-heatmap-container');
  if(el)el.innerHTML=bodyHeatmapSVGHtml(seriesMap);
}
