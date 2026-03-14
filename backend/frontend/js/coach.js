// ══════════════════════════════════════════════
// COACH.JS — Coach Sasha
// ══════════════════════════════════════════════

let _coachStats=null,_coachIdx=-1;

const _COACH_GENERIC=[
  'El 80% de la gente abandona el gimnasio antes de febrero. Tú sigues aquí. Eso ya es ganar.',
  'Arnold entrenaba 6 horas al día. Tú tienes potencial de llegar al 15%. Poco a poco.',
  'El músculo no crece durante el entrenamiento, sino en el descanso. Dormir también es entrenar. De nada.',
  'El récord mundial de dominadas en 1 minuto son 51. Tú vas bien... para ser terrestre.',
  'Científicamente, el ejercicio libera endorfinas. Las endorfinas te hacen feliz. Conclusión: soy yo quien te hace feliz.',
  'Los griegos competían desnudos en los Juegos Olímpicos. Agradece el pantalón de chándal y entrena.',
  'Una sesión de fuerza eleva el metabolismo hasta 48h después. Lo que comas esta noche... yo no dije nada.',
  'El corazón late 100.000 veces al día. En el gym le pides que se acelere. Eso es tortura. Sigue así.',
  'El dolor muscular de 24-48h se llama DOMS. Tu cuerpo dice "gracias". O "para ya". Depende del contexto.',
  'Escuchar música aumenta el rendimiento un 15%. ¿Qué escuchas tú? No me lo digas, no quiero saber.',
  'La fuerza máxima se desarrolla entre los 25 y 35 años. ¿Ya los superaste? Más razón para no perder lo que tienes.',
  'Los músculos tienen memoria. El tuyo probablemente recuerda aquella época en que entrenabas más.',
  'Dato: el ser humano tardó 4 millones de años en bipedarse. Lleva ese legado al press de banca.',
  'La proteína de una lata de atún equivale a unos 25g. Come, levanta, duerme. Repite.',
  'Un estudio dice que mirarse al espejo mientras entrenas mejora la técnica. O simplemente te gusta mirarte. Los dos son válidos.',
];

function _coachPhrases(s){
  const total=s.total||0,racha=s.racha||0,semana=s.ultimasSemana||0;
  const horas=Math.floor((s.totalMinutos||0)/60);
  const u=JSON.parse(localStorage.getItem('gymy_user')||'{}');
  const n=u.username||'campeón';
  const ph=[..._COACH_GENERIC];
  if(racha===0&&total>0)  ph.push(`¿Sin racha, ${n}? Mi abuela tiene mejor ritmo y va con andador.`);
  if(racha===0&&total===0)ph.push(`Cero sesiones, cero racha. El sofá te ha ganado sin pelear. Deplorable.`);
  if(racha===1)           ph.push(`Un día de racha. Una palmadita en la espalda... con una chancla.`);
  if(racha>=2&&racha<5)   ph.push(`${racha} días seguidos. Eso está bien. Para ser principiante.`);
  if(racha>=5&&racha<7)   ph.push(`${racha} días de racha. Casi pareces un atleta. Casi.`);
  if(racha>=7&&racha<14)  ph.push(`¡${racha} días de racha! Esto ya empieza a parecerse a disciplina de verdad.`);
  if(racha>=14&&racha<30) ph.push(`${racha} días seguidos. O tienes fuerza de voluntad o no tienes vida social. De cualquier modo: bien.`);
  if(racha>=30)           ph.push(`${racha} días de racha. ¿Tienes amigos? No importa, estoy orgullosa de ti.`);
  if(total===0)           ph.push(`Sin sesiones. La barra olímpica lleva tu nombre grabado... y tiene polvo.`);
  if(total>=1&&total<5)   ph.push(`Solo ${total} sesión(es). El gimnasio aún te da miedo, ¿verdad? Normal.`);
  if(total>=10&&total<30) ph.push(`${total} sesiones. Ya no eres un recién llegado. Todavía no eres impresionante, pero algo es algo.`);
  if(total>=30&&total<60) ph.push(`${total} sesiones acumuladas. El hierro ya reconoce tu olor.`);
  if(total>=60&&total<100)ph.push(`${total} sesiones. Dedicación. O adicción. En el gimnasio las dos son válidas.`);
  if(total>=100)          ph.push(`${total} sesiones, ${n}. ¿Sabes cuántas personas llegan aquí? Muy pocas. Bien hecho.`);
  if(total>=200)          ph.push(`${total} sesiones. Eso ya no es un hobby, es un estilo de vida.`);
  if(semana===0&&total>0) ph.push(`Cero sesiones esta semana, ${n}. Mis plantas tienen más actividad física que tú.`);
  if(semana===1)          ph.push(`Una sesión esta semana. Honestamente esperaba menos. Sorpresa agradable.`);
  if(semana===2)          ph.push(`Dos sesiones esta semana. Ni para quejarse ni para presumir.`);
  if(semana>=3&&semana<5) ph.push(`${semana} sesiones esta semana. ¿Ves cómo cuando quieres puedes?`);
  if(semana>=5)           ph.push(`${semana} sesiones esta semana. ¿Cuándo duermes? ¿Tienes amigos?`);
  if(horas<5&&total>3)    ph.push(`${horas}h de entrenamiento total. Un capítulo de Netflix dura más que tu historial completo.`);
  if(horas>=10&&horas<50) ph.push(`${horas}h acumuladas. Los resultados no se ven en el espejo todavía, pero van llegando.`);
  if(horas>=50&&horas<100)ph.push(`${horas}h sudando. Más de dos días de tu vida entregados al hierro. Me alegra.`);
  if(horas>=100)          ph.push(`${horas}h de entreno. Podrías haber aprendido chino. Elegiste el hierro. Buena decisión.`);

  // ── Frases con datos reales de ejercicios ──
  const top=s.mejorEjercicio||[];
  if(top.length>0){
    const t=top[0];
    ph.push(`Tu mejor marca registrada: ${t.nombre} con ${t.max_peso}kg. Impresionante para ser mortal.`);
    if(t.veces>=15) ph.push(`Llevas ${t.veces} veces haciendo ${t.nombre}. ¿Sabes que existen otros ejercicios, verdad?`);
    if(top.length>=3) ph.push(`${top[0].nombre}, ${top[1].nombre}, ${top[2].nombre}... tus ejercicios favoritos. Qué predecible eres.`);
  }
  if(top.length===0&&total>5) ph.push(`Sin marcas de peso registradas. Entrenar sin datos es como cocinar sin receta: caos puro.`);

  // ── Frases con calorías ──
  const kcal=s.totalCalorias||0;
  if(kcal>10000) ph.push(`${kcal.toLocaleString()} kcal quemadas en total. Estadísticamente podrías haberte comido ${Math.round(kcal/250)} hamburguesas. No lo hagas.`);
  if(kcal>2000&&kcal<=10000) ph.push(`${kcal.toLocaleString()} kcal sudadas. Cada una de ellas me enorgullece. Solo un poco.`);
  if(kcal>0&&kcal<500&&total>2) ph.push(`${kcal} kcal en total. Mi cafetera gasta más energía que tú. Sube la intensidad.`);

  // ── Frases con valoración media ──
  const val=s.mediaValoracion||0;
  if(val>=4.5&&total>3) ph.push(`Te pones ${val}/5 de media a tus sesiones. O te encantan... o eres muy generoso contigo mismo. De los dos me alegro.`);
  if(val>0&&val<=2.5&&total>3) ph.push(`${val}/5 de valoración media. Tus sesiones no te convencen. Cámbialo o cállate. Sasha dixit.`);
  if(val>=3&&val<4&&total>5) ph.push(`${val}/5 de media. Aceptable. El objetivo es no conformarse con el aprobado.`);

  // ── Frases con días desde última sesión ──
  if(s.recientes&&s.recientes.length>0){
    const last=s.recientes[0];
    const diasDesde=Math.round((Date.now()-new Date(last.fecha).getTime())/86400000);
    if(diasDesde===0) ph.push(`Entrenaste hoy. Eso merece reconocimiento. Un aplauso. Solo uno, no te emociones.`);
    if(diasDesde===1) ph.push(`Ayer entrenaste ${last.tipo||''}. Hoy puedes. El músculo ya ha descansado suficiente.`);
    if(diasDesde>=3&&diasDesde<=6) ph.push(`Llevas ${diasDesde} días sin pasar por aquí. El gimnasio pregunta por ti. Con cierta preocupación.`);
    if(diasDesde>=7&&diasDesde<14) ph.push(`Una semana sin entrenar, ${n}. Las plantas de mi oficina tienen más actividad que tú últimamente.`);
    if(diasDesde>=14) ph.push(`${diasDesde} días sin entrenar. Oficialmente en modo hibernación. Sal de ahí.`);
  }

  // ── Frases con tendencia semanal (progreso) ──
  const prog=s.progreso||[];
  if(prog.length>=3){
    const ultimas=prog.slice(-3).map(p=>parseInt(p.sesiones)||0);
    const tendencia=ultimas[2]-ultimas[0];
    if(tendencia>1) ph.push(`Tendencia alcista: ${ultimas[0]}→${ultimas[1]}→${ultimas[2]} sesiones en las últimas semanas. Esto empieza a parecer hábito.`);
    if(tendencia<-1&&ultimas[2]<ultimas[0]) ph.push(`Bajando el ritmo: ${ultimas[0]}→${ultimas[1]}→${ultimas[2]} sesiones estas semanas. El sofá no es tu entrenador.`);
    if(tendencia===0&&ultimas[2]>0) ph.push(`Consistencia total: mismo número de sesiones semana tras semana. Aburrido pero efectivo.`);
  }

  return ph;
}

function updateCoach(s){_coachStats=s;_coachIdx=-1;refreshCoach();}
function refreshCoach(){
  const phrases=_coachStats?_coachPhrases(_coachStats):[..._COACH_GENERIC];
  let idx;
  do{idx=Math.floor(Math.random()*phrases.length);}while(phrases.length>1&&idx===_coachIdx);
  _coachIdx=idx;
  const el=document.getElementById('coach-phrase');
  if(!el)return;
  el.style.opacity='0';
  setTimeout(()=>{el.textContent=phrases[idx];el.style.opacity='1';},160);
}

// ── Long-press → Plan de entrenamiento IA ──
let _coachLpTimer=null,_coachLpX=0,_coachLpY=0;
function _coachLpStart(e){
  if(e.button!=null&&e.button!==0)return;
  if(e.touches){_coachLpX=e.touches[0].clientX;_coachLpY=e.touches[0].clientY;}
  const card=document.getElementById('coach-card');
  _coachLpTimer=setTimeout(()=>{
    _coachLpTimer=null;
    card.classList.remove('pressing');
    coachPlan();
  },700);
  card.classList.add('pressing');
}
function _coachLpMove(e){
  if(!_coachLpTimer||!e.touches)return;
  const dx=e.touches[0].clientX-_coachLpX,dy=e.touches[0].clientY-_coachLpY;
  if(Math.sqrt(dx*dx+dy*dy)>10)_coachLpCancel(); // umbral 10px
}
function _coachLpEnd(e){_coachLpCancel();}
function _coachLpCancel(){
  if(_coachLpTimer){clearTimeout(_coachLpTimer);_coachLpTimer=null;}
  document.getElementById('coach-card')?.classList.remove('pressing');
}

const COACH_PLAN_TTL=12*60*60*1000; // 12h

async function _fetchAllHistory(){
  try{
    const{data}=await getSesiones({limit:1000});
    if(!data.ok)return null;
    const sesiones=data.sesiones||[];
    // Estimar duración y calorías para sesiones sin datos guardados
    let _pw=70;try{const _pd=JSON.parse(localStorage.getItem(_uk('profile_data'))||'{}');_pw=parseFloat(_pd.peso_corporal)||70;}catch(e){}
    sesiones.forEach(s=>{
      if(!s.duracion_min&&(s.ejercicios||[]).length>0)
        s._durEst=Math.min(180,Math.max(15,5+(s.ejercicios||[]).reduce((a,e)=>a+(e.series||1)*3+1,0)));
      if(!s.calorias&&(s.duracion_min||s._durEst))
        s._calEst=Math.round(5*_pw*((s.duracion_min||s._durEst)/60));
    });
    // Por tipo
    const byTipo={};
    sesiones.forEach(s=>{
      const t=s.tipo||'Sin tipo';
      if(!byTipo[t])byTipo[t]={count:0,minutos:0,calorias:0};
      byTipo[t].count++;
      byTipo[t].minutos+=s.duracion_min||s._durEst||0;
      byTipo[t].calorias+=s.calorias||s._calEst||0;
    });
    // Por mes (últimos 12)
    const byMonth={};
    sesiones.forEach(s=>{
      const m=(s.fecha||'').slice(0,7);
      if(!m)return;
      if(!byMonth[m])byMonth[m]={count:0,minutos:0,calorias:0};
      byMonth[m].count++;
      byMonth[m].minutos+=s.duracion_min||s._durEst||0;
      byMonth[m].calorias+=s.calorias||s._calEst||0;
    });
    // Frecuencia de ejercicios en todo el historial
    const ejFreq={};
    sesiones.forEach(s=>{
      (s.ejercicios||[]).forEach(e=>{
        const n=(e.nombre||'').toLowerCase().trim();
        if(!n)return;
        if(!ejFreq[n])ejFreq[n]={nombre:e.nombre,count:0,maxKg:0};
        ejFreq[n].count++;
        if((e.peso_kg||0)>ejFreq[n].maxKg)ejFreq[n].maxKg=e.peso_kg||0;
      });
    });
    const topEj=Object.values(ejFreq).sort((a,b)=>b.count-a.count).slice(0,15);
    const monthsSorted=Object.entries(byMonth).sort(([a],[b])=>a.localeCompare(b)).slice(-12);
    return{
      byTipo,monthsSorted,topEj,
      primera:sesiones[sesiones.length-1]?.fecha?.slice(0,10),
      ultima:sesiones[0]?.fecha?.slice(0,10),
    };
  }catch(e){return null;}
}

function _coachCtxStr(s,nombre,hist){
  if(!s)return'Sin historial disponible aún.';
  const horas=Math.floor((s.totalMinutos||0)/60);
  const top=(s.mejorEjercicio||[]).slice(0,8);
  const prog=s.progreso||[];

  // Perfil físico
  let perfil='';
  try{
    const pd=JSON.parse(localStorage.getItem(_uk('profile_data'))||'{}');
    const parts=[];
    if(pd.peso_corporal)parts.push(`peso: ${pd.peso_corporal}kg`);
    if(pd.edad)parts.push(`edad: ${pd.edad} años`);
    if(pd.genero)parts.push(`género: ${pd.genero}`);
    if(parts.length)perfil='\n- Perfil físico: '+parts.join(', ');
  }catch(e){}

  // Últimas 5 sesiones (con estimación si falta duracion_min o calorias)
  let _pw2=70;try{const _pd=JSON.parse(localStorage.getItem(_uk('profile_data'))||'{}');_pw2=parseFloat(_pd.peso_corporal)||70;}catch(e){}
  const recDetail=(s.recientes||[]).slice(0,5).map(r=>{
    const ejArr=r.ejercicios||[];
    const durReal=r.duracion_min;
    const durEst=!durReal&&ejArr.length>0?Math.min(180,Math.max(15,5+ejArr.reduce((a,e)=>a+(e.series||1)*3+1,0))):0;
    const durMin=durReal||durEst;
    const calReal=r.calorias;
    const calEst=!calReal&&durMin?Math.round(5*_pw2*(durMin/60)):0;
    const dur=durReal?durReal+' min':durEst?'~'+durEst+' min':'—';
    const cal=calReal?calReal+' kcal':calEst?'~'+calEst+' kcal':'—';
    const ejs=ejArr.slice(0,5).map(e=>e.nombre).join(', ')||'—';
    return`  ${(r.fecha||'').slice(0,10)} | ${r.tipo||'?'} | ${dur} | ${cal} | val:${r.valoracion||'—'} | ${ejs}`;
  }).join('\n')||'  sin datos';

  // Progresión semanal
  const progDetail=prog.slice(-8).map(p=>
    `  ${p.semana}: ${p.sesiones} sesiones, ${p.minutos||0} min, ${p.calorias||0} kcal`
  ).join('\n')||'  sin datos';

  let extra='';
  if(hist){
    // Desglose por tipo (todo el historial)
    const tipoLines=Object.entries(hist.byTipo)
      .sort(([,a],[,b])=>b.count-a.count)
      .map(([t,v])=>`  ${t}: ${v.count} sesiones, ${v.minutos} min, ${v.calorias} kcal`)
      .join('\n');
    // Desglose mensual
    const mesLines=hist.monthsSorted.map(([m,v])=>
      `  ${m}: ${v.count} sesiones, ${v.minutos} min, ${v.calorias} kcal`
    ).join('\n')||'  sin datos';
    // Ejercicios más frecuentes de todo el historial
    const ejLines=hist.topEj.map(e=>
      `  ${e.nombre}: ${e.count}x${e.maxKg>0?', máx '+e.maxKg+'kg':''}`
    ).join('\n')||'  sin datos';

    extra=`
- Historial completo desde: ${hist.primera||'?'} hasta: ${hist.ultima||'?'}
- Desglose por tipo de sesión (total historial):
${tipoLines}
- Evolución mensual (últimos 12 meses):
${mesLines}
- Ejercicios más frecuentes en todo el historial:
${ejLines}`;
  }

  return`- Nombre: ${nombre}
- Sesiones totales: ${s.total}
- Tiempo total acumulado: ${horas}h (${s.totalMinutos||0} min)
- Racha actual: ${s.racha} días
- Sesiones esta semana: ${s.ultimasSemana}
- Calorías totales registradas: ${s.totalCalorias||0} kcal
- Valoración media: ${s.mediaValoracion||'—'}/5${perfil}
- Ejercicios con mayor marca de peso: ${top.length?top.map(e=>`${e.nombre} (${e.max_peso}kg, ${e.veces}x)`).join(' | '):'sin datos'}
- Últimas 5 sesiones (fecha|tipo|duración|calorías|valoración|ejercicios):
${recDetail}
- Progresión últimas 8 semanas (semana|sesiones|minutos|calorías):
${progDetail}${extra}`;
}

async function coachPlan(forzar){
  const _titleEl=document.getElementById('coach-plan-title');
  if(_titleEl)_titleEl.textContent='🏋️‍♀️ Plan de Sasha';
  openModal('modal-coach-plan');
  const body=document.getElementById('coach-plan-body');

  // Mostrar plan cacheado si existe y es reciente
  if(!forzar){
    try{
      const cached=JSON.parse(localStorage.getItem('gymy_coach_plan')||'null');
      if(cached&&cached.text&&(Date.now()-cached.ts)<COACH_PLAN_TTL){
        _coachPlanShow(body,cached.text,true);
        return;
      }
    }catch(e){}
  }

  body.innerHTML='<div style="text-align:center;padding:36px 16px;color:var(--text2)">'
    +'<div style="font-size:36px;margin-bottom:12px">🤔</div>'
    +'<div style="font-size:13px">Sasha está analizando tu historial...</div></div>';

  const s=_coachStats;
  const u=JSON.parse(localStorage.getItem('gymy_user')||'{}');
  const nombre=u.username||'el usuario';
  const hist=await _fetchAllHistory();
  const ctx=_coachCtxStr(s,nombre,hist);

  const prompt=`Eres Coach Sasha, entrenadora personal con tono directo, irónico y genuinamente motivador.
Analiza los datos del usuario y crea un plan de entrenamiento personalizado para la próxima semana.

DATOS DEL USUARIO:
${ctx}

INSTRUCCIONES:
- Crea un plan de 3 a 5 días de entrenamiento semanal
- Para cada día: nombre del día, tipo de sesión, lista de 4 a 6 ejercicios con series×repeticiones y peso orientativo
- Adapta la intensidad y los ejercicios al nivel real que muestran sus datos
- Añade 1 o 2 comentarios de Sasha con su tono habitual (irónico pero que quiere que mejores)
- Usa texto plano con saltos de línea y emojis, sin markdown pesado (sin **, sin #)
- Sé concisa: el plan completo debe caber en una pantalla de móvil`;

  try{
    const{data}=await apiCall('POST','/ai/import',{prompt});
    if(!data.ok) throw new Error(data.error||'Error de IA');
    try{localStorage.setItem('gymy_coach_plan',JSON.stringify({text:data.text,ts:Date.now()}));}catch(e){}
    _coachPlanShow(body,data.text,false);
  }catch(err){
    body.innerHTML='<div style="text-align:center;padding:20px 16px">'
      +'<div style="font-size:32px;margin-bottom:10px">⚠️</div>'
      +'<div style="color:var(--danger);font-size:13px;font-weight:600;margin-bottom:8px">Error al generar el plan</div>'
      +'<div style="color:var(--text2);font-size:12px;background:var(--bg2);border-radius:8px;padding:10px 12px;text-align:left;word-break:break-word">'+err.message+'</div>'
      +'<div style="color:var(--text2);font-size:11px;margin-top:10px;opacity:.6">Revisa los logs de Railway para más detalle</div>'
      +'</div>';
  }
}

const COACH_ANALISIS_TTL=6*60*60*1000;
async function coachAnalisis(forzar){
  openModal('modal-coach-plan');
  document.getElementById('coach-plan-title').textContent='🔬 Análisis Científico';
  const body=document.getElementById('coach-plan-body');

  if(!forzar){
    try{
      const cached=JSON.parse(localStorage.getItem(_uk('coach_analisis'))||'null');
      if(cached&&cached.text&&(Date.now()-cached.ts)<COACH_ANALISIS_TTL){
        _coachAnalisisShow(body,cached.text,true);return;
      }
    }catch(e){}
  }

  body.innerHTML=
    '<div style="padding:32px 20px 28px">'
    +'<div style="text-align:center;margin-bottom:22px">'
    +'<div style="font-size:36px;margin-bottom:12px">🔬</div>'
    +'<div id="_ap_label" style="font-size:13px;font-weight:600;color:var(--text);margin-bottom:4px">Preparando análisis...</div>'
    +'<div id="_ap_sub" style="font-size:11px;color:var(--text2)">Paso 1 de 3</div>'
    +'</div>'
    +'<div style="background:var(--bg3);border-radius:99px;height:8px;overflow:hidden;box-shadow:inset 0 1px 3px rgba(0,0,0,.15)">'
    +'<div id="_ap_bar" style="height:100%;border-radius:99px;background:var(--accent);width:4%;transition:width .5s cubic-bezier(.4,0,.2,1)"></div>'
    +'</div>'
    +'<div style="display:flex;justify-content:space-between;margin-top:6px">'
    +'<div style="font-size:10px;color:var(--text2);opacity:.5">0%</div>'
    +'<div id="_ap_pct" style="font-size:10px;color:var(--accent);font-weight:700">4%</div>'
    +'</div>'
    +'</div>';

  await new Promise(r=>requestAnimationFrame(r));
  await new Promise(r=>requestAnimationFrame(r));

  function _apSet(pct,label,sub){
    const bar=document.getElementById('_ap_bar');
    const lbl=document.getElementById('_ap_label');
    const slbl=document.getElementById('_ap_sub');
    const pctEl=document.getElementById('_ap_pct');
    if(bar)bar.style.width=pct+'%';
    if(lbl&&label)lbl.textContent=label;
    if(slbl&&sub!==undefined)slbl.textContent=sub;
    if(pctEl)pctEl.textContent=pct+'%';
  }

  let _apTimer=null;
  function _apAnimate(from,to,ms){
    if(_apTimer)clearInterval(_apTimer);
    const steps=30,inc=(to-from)/steps,interval=ms/steps;
    let cur=from;
    _apTimer=setInterval(()=>{
      cur=Math.min(cur+inc,to);
      const bar=document.getElementById('_ap_bar');
      const pctEl=document.getElementById('_ap_pct');
      if(bar)bar.style.width=Math.round(cur)+'%';
      if(pctEl)pctEl.textContent=Math.round(cur)+'%';
      if(cur>=to)clearInterval(_apTimer);
    },interval);
  }

  const s=_coachStats;
  if(!s||!s.total){
    body.innerHTML='<div style="text-align:center;padding:24px 16px;color:var(--text2)"><div style="font-size:32px;margin-bottom:10px">📭</div><div style="font-size:13px">Necesitas registrar sesiones para el análisis</div></div>';
    return;
  }

  const u=JSON.parse(localStorage.getItem('gymy_user')||'{}');
  const nombre=u.username||'atleta';
  const horas=Math.floor((s.totalMinutos||0)/60);
  const mins=(s.totalMinutos||0)%60;
  const mejorEj=s.mejorEjercicio||[];

  _apSet(10,'Conectando con la base de datos...','Paso 1 de 3');

  let fs={mensual:[],porTipo:[],porDia:[],topEjercicios:[],porGrupo:[],primeraFecha:null};
  try{
    _apAnimate(10,45,800);
    const{data}=await apiCall('GET','/sesiones/fullstats');
    if(data.ok)fs=data;
  }catch(e){}
  _apSet(45,'Calculando métricas del historial...','Paso 2 de 3');

  const meses=fs.mensual.slice().reverse();
  const mesesActivos=meses.filter(m=>parseInt(m.sesiones)>0);
  const totalMesesConDatos=mesesActivos.length||1;
  const avgMensual=(mesesActivos.reduce((a,m)=>a+parseInt(m.sesiones),0)/totalMesesConDatos).toFixed(1);
  const avgDurMes=meses.filter(m=>parseInt(m.minutos)>0).reduce((a,m,_,arr)=>a+parseInt(m.minutos)/Math.max(parseInt(m.sesiones),1)/arr.length,0);

  const ult3=fs.mensual.slice(0,3).reduce((a,m)=>a+parseInt(m.sesiones),0);
  const prev3=fs.mensual.slice(3,6).reduce((a,m)=>a+parseInt(m.sesiones),0);
  const tendencia=prev3===0?'período inicial'
    :ult3>prev3+1?'CRECIENTE (+'+Math.round((ult3-prev3)/Math.max(prev3,1)*100)+'% vs trimestre anterior)'
    :ult3<prev3-1?'DECRECIENTE (-'+Math.round((prev3-ult3)/Math.max(prev3,1)*100)+'% vs trimestre anterior)'
    :'ESTABLE';

  const primerMes=fs.primeraFecha?fs.primeraFecha.slice(0,7):null;
  const hoy=new Date().toISOString().slice(0,7);
  let mesesTotalesHistorial=1;
  if(primerMes){
    const [ay,am]=primerMes.split('-').map(Number);
    const [by,bm]=hoy.split('-').map(Number);
    mesesTotalesHistorial=Math.max(1,(by-ay)*12+(bm-am)+1);
  }
  const consistencia=Math.round(mesesActivos.length/mesesTotalesHistorial*100);

  const mejorMes=mesesActivos.reduce((a,m)=>parseInt(m.sesiones)>parseInt(a.sesiones)?m:a,mesesActivos[0]||{});
  const peorMes=mesesActivos.reduce((a,m)=>parseInt(m.sesiones)<parseInt(a.sesiones)?m:a,mesesActivos[0]||{});

  const DIAS_ES=['Dom','Lun','Mar','Mié','Jue','Vie','Sáb'];
  const diaTop=fs.porDia.length?fs.porDia.reduce((a,d)=>parseInt(d.n)>parseInt(a.n)?d:a,fs.porDia[0]):null;

  const grupoResumen=fs.porGrupo.slice(0,8).map(g=>`${g.grupo_muscular}(${g.total_series}s,${g.sesiones_presentes}ses)`).join(' · ')||'sin datos';

  const _DUR_EST={Fuerza:60,Cardio:45,HIIT:35,Yoga:50,Pilates:50,
    Pecho:55,Espalda:55,Piernas:65,Hombros:50,Brazos:45,Core:40,Otro:55};
  const _KCAL_MIN={Fuerza:6,Cardio:9,HIIT:11,Yoga:4,Pilates:5,
    Pecho:6,Espalda:6,Piernas:7,Hombros:6,Brazos:5,Core:6,Otro:6.5};

  let _minEst=0,_kcalEst=0;
  fs.porTipo.forEach(t=>{
    const n=parseInt(t.n),durR=parseFloat(t.avg_min)||0,kcalR=parseFloat(t.avg_kcal)||0;
    const durE=_DUR_EST[t.tipo]||55,kcalE=(_KCAL_MIN[t.tipo]||6.5);
    if(!durR)_minEst+=n*durE;
    if(!kcalR)_kcalEst+=n*(durR||durE)*kcalE;
  });
  const totalMinReal=s.totalMinutos||0;
  const totalKcalReal=s.totalCalorias||0;
  const totalMinComb=totalMinReal+_minEst;
  const totalKcalComb=totalKcalReal+Math.round(_kcalEst);
  const hayEstDur=_minEst>0,hayEstKcal=_kcalEst>0;
  const horasT=Math.floor(totalMinComb/60),minsT=Math.round(totalMinComb%60);
  const avgMinSesion=s.total>0?Math.round(totalMinComb/s.total):0;
  const avgKcalSesion=s.total>0?Math.round(totalKcalComb/s.total):0;

  const tiposCompleto=fs.porTipo.map(t=>{
    const durR=parseFloat(t.avg_min)||0,kcalR=parseFloat(t.avg_kcal)||0;
    const durE=_DUR_EST[t.tipo]||55,kcalE=(_KCAL_MIN[t.tipo]||6.5)*(durR||durE);
    const durStr=durR>0?`${t.avg_min}min`:`~${durE}min`;
    const kcalStr=kcalR>0?`${t.avg_kcal}kcal`:`~${Math.round(kcalE)}kcal`;
    const nota=(!durR||!kcalR)?'(est)':'';
    return `${t.tipo}: ${t.n}ses(${t.pct}%) ${durStr}/ses ${kcalStr}/ses${nota}`;
  }).join('\n')||'—';

  const eficienciaKcal=fs.porTipo.map(t=>{
    const durR=parseFloat(t.avg_min)||0,kcalR=parseFloat(t.avg_kcal)||0;
    const dur=durR||((_DUR_EST[t.tipo])||55);
    const kcal=kcalR||Math.round((_KCAL_MIN[t.tipo]||6.5)*dur);
    return `${t.tipo}: ${(kcal/dur).toFixed(1)}kcal/min${(!durR||!kcalR)?'(est)':''}`;
  }).join(' · ')||'—';

  const avgKcalMes=mesesActivos.length?Math.round(totalKcalComb/mesesActivos.length):0;
  const avgMinMes=mesesActivos.length?Math.round(totalMinComb/mesesActivos.length):0;

  const topFreq=fs.topEjercicios.slice(0,12).map(e=>{
    const carga=e.max_peso>0?` ${e.avg_peso}kg avg/${e.max_peso}kg max`:'';
    return `${e.nombre}: ${e.veces}x${carga}`;
  }).join('\n')||'—';

  const topCarga=mejorEj.slice(0,8).map(e=>`${e.nombre}: ${e.max_peso}kg max, ${e.veces}x`).join('\n')||'—';

  const evolucionMensual=meses.slice(-12).map(m=>
    `${m.mes}: ${m.sesiones}ses ${m.minutos}min ${m.val_media>0?'★'+m.val_media:''}`
  ).join(' | ')||'—';

  const ctx=`ATLETA: ${nombre}
HISTORIAL COMPLETO: desde ${fs.primeraFecha||'desconocido'} hasta hoy (${mesesTotalesHistorial} meses)

── MÉTRICAS GLOBALES (historial completo) ──
· Sesiones totales: ${s.total}
· Horas totales entrenadas: ${horasT}h ${minsT}min${hayEstDur?' (est. parcial)':''}
· Calorías totales quemadas: ${totalKcalComb} kcal${hayEstKcal?' (est. parcial)':''}
· Valoración media global: ${s.mediaValoracion||0}/5
· Racha actual: ${s.racha} días consecutivos
· Consistencia mensual histórica: ${consistencia}% (${mesesActivos.length}/${mesesTotalesHistorial} meses activos)
· Media sesiones/mes: ${avgMensual}
· Tendencia actual: ${tendencia}
· Mejor mes: ${mejorMes.mes||'—'} (${mejorMes.sesiones||0} sesiones)
· Peor mes: ${peorMes.mes||'—'} (${peorMes.sesiones||0} sesiones)
· Día favorito de entrenamiento: ${diaTop?`${DIAS_ES[parseInt(diaTop.dow)%7]}(${diaTop.n}x)`:'—'}

── TIEMPO DE ENTRENAMIENTO${hayEstDur?' (reales + estimados)':''} ──
· Horas totales: ${horasT}h ${minsT}min${hayEstDur?' ('+Math.floor(_minEst/60)+'h estimadas para ses. sin registro)':''}
· Duración media por sesión: ${avgMinSesion} min/sesión${hayEstDur?' (est)':''}
· Minutos medios por mes: ${avgMinMes} min/mes
· Horas medias mensuales: ${Math.round(avgMinMes/60*10)/10} h/mes

── CALORÍAS${hayEstKcal?' (reales + estimados)':''} ──
· Calorías totales: ${totalKcalComb} kcal${hayEstKcal?' ('+Math.round(_kcalEst)+' estimadas para ses. sin registro)':''}
· Calorías medias por sesión: ${avgKcalSesion} kcal/sesión${hayEstKcal?' (est)':''}
· Calorías medias por mes: ${avgKcalMes} kcal/mes
· Eficiencia calórica por tipo: ${eficienciaKcal}

── TIPOS DE ENTRENAMIENTO con duración y calorías (histórico) ──
${tiposCompleto}

── DISTRIBUCIÓN MUSCULAR HISTÓRICA (series totales registradas) ──
${grupoResumen}

── TOP 12 EJERCICIOS POR FRECUENCIA ──
${topFreq}

── TOP 8 EJERCICIOS POR CARGA MÁXIMA ──
${topCarga}

── EVOLUCIÓN MENSUAL (últimos 12 meses) ──
${evolucionMensual}`;

  _apSet(60,'Sasha leyendo tu historial completo...','Paso 3 de 3 — puede tardar unos segundos');
  _apAnimate(60,92,8000);

  const prompt=`Eres Coach Sasha, doctora en ciencias del deporte y entrenadora de élite. Tono: científico, directo y con la ironía española que te caracteriza. Usa terminología real: RPE, RM, DOMS, mesociclo, deload, hipertrofia, etc.

Analiza el HISTORIAL COMPLETO de entrenamiento de este atleta. Tienes datos de TODOS sus entrenos desde el inicio. Aprovéchalo para identificar tendencias a largo plazo, no solo lo reciente.
NOTA: los valores marcados con "(est)" son estimaciones basadas en promedios científicos por tipo de sesión cuando el usuario no registró el dato real. Úsalos con normalidad en el análisis, mencionando brevemente que son estimaciones donde corresponda.

${ctx}

RESPONDE EXACTAMENTE con este formato (sin texto fuera de las etiquetas):

[PUNTUACION]
XX/100
Una frase diagnóstico de Sasha sobre el nivel global basada en el historial completo.
[/PUNTUACION]

[FORTALEZAS]
3-4 fortalezas concretas con datos numéricos del historial real. Menciona cifras específicas.
[/FORTALEZAS]

[DESEQUILIBRIOS]
2-3 desequilibrios o riesgos detectados en el largo plazo: grupos musculares descuidados históricamente, patrones de sobreuso, rachas de abandono, monotonía de estímulo.
[/DESEQUILIBRIOS]

[SOBRECARGA_PROGRESIVA]
¿Se observa progresión real de cargas a lo largo del tiempo? ¿El volumen y frecuencia son óptimos para el nivel del atleta? ¿Hay estancamiento? Usa los datos de ejercicios frecuentes.
[/SOBRECARGA_PROGRESIVA]

[RECUPERACION]
Analiza la periodización real en los datos mensuales: ¿hay deloads naturales? ¿sobreentrenamiento crónico? ¿subentreno? Correlaciona valoraciones con frecuencia. Analiza también el tiempo de sesión: ¿es adecuado para los objetivos? ¿tendencia a sesiones más largas o más cortas?
[/RECUPERACION]

[CALORIAS_TIEMPO]
Analiza la eficiencia calórica y el tiempo de entrenamiento: ¿son las calorías quemadas coherentes con el tipo y duración de las sesiones? ¿la eficiencia kcal/min es buena para el tipo de entreno? ¿hay margen para optimizar el gasto calórico? Incluye comparativa entre tipos de entrenamiento si hay datos.
[/CALORIAS_TIEMPO]

[PLAN_4_SEMANAS]
Plan de optimización basado en los déficits históricos reales:
FASE 1 (sem 1-2): correcciones prioritarias con ejercicios y volúmenes concretos.
FASE 2 (sem 3-4): progresión con nuevos estímulos.
[/PLAN_4_SEMANAS]

[METRICAS_CLAVE]
3 KPIs concretos con valores objetivo realistas para ESTE atleta basados en su historial.
[/METRICAS_CLAVE]`;

  try{
    const{data}=await apiCall('POST','/ai/import',{prompt});
    if(!data.ok)throw new Error(data.error||'Error de IA');
    if(_apTimer)clearInterval(_apTimer);
    _apSet(100,'¡Análisis completado!','');
    await new Promise(r=>setTimeout(r,300));
    try{localStorage.setItem(_uk('coach_analisis'),JSON.stringify({text:data.text,ts:Date.now(),stats:ctx}));}catch(e){}
    _coachAnalisisShow(body,data.text,false);
  }catch(err){
    if(_apTimer)clearInterval(_apTimer);
    body.innerHTML='<div style="text-align:center;padding:20px 16px">'
      +'<div style="font-size:32px;margin-bottom:10px">⚠️</div>'
      +'<div style="color:var(--danger);font-size:13px;font-weight:600;margin-bottom:8px">Error al analizar</div>'
      +'<div style="color:var(--text2);font-size:12px;background:var(--bg2);border-radius:8px;padding:10px 12px;text-align:left;word-break:break-word">'+err.message+'</div>'
      +'</div>';
  }
}

function _coachAnalisisShow(body,text,fromCache){
  function getSec(tag){
    const m=text.match(new RegExp('\\['+tag+'\\]([\\s\\S]*?)\\[/'+tag+'\\]'));
    return m?m[1].trim():null;
  }
  const puntuacion=getSec('PUNTUACION');
  const fortalezas=getSec('FORTALEZAS');
  const deseq=getSec('DESEQUILIBRIOS');
  const sobrecarga=getSec('SOBRECARGA_PROGRESIVA');
  const recuperacion=getSec('RECUPERACION');
  const calTiempo=getSec('CALORIAS_TIEMPO');
  const plan=getSec('PLAN_4_SEMANAS');
  const metricas=getSec('METRICAS_CLAVE');

  const sm=puntuacion?puntuacion.match(/(\d+)\/100/):null;
  const score=sm?parseInt(sm[1]):null;
  const scoreDiag=puntuacion?(puntuacion.replace(/\d+\/100\s*/,'').trim()):'';
  const scoreColor=score===null?'#888':score>=80?'#66bb6a':score>=60?'#ffa726':'#ef5350';

  let html='';
  if(fromCache){
    html+='<div style="font-size:11px;color:var(--text2);text-align:right;padding:8px 16px 0;opacity:.7">'
      +'Análisis guardado · <span style="color:var(--accent);cursor:pointer" onclick="coachAnalisis(true)">Regenerar</span></div>';
  }

  if(score!==null){
    html+='<div style="text-align:center;padding:18px 16px 10px">'
      +'<div style="display:inline-flex;align-items:center;justify-content:center;width:88px;height:88px;border-radius:50%;border:4px solid '+scoreColor+';background:var(--bg2);margin-bottom:10px">'
      +'<div><div style="font-size:28px;font-weight:900;color:'+scoreColor+';font-family:var(--font-b);line-height:1">'+score+'</div>'
      +'<div style="font-size:10px;color:var(--text2);margin-top:-1px">/100</div></div></div>'
      +(scoreDiag?'<div style="font-size:12px;color:var(--text2);max-width:280px;margin:0 auto;line-height:1.4;font-style:italic">"'+scoreDiag+'"</div>':'')
      +'</div>';
  }

  function sec(icon,title,content,accent){
    if(!content)return'';
    return'<div style="margin:0 12px 10px;background:var(--bg2);border-radius:12px;overflow:hidden;border:1px solid var(--border)">'
      +'<div style="display:flex;align-items:center;gap:8px;padding:9px 14px 7px;border-bottom:1px solid var(--border)">'
      +'<span style="font-size:15px">'+icon+'</span>'
      +'<span style="font-size:11px;font-weight:700;color:'+(accent||'var(--accent)')+';text-transform:uppercase;letter-spacing:.6px">'+title+'</span></div>'
      +'<div style="padding:10px 14px 12px;font-size:12px;color:var(--text);line-height:1.65;white-space:pre-wrap">'+content+'</div></div>';
  }

  html+=sec('💪','Fortalezas',fortalezas,'#66bb6a');
  html+=sec('⚠️','Desequilibrios detectados',deseq,'#ef5350');
  html+=sec('📈','Sobrecarga progresiva',sobrecarga,'#42a5f5');
  html+=sec('🔄','Recuperación y periodización',recuperacion,'#ab47bc');
  html+=sec('🔥','Calorías y tiempo de entrenamiento',calTiempo,'#ff7043');
  html+=sec('📋','Plan de optimización 4 semanas',plan,'#ffa726');
  html+=sec('🎯','Métricas clave a trackear',metricas,'#26c6da');

  if(!fortalezas&&!plan){
    html+='<div style="padding:12px 16px;font-size:12px;color:var(--text);line-height:1.65;white-space:pre-wrap">'+text+'</div>';
  }

  html+='<div style="padding:10px 12px 16px;display:flex;gap:8px">'
    +'<button onclick="coachAnalisis(true)" style="flex:1;padding:10px 4px;background:var(--bg3);color:var(--text2);border:1px solid var(--border);border-radius:10px;font-size:12px;font-weight:600;cursor:pointer">🔄 Regenerar</button>'
    +'<button onclick="_descargarAnalisisWord()" style="flex:1.6;padding:10px 4px;background:var(--accent);color:#fff;border:none;border-radius:10px;font-size:12px;font-weight:700;cursor:pointer">📄 Descargar Word</button>'
    +'</div>';

  body.innerHTML=html;
}

function _descargarAnalisisWord(){
  const cached=JSON.parse(localStorage.getItem(_uk('coach_analisis'))||'null');
  if(!cached||!cached.text){showToast('No hay análisis guardado','error');return;}
  const text=cached.text;
  const u=JSON.parse(localStorage.getItem('gymy_user')||'{}');
  const fecha=new Date().toLocaleDateString('es-ES',{day:'2-digit',month:'long',year:'numeric'});
  const s=_coachStats;

  function getSec(tag){
    const m=text.match(new RegExp('\\['+tag+'\\]([\\s\\S]*?)\\[/'+tag+'\\]'));
    return m?m[1].trim().replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/\n/g,'<br>'):'—';
  }
  const sm=text.match(/(\d+)\/100/);
  const score=sm?sm[1]:'—';
  const scoreColor=sm?(parseInt(sm[1])>=80?'#388E3C':parseInt(sm[1])>=60?'#F57C00':'#C62828'):'#555';
  const horas=Math.floor((s?.totalMinutos||0)/60);

  const statsTable=s?`<table style="width:100%;border-collapse:collapse;margin:10pt 0 16pt;font-size:10pt">
    <tr style="background:#E3F2FD"><th colspan="4" style="padding:6pt 8pt;text-align:left;color:#0D47A1;font-size:11pt">📊 Estadísticas del atleta</th></tr>
    <tr><td style="padding:5pt 8pt;border:1px solid #ccc;width:25%"><b>Sesiones totales</b></td><td style="padding:5pt 8pt;border:1px solid #ccc">${s.total}</td>
        <td style="padding:5pt 8pt;border:1px solid #ccc;width:25%"><b>Horas entrenadas</b></td><td style="padding:5pt 8pt;border:1px solid #ccc">${horas}h</td></tr>
    <tr style="background:#f9f9f9"><td style="padding:5pt 8pt;border:1px solid #ccc"><b>Calorías totales</b></td><td style="padding:5pt 8pt;border:1px solid #ccc">${s.totalCalorias||0} kcal</td>
        <td style="padding:5pt 8pt;border:1px solid #ccc"><b>Valoración media</b></td><td style="padding:5pt 8pt;border:1px solid #ccc">${s.mediaValoracion||'—'}/5</td></tr>
    <tr><td style="padding:5pt 8pt;border:1px solid #ccc"><b>Racha actual</b></td><td style="padding:5pt 8pt;border:1px solid #ccc">${s.racha} días</td>
        <td style="padding:5pt 8pt;border:1px solid #ccc"><b>Esta semana</b></td><td style="padding:5pt 8pt;border:1px solid #ccc">${s.ultimasSemana} sesiones</td></tr>
  </table>`:'';

  const secHtml=(icon,title,tag,color)=>`<h2 style="font-size:13pt;color:${color};margin-top:20pt;margin-bottom:4pt;border-left:4px solid ${color};padding-left:8pt">${icon} ${title}</h2><p style="margin:4pt 0 10pt;font-size:10.5pt;line-height:1.6">${getSec(tag)}</p>`;

  const wordHtml=`<html xmlns:o="urn:schemas-microsoft-com:office:office" xmlns:w="urn:schemas-microsoft-com:office:word" xmlns="http://www.w3.org/TR/REC-html40">
<head><meta charset="utf-8"><title>Análisis Científico Sasha</title>
<style>
  body{font-family:Calibri,Arial,sans-serif;max-width:720px;margin:0 auto;color:#222;font-size:11pt;line-height:1.5}
  h1{font-size:18pt;color:#1565C0;border-bottom:3px solid #1565C0;padding-bottom:6pt;margin-bottom:2pt}
  .meta{color:#666;font-size:9.5pt;margin-bottom:16pt}
  .score-box{text-align:center;margin:14pt 0;padding:16pt;background:#F5F5F5;border:2px solid ${scoreColor};border-radius:6pt}
  .score-num{font-size:44pt;font-weight:bold;color:${scoreColor};line-height:1}
  .score-label{font-size:10pt;color:#555}
  .diag{font-style:italic;color:#333;font-size:11pt;margin-top:6pt}
  .footer{margin-top:28pt;font-size:9pt;color:#888;border-top:1px solid #ccc;padding-top:8pt;text-align:center}
</style></head>
<body>
<h1>🔬 Análisis Científico de Entrenamiento</h1>
<div class="meta">Atleta: <strong>${u.username||'Usuario'}</strong> &nbsp;·&nbsp; Fecha de análisis: ${fecha} &nbsp;·&nbsp; Generado por Coach Sasha · GyMy</div>

${statsTable}

<div class="score-box">
  <div class="score-num">${score}<span style="font-size:22pt;color:#888">/100</span></div>
  <div class="diag">"${getSec('PUNTUACION').replace(/\d+\/100<br>/,'')}"</div>
</div>

${secHtml('💪','Fortalezas','FORTALEZAS','#2E7D32')}
${secHtml('⚠️','Desequilibrios Detectados','DESEQUILIBRIOS','#C62828')}
${secHtml('📈','Sobrecarga Progresiva','SOBRECARGA_PROGRESIVA','#1565C0')}
${secHtml('🔄','Recuperación y Periodización','RECUPERACION','#6A1B9A')}
${secHtml('🔥','Calorías y Tiempo de Entrenamiento','CALORIAS_TIEMPO','#BF360C')}
${secHtml('📋','Plan de Optimización — 4 Semanas','PLAN_4_SEMANAS','#E65100')}
${secHtml('🎯','Métricas Clave a Trackear','METRICAS_CLAVE','#00695C')}

<div class="footer">GyMy · Coach Sasha · https://gymy-production.up.railway.app · ${fecha}</div>
</body></html>`;

  const blob=new Blob(['\ufeff'+wordHtml],{type:'application/msword'});
  const url=URL.createObjectURL(blob);
  const a=document.createElement('a');
  a.href=url;
  a.download='analisis-sasha-'+(u.username||'atleta')+'-'+new Date().toISOString().split('T')[0]+'.doc';
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  setTimeout(()=>URL.revokeObjectURL(url),5000);
  showToast('📄 Descargando análisis...','ok');
}

function _coachPlanShow(body,text,fromCache,regenFn='coachPlan'){
  const div=document.createElement('div');
  div.className='coach-plan-text';
  div.textContent=text;
  body.innerHTML='';
  if(fromCache){
    const info=document.createElement('div');
    info.style.cssText='font-size:11px;color:var(--text2);text-align:right;margin-bottom:6px;opacity:.7';
    info.innerHTML='Plan guardado · <span style="color:var(--accent);cursor:pointer" onclick="coachPlan(true)">Regenerar</span>';
    body.appendChild(info);
  }
  body.appendChild(div);
}
