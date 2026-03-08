/**
 * migrate_ejercicios_catalogo.js
 * Ejecuta SOLO la creación/seed de ejercicios_catalogo en la BD existente.
 * Útil si el servidor ya está corriendo y no quieres reiniciarlo.
 *
 * Uso: DATABASE_URL=postgresql://... node database/migrate_ejercicios_catalogo.js
 */
require('dotenv').config();
const { Pool } = require('pg');

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.DATABASE_URL && process.env.DATABASE_URL.includes('railway.internal')
    ? false : { rejectUnauthorized: false },
});

async function run() {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    await client.query(`
      CREATE TABLE IF NOT EXISTS ejercicios_catalogo (
        id                SERIAL PRIMARY KEY,
        nombre            TEXT NOT NULL UNIQUE,
        grupo_muscular    TEXT NOT NULL,
        subgrupo          TEXT,
        equipo            TEXT,
        tipo              TEXT,
        descripcion       TEXT,
        activo            BOOLEAN DEFAULT TRUE,
        created_at        TIMESTAMPTZ DEFAULT NOW()
      );
    `);
    await client.query(`CREATE INDEX IF NOT EXISTS idx_catalogo_grupo  ON ejercicios_catalogo(grupo_muscular);`);
    await client.query(`CREATE INDEX IF NOT EXISTS idx_catalogo_activo ON ejercicios_catalogo(activo);`);
    console.log('Tabla e índices creados ✓');

    const result = await client.query(`
      INSERT INTO ejercicios_catalogo (nombre, grupo_muscular, subgrupo, equipo, tipo) VALUES
        -- HOMBROS
        ('Press Hombros Mancuernas',            'Hombros', 'Deltoides anterior', 'mancuernas', 'fuerza'),
        ('Press Hombros Barra',                 'Hombros', 'Deltoides anterior', 'barra',       'fuerza'),
        ('Press Hombros Máquina',               'Hombros', 'Deltoides anterior', 'máquina',     'fuerza'),
        ('Elevaciones Laterales Mancuernas',    'Hombros', 'Deltoides lateral',  'mancuernas', 'fuerza'),
        ('Elevaciones Laterales Máquina',       'Hombros', 'Deltoides lateral',  'máquina',     'fuerza'),
        ('Elevación Lateral Cable Unilateral',  'Hombros', 'Deltoides lateral',  'cable',       'fuerza'),
        ('Face Pull',                           'Hombros', 'Deltoides posterior','cable',       'fuerza'),
        ('Remo Máquina Unilateral',             'Hombros', 'Deltoides posterior','máquina',     'fuerza'),
        ('Vuelos Posteriores Mancuernas',       'Hombros', 'Deltoides posterior','mancuernas', 'fuerza'),
        ('Press Arnold',                        'Hombros', 'Deltoides anterior', 'mancuernas', 'fuerza'),
        -- ESPALDA
        ('Jalón Agarre Cerrado Cable',          'Espalda', 'Dorsal',             'cable',        'fuerza'),
        ('Jalón Agarre Amplio Cable',           'Espalda', 'Dorsal',             'cable',        'fuerza'),
        ('Pull Down Máquina',                   'Espalda', 'Dorsal',             'máquina',      'fuerza'),
        ('Dominadas',                           'Espalda', 'Dorsal',             'peso_corporal','fuerza'),
        ('Remo Cable Sentado',                  'Espalda', 'Dorsal medio',       'cable',        'fuerza'),
        ('Remo Máquina Unilateral Espalda',     'Espalda', 'Dorsal medio',       'máquina',      'fuerza'),
        ('Remo Barra Agarre Bajo',              'Espalda', 'Dorsal medio',       'barra',        'fuerza'),
        ('Remo Polea Unilateral',               'Espalda', 'Dorsal medio',       'cable',        'fuerza'),
        ('Remo Mancuerna Unilateral',           'Espalda', 'Dorsal medio',       'mancuernas',   'fuerza'),
        ('Peso Muerto Rumano',                  'Espalda', 'Lumbar',             'barra',        'fuerza'),
        ('Hiperextensiones',                    'Espalda', 'Lumbar',             'peso_corporal','fuerza'),
        -- PIERNAS
        ('Sentadilla Barra',                    'Piernas', 'Cuádriceps',         'barra',        'fuerza'),
        ('Prensa Inclinada',                    'Piernas', 'Cuádriceps',         'máquina',      'fuerza'),
        ('Press Piernas Horizontal',            'Piernas', 'Cuádriceps',         'máquina',      'fuerza'),
        ('Extensión Piernas Máquina',           'Piernas', 'Cuádriceps',         'máquina',      'fuerza'),
        ('Zancadas Mancuernas',                 'Piernas', 'Cuádriceps',         'mancuernas',   'fuerza'),
        ('Curl Femoral Máquina',                'Piernas', 'Femoral',            'máquina',      'fuerza'),
        ('Curl Femoral Tumbado',                'Piernas', 'Femoral',            'máquina',      'fuerza'),
        ('Peso Muerto',                         'Piernas', 'Femoral/Lumbar',     'barra',        'fuerza'),
        ('Abducción Máquina',                   'Piernas', 'Glúteo/Abductor',   'máquina',      'fuerza'),
        ('Aducción Máquina',                    'Piernas', 'Aductor',            'máquina',      'fuerza'),
        ('Gemelos Máquina Sentado',             'Piernas', 'Gemelos',            'máquina',      'fuerza'),
        ('Gemelos Máquina De Pie',              'Piernas', 'Gemelos',            'máquina',      'fuerza'),
        ('Elevación Talones Barra',             'Piernas', 'Gemelos',            'barra',        'fuerza'),
        -- PECHO
        ('Press Pecho Máquina Frontal',         'Pecho',   'Pectoral mayor',     'máquina',      'fuerza'),
        ('Press Pecho Máquina Inclinado',       'Pecho',   'Pectoral superior',  'máquina',      'fuerza'),
        ('Aperturas Máquina',                   'Pecho',   'Pectoral mayor',     'máquina',      'fuerza'),
        ('Press Banca Plano',                   'Pecho',   'Pectoral mayor',     'barra',        'fuerza'),
        ('Press Banca Inclinado',               'Pecho',   'Pectoral superior',  'barra',        'fuerza'),
        ('Press Mancuernas Plano',              'Pecho',   'Pectoral mayor',     'mancuernas',   'fuerza'),
        ('Aperturas Mancuernas',                'Pecho',   'Pectoral mayor',     'mancuernas',   'fuerza'),
        ('Cruce de Poleas',                     'Pecho',   'Pectoral mayor',     'cable',        'fuerza'),
        ('Fondos Pecho',                        'Pecho',   'Pectoral mayor',     'peso_corporal','fuerza'),
        -- BRAZOS - BÍCEPS
        ('Curl Bíceps Mancuernas Alterno',      'Brazos',  'Bíceps',             'mancuernas',   'fuerza'),
        ('Curl Bíceps Mancuerna',               'Brazos',  'Bíceps',             'mancuernas',   'fuerza'),
        ('Curl Bíceps Máquina Scott',           'Brazos',  'Bíceps',             'máquina',      'fuerza'),
        ('Curl Bíceps Martillo Alterno',        'Brazos',  'Braquial/Bíceps',    'mancuernas',   'fuerza'),
        ('Curl Bíceps Barra',                   'Brazos',  'Bíceps',             'barra',        'fuerza'),
        ('Curl Bíceps Cable',                   'Brazos',  'Bíceps',             'cable',        'fuerza'),
        ('Curl Predicador Máquina',             'Brazos',  'Bíceps',             'máquina',      'fuerza'),
        -- BRAZOS - TRÍCEPS
        ('Press Tríceps Cuerda Cable',          'Brazos',  'Tríceps',            'cable',        'fuerza'),
        ('Extensión Tríceps Polea Alta',        'Brazos',  'Tríceps',            'cable',        'fuerza'),
        ('Patada de Tríceps Mancuerna',         'Brazos',  'Tríceps',            'mancuernas',   'fuerza'),
        ('Press Francés Barra',                 'Brazos',  'Tríceps',            'barra',        'fuerza'),
        ('Fondos Tríceps Banco',                'Brazos',  'Tríceps',            'peso_corporal','fuerza'),
        ('Extensión Tríceps Máquina',           'Brazos',  'Tríceps',            'máquina',      'fuerza'),
        -- CORE
        ('Crunch Máquina',                      'Core',    'Recto abdominal',    'máquina',      'fuerza'),
        ('Crunch Polea Alta',                   'Core',    'Recto abdominal',    'cable',        'fuerza'),
        ('Plancha',                             'Core',    'Core completo',      'peso_corporal','fuerza'),
        ('Elevación de Piernas Tumbado',        'Core',    'Recto inferior',     'peso_corporal','fuerza'),
        ('Rotación con Cable',                  'Core',    'Oblicuos',           'cable',        'fuerza'),
        ('Rueda Abdominal',                     'Core',    'Core completo',      'peso_corporal','fuerza'),
        -- CARDIO
        ('Cinta',                               'Cardio',  'Cardio',             'cardio',       'cardio'),
        ('Bicicleta',                           'Cardio',  'Cardio',             'cardio',       'cardio'),
        ('Elíptica',                            'Cardio',  'Cardio',             'cardio',       'cardio'),
        ('Remo Ergómetro',                      'Cardio',  'Cardio completo',    'cardio',       'cardio'),
        ('Escaladora',                          'Cardio',  'Cardio',             'cardio',       'cardio')
      ON CONFLICT (nombre) DO NOTHING;
    `);
    console.log(`${result.rowCount} ejercicios insertados ✓`);

    const resumen = await client.query(`
      SELECT grupo_muscular, COUNT(*) as total
      FROM ejercicios_catalogo GROUP BY grupo_muscular ORDER BY grupo_muscular
    `);
    console.log('\nResumen por grupo:');
    resumen.rows.forEach(r => console.log(`  ${r.grupo_muscular}: ${r.total}`));

    await client.query('COMMIT');
  } catch (err) {
    await client.query('ROLLBACK');
    console.error('ERROR:', err.message);
    process.exit(1);
  } finally {
    client.release();
    await pool.end();
  }
}

run();
