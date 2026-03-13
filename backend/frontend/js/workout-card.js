// ══════════════════════════════════════════════
// WORKOUT-CARD.JS — Tarjeta de ejercicio, series y timer
// ══════════════════════════════════════════════

// ── Gaussian helpers ──
function _gaussErf(x){
  const s=x>=0?1:-1;x=Math.abs(x);
  const t=1/(1+0.3275911*x);
  return s*(1-(((((1.061405429*t-1.453152027)*t+1.421413741)*t-0.284496736)*t+0.254829592)*t)*Math.exp(-x*x));
}
function _gaussCDF(x,mu,sg){return sg===0?(x>=mu?1:0):0.5*(1+_gaussErf((x-mu)/(sg*Math.SQRT2)));}
function _gaussPDF(x,mu,sg){return sg===0?0:Math.exp(-0.5*((x-mu)/sg)**2)/(sg*Math.sqrt(2*Math.PI));}

function _wkHistVols(nombre){
  return JSON.parse(localStorage.getItem('gymy_historial_local')||'[]')
    .filter(h=>h.nombre===nombre)
    .map(h=>(h.sets||[]).reduce((a,s)=>a+(s.kg||0)*(s.reps||0),0))
    .filter(v=>v>0);
}

function wkInitGauss(ex){
  const canvasId='wk-gauss-cv-'+ex.id;
  const pctId='wk-gauss-pct-'+ex.id;
  const canvas=document.getElementById(canvasId);
  if(!canvas)return;
  if(_wkGaussCharts[ex.id]){_wkGaussCharts[ex.id].destroy();delete _wkGaussCharts[ex.id];}
  const vols=_wkHistVols(ex.n);
  if(vols.length<3)return;
  const n=vols.length;
  const mu=vols.reduce((a,b)=>a+b,0)/n;
  let sg=Math.sqrt(vols.reduce((s,v)=>s+(v-mu)**2,0)/n);
  if(sg<1)sg=Math.max(1,mu*0.05);
  const lo=Math.max(0,mu-3.5*sg),hi=mu+3.5*sg;
  const pts=80,step=(hi-lo)/(pts-1);
  const curVol=ex.sets.filter(s=>s.done).reduce((a,s)=>a+s.kg*s.reps,0);
  const pct=Math.round(_gaussCDF(curVol,mu,sg)*100);
  const peakPDF=_gaussPDF(mu,mu,sg);
  const bellData=Array.from({length:pts},(_,i)=>{const x=lo+i*step;return{x,y:_gaussPDF(x,mu,sg)};});
  const markerData=curVol>0?[{x:curVol,y:0},{x:curVol,y:peakPDF}]:[];
  const isDark=!document.body.classList.contains('theme-light')&&!document.body.classList.contains('theme-material-light');
  const gridColor=isDark?'rgba(255,255,255,.04)':'rgba(0,0,0,.06)';
  _wkGaussCharts[ex.id]=new Chart(canvas,{
    type:'line',
    data:{datasets:[
      {data:bellData,borderColor:'rgba(108,71,255,.7)',backgroundColor:'rgba(108,71,255,.18)',
       fill:true,tension:0,pointRadius:0,borderWidth:1.5,parsing:false},
      {data:markerData,type:'scatter',showLine:true,borderColor:'#e8ff47',backgroundColor:'#e8ff47',
       pointRadius:0,borderWidth:2,parsing:false}
    ]},
    options:{responsive:true,maintainAspectRatio:false,animation:false,
      plugins:{legend:{display:false},tooltip:{enabled:false}},
      scales:{
        x:{type:'linear',display:false,grid:{display:false}},
        y:{display:false,grid:{color:gridColor}}
      }
    }
  });
  const pctEl=document.getElementById(pctId);
  if(pctEl){
    if(curVol>0)pctEl.textContent='Volumen actual: '+curVol+' kg · Percentil '+pct+'%';
    else pctEl.textContent=n+' sesiones previas · media '+Math.round(mu)+' kg';
  }
}

// ── Render ──
function wkRender(){
  document.getElementById('wk-ex-container').innerHTML=wkExs.map(ex=>wkCardHTML(ex)).join('');
  wkExs.forEach(ex=>wkInitGauss(ex));
  wkRefreshStats();
  wkSaveState();
}

function wkCardHTML(ex){
  const hist=JSON.parse(localStorage.getItem('gymy_historial_local')||'[]').filter(h=>h.nombre===ex.n);
  const prKg=hist.length?Math.max(...hist.map(h=>h.sets?Math.max(...h.sets.map(s=>s.kg)):h.kg||0)):0;
  const doneSets=ex.sets.filter(s=>s.done);
  const vol=doneSets.reduce((a,s)=>a+s.kg*s.reps,0);
  const prVol=hist.length?Math.max(...hist.map(h=>h.sets?h.sets.reduce((a,s)=>a+s.kg*s.reps,0):(h.kg||0)*(h.reps||0))):0;
  const pct=prVol>0?Math.min(100,Math.round(vol/prVol*100)):0;
  const vsHtml=vol>0&&prVol>0?
    '<div class="vs-box"><div class="vs-top"><span class="vs-label">VS RECORD</span>'
    +'<span class="vs-right">'+vol+'/'+prVol+'kg<span class="vs-pct"> '+pct+'%</span></span></div>'
    +'<div class="vs-track"><div class="vs-fill" style="width:'+pct+'%"></div></div></div>':'';
  const setsHtml=ex.sets.map((s,i)=>{
    const isPR=s.done&&prKg>0&&s.kg>prKg;
    return '<div class="set-row '+(s.done?'is-done':'')+'" id="wk-sr-'+ex.id+'-'+i+'">'
      +'<div class="set-num '+(s.done?'done':'')+'">'+( i+1)+'</div>'
      +'<div class="stepper '+(s.pre&&!s.done?'preloaded':'')+'">'
        +'<button class="st-btn" onclick="wkStep('+ex.id+','+i+',\'kg\',-2.5)">−</button>'
        +'<div class="st-val" id="wk-kg-'+ex.id+'-'+i+'">'+s.kg+'</div>'
        +'<button class="st-btn" onclick="wkStep('+ex.id+','+i+',\'kg\',2.5)">+</button>'
      +'</div>'
      +'<div class="stepper '+(s.pre&&!s.done?'preloaded':'')+'">'
        +'<button class="st-btn" onclick="wkStep('+ex.id+','+i+',\'reps\',-1)">−</button>'
        +'<div class="st-val" id="wk-rp-'+ex.id+'-'+i+'">'+s.reps+'</div>'
        +'<button class="st-btn" onclick="wkStep('+ex.id+','+i+',\'reps\',1)">+</button>'
      +'</div>'
      +'<div class="mid-icon">'
        +'<span class="mid-eq">'+(s.done?'=':'')+'</span>'
        +'<span class="mid-star '+(isPR?'show':'')+'">★</span>'
        +'<button class="check-circle '+(s.done?'done':'')+'" onclick="wkToggleDone('+ex.id+','+i+')">'
          +'<svg viewBox="0 0 24 24"><polyline points="20 6 9 17 4 12"/></svg>'
        +'</button>'
      +'</div>'
      +'<button class="del-btn" onclick="wkDelSet('+ex.id+','+i+')">✕</button>'
    +'</div>';
  }).join('');
  const dotsHtml='<div class="sets-dots">'+ex.sets.map((s,i)=>{
    const isPRDot=s.done&&prKg>0&&s.kg>prKg;
    return'<div class="set-dot'+(s.done?(isPRDot?' pr':' done')+'':'')+'" title="Serie '+(i+1)+(s.done?' ✓':'')+'"></div>';
  }).join('')+'</div>';
  return '<div class="ex-card" id="wk-ex-'+ex.id+'">'
    +'<div class="ex-header">'
      +'<div class="ex-left"><div class="ex-emoji">'+ejIconHtml(ex.n,ex.equipo,28)+'</div>'
      +'<div><div class="ex-name">'+ex.n+'</div><div class="ex-muscle">'+ex.m+'</div></div></div>'
      +'<div style="display:flex;align-items:center;gap:6px">'
        +(prKg?'<div class="pr-badge">PR '+prKg+'kg</div>':'')
        +'<button class="ex-del-btn" onclick="wkDelExercise('+ex.id+')">🗑</button>'
      +'</div>'
    +'</div>'
    +dotsHtml
    +vsHtml
    +(hist.length>=3?'<div class="gauss-wrap"><canvas id="wk-gauss-cv-'+ex.id+'"></canvas><div class="gauss-pct" id="wk-gauss-pct-'+ex.id+'"></div></div>':'')
    +'<div class="col-heads"><span>SET</span><span>KG</span><span>REPS</span><span></span><span></span></div>'
    +setsHtml
    +'<button class="add-serie-btn" onclick="wkAddSet('+ex.id+')">＋ Serie</button>'
  +'</div>';
}

// ── Set actions ──
function wkStep(exId,si,field,delta){
  const ex=wkExs.find(e=>e.id===exId);if(!ex)return;
  const s=ex.sets[si];s.pre=false;
  if(field==='kg')s.kg=Math.max(0,Math.round((s.kg+delta)*2)/2);
  else s.reps=Math.max(1,s.reps+delta);
  const elId=field==='kg'?'wk-kg-'+exId+'-'+si:'wk-rp-'+exId+'-'+si;
  const el=document.getElementById(elId);
  if(el)el.textContent=field==='kg'?s.kg:s.reps;
  const row=document.getElementById('wk-sr-'+exId+'-'+si);
  if(row)row.querySelectorAll('.stepper').forEach(st=>st.classList.remove('preloaded'));
  wkRefreshStats();wkSaveState();
}

function calcKcalSerie(kg,reps,grupoMuscular,restSecs){
  const MET={'Piernas':1.00,'Espalda':0.90,'Pecho':0.85,'Hombros':0.75,'Brazos':0.65,'Core':0.70};
  const grupoBase=(grupoMuscular||'').split(' ')[0];
  const metFactor=MET[grupoBase]||0.80;
  const volKcal=kg*reps*0.1*metFactor;
  const restFactor=restSecs<60?1.15:restSecs>180?0.88:1.0;
  const u=window._wkUserPerfil||{};
  const edad=u.edad||30;
  const genero=u.genero||'M';
  const pesoCorp=u.peso_corporal||u.peso||75;
  const genFactor=(genero==='F'||genero==='mujer')?0.85:1.0;
  const ageFactor=edad<30?1.05:edad<40?1.0:edad<50?0.95:0.88;
  const bwFactor=Math.sqrt(pesoCorp/75);
  return Math.max(1,Math.round(volKcal*restFactor*genFactor*ageFactor*bwFactor));
}

function wkToggleDone(exId,si){
  const ex=wkExs.find(e=>e.id===exId);if(!ex)return;
  ex.sets[si].done=!ex.sets[si].done;
  if(ex.sets[si].done){
    ex.sets[si].pre=false;
    const restDef=parseInt(localStorage.getItem('gymy_rest_secs')||'90');
    ex.sets[si].kcal=calcKcalSerie(ex.sets[si].kg,ex.sets[si].reps,ex.m,restDef);
    haptic(18);
    wkStartRestTimer();
    const hist=JSON.parse(localStorage.getItem('gymy_historial_local')||'[]').filter(h=>h.nombre===ex.n);
    const prKg=hist.length?Math.max(...hist.map(h=>h.kg)):0;
    const isPR=prKg>0&&ex.sets[si].kg>prKg;
    if(isPR){haptic([30,20,30]);showToast('🏆 Nuevo PR en '+ex.n+'!','success');}
    else showToast('Serie completada ✓ +'+ex.sets[si].kcal+'kcal');
  }else{delete ex.sets[si].kcal;haptic(8);wkSkipRest();}
  wkReRenderCard(ex);
  setTimeout(()=>{
    const cc=document.querySelector('#wk-sr-'+exId+'-'+si+' .check-circle');
    if(cc&&ex.sets[si].done){cc.classList.add('just-done');setTimeout(()=>cc.classList.remove('just-done'),300);}
  },10);
  wkRefreshStats();wkSaveState();
}

function wkAddSet(exId){
  const ex=wkExs.find(e=>e.id===exId);if(!ex)return;
  const l=ex.sets[ex.sets.length-1];
  ex.sets.push({kg:l.kg,reps:l.reps,done:false,pre:false});
  haptic(10);
  wkReRenderCard(ex);wkSaveState();
}

function wkDelSet(exId,si){
  const ex=wkExs.find(e=>e.id===exId);if(!ex||ex.sets.length<=1)return;
  ex.sets.splice(si,1);wkReRenderCard(ex);wkRefreshStats();
}

function wkDelExercise(exId){wkExs=wkExs.filter(e=>e.id!==exId);wkRender();}

function wkReRenderCard(ex){
  if(_wkGaussCharts[ex.id]){_wkGaussCharts[ex.id].destroy();delete _wkGaussCharts[ex.id];}
  const el=document.getElementById('wk-ex-'+ex.id);
  if(el)el.outerHTML=wkCardHTML(ex);
  wkInitGauss(ex);
}

function wkRefreshStats(){
  let vol=0,ser=0,kcal=0;
  wkExs.forEach(ex=>ex.sets.forEach(s=>{if(s.done){vol+=s.kg*s.reps;ser++;kcal+=(s.kcal||0);}}));
  const m=String(Math.floor(wkSecs/60)).padStart(2,'0');
  const s=String(wkSecs%60).padStart(2,'0');
  document.getElementById('wkb-dur').textContent=m+':'+s;
  document.getElementById('wkb-vol').textContent=vol;
  document.getElementById('wkb-ser').textContent=ser;
  document.getElementById('wkb-kcal').textContent=kcal;
}

// ── Rest timer ──
const RT_CIRCUMFERENCE=62.83;

function _rtUpdateRing(secs,total){
  const prog=document.getElementById('rt-prog');if(!prog)return;
  const offset=RT_CIRCUMFERENCE*(1-secs/total);
  prog.style.strokeDashoffset=RT_CIRCUMFERENCE-offset;
}

function wkStartRestTimer(){
  const def=parseInt(localStorage.getItem('gymy_rest_secs')||'90');
  wkRestSecs=def;wkRestRunning=true;
  document.getElementById('rest-timer').classList.add('active');
  _rtUpdateRing(def,def);
  haptic(12);
  clearInterval(wkRestInterval);
  wkRestInterval=setInterval(()=>{
    if(!wkRestRunning)return;
    wkRestSecs--;
    if(wkRestSecs<=0){
      clearInterval(wkRestInterval);wkRestRunning=false;
      document.getElementById('rest-timer').classList.remove('active');
      haptic([50,30,50]);
      showToast('¡Descanso terminado! 💪');return;
    }
    const m=String(Math.floor(wkRestSecs/60)).padStart(2,'0');
    const s=String(wkRestSecs%60).padStart(2,'0');
    document.getElementById('rt-display').textContent=m+':'+s;
    _rtUpdateRing(wkRestSecs,def);
  },1000);
}

function wkSkipRest(){
  clearInterval(wkRestInterval);wkRestRunning=false;
  document.getElementById('rest-timer').classList.remove('active');
}
