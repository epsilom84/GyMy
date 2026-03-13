const XLSX = require('xlsx');
const fs = require('fs');

// Cargar JSON actual como lookup nombre→{subgrupo,equipo}
const jsonActual = JSON.parse(fs.readFileSync('./frontend/assets/plantillas_ejercicios.json','utf8'));
const lookup = {};
jsonActual.forEach(e => {
  lookup[e.nombre.toLowerCase().trim()] = { subgrupo: e.subgrupo||null, equipo: e.equipo||null };
});

// Mapeo de grupos del Excel → nombres BD
const grupoMap = {
  'PIERNAS':     'Piernas',
  'ESPALDA':     'Espalda',
  'ESPALDA ':    'Espalda',
  'ABDOMINALES': 'Core',
  'BÍCEPS':      'Brazos Bíceps',
  'BÍCEPS ':     'Brazos Bíceps',
  'TRÍCEPS':     'Brazos Tríceps',
  'TRÍCEPS ':    'Brazos Tríceps',
  'PECHO':       'Pecho',
  'PECHO ':      'Pecho',
  'HOMBRO':      'Hombros',
  'HOMBRO ':     'Hombros',
};

// Limpiar nombres con artefactos conocidos
function limpiarNombre(n) {
  n = n.trim();
  n = n.replace(/ jo\s*$/, '');       // "Pullover de pie en polea alta jo " → sin "jo"
  n = n.replace(/^7\s+/, '');          // "7 Crunch..." → "Crunch..."
  n = n.replace(/\s+a\s*$/, '');      // "Dominadas agarre prono medio a " → sin "a"
  n = n.replace(/\s+e\s*$/, '');      // "...inclinado e " → sin "e"
  n = n.replace(/\s+mu\s+/, ' ');     // "StepUps mu Zancadas..." → split? skip below
  n = n.replace(/^Curl dao /, 'Curl '); // "Curl dao Curl barra Z..." → "Curl Curl..." (dup, se filtra)
  return n.trim();
}

// Nombres que se descartan (demasiado cortos o inválidos)
function esNombreInvalido(n) {
  if (n.length < 4) return true;
  if (n === 'Row') return true;
  if (/ au /.test(n) && n.length > 50) return true; // artefacto merge
  if (/^Curl Curl/.test(n)) return true; // resultado de limpiar "Curl dao Curl..."
  if (/ mu /.test(n) && n.length > 30) return true; // "StepUps mu Zancadas..."
  return false;
}

function inferEquipo(nombre) {
  const n = nombre.toLowerCase();
  if (/\bbarra\b|smith|hack con barra|yates/.test(n)) return 'barra';
  if (/mancuerna/.test(n)) return 'mancuernas';
  if (/polea|cable|cuerda|jalón|jal[oó]n|pull.down|pull.over/.test(n)) return 'cable';
  if (/m[aá]quina|prensa|leg extension|leg press/.test(n)) return 'máquina';
  if (/peso corporal|fondos|dominadas|flexion|plancha|superman/.test(n)) return 'peso_corporal';
  return null;
}

function inferSubgrupo(grupo, nombre) {
  const n = nombre.toLowerCase();
  if (grupo === 'Piernas') {
    if (/femoral|isquio|curl de pierna|buenos d[ií]as|peso muerto|pull through|nordico|nordic/.test(n)) return 'Femoral';
    if (/cu[aá]dricep|extensi[oó]n.*cu[aá]d|leg extension|prensa|press.*pierna|hack|sentadill|lunges|zancada|step/.test(n)) return 'Cuádriceps';
    if (/gemelo|tal[oó]n|pantorrilla|calf/.test(n)) return 'Gemelos';
    if (/gl[uú]teo|cadera|pelvis|abductor|aductor|hip thrust|patada|extensi[oó]n de cadera|aleteo/.test(n)) return 'Glúteo';
    return 'Cuádriceps';
  }
  if (grupo === 'Espalda') {
    if (/lumbar|superman|extensi[oó]n de espalda|hiperextensi/.test(n)) return 'Lumbar';
    if (/trapecio|encogimiento|shrug/.test(n)) return 'Trapecio';
    return 'Dorsal';
  }
  if (grupo === 'Core') return 'Recto abdominal';
  if (grupo === 'Brazos Bíceps') return 'Bíceps';
  if (grupo === 'Brazos Tríceps') return 'Tríceps';
  if (grupo === 'Pecho') return 'Pectoral';
  if (grupo === 'Hombros') return 'Deltoides';
  return null;
}

// Leer Excel
const wb = XLSX.readFile('./frontend/assets/plantilla_ejercicios.xlsx');
const ws = wb.Sheets[wb.SheetNames[0]];
const rows = XLSX.utils.sheet_to_json(ws, {defval:''});

const resultado = [];
const nuevos = [];
const skipped = [];
const vistos = new Set();

rows.forEach(row => {
  const grupoRaw = (row['Grupo Muscular']||'').trim();
  const grupo = grupoMap[grupoRaw] || null;
  let nombre = limpiarNombre(row['Ejercicio']||'');

  if (!nombre || !grupo || esNombreInvalido(nombre)) {
    skipped.push(nombre || grupoRaw);
    return;
  }

  const key = nombre.toLowerCase().trim();
  if (vistos.has(key)) { return; } // deduplicar silenciosamente
  vistos.add(key);

  const existing = lookup[key];
  let subgrupo, equipo;

  if (existing) {
    subgrupo = existing.subgrupo;
    equipo = existing.equipo;
  } else {
    subgrupo = inferSubgrupo(grupo, nombre);
    equipo = inferEquipo(nombre);
    nuevos.push({ nombre, grupo, subgrupo, equipo });
  }

  resultado.push({ nombre, grupo_muscular: grupo, subgrupo, equipo, tipo: 'fuerza' });
});

// Stats
console.log('Total ejercicios finales:', resultado.length);
console.log('Del JSON anterior (preservados):', resultado.length - nuevos.length);
console.log('Nuevos (inferidos):', nuevos.length);
console.log('Skipped/eliminados:', skipped.length);
console.log('\nNuevos ejercicios añadidos:');
nuevos.forEach(e=>console.log(' +', e.grupo.padEnd(20), '|', (e.subgrupo||'?').padEnd(18), '|', (e.equipo||'?').padEnd(12), '|', e.nombre));
if (skipped.length) {
  console.log('\nSkipped:');
  skipped.forEach(s=>console.log(' -', s));
}

// Escribir JSON
fs.writeFileSync('./frontend/assets/plantillas_ejercicios.json', JSON.stringify(resultado, null, 2), 'utf8');
console.log('\nJSON escrito: ./frontend/assets/plantillas_ejercicios.json');
