// ══════════════════════════════════════════════
// IMPORTAR HISTORIAL — extraído de index.html
// Depende de globals: showToast, XLSX, apiCall, crearSesion, loadDashboard,
//   statsCache, currentPage, loadHistorial, goTab, guardarOffline,
//   updateOfflineBadge, _catalogoCache, loadCatalogo, closeModal, openModal,
//   formatFecha
// ══════════════════════════════════════════════
function importHistorialCSV(event){
  const file=event.target.files[0];if(!file)return;
  event.target.value='';
  if(/\.xlsx?$/i.test(file.name)){
    _readExcel(file);
  } else {
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
        return '<span style="color:var(--text2)">'+e.nombre
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
  } else {
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

// ── DETECCIÓN DE GRUPO MUSCULAR ──────────────────────────────────────────────
const GRUPOS_KEYWORDS={
  'Pecho':['press pecho','pec deck','aperturas pecho','crossover','push up','flexiones pecho','pecho','chest','bench press','incline press','fly'],
  'Espalda':['jalón','pulldown','pull-down','dominadas','remo','espalda','peso muerto','deadlift','lat pull','seated row','back','pull up','chin up'],
  'Piernas':['sentadilla','squat','prensa','leg press','extensión cuad','curl femoral','leg curl','gemelos','calf','abducción','aducción','piernas','legs','lunges','zancadas','hip thrust','rdl','romanian'],
  'Hombros':['press hombros','press militar','overhead press','elevaciones lat','elevacion frontal','face pull','arnold','hombros','shoulder','deltoid','lateral raise'],
  'Brazos Bíceps':['curl bíceps','curl biceps','curl martillo','hammer curl','curl scott','preacher curl','bicep','bícep','biceps curl'],
  'Brazos Tríceps':['press tríceps','tricep','trícep','extensión tríceps','fondos tríceps','skull crusher','pushdown','dips','triceps'],
  'Core':['abdominales','abs','crunch','plancha','plank','oblicuos','core','sit up','russian twist','rueda abdominal','hanging leg','dragon flag'],
  'Cardio':['correr','carrera','bici','ciclismo','eliptica','cinta','treadmill','running','cardio','remo cardio','rowing','nadar','natación','saltar','jump rope','comba']
};
function detectarGrupo(nombreEj){
  const n=(nombreEj||'').toLowerCase().trim();
  for(const[grupo,kws]of Object.entries(GRUPOS_KEYWORDS)){
    if(kws.some(k=>n.includes(k)))return grupo;
  }
  if(typeof _catalogoCache!=='undefined'&&_catalogoCache){
    for(const[grupo,ejercicios]of Object.entries(_catalogoCache)){
      if(ejercicios.some(e=>{const en=(e.n||e.nombre||'').toLowerCase();return en===n||en.includes(n)||n.includes(en);}))return grupo;
    }
  }
  return 'Fuerza';
}
function detectarTipoSesion(ejercicios){
  if(!ejercicios||!ejercicios.length)return'Fuerza';
  const grupos={};
  ejercicios.forEach(e=>{const g=e.grupo_muscular||detectarGrupo(e.nombre);grupos[g]=(grupos[g]||0)+1;});
  const top=Object.entries(grupos).sort((a,b)=>b[1]-a[1])[0];
  const g=top?top[0]:'Fuerza';
  const mapa={'Pecho':'Pecho','Espalda':'Espalda','Piernas':'Piernas','Hombros':'Hombros',
    'Brazos Bíceps':'Brazos','Brazos Tríceps':'Brazos','Core':'Core','Cardio':'Cardio'};
  return mapa[g]||g;
}

// ── PARSEO CSV ───────────────────────────────────────────────────────────────
function _normFecha(raw){
  if(!raw)return'';
  let s=String(raw).replace(/["']/g,'').trim();
  s=s.replace(/[T ]\d{1,2}:\d{2}(:\d{2})?(\.\d+)?(Z|[+-]\d{1,2}:?\d{0,2})?$/,'').trim();
  let m=s.match(/^(\d{4})[-\/](\d{1,2})[-\/](\d{1,2})$/);
  if(m)return m[1]+'-'+m[2].padStart(2,'0')+'-'+m[3].padStart(2,'0');
  m=s.match(/^(\d{1,2})[\/\-\.](\d{1,2})[\/\-\.](\d{4})$/);
  if(m)return m[3]+'-'+m[2].padStart(2,'0')+'-'+m[1].padStart(2,'0');
  m=s.match(/^(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{2})$/);
  if(m)return'20'+m[3]+'-'+m[1].padStart(2,'0')+'-'+m[2].padStart(2,'0');
  return'';
}
function _numF(s){return parseFloat(String(s||'').replace(',','.'))||0;}
function _numI(s){const m=String(s||'').match(/\d+/);return m?parseInt(m[0]):0;}
function _parseDuracion(s){
  if(!s)return 0;
  s=String(s).trim();
  const hm=s.match(/^(\d+):(\d{2})(?::\d{2})?$/);
  if(hm)return parseInt(hm[1])*60+parseInt(hm[2]);
  const solo=s.match(/^(\d+)\s*(?:min|m|minutos?)?$/i);
  if(solo)return parseInt(solo[1]);
  return 0;
}
function _parseLine(line,sep){
  const r=[];let cur='';let inQ=false;
  for(const c of line){
    if(c==='"'){inQ=!inQ;}
    else if(c===sep&&!inQ){r.push(cur.trim());cur='';}
    else cur+=c;
  }
  r.push(cur.trim());
  return r.map(v=>v.replace(/^["']|["']$/g,'').trim());
}

function parsearCSV(rawText){
  const lines=rawText.split(/\r?\n|\r/).map(l=>l.trim()).filter(l=>l&&!/^,+$/.test(l));
  if(!lines.length)return[];

  const firstLine=lines[0];
  const hasSep=['\t',';','|',','].some(s=>firstLine.includes(s));
  if(!hasSep){
    return _parsearTextoLibre(lines);
  }

  const sep=['\t',';','|',','].find(s=>firstLine.includes(s));
  const header=_parseLine(lines[0],sep).map(h=>h.toLowerCase().replace(/[()°\s]+/g,'_').replace(/_+/g,'_'));
  const dataLines=lines.slice(1);

  function col(...aliases){
    for(const a of aliases){
      const i=header.findIndex(h=>h===a||h.includes(a));
      if(i>=0)return i;
    }
    return -1;
  }
  function get(cols,idx,def=''){return idx>=0&&idx<cols.length?(cols[idx]||def):def;}

  const isGyMy=header[0]==='fecha'&&header[1]==='tipo'&&header.includes('duracion_min');
  if(isGyMy){
    const iF=0,iT=1,iD=col('duracion_min'),iC=col('calorias'),iV=col('valoracion'),iN=col('notas');
    return dataLines.map(line=>{
      const c=_parseLine(line,sep);
      const fecha=_normFecha(get(c,iF));
      if(!fecha)return null;
      return{fecha,tipo:get(c,iT)||'Fuerza',duracion_min:_numI(get(c,iD)),
        calorias:_numI(get(c,iC)),valoracion:_numI(get(c,iV)),
        notas:get(c,iN)||'Importado GyMy',ejercicios:[]};
    }).filter(Boolean);
  }

  const iDate =col('date','fecha','día','dia','timestamp','datetime','workout_date');
  const iWname=col('workout_name','workout','entrenamiento','sesion','session_name','training');
  const iEname=col('exercise_name','exercise','ejercicio','nombre','movement','name');
  const iSet  =col('set_order','set_num','numero_serie','set');
  const iReps =col('reps','repeticiones','repetitions','rep');
  const iPeso =col('weight','peso','weight_(kg)','weight_kg','kg','lbs','load','weight_(lbs)');
  const iDur  =col('duration','duracion','duracion_min','minutes','tiempo','duration_(seconds)','seconds');
  const iTipo =col('type','tipo','category','categoria');
  const iCal  =col('calories','calorias','kcal','cal');
  const iNotas=col('notes','notas','nota','comments','workout_notes');
  const pesoEnLbs=header.some(h=>h.includes('lbs')&&!h.includes('kg'));

  const byFecha={};
  dataLines.forEach(line=>{
    const c=_parseLine(line,sep);
    if(c.length<2)return;
    const fecha=_normFecha(get(c,iDate));
    if(!fecha)return;
    let peso=_numF(get(c,iPeso));
    if(pesoEnLbs&&peso>0)peso=Math.round(peso*0.4536*10)/10;
    const reps=_numI(get(c,iReps));
    const ejNombre=(get(c,iEname)||'').replace(/[()]/g,'').replace(/\s+/g,' ').trim();
    const workoutName=get(c,iWname)||'';
    const tipoRaw=get(c,iTipo)||workoutName;
    const durRaw=get(c,iDur);
    const dur=_parseDuracion(durRaw);
    const cal=_numI(get(c,iCal));
    const notas=get(c,iNotas)||'';
    const setOrder=iSet>=0?(_numI(get(c,iSet))||0):0;
    if(!byFecha[fecha]){
      byFecha[fecha]={fecha,tipo:tipoRaw&&!/^\d+$/.test(tipoRaw)?tipoRaw:'',
        duracion_min:dur,calorias:cal,notas:notas||'Importado',ejercicios:[]};
    } else {
      if(dur>byFecha[fecha].duracion_min)byFecha[fecha].duracion_min=dur;
      if(cal>byFecha[fecha].calorias)byFecha[fecha].calorias=cal;
      if(notas&&!byFecha[fecha].notas)byFecha[fecha].notas=notas;
    }
    if(!ejNombre)return;
    byFecha[fecha].ejercicios.push({
      nombre:ejNombre,
      grupo_muscular:detectarGrupo(ejNombre),
      reps,peso_kg:peso,
      _setOrder:setOrder
    });
  });

  Object.values(byFecha).forEach(s=>{
    s.ejercicios=_agruparSeries(s.ejercicios);
    if(!s.tipo)s.tipo=detectarTipoSesion(s.ejercicios);
    delete s._hora;
  });

  return Object.values(byFecha);
}

function _agruparSeries(ejercicios){
  if(!ejercicios.length)return[];
  const bloques={};const orden=[];
  ejercicios.forEach(e=>{
    const k=e.nombre.toLowerCase().trim();
    if(!bloques[k]){
      bloques[k]={nombre:e.nombre,grupo_muscular:e.grupo_muscular,
        series:1,reps:e.reps,peso_kg:e.peso_kg,
        _sets:[{reps:e.reps,kg:e.peso_kg}]};
      orden.push(k);
    } else {
      bloques[k].series++;
      if(e.reps>bloques[k].reps)bloques[k].reps=e.reps;
      if(e.peso_kg>bloques[k].peso_kg)bloques[k].peso_kg=e.peso_kg;
      bloques[k]._sets.push({reps:e.reps,kg:e.peso_kg});
    }
  });
  return orden.map(k=>{
    const b=bloques[k];
    b.sets_data=JSON.stringify(b._sets);
    delete b._sets;
    return b;
  });
}

function _parsearTextoLibre(lines){
  const sesiones=[];let current=null;
  const fechaRe=/^(\d{1,2})[\/\-\.](\d{1,2})(?:[\/\-\.](\d{2,4}))?/;
  const ejRe=/^(.+?)[\s:]+(\d+)\s*[x×*]\s*(\d+)(?:\s*[-@]\s*([\d.,]+)\s*kg?)?/i;
  lines.forEach(line=>{
    const mf=line.match(fechaRe);
    if(mf){
      const d=mf[1].padStart(2,'0');
      const mo=mf[2].padStart(2,'0');
      const y=mf[3]?(mf[3].length===2?'20'+mf[3]:mf[3]):''+new Date().getFullYear();
      const fecha=`${y}-${mo}-${d}`;
      current={fecha,tipo:'Fuerza',duracion_min:0,calorias:0,notas:'Importado',ejercicios:[]};
      sesiones.push(current);
      return;
    }
    if(!current){
      current={fecha:new Date().toISOString().slice(0,10),tipo:'Fuerza',duracion_min:0,calorias:0,notas:'Importado',ejercicios:[]};
      sesiones.push(current);
    }
    const me=line.match(ejRe);
    if(me){
      const nombre=me[1].trim();
      current.ejercicios.push({
        nombre,grupo_muscular:detectarGrupo(nombre),
        series:parseInt(me[2]),reps:parseInt(me[3]),peso_kg:_numF(me[4])
      });
    }
  });
  sesiones.forEach(s=>{if(!s.tipo||s.tipo==='Fuerza')s.tipo=detectarTipoSesion(s.ejercicios);});
  return sesiones.filter(s=>s.ejercicios.length>0||lines.length<5);
}

// ── SIMILITUD POR BIGRAMAS ────────────────────────────────────────────────────
function _normEjN(s){
  return (s||'').toLowerCase()
    .normalize('NFD').replace(/[\u0300-\u036f]/g,'')
    .replace(/[^a-z0-9 ]/g,' ').replace(/\s+/g,' ').trim();
}
function _bigramasSet(s){
  const set=new Set();
  for(let i=0;i<s.length-1;i++)set.add(s.slice(i,i+2));
  return set;
}
function _simSilabas(a,b){
  const na=_normEjN(a),nb=_normEjN(b);
  if(!na||!nb)return 0;
  const ba=_bigramasSet(na),bb=_bigramasSet(nb);
  if(!ba.size||!bb.size)return 0;
  let inter=0;ba.forEach(g=>{if(bb.has(g))inter++;});
  return inter/(ba.size+bb.size-inter);
}
function _buscarCandidatosEj(nombre,catalogoFlat,n){
  n=n||6;
  return catalogoFlat
    .map(e=>({e,sim:_simSilabas(nombre,e.n||e.nombre||'')}))
    .filter(x=>x.sim>0.15)
    .sort((a,b)=>b.sim-a.sim)
    .slice(0,n);
}
function _normDomId(s){
  return _normEjN(s).replace(/\s+/g,'_').replace(/[^a-z0-9_]/g,'').slice(0,40);
}
function _escH(s){
  return (s||'').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
}

// ── RESOLUCIÓN DE COMBINACIONES ───────────────────────────────────────────────
async function _resolverCombinaciones(sesiones){
  if(!_catalogoCache)await loadCatalogo();
  const catalogoFlat=Object.values(_catalogoCache||{}).flat();
  const catalogNamesLow=new Set(catalogoFlat.map(e=>(e.n||e.nombre||'').toLowerCase()));

  const vistos=new Set();const noEncontrados=[];
  for(const s of sesiones){
    for(const e of(s.ejercicios||[])){
      const key=(e.nombre||'').toLowerCase().trim();
      if(!vistos.has(key)){
        vistos.add(key);
        if(!catalogNamesLow.has(key))noEncontrados.push(e.nombre);
      }
    }
  }
  if(!noEncontrados.length)return new Map();

  const filas=noEncontrados.map(nombre=>({
    original:nombre,
    cands:_buscarCandidatosEj(nombre,catalogoFlat,6)
  }));

  return new Promise(resolve=>{
    window._combinarResolver=function(confirmed){
      closeModal('modal-import-combinar');
      if(!confirmed){resolve(null);return;}
      const mapa=new Map();
      filas.forEach(({original})=>{
        const id='cs_'+_normDomId(original);
        const sel=document.getElementById(id);
        const val=sel?sel.value:'__nuevo__';
        if(val&&val!=='__nuevo__')mapa.set(original.toLowerCase().trim(),val);
      });
      resolve(mapa);
    };

    let html='<p style="font-size:13px;color:var(--text2);margin:0 0 14px">'
      +'Los siguientes ejercicios <strong style="color:var(--text)">no existen en el catálogo</strong>. '
      +'Puedes combinarlos con un ejercicio existente o crearlos como nuevos.</p>';

    filas.forEach(({original,cands})=>{
      const id='cs_'+_normDomId(original);
      const topSim=cands[0]?cands[0].sim:0;
      const topNombre=cands[0]?(cands[0].e.n||cands[0].e.nombre||''):'';
      const autoSuggest=topSim>=0.8;

      html+='<div style="margin-bottom:10px;padding:10px 12px;background:var(--bg3);border-radius:10px;border:1px solid var(--border)">';
      html+='<div style="display:flex;align-items:flex-start;gap:10px;flex-wrap:wrap">';
      html+='<div style="flex:1;min-width:120px">'
        +'<div style="font-size:11px;color:var(--text2);margin-bottom:3px">Del archivo</div>'
        +'<div style="font-size:13px;font-weight:600;color:var(--accent2);word-break:break-word">'+_escH(original)+'</div>'
        +'</div>';
      html+='<div style="flex:1;min-width:160px">'
        +'<div style="font-size:11px;color:var(--text2);margin-bottom:3px">Combinar con</div>'
        +'<select id="'+id+'" style="width:100%;padding:6px 8px;background:var(--bg);border:1px solid var(--border);'
        +'border-radius:8px;color:var(--text);font-size:12px">'
        +'<option value="__nuevo__">➕ Crear como nuevo</option>';

      cands.forEach(({e,sim})=>{
        const nombre=e.n||e.nombre||'';
        const pct=Math.round(sim*100);
        const sel=(autoSuggest&&nombre===topNombre)?' selected':'';
        html+='<option value="'+_escH(nombre)+'"'+sel+'>'+_escH(nombre)+' ('+pct+'%)</option>';
      });
      html+='</select>';

      if(autoSuggest){
        html+='<div style="font-size:11px;color:var(--accent3);margin-top:4px">'
          +'✓ Sugerido: <em>'+_escH(topNombre)+'</em> ('+Math.round(topSim*100)+'%)</div>';
      } else if(cands.length){
        html+='<div style="font-size:11px;color:var(--text2);margin-top:4px">'
          +'Mejor coincidencia: '+Math.round(topSim*100)+'%</div>';
      }
      html+='</div></div></div>';
    });

    html+='<div style="display:flex;gap:8px;margin-top:16px">'
      +'<button class="c-btn-cancel" onclick="window._combinarResolver(false)">Cancelar importación</button>'
      +'<button class="c-btn-primary" onclick="window._combinarResolver(true)">Continuar →</button>'
      +'</div>';

    document.getElementById('combinar-body').innerHTML=html;
    openModal('modal-import-combinar');
  });
}

// ── AUTO-CREAR EJERCICIOS EN CATÁLOGO ─────────────────────────────────────────
// fix #9: subgrupo ya no se establece con grupo_muscular (incorrecto),
// el backend lo infiere del catálogo o lo deja null.
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

// ── MAIN IMPORT ───────────────────────────────────────────────────────────────
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

    // Mostrar barra de progreso
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
