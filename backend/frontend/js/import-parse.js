// ══════════════════════════════════════════════
// IMPORT-PARSE.JS — Detección de grupo muscular y parseo CSV/texto
// ══════════════════════════════════════════════

// ── Detección de grupo muscular ──
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
  return'Fuerza';
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

// ── Helpers de parseo ──
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

// ── Agrupación de series ──
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
    }else{
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

// ── Parseo texto libre ──
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

// ── Parseo CSV principal ──
function parsearCSV(rawText){
  const lines=rawText.split(/\r?\n|\r/).map(l=>l.trim()).filter(l=>l&&!/^,+$/.test(l));
  if(!lines.length)return[];

  const firstLine=lines[0];
  const hasSep=['\t',';','|',','].some(s=>firstLine.includes(s));
  if(!hasSep)return _parsearTextoLibre(lines);

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
    }else{
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
