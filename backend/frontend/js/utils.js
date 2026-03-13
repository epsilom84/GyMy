// ══════════════════════════════════════════════
// UTILS.JS — Helpers puros
// ══════════════════════════════════════════════

// ── Haptic feedback ──
function haptic(ms){if('vibrate' in navigator){try{navigator.vibrate(ms||12);}catch(e){}}}

// ── Auto-tema por hora del día ──
function autoThemeByHour(){
  const saved=localStorage.getItem('gymy_theme');
  if(saved)return; // respeta preferencia manual
  const h=new Date().getHours();
  const theme=(h>=7&&h<20)?'light':'dark';
  document.documentElement.setAttribute('data-theme',theme);
}

// ── Formatear fecha ──
function formatFecha(f){
  if(!f)return'';
  const s=String(f).slice(0,10);
  const [y,m,d]=s.split('-');
  if(!y||!m||!d)return s;
  const meses=['ene','feb','mar','abr','may','jun','jul','ago','sep','oct','nov','dic'];
  return d+' '+meses[parseInt(m,10)-1]+' '+y;
}

// ── Toast ──
let toastTimer;
function showToast(msg,type=''){
  const t=document.getElementById('toast');
  t.textContent=msg;t.className='toast '+type+' show';
  clearTimeout(toastTimer);toastTimer=setTimeout(()=>t.className='toast',3000);
}

// ── tipoIcon ──
function tipoIcon(t){return TIPO_ICON[t]||'⚡';}

// ── equipoSVGHtml ──
function _normEquipo(e){return e==='mancuerna'?'mancuernas':e==='maquina'?'máquina':e||'';}
function equipoSVGHtml(equipo, size){
  const k=_normEquipo(equipo);
  const paths=EQUIPO_SVG[k];
  const sz=size||24;
  if(!paths) return `<span style="font-size:${sz-2}px">${EQUIPO_EM[equipo]||'💪'}</span>`;
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" width="${sz}" height="${sz}" style="fill:var(--text2);color:var(--text2);flex-shrink:0;display:block">${paths}</svg>`;
}

// ── ejIconHtml ──
function ejIconHtml(nombre,equipo,size){
  const img=EJ_ICONOS[(nombre||'').toLowerCase().trim()];
  const sz=size||24;
  if(img)return`<img src="${img}" alt="${nombre}" width="${sz}" height="${sz}" style="object-fit:cover;border-radius:4px;flex-shrink:0;display:block">`;
  return equipoSVGHtml(equipo,sz);
}

// ── ejHasImg ──
function ejHasImg(nombre){return!!(EJ_ICONOS[(nombre||'').toLowerCase().trim()]);}

// ── ejEmoji ──
function ejEmoji(equipo){return EQUIPO_EM[equipo]||'💪';}

// ── grupoEmoji ──
function grupoEmoji(g){return GRUPO_EM[g]||'🏃';}

// ── grupoSVGHtml ──
function grupoSVGHtml(grupo, width){
  const norm=/^Brazos/.test(grupo)?'Brazos':grupo;
  const SETS={
    Pecho:   {fp:1},
    Espalda: {be:1},
    Piernas: {fql:1,fqr:1,fcl:1,fcr:1,bg:1,bhl:1,bhr:1,bcl:1,bcr:1},
    Hombros: {fdl:1,fdr:1,bdl:1,bdr:1},
    Brazos:  {fbl:1,fbr:1,ffl:1,ffr:1,btl:1,btr:1,bfl:1,bfr:1},
    Core:    {fc:1},
    Cardio:  {fp:1,fc:1,be:1,fdl:1,fdr:1,bdl:1,bdr:1,fql:1,fqr:1,bhl:1,bhr:1},
  };
  const hi=SETS[norm]||{};
  const col=GRUPO_COLORS[norm]||'var(--accent)';
  const d='rgba(128,128,128,.16)';
  const n='rgba(128,128,128,.10)';
  const c=id=>hi[id]?col:d;
  const wAttr=width?`width="${width}"`:'';
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 120 180" ${wAttr} style="flex-shrink:0;display:block">
  <circle cx="30" cy="14" r="10" fill="${n}" stroke="rgba(128,128,128,.25)" stroke-width=".5"/>
  <rect x="26.5" y="23" width="7" height="6" fill="${n}" rx="2"/>
  <ellipse cx="15" cy="38" rx="10" ry="7" fill="${c('fdl')}"/>
  <ellipse cx="45" cy="38" rx="10" ry="7" fill="${c('fdr')}"/>
  <path d="M20,30 Q30,26 40,30 L41,55 Q30,58 19,55 Z" fill="${c('fp')}"/>
  <path d="M19,56 Q30,59 41,56 L40,82 Q30,85 20,82 Z" fill="${c('fc')}"/>
  <rect x="5" y="36" width="10" height="27" fill="${c('fbl')}" rx="4"/>
  <rect x="45" y="36" width="10" height="27" fill="${c('fbr')}" rx="4"/>
  <rect x="5" y="65" width="8" height="20" fill="${c('ffl')}" rx="3.5"/>
  <rect x="47" y="65" width="8" height="20" fill="${c('ffr')}" rx="3.5"/>
  <path d="M20,83 Q30,86 40,83 L41,96 Q30,99 19,96 Z" fill="${n}"/>
  <rect x="19" y="96" width="10" height="36" fill="${c('fql')}" rx="4.5"/>
  <rect x="31" y="96" width="10" height="36" fill="${c('fqr')}" rx="4.5"/>
  <rect x="20" y="134" width="8.5" height="26" fill="${c('fcl')}" rx="4"/>
  <rect x="31" y="134" width="8.5" height="26" fill="${c('fcr')}" rx="4"/>
  <line x1="60" y1="4" x2="60" y2="166" stroke="rgba(128,128,128,.18)" stroke-width=".5" stroke-dasharray="3,2"/>
  <circle cx="90" cy="14" r="10" fill="${n}" stroke="rgba(128,128,128,.25)" stroke-width=".5"/>
  <rect x="86.5" y="23" width="7" height="6" fill="${n}" rx="2"/>
  <ellipse cx="75" cy="38" rx="10" ry="7" fill="${c('bdl')}"/>
  <ellipse cx="105" cy="38" rx="10" ry="7" fill="${c('bdr')}"/>
  <path d="M80,30 Q90,26 100,30 L101,82 Q90,85 79,82 Z" fill="${c('be')}"/>
  <rect x="65" y="36" width="10" height="27" fill="${c('btl')}" rx="4"/>
  <rect x="105" y="36" width="10" height="27" fill="${c('btr')}" rx="4"/>
  <rect x="65" y="65" width="8" height="20" fill="${c('bfl')}" rx="3.5"/>
  <rect x="107" y="65" width="8" height="20" fill="${c('bfr')}" rx="3.5"/>
  <path d="M80,83 Q90,86 100,83 L101,96 Q90,99 79,96 Z" fill="${c('bg')}"/>
  <rect x="79" y="96" width="10" height="36" fill="${c('bhl')}" rx="4.5"/>
  <rect x="91" y="96" width="10" height="36" fill="${c('bhr')}" rx="4.5"/>
  <rect x="80" y="134" width="8.5" height="26" fill="${c('bcl')}" rx="4"/>
  <rect x="91" y="134" width="8.5" height="26" fill="${c('bcr')}" rx="4"/>
  <text x="30" y="175" text-anchor="middle" fill="rgba(128,128,128,.38)" font-size="5.5" font-family="sans-serif">FRENTE</text>
  <text x="90" y="175" text-anchor="middle" fill="rgba(128,128,128,.38)" font-size="5.5" font-family="sans-serif">ESPALDA</text>
</svg>`; }

// ── tipoSVGHtml ──
function tipoSVGHtml(tipo,size){const g=TIPO_GRUPO_SVG[tipo];return g?grupoSVGHtml(g,size||28):('<span style="font-size:'+(size||28)*0.65+'px;line-height:1">'+tipoIcon(tipo)+'</span>');}

// ── normTipo ──
function normTipo(s){return /^\d+$/.test(s.tipo||'')?detectarTipoSesion(s.ejercicios||[]):( s.tipo||'Fuerza');}

// ── getUser ──
function getUser(){const u=localStorage.getItem('gymy_user');return u?JSON.parse(u):null;}

// ── normQ helper ──
function _normQ(s){return(s||'').normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase();}
