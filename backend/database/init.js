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

    // Seed catálogo desde plantillas_ejercicios.json (borra y re-inserta en cada arranque)
    const seedFile = path.join(__dirname, '../frontend/assets/plantillas_ejercicios.json');
    if (fs.existsSync(seedFile)) {
      try {
        const seedData = JSON.parse(fs.readFileSync(seedFile, 'utf8'));
        const ejs = Array.isArray(seedData) ? seedData.filter(e => e.nombre && e.grupo_muscular) : [];
        if (ejs.length > 0) {
          await client.query(`DELETE FROM ejercicios_catalogo`);
          for (const e of ejs) {
            await client.query(
              `INSERT INTO ejercicios_catalogo (nombre, grupo_muscular, subgrupo, equipo, tipo)
               VALUES ($1,$2,$3,$4,$5) ON CONFLICT (nombre) DO NOTHING`,
              [e.nombre, e.grupo_muscular, e.subgrupo||null, e.equipo||null, e.tipo||'fuerza']
            );
          }
          console.log(`[DB] Catálogo poblado: ${ejs.length} ejercicios ✓`);
        }
      } catch(e) {
        console.warn('[DB] plantillas_ejercicios.json no se pudo leer:', e.message);
      }
    }

    // Seed plantillas genéricas (borra las genéricas y re-inserta desde el mismo JSON)
    const { rows: existingPlantillas } = await client.query(
      `SELECT COUNT(*) FROM plantillas_ejercicios WHERE user_id IS NULL`
    );
    if (parseInt(existingPlantillas[0].count) === 0 && fs.existsSync(seedFile)) {
      try {
        const seedData = JSON.parse(fs.readFileSync(seedFile, 'utf8'));
        let seeded = 0;
        for (const e of (Array.isArray(seedData) ? seedData : [])) {
          if (!e.nombre || !e.grupo_muscular) continue;
          await client.query(
            `INSERT INTO plantillas_ejercicios (nombre, grupo_muscular, subgrupo, equipo, tipo)
             VALUES ($1,$2,$3,$4,$5) ON CONFLICT DO NOTHING`,
            [e.nombre, e.grupo_muscular, e.subgrupo||null, e.equipo||null, e.tipo||'fuerza']
          );
          seeded++;
        }
        if (seeded > 0) console.log(`[DB] Plantillas genéricas: ${seeded} ejercicios ✓`);
      } catch(e) {
        console.warn('[DB] plantillas_ejercicios.json (plantillas) no se pudo leer:', e.message);
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
