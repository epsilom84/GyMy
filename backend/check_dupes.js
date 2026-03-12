const XLSX = require('xlsx');
const wb = XLSX.readFile('./frontend/assets/plantilla_ejercicios.xlsx');
const ws = wb.Sheets[wb.SheetNames[0]];
const rows = XLSX.utils.sheet_to_json(ws, {defval:''});

const nombres = rows.map(r=>(r['Ejercicio']||'').trim());
const norm = nombres.map(n=>n.toLowerCase().trim());
const vistos = {};
const dupes = [];
norm.forEach((n,i)=>{
  if(!n) return;
  if(vistos[n] !== undefined) dupes.push({idx:i, nombre:nombres[i], primera:vistos[n]});
  else vistos[n]=i;
});
console.log('Total filas:', rows.length);
console.log('Duplicados exactos:', dupes.length);
dupes.forEach(d=>console.log(' DUP idx='+d.idx, JSON.stringify(d.nombre), '(primera: '+d.primera+')'));

// Nombres muy cortos o raros
const raros = rows.filter(r=>{
  const n=(r['Ejercicio']||'').trim();
  return n.length < 5 || / au | dao | jo | a $/.test(n);
});
console.log('\nNombres sospechosos:', raros.length);
raros.forEach(r=>console.log(' ?', JSON.stringify(r['Ejercicio'])));
