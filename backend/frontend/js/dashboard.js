// ══════════════════════════════════════════════
// DASHBOARD.JS
// ══════════════════════════════════════════════

async function loadDashboard(){
  // Skeleton stats
  const skelStat=(id)=>{const el=document.getElementById(id);if(el){el.innerHTML='<div class="skeleton skel-bar" style="width:60%;height:28px;margin:0 auto"></div>';}};
  ['s-total','s-racha','s-semana','s-horas'].forEach(skelStat);
  const recEl=document.getElementById('dash-recientes');
  if(recEl)recEl.innerHTML=Array(2).fill('<div class="skeleton skel-session"></div>').join('');
  const{data}=await getStats();if(!data.ok)return;
  statsCache=data.stats;const s=data.stats;
  const horas=Math.floor(s.totalMinutos/60)+'h';
  const set=(id,v)=>{const el=document.getElementById(id);if(el)el.textContent=v;};
  set('s-total',s.total);
  set('s-racha',s.racha);
  set('s-semana',s.ultimasSemana);
  set('s-horas',horas);
  set('p-total',s.total);
  set('p-horas',horas);
  set('p-racha',s.racha);
  renderProgreso(s.progreso);renderRecientes(s.recientes);
  updateCoach(s);
}

function renderProgreso(semanas){
  const el=document.getElementById('chart-progreso');
  if(!semanas||!semanas.length){el.innerHTML='<p style="color:var(--text2);font-size:13px">¡Registra tu primera sesión!</p>';return;}
  const max=Math.max(...semanas.map(s=>s.sesiones),1);
  el.innerHTML=semanas.map(s=>{
    const h=Math.max(4,(s.sesiones/max)*72);
    const lbl=s.semana?s.semana.split('-W')[1]:'';
    return '<div class="prog-col"><div class="prog-bar" style="height:'+h+'px" title="'+s.sesiones+' sesiones"></div><div class="prog-label">S'+lbl+'</div></div>';
  }).join('');
}

function renderRecientes(sesiones){
  const el=document.getElementById('dash-recientes');
  if(!sesiones||!sesiones.length){
    el.innerHTML='<div class="empty-state" style="padding:28px 20px"><img class="empty-state-icon" src="/assets/musculos.svg" alt=""/><div class="empty-state-title">Sin sesiones</div><div class="empty-state-sub">Pulsa ＋ para empezar tu primer entrenamiento</div></div>';
    return;
  }
  el.innerHTML=sesiones.map(s=>sessionCard(s)).join('');
}
