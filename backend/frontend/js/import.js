// ══════════════════════════════════════════════
// IMPORT.JS — Entrada de importación, preview, auto-crear y ejecución
// Depende de: import-parse.js, import-match.js
// ══════════════════════════════════════════════

// ── Lectura de archivo ──
function importHistorialCSV(event){
  const file=event.target.files[0];if(!file)return;
  event.target.value='';
  if(/\.xlsx?$/i.test(file.name)){
    _readExcel(file);
  }else{
    const reader=new FileReader();
    reader.onload=(e)=>{
      const raw=e.target.result;
      if(!raw.trim()){showToast('Archivo vacío','error');return;}
      openImportPreview(raw,file.name);
    };
    reader.readAsText(file,'UTF-8');
  }
}

function _readExcel(file){
  if(typeof XLSX==='undefined'){showToast('Librería Excel no disponible','error');return;}
  const reader=new FileReader();
  reader.onload=(e)=>{
    try{
      const wb=XLSX.read(new Uint8Array(e.target.result),{type:'array'});
      const ws=wb.Sheets[wb.SheetNames[0]];
      const csv=XLSX.utils.sheet_to_csv(ws,{FS:',',RS:'\n'});
      if(!csv.trim()){showToast('Excel vacío','error');return;}
      openImportPreview(csv,file.name);
    }catch(err){showToast('Error leyendo Excel: '+err.message,'error');}
  };
  reader.readAsArrayBuffer(file);
}

// ── Preview de importación ──
function openImportPreview(rawText,filename){
  let sesiones=[];
  try{sesiones=parsearCSV(rawText);}catch(e){console.warn('parsearCSV error:',e);}

  let resumenHtml='';
  if(sesiones.length){
    const totalEj=sesiones.reduce((a,s)=>a+(s.ejercicios||[]).length,0);
    const totalSeries=sesiones.reduce((a,s)=>(s.ejercicios||[]).reduce((b,e)=>b+(e.series||1),a),0);
    resumenHtml='<div style="background:var(--bg3);border-radius:10px;padding:12px;margin-bottom:12px">'
      +'<div style="font-size:13px;font-weight:600;color:var(--accent3);margin-bottom:8px">'
      +'✓ '+sesiones.length+' sesión(es) · '+totalEj+' ejercicio(s) · '+totalSeries+' serie(s)</div>';
    sesiones.slice(0,5).forEach(s=>{
      const ejList=(s.ejercicios||[]).slice(0,4).map(e=>{
        const peso=e.peso_kg?(' — '+e.peso_kg+'kg'):'';
        return'<span style="color:var(--text2)">'+e.nombre
          +' <span style="color:var(--text);font-weight:600">'+e.series+'×'+e.reps+peso+'</span></span>';
      }).join('<br>');
      const masEj=(s.ejercicios||[]).length>4
        ?'<br><span style="color:var(--text2);font-size:11px">+'+(s.ejercicios.length-4)+' más...</span>':'';
      resumenHtml+='<div style="margin-bottom:10px;padding-bottom:10px;border-bottom:1px solid var(--border)">'
        +'<div style="font-size:12px;font-weight:600;color:var(--text);margin-bottom:4px">'
        +'📅 '+formatFecha(s.fecha)+(s.tipo?' · '+s.tipo:'')+'</div>'
        +'<div style="font-size:11px;line-height:1.7;padding-left:8px">'+ejList+masEj+'</div></div>';
    });
    if(sesiones.length>5)resumenHtml+='<div style="font-size:12px;color:var(--text2);text-align:center">...y '+(sesiones.length-5)+' sesión(es) más</div>';
    resumenHtml+='</div>';
  }else{
    resumenHtml='<div style="color:var(--accent2);font-size:13px;margin-bottom:12px">⚠️ No se detectaron sesiones válidas. Comprueba el formato.</div>';
  }

  document.getElementById('import-preview-body').innerHTML=
    '<div style="font-size:12px;color:var(--text2);margin-bottom:10px"><strong style="color:var(--text)">'+filename+'</strong></div>'
    +resumenHtml
    +'<div id="import-status" style="margin-top:4px;font-size:12px;min-height:18px;color:var(--accent3)"></div>'
    +'<div id="import-progress-wrap" style="display:none;margin-top:6px;background:var(--bg3);border-radius:4px;height:6px;overflow:hidden">'
    +'<div id="import-progress-fill" style="height:100%;background:var(--accent);width:0%;transition:width .25s ease"></div></div>'
    +'<div style="display:flex;gap:8px;margin-top:14px">'
    +'<button class="c-btn-cancel" onclick="closeModal(\'modal-import-preview\')">Cancelar</button>'
    +'<button class="c-btn-primary" id="btn-run-import" onclick="runImport()" '+(sesiones.length?'':'disabled="disabled"')+'>📥 Importar</button>'
    +'</div>';
  window._importRawText=rawText;
  openModal('modal-import-preview');
}

// ── Auto-crear ejercicios en catálogo ──
async function _autoCrearEjercicios(sesiones){
  if(!_catalogoCache)await loadCatalogo();
  const catalogNamesLow=new Set(
    Object.values(_catalogoCache||{}).flat().map(e=>(e.n||e.nombre||'').toLowerCase())
  );
  const token=localStorage.getItem('gymy_access');
  const vistos=new Set();let creados=0;
  for(const s of sesiones){
    for(const e of(s.ejercicios||[])){
      const key=e.nombre.toLowerCase();
      if(vistos.has(key)||catalogNamesLow.has(key)){vistos.add(key);continue;}
      vistos.add(key);
      try{
        const r=await fetch('/api/catalogo',{
          method:'POST',
          headers:{'Content-Type':'application/json','Authorization':'Bearer '+token},
          body:JSON.stringify({
            nombre:e.nombre,
            grupo_muscular:e.grupo_muscular||'Fuerza',
            subgrupo:null,
            equipo:null,
            tipo:(e.grupo_muscular||'')==='Cardio'?'cardio':'fuerza',
            descripcion:'Importado'
          })
        });
        const d=await r.json();
        if(d.ok&&d.created){creados++;catalogNamesLow.add(key);}
      }catch(err){console.warn('No se pudo crear ejercicio:',e.nombre,err);}
    }
  }
  if(creados>0){try{await loadCatalogo();}catch(e){}}
  return creados;
}

// ── Ejecución de importación ──
async function runImport(){
  const rawText=window._importRawText;
  if(!rawText)return;
  const btn=document.getElementById('btn-run-import');
  const status=document.getElementById('import-status');
  const progWrap=document.getElementById('import-progress-wrap');
  const progFill=document.getElementById('import-progress-fill');
  btn.disabled=true;btn.textContent='Procesando...';

  try{
    status.textContent='Analizando archivo...';
    const sesiones=parsearCSV(rawText);
    if(!sesiones.length){
      status.style.color='var(--accent2)';
      status.textContent='No se encontraron sesiones válidas';
      btn.disabled=false;btn.textContent='📥 Importar';
      return;
    }

    status.textContent='Comprobando ejercicios en catálogo...';
    const mapaCombinaciones=await _resolverCombinaciones(sesiones);
    if(mapaCombinaciones===null){
      btn.disabled=false;btn.textContent='📥 Importar';
      return;
    }
    if(mapaCombinaciones.size>0){
      sesiones.forEach(s=>{
        (s.ejercicios||[]).forEach(e=>{
          const mapped=mapaCombinaciones.get((e.nombre||'').toLowerCase().trim());
          if(mapped)e.nombre=mapped;
        });
      });
    }

    const totalEj=sesiones.reduce((a,s)=>a+(s.ejercicios||[]).length,0);
    if(totalEj>0){
      status.textContent='Registrando ejercicios nuevos en catálogo...';
      const creados=await _autoCrearEjercicios(sesiones);
      if(creados>0)status.textContent=creados+' ejercicio(s) añadidos al catálogo.';
    }

    if(progWrap)progWrap.style.display='block';
    status.textContent='Guardando sesiones...';
    let imported=0,errors=0;
    for(const s of sesiones){
      if(!s.fecha||!/^\d{4}-\d{2}-\d{2}$/.test(s.fecha))continue;
      const sesion={
        fecha:s.fecha,
        tipo:s.tipo||'Fuerza',
        duracion_min:s.duracion_min||null,
        calorias:s.calorias||0,
        notas:s.notas||'Importado',
        importado:true,
        ejercicios:(s.ejercicios||[]).map(e=>({
          nombre:e.nombre,
          series:e.series||1,
          reps:e.reps||0,
          peso_kg:e.peso_kg||0,
          sets_data:e.sets_data||null
        }))
      };
      if(!navigator.onLine){guardarOffline(sesion);imported++;}
      else{
        const r=await crearSesion(sesion);
        if(r.data&&r.data.ok)imported++;
        else{errors++;console.warn('Error sesión',s.fecha,r.data);}
      }
      const done=imported+errors;
      const pct=Math.round(done/sesiones.length*100);
      if(progFill)progFill.style.width=pct+'%';
      status.textContent='Guardando '+done+'/'+sesiones.length+'...';
    }

    closeModal('modal-import-preview');
    updateOfflineBadge();loadDashboard();statsCache=null;currentPage=1;loadHistorial();
    setTimeout(()=>goTab('historial',document.getElementById('tab-historial')),300);

    let msg=imported+' sesión(es) importada(s)';
    if(errors>0)msg+=' · '+errors+' error(es)';
    showToast(msg+(navigator.onLine?'':' (offline)'),'success');

  }catch(err){
    console.error('runImport error:',err);
    status.style.color='var(--accent2)';
    status.textContent='Error: '+err.message;
    btn.disabled=false;btn.textContent='📥 Importar';
  }
}

async function runAIImport(){return runImport();}
