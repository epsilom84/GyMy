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
async function coachPlan(forzar){
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
  const top=(s?.mejorEjercicio||[]).slice(0,5);
  const ultTipos=(s?.recientes||[]).slice(0,5).map(r=>r.tipo).filter(Boolean);
  const horas=Math.floor((s?.totalMinutos||0)/60);

  const ctx=s
    ?`- Nombre: ${nombre}
- Sesiones totales: ${s.total}
- Horas de entreno acumuladas: ${horas}h
- Racha actual: ${s.racha} días
- Sesiones esta semana: ${s.ultimasSemana}
- Calorías quemadas en total: ${s.totalCalorias||0} kcal
- Valoración media de sesiones: ${s.mediaValoracion||'—'}/5
- Ejercicios con mayor marca de peso: ${top.length?top.map(e=>`${e.nombre} (${e.max_peso}kg, ${e.veces} veces)`).join(' | '):'sin datos'}
- Tipos de entrenamientos recientes: ${ultTipos.length?[...new Set(ultTipos)].join(', '):'sin datos'}`
    :'Sin historial disponible aún.';

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

function _coachPlanShow(body,text,fromCache){
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
