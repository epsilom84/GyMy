// ══════════════════════════════════════════════
// SETTINGS.JS — Tema y ajustes de usuario
// ══════════════════════════════════════════════

function wkGetPreloadMode(){return localStorage.getItem('gymy_preload')||'ultimo';}

function applySettingsUI(){
  const t=localStorage.getItem('gymy_theme')||'dark';
  ['dark','light','choni','material-dark','material-light'].forEach(n=>{
    const el=document.getElementById('opt-'+n);
    if(el)el.classList.toggle('active',t===n);
  });
  const mode=localStorage.getItem('gymy_preload')||'ultimo';
  document.getElementById('opt-ultimo')?.classList.toggle('active',mode==='ultimo');
  document.getElementById('opt-maximo')?.classList.toggle('active',mode==='maximo');
}

function setTheme(t){
  document.documentElement.setAttribute('data-theme',t);
  localStorage.setItem('gymy_theme',t);
  applyTheme();
  applySettingsUI();
}

function setPreload(mode){
  localStorage.setItem('gymy_preload',mode);
  applySettingsUI();
  showToast('Modo precarga actualizado','success');
}

function applyTheme(){
  const t=localStorage.getItem('gymy_theme')||'dark';
  document.documentElement.setAttribute('data-theme',t);
  const btn=document.getElementById('theme-btn');
  const icons={
    dark:'<svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor"><path d="M6.76 4.84l-1.8-1.79-1.41 1.41 1.79 1.79 1.42-1.41zM4 10.5H1v2h3v-2zm9-9.95h-2V3.5h2V.55zm7.45 3.91l-1.41-1.41-1.79 1.79 1.41 1.41 1.79-1.79zm-3.21 13.7l1.79 1.8 1.41-1.41-1.8-1.79-1.4 1.4zM20 10.5v2h3v-2h-3zm-8-5c-3.31 0-6 2.69-6 6s2.69 6 6 6 6-2.69 6-6-2.69-6-6-6zm-1 16.95h2V19.5h-2v2.95zm-7.45-3.91l1.41 1.41 1.79-1.8-1.41-1.41-1.79 1.8z"/></svg>',
    light:'<svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor"><path d="M12 3a9 9 0 1 0 9 9c0-.46-.04-.92-.1-1.36a5.389 5.389 0 0 1-4.4 2.26 5.403 5.403 0 0 1-3.14-9.8c-.44-.06-.9-.1-1.36-.1z"/></svg>',
    choni:'<svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor"><path d="M19 9l1.25-2.75L23 5l-2.75-1.25L19 1l-1.25 2.75L15 5l2.75 1.25L19 9zm-7.5.5L9 4 6.5 9.5 1 12l5.5 2.5L9 20l2.5-5.5L17 12l-5.5-2.5zM19 15l-1.25 2.75L15 19l2.75 1.25L19 23l1.25-2.75L23 19l-2.75-1.25L19 15z"/></svg>',
    'material-dark':'<svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor"><path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm0 18V4c4.41 0 8 3.59 8 8s-3.59 8-8 8z"/></svg>',
    'material-light':'<svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor"><path d="M6.76 4.84l-1.8-1.79-1.41 1.41 1.79 1.79 1.42-1.41zM4 10.5H1v2h3v-2zm9-9.95h-2V3.5h2V.55zm7.45 3.91l-1.41-1.41-1.79 1.79 1.41 1.41 1.79-1.79zm-3.21 13.7l1.79 1.8 1.41-1.41-1.8-1.79-1.4 1.4zM20 10.5v2h3v-2h-3zm-8-5c-3.31 0-6 2.69-6 6s2.69 6 6 6 6-2.69 6-6-2.69-6-6-6zm-1 16.95h2V19.5h-2v2.95zm-7.45-3.91l1.41 1.41 1.79-1.8-1.41-1.41-1.79 1.8z"/></svg>'
  };
  if(btn)btn.innerHTML=icons[t]||icons.dark;
}

function toggleTheme(){
  const themes=['dark','light','choni','material-dark','material-light'];
  const c=document.documentElement.getAttribute('data-theme');
  const n=themes[(themes.indexOf(c)+1)%themes.length];
  setTheme(n);
}
