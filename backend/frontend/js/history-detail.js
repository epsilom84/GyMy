// ══════════════════════════════════════════════
// HISTORY-DETAIL.JS — Modal de detalle de sesión
// ══════════════════════════════════════════════

async function openDetalle(id){
  const{data}=await getSesion(id);if(!data.ok)return;
  const s=data.sesion;
  const _tipo=normTipo(s);
  document.getElementById('md-tipo').textContent=tipoIcon(_tipo)+' '+_tipo;
  // Estimar duración y calorías cuando no están guardadas
  const _ejs0=s.ejercicios||[];
  let _estDur=s.duracion_min;
  let _estCal=s.calorias;
  const _isEstDur=!_estDur&&_ejs0.length>0;
  const _isEstCal=!_estCal&&_ejs0.length>0;
  if(_isEstDur)_estDur=Math.min(180,Math.max(15,5+_ejs0.reduce((a,e)=>a+(e.series||1)*3+1,0)));
  if(_isEstCal&&_estDur){
    let _w=70;try{const _pd=JSON.parse(localStorage.getItem(_uk('profile_data'))||'{}');_w=parseFloat(_pd.peso_corporal)||70;}catch(e){}
    _estCal=Math.round(5*_w*(_estDur/60));
  }
  const _durStr=_estDur?(_isEstDur?'~':'')+_estDur+' min':'—';
  const _calStr=_estCal?(_isEstCal?'~':'')+_estCal+' kcal':'—';
  const _totalVol=_ejs0.reduce((a,e)=>a+(e.peso_kg||0)*(e.reps||1)*(e.series||1),0);
  let html='<div class="detail-grid" style="grid-template-columns:1fr 1fr">'
    +'<div class="detail-cell"><div class="detail-cell-label">Fecha</div><div class="detail-cell-val">'+formatFecha(s.fecha)+'</div></div>'
    +'<div class="detail-cell"><div class="detail-cell-label">Valoración</div><div class="detail-cell-val">'+(s.valoracion?'⭐'.repeat(s.valoracion):'—')+'</div></div>'
    +'<div class="detail-cell" style="background:linear-gradient(135deg,var(--bg3),color-mix(in srgb,var(--accent) 8%,var(--bg3)))"><div class="detail-cell-label">⏱ Tiempo</div><div class="detail-cell-val" style="color:var(--accent)">'+_durStr+'</div>'+(_isEstDur?'<div style="font-size:10px;color:var(--text2);margin-top:2px">estimado</div>':'')+'</div>'
    +'<div class="detail-cell" style="background:linear-gradient(135deg,var(--bg3),color-mix(in srgb,#ef5350 8%,var(--bg3)))"><div class="detail-cell-label">🔥 Calorías</div><div class="detail-cell-val" style="color:#ef5350">'+_calStr+'</div>'+(_isEstCal?'<div style="font-size:10px;color:var(--text2);margin-top:2px">estimado</div>':'')+'</div>'
    +'</div>'
    +(_totalVol>0?'<div style="display:flex;align-items:center;justify-content:space-between;padding:10px 14px;background:var(--bg3);border-radius:11px;margin-bottom:16px;font-size:13px"><span style="color:var(--text2)">Volumen total</span><span style="font-weight:700;color:var(--text)">'+(_totalVol>=1000?((_totalVol/1000).toFixed(1)+'t'):_totalVol.toLocaleString()+' kg')+'</span></div>':'');
  if(s.notas)html+='<div class="card" style="margin-bottom:14px"><div class="card-title">Notas</div><p style="font-size:14px;line-height:1.65">'+s.notas+'</p></div>';
  if(s.ejercicios?.length){
    // Agrupar filas por nombre (retrocompat: datos anteriores tienen 1 fila por serie)
    const ejIdx={};const ejOrd=[];
    s.ejercicios.forEach(e=>{
      const k=e.nombre.toLowerCase();
      if(!ejIdx[k]){ejIdx[k]={...e,_rows:[e]};ejOrd.push(k);}
      else{ejIdx[k]._rows.push(e);ejIdx[k].series=(ejIdx[k].series||0)+(e.series||1);ejIdx[k].reps=Math.max(ejIdx[k].reps||0,e.reps||0);ejIdx[k].peso_kg=Math.max(ejIdx[k].peso_kg||0,e.peso_kg||0);}
    });
    const ejList=ejOrd.map(k=>ejIdx[k]);
    html+='<div class="card-title" style="margin-bottom:8px">Ejercicios ('+ejList.length+')</div>';
    html+=ejList.map(e=>{
      let sets=null;
      const firstWithData=e._rows.find(r=>r.sets_data);
      if(firstWithData?.sets_data){try{sets=JSON.parse(firstWithData.sets_data);}catch(x){}}
      if(!sets&&e._rows.length>1){sets=e._rows.map(r=>({reps:r.reps??0,kg:r.peso_kg??0}));}
      if(!sets&&(e.series>0||e.reps>0||e.peso_kg>0)){const n=e.series||1;sets=Array.from({length:n},()=>({reps:e.reps??0,kg:e.peso_kg??0}));}
      const hasSets=sets?.length>0;

      const nSeries=hasSets?sets.length:(e.series||0);
      const maxKg=hasSets?Math.max(...sets.map(s=>s.kg??s.peso_kg??0)):(e.peso_kg??0);
      const maxReps=hasSets?Math.max(...sets.map(s=>s.reps??0)):(e.reps??0);

      const partes=[];
      if(nSeries>0)partes.push(nSeries+(nSeries===1?' serie':' series'));
      if(maxReps>0)partes.push(maxReps+' reps');
      if(maxKg>0)partes.push(maxKg+'kg');
      const resumen=partes.length?partes.join(' · '):'Sin datos';

      const setsHtml=hasSets?sets.map((st,i)=>{
        const kg=st.kg??st.peso_kg??0;
        const reps=st.reps??0;
        return '<div class="ej-set-row"><span class="ej-set-num">'+(i+1)+'</span>'
          +'<span class="ej-set-weight">'+(kg>0?kg+'kg':'PC')+'</span>'
          +'<span style="color:var(--text2);font-size:11px">×</span>'
          +'<span class="ej-set-reps">'+(reps>0?reps+' reps':'—')+'</span>'
          +'</div>';
      }).join(''):'';

      return '<div class="ej-group'+(hasSets?'" onclick="this.classList.toggle(\'expanded\')"':'" style="cursor:default"')+'>'
        +'<div class="session-ej-row" style="margin-bottom:0">'
        +'<div class="session-icon" style="background:var(--bg2);width:38px;height:38px;flex-shrink:0;">'+ejIconHtml(e.nombre,e.equipo,26)+'</div>'
        +'<div class="session-info"><div class="session-tipo">'+e.nombre+'</div>'
        +(e.subgrupo?'<div style="font-size:11px;color:var(--text2);line-height:1.3;margin-bottom:1px">'+e.subgrupo+'</div>':'')
        +'<div class="session-meta">'+resumen+'</div></div>'
        +(hasSets?'<svg class="ej-expand-arrow" width="16" height="16" viewBox="0 0 24 24" fill="currentColor"><path d="M7 10l5 5 5-5z"/></svg>':'')
        +'</div>'
        +(hasSets?'<div class="ej-sets-collapse">'+setsHtml+'</div>':'')
        +'</div>';
    }).join('');
  }
  html+='<div style="display:flex;gap:8px;margin-top:16px">'+
    '<button class="btn btn-secondary" style="flex:1" onclick="borrarSesionConfirm('+s.id+')">🗑 Eliminar</button>'+
    '<button class="btn btn-primary" style="flex:2" onclick="repetirWorkout('+s.id+')">🏋️ Repetir Workout</button>'+
    '</div>';
  document.getElementById('md-content').innerHTML=html;
  openModal('modal-detalle');
}

function borrarSesionConfirm(id){
  closeModal('modal-detalle');
  showConfirm('¿Eliminar sesión?','Esta acción no se puede deshacer.','Eliminar',async()=>{
    const{data}=await eliminarSesion(id);
    if(data.ok){showToast('Sesión eliminada','info');loadDashboard();loadHistorial();}
    else showToast(data.error,'error');
  });
}

async function repetirWorkout(id){
  closeModal('modal-detalle');
  const{data}=await getSesion(id);
  if(!data.ok){showToast('Error al cargar sesión','error');return;}
  const s=data.sesion;
  const catFlat={};
  if(_catalogoCache){
    for(const[grupo,ejs]of Object.entries(_catalogoCache)){
      for(const ej of ejs){if(ej.n)catFlat[ej.n.toLowerCase().trim()]={em:ej.em,equipo:ej.equipo||null,m:grupo};}
    }
  }
  const ejMap={},ejOrder=[];
  (s.ejercicios||[]).forEach(e=>{
    const key=e.nombre.toLowerCase().trim();
    if(!ejMap[key]){
      const cat=catFlat[key]||{};
      ejMap[key]={em:cat.em||'💪',equipo:cat.equipo||null,n:e.nombre,m:cat.m||e.nombre.toUpperCase(),sets:[]};
      ejOrder.push(key);
    }
    let sets=null;
    if(e.sets_data){try{sets=JSON.parse(e.sets_data);}catch(x){}}
    if(sets?.length){
      sets.forEach(st=>ejMap[key].sets.push({kg:st.kg!=null?st.kg:(st.peso_kg!=null?st.peso_kg:0),reps:st.reps||0}));
    }else{
      const n=e.series||1;
      for(let i=0;i<n;i++)ejMap[key].sets.push({kg:e.peso_kg||60,reps:e.reps||10});
    }
  });
  const preload={tipo:s.tipo,fromHistory:true,ejercicios:ejOrder.map(k=>ejMap[k])};
  sessionStorage.setItem('gymy_preload_workout',JSON.stringify(preload));
  const wtab=document.getElementById('tab-workout');
  if(wtab)wtab.style.display='flex';
  goTab('workout',wtab);
}
