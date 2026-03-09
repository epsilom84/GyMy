const { Pool } = require('pg');
const fs   = require('fs');
const path = require('path');

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.DATABASE_URL && process.env.DATABASE_URL.includes('railway.internal')
    ? false  // conexión interna railway no necesita SSL
    : { rejectUnauthorized: false },
  max: 10,
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 10000,
});

pool.on('error', (err) => {
  console.error('[DB] Error en pool:', err.message || JSON.stringify(err));
});

async function initDB() {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    await client.query(`
      CREATE TABLE IF NOT EXISTS users (
        id               SERIAL PRIMARY KEY,
        username         TEXT UNIQUE NOT NULL,
        email            TEXT UNIQUE NOT NULL,
        password         TEXT NOT NULL,
        refresh_token    TEXT,
        reset_token      TEXT,
        reset_token_exp  TIMESTAMPTZ,
        created_at       TIMESTAMPTZ DEFAULT NOW(),
        last_login       TIMESTAMPTZ
      );
    `);
    await client.query(`
      CREATE TABLE IF NOT EXISTS sesiones (
        id           SERIAL PRIMARY KEY,
        user_id      INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        fecha        DATE NOT NULL,
        tipo         TEXT NOT NULL,
        duracion_min INTEGER,
        notas        TEXT,
        calorias     INTEGER,
        valoracion   INTEGER CHECK(valoracion BETWEEN 1 AND 5),
        created_at   TIMESTAMPTZ DEFAULT NOW()
      );
    `);
    await client.query(`CREATE INDEX IF NOT EXISTS idx_sesiones_user_fecha ON sesiones(user_id, fecha DESC);`);
    await client.query(`
      CREATE TABLE IF NOT EXISTS ejercicios (
        id        SERIAL PRIMARY KEY,
        sesion_id INTEGER NOT NULL REFERENCES sesiones(id) ON DELETE CASCADE,
        nombre    TEXT NOT NULL,
        series    INTEGER,
        reps      INTEGER,
        peso_kg   REAL
      );
    `);
    await client.query(`CREATE INDEX IF NOT EXISTS idx_ejercicios_sesion ON ejercicios(sesion_id);`);

    // Catálogo de ejercicios clasificados por grupo muscular
    await client.query(`
      CREATE TABLE IF NOT EXISTS ejercicios_catalogo (
        id              SERIAL PRIMARY KEY,
        nombre          TEXT NOT NULL UNIQUE,
        grupo_muscular  TEXT NOT NULL,
        subgrupo        TEXT,
        equipo          TEXT,          -- mancuernas, barra, máquina, cable, peso_corporal, cardio
        tipo            TEXT,          -- fuerza, cardio, movilidad
        descripcion     TEXT,
        activo          BOOLEAN DEFAULT TRUE,
        created_at      TIMESTAMPTZ DEFAULT NOW()
      );
    `);
    await client.query(`CREATE INDEX IF NOT EXISTS idx_catalogo_grupo ON ejercicios_catalogo(grupo_muscular);`);
    await client.query(`CREATE INDEX IF NOT EXISTS idx_catalogo_activo ON ejercicios_catalogo(activo);`);

    // Plantillas de ejercicios: genéricas (user_id NULL) + personales por usuario
    await client.query(`
      CREATE TABLE IF NOT EXISTS plantillas_ejercicios (
        id             SERIAL PRIMARY KEY,
        nombre         TEXT NOT NULL,
        grupo_muscular TEXT NOT NULL,
        subgrupo       TEXT,
        equipo         TEXT,
        tipo           TEXT DEFAULT 'fuerza',
        user_id        INTEGER REFERENCES users(id) ON DELETE CASCADE,
        activo         BOOLEAN DEFAULT TRUE,
        created_at     TIMESTAMPTZ DEFAULT NOW()
      );
    `);
    await client.query(`CREATE INDEX IF NOT EXISTS idx_plantillas_user  ON plantillas_ejercicios(user_id);`);
    await client.query(`CREATE INDEX IF NOT EXISTS idx_plantillas_grupo ON plantillas_ejercicios(grupo_muscular);`);

    // Poblar catálogo solo si está vacío
    const { rows: existing } = await client.query(`SELECT COUNT(*) FROM ejercicios_catalogo`);
    if (parseInt(existing[0].count) === 0) {
      await client.query(`
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
          ('Jalón Agarre Cerrado Cable',          'Espalda', 'Dorsal',             'cable',       'fuerza'),
          ('Jalón Agarre Amplio Cable',           'Espalda', 'Dorsal',             'cable',       'fuerza'),
          ('Pull Down Máquina',                   'Espalda', 'Dorsal',             'máquina',     'fuerza'),
          ('Dominadas',                           'Espalda', 'Dorsal',             'peso_corporal','fuerza'),
          ('Remo Cable Sentado',                  'Espalda', 'Dorsal medio',       'cable',       'fuerza'),
          ('Remo Máquina Unilateral',             'Espalda', 'Dorsal medio',       'máquina',     'fuerza'),
          ('Remo Barra Agarre Bajo',              'Espalda', 'Dorsal medio',       'barra',       'fuerza'),
          ('Remo Polea Unilateral',               'Espalda', 'Dorsal medio',       'cable',       'fuerza'),
          ('Remo Mancuerna Unilateral',           'Espalda', 'Dorsal medio',       'mancuernas', 'fuerza'),
          ('Peso Muerto Rumano',                  'Espalda', 'Lumbar',             'barra',       'fuerza'),
          ('Hiperextensiones',                    'Espalda', 'Lumbar',             'peso_corporal','fuerza'),

          -- PIERNAS
          ('Sentadilla Barra',                    'Piernas', 'Cuádriceps',         'barra',       'fuerza'),
          ('Prensa Inclinada',                    'Piernas', 'Cuádriceps',         'máquina',     'fuerza'),
          ('Press Piernas Horizontal',            'Piernas', 'Cuádriceps',         'máquina',     'fuerza'),
          ('Extensión Piernas Máquina',           'Piernas', 'Cuádriceps',         'máquina',     'fuerza'),
          ('Zancadas Mancuernas',                 'Piernas', 'Cuádriceps',         'mancuernas', 'fuerza'),
          ('Curl Femoral Máquina',                'Piernas', 'Femoral',            'máquina',     'fuerza'),
          ('Curl Femoral Tumbado',                'Piernas', 'Femoral',            'máquina',     'fuerza'),
          ('Peso Muerto',                         'Piernas', 'Femoral/Lumbar',     'barra',       'fuerza'),
          ('Abducción Máquina',                   'Piernas', 'Glúteo/Abductor',   'máquina',     'fuerza'),
          ('Aducción Máquina',                    'Piernas', 'Aductor',            'máquina',     'fuerza'),
          ('Gemelos Máquina Sentado',             'Piernas', 'Gemelos',            'máquina',     'fuerza'),
          ('Gemelos Máquina De Pie',              'Piernas', 'Gemelos',            'máquina',     'fuerza'),
          ('Elevación Talones Barra',             'Piernas', 'Gemelos',            'barra',       'fuerza'),

          -- PECHO
          ('Press Pecho Máquina Frontal',         'Pecho',   'Pectoral mayor',     'máquina',     'fuerza'),
          ('Press Pecho Máquina Inclinado',       'Pecho',   'Pectoral superior',  'máquina',     'fuerza'),
          ('Aperturas Máquina',                   'Pecho',   'Pectoral mayor',     'máquina',     'fuerza'),
          ('Press Banca Plano',                   'Pecho',   'Pectoral mayor',     'barra',       'fuerza'),
          ('Press Banca Inclinado',               'Pecho',   'Pectoral superior',  'barra',       'fuerza'),
          ('Press Mancuernas Plano',              'Pecho',   'Pectoral mayor',     'mancuernas', 'fuerza'),
          ('Aperturas Mancuernas',                'Pecho',   'Pectoral mayor',     'mancuernas', 'fuerza'),
          ('Cruce de Poleas',                     'Pecho',   'Pectoral mayor',     'cable',       'fuerza'),
          ('Fondos Pecho',                        'Pecho',   'Pectoral mayor',     'peso_corporal','fuerza'),

          -- BRAZOS - BÍCEPS
          ('Curl Bíceps Mancuernas Alterno',      'Brazos',  'Bíceps',             'mancuernas', 'fuerza'),
          ('Curl Bíceps Mancuerna',               'Brazos',  'Bíceps',             'mancuernas', 'fuerza'),
          ('Curl Bíceps Máquina Scott',           'Brazos',  'Bíceps',             'máquina',     'fuerza'),
          ('Curl Bíceps Martillo Alterno',        'Brazos',  'Braquial/Bíceps',    'mancuernas', 'fuerza'),
          ('Curl Bíceps Barra',                   'Brazos',  'Bíceps',             'barra',       'fuerza'),
          ('Curl Bíceps Cable',                   'Brazos',  'Bíceps',             'cable',       'fuerza'),
          ('Curl Predicador Máquina',             'Brazos',  'Bíceps',             'máquina',     'fuerza'),

          -- BRAZOS - TRÍCEPS
          ('Press Tríceps Cuerda Cable',          'Brazos',  'Tríceps',            'cable',       'fuerza'),
          ('Extensión Tríceps Polea Alta',        'Brazos',  'Tríceps',            'cable',       'fuerza'),
          ('Patada de Tríceps Mancuerna',         'Brazos',  'Tríceps',            'mancuernas', 'fuerza'),
          ('Press Francés Barra',                 'Brazos',  'Tríceps',            'barra',       'fuerza'),
          ('Fondos Tríceps Banco',                'Brazos',  'Tríceps',            'peso_corporal','fuerza'),
          ('Extensión Tríceps Máquina',           'Brazos',  'Tríceps',            'máquina',     'fuerza'),

          -- CORE / ABDOMINALES
          ('Crunch Máquina',                      'Core',    'Recto abdominal',    'máquina',     'fuerza'),
          ('Crunch Polea Alta',                   'Core',    'Recto abdominal',    'cable',       'fuerza'),
          ('Plancha',                             'Core',    'Core completo',      'peso_corporal','fuerza'),
          ('Elevación de Piernas Tumbado',        'Core',    'Recto inferior',     'peso_corporal','fuerza'),
          ('Rotación con Cable',                  'Core',    'Oblicuos',           'cable',       'fuerza'),
          ('Rueda Abdominal',                     'Core',    'Core completo',      'peso_corporal','fuerza'),

          -- CARDIO
          ('Cinta',                               'Cardio',  'Cardio',             'cardio',      'cardio'),
          ('Bicicleta',                           'Cardio',  'Cardio',             'cardio',      'cardio'),
          ('Elíptica',                            'Cardio',  'Cardio',             'cardio',      'cardio'),
          ('Remo Ergómetro',                      'Cardio',  'Cardio completo',    'cardio',      'cardio'),
          ('Escaladora',                          'Cardio',  'Cardio',             'cardio',      'cardio')

        ON CONFLICT (nombre) DO NOTHING;
      `);
      console.log('[DB] Catálogo de ejercicios poblado ✓');
    }

    // Seed plantillas genéricas desde assets/plantillas_ejercicios.json si la tabla está vacía
    const { rows: existingPlantillas } = await client.query(
      `SELECT COUNT(*) FROM plantillas_ejercicios WHERE user_id IS NULL`
    );
    if (parseInt(existingPlantillas[0].count) === 0) {
      const seedFile = path.join(__dirname, '../frontend/assets/plantillas_ejercicios.json');
      if (fs.existsSync(seedFile)) {
        try {
          const seedData = JSON.parse(fs.readFileSync(seedFile, 'utf8'));
          let seeded = 0;
          for (const e of (Array.isArray(seedData) ? seedData : [])) {
            if (!e.nombre || !e.grupo_muscular) continue;
            await client.query(
              `INSERT INTO plantillas_ejercicios (nombre, grupo_muscular, subgrupo, equipo, tipo)
               VALUES ($1,$2,$3,$4,$5)`,
              [e.nombre, e.grupo_muscular, e.subgrupo||null, e.equipo||null, e.tipo||'fuerza']
            );
            seeded++;
          }
          if (seeded > 0) console.log(`[DB] Plantillas genéricas: ${seeded} ejercicios ✓`);
        } catch(e) {
          console.warn('[DB] plantillas_ejercicios.json no se pudo leer:', e.message);
        }
      }
    }

    await client.query('COMMIT');
    console.log('[DB] PostgreSQL listo ✓');
  } catch (err) {
    await client.query('ROLLBACK');
    console.error('[DB] Error al inicializar tablas:', err.message || JSON.stringify(err));
    throw err;
  } finally {
    client.release();
  }
}

async function queryOne(text, params) {
  const res = await pool.query(text, params);
  return res.rows[0] || null;
}

async function queryAll(text, params) {
  const res = await pool.query(text, params);
  return res.rows;
}

async function withTransaction(fn) {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const result = await fn(client);
    await client.query('COMMIT');
    return result;
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }
}

module.exports = { pool, initDB, queryOne, queryAll, withTransaction };
