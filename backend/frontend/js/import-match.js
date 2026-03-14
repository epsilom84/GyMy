// ══════════════════════════════════════════════
// IMPORT-MATCH.JS — Similitud por bigramas y resolución de combinaciones
// Depende de: import-parse.js (detectarGrupo, _catalogoCache), loadCatalogo
// ══════════════════════════════════════════════

// ── Similitud por bigramas ──
function _normEjN(s){
  return(s||'').toLowerCase()
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
  return(s||'').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
}

// ── Resolución de combinaciones (modal) ──
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
      }else if(cands.length){
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
