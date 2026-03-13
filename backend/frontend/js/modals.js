// ══════════════════════════════════════════════
// MODALS.JS — Modal / Panel / Confirm
// ══════════════════════════════════════════════

function openModal(id){
  const el=document.getElementById(id);
  el.classList.add('open');
  // Cerrar al pulsar fuera del contenido
  el._closeHandler=function(e){if(e.target===el)closeModal(id);};
  el.addEventListener('click',el._closeHandler);
}
function closeModal(id){
  const el=document.getElementById(id);
  el.classList.remove('open');
  if(el._closeHandler){el.removeEventListener('click',el._closeHandler);delete el._closeHandler;}
}
function openPanel(){document.getElementById('side-panel').classList.add('open');document.getElementById('panel-bd').classList.add('open');}
function closePanel(){document.getElementById('side-panel').classList.remove('open');document.getElementById('panel-bd').classList.remove('open');}

// ══════════════════════════════════════════════
// CONFIRM MODAL
// ══════════════════════════════════════════════
function showConfirm(title,msg,okLabel,onOk,style='danger'){
  document.getElementById('confirm-title').textContent=title;
  document.getElementById('confirm-msg').textContent=msg;
  const btn=document.getElementById('confirm-ok-btn');
  btn.textContent=okLabel;
  btn.className=style==='primary'?'c-btn-primary':'c-btn-ok';
  btn.onclick=()=>{closeModal('modal-confirm');onOk();};
  openModal('modal-confirm');
}

function confirmLogout(){
  showConfirm('¿Cerrar sesión?','Tu token se eliminará de este dispositivo.','Cerrar sesión',()=>logout());
}
