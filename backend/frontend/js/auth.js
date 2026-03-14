// ══════════════════════════════════════════════
// AUTH.JS — Auth UI
// ══════════════════════════════════════════════

function switchAuthTab(tab){
  ['login','register','forgot'].forEach(t=>{document.getElementById(t+'-form').style.display=t===tab?'block':'none';});
  document.querySelectorAll('.auth-tab').forEach((el,i)=>el.classList.toggle('active',(i===0&&tab==='login')||(i===1&&tab==='register')));
  document.getElementById('auth-tabs-bar').style.display=tab==='forgot'?'none':'flex';
  document.getElementById('auth-error').textContent='';
}

async function handleLogin(){
  clearFieldErrors();
  const email=document.getElementById('li-email').value.trim();
  const pass=document.getElementById('li-pass').value;
  if(!email||!pass)return setAuthError('Rellena todos los campos');
  setLoading('btn-login',true,'Entrando...');
  const{data}=await login(email,pass);
  setLoading('btn-login',false,'Entrar');
  if(data.ok){
    const remember=document.getElementById('remember-me')?.checked;
    if(remember){
      localStorage.setItem('gymy_saved_email',email);
      localStorage.setItem('gymy_remember','1');
    } else {
      localStorage.removeItem('gymy_saved_email');
      localStorage.removeItem('gymy_remember');
    }
    initApp();
  } else { setAuthError(data.error); }
}

async function handleRegister(){
  clearFieldErrors();
  const user=document.getElementById('re-user').value.trim();
  const email=document.getElementById('re-email').value.trim();
  const pass=document.getElementById('re-pass').value;
  let ok=true;
  if(!user||user.length<3){showFieldError('err-user','Mínimo 3 caracteres');ok=false;}
  if(!email||!email.includes('@')){showFieldError('err-email','Email no válido');ok=false;}
  if(!pass||pass.length<6){showFieldError('err-pass','Mínimo 6 caracteres');ok=false;}
  if(!ok)return;
  setLoading('btn-register',true,'Creando...');
  const{data}=await register(user,email,pass);
  setLoading('btn-register',false,'Crear cuenta');
  if(data.ok)initApp();else setAuthError(data.error);
}

async function handleForgot(){
  const email=document.getElementById('fp-email').value.trim();
  if(!email)return setAuthError('Introduce tu email');
  setLoading('btn-forgot',true,'Enviando...');
  const{data}=await forgotPassword(email);
  setLoading('btn-forgot',false,'Enviar enlace');
  if(data.ok)setAuthError('✓ Si el email existe, recibirás un enlace');else setAuthError(data.error);
}

function showResetForm(token){
  document.getElementById('auth-screen').style.display='flex';
  document.getElementById('login-form').innerHTML=[
    '<p style="color:var(--text2);font-size:13px;margin-bottom:14px">Introduce tu nueva contraseña.</p>',
    '<div class="form-group"><label>Nueva contraseña</label><input type="password" id="rp-pass" placeholder="Mínimo 6 caracteres"/></div>',
    '<button class="btn btn-primary" id="btn-reset">Guardar contraseña</button>'
  ].join('');
  document.getElementById('btn-reset').addEventListener('click',()=>doReset(token));
  document.getElementById('auth-tabs-bar').style.display='none';
}

async function doReset(token){
  const pass=document.getElementById('rp-pass').value;
  if(!pass||pass.length<6)return setAuthError('Mínimo 6 caracteres');
  const{data}=await resetPassword(token,pass);
  if(data.ok){setAuthError('✓ Contraseña actualizada');setTimeout(()=>{history.replaceState({},'','/');switchAuthTab('login');},2000);}
  else setAuthError(data.error);
}

function setAuthError(m){document.getElementById('auth-error').textContent=m;}
function showFieldError(id,m){const el=document.getElementById(id);if(el)el.textContent=m;}
function clearFieldErrors(){document.querySelectorAll('.field-error').forEach(el=>el.textContent='');}
function setLoading(id,loading,text){const b=document.getElementById(id);if(!b)return;b.disabled=loading;b.textContent=text;}
function showAuth(){document.getElementById('auth-screen').style.display='flex';document.getElementById('app-screen').style.display='none';}
