const { Pool } = require('pg');
const fs     = require('fs');
const path   = require('path');
const crypto = require('crypto');
const log    = require('../logger');

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
  log.error({ err }, 'DB pool error');
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
        last_login       TIMESTAMPTZ,
        nivel_usuario    INT DEFAULT 2
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
        peso_kg   REAL,
        sets_data TEXT
      );
    `);
    await client.query(`CREATE INDEX IF NOT EXISTS idx_ejercicios_sesion ON ejercicios(sesion_id);`);
    // Índice para búsquedas por nombre de ejercicio (historial por ejercicio + JOINs con catálogo)
    await client.query(`CREATE INDEX IF NOT EXISTS idx_ejercicios_nombre_lower ON ejercicios(LOWER(nombre));`);
    // Migración: añadir columna sets_data si no existe
    await client.query(`ALTER TABLE ejercicios ADD COLUMN IF NOT EXISTS sets_data TEXT;`);
    // Migración: FK al catálogo de ejercicios (evita JOINs por nombre en texto)
    await client.query(`ALTER TABLE ejercicios ADD COLUMN IF NOT EXISTS catalog_id INTEGER REFERENCES ejercicios_catalogo(id) ON DELETE SET NULL;`);
    await client.query(`CREATE INDEX IF NOT EXISTS idx_ejercicios_catalog_id ON ejercicios(catalog_id);`);
    // Backfill: rellenar catalog_id para ejercicios históricos que ya estén en el catálogo
    await client.query(`
      UPDATE ejercicios e
      SET catalog_id = ec.id
      FROM ejercicios_catalogo ec
      WHERE e.catalog_id IS NULL
        AND LOWER(e.nombre) = LOWER(ec.nombre)
    `);
    // Migración: campos de perfil físico en users
    await client.query(`ALTER TABLE users ADD COLUMN IF NOT EXISTS edad INT;`);
    await client.query(`ALTER TABLE users ADD COLUMN IF NOT EXISTS genero TEXT;`);
    await client.query(`ALTER TABLE users ADD COLUMN IF NOT EXISTS peso_corporal REAL;`);
    // Migración: flag para sesiones importadas
    await client.query(`ALTER TABLE sesiones ADD COLUMN IF NOT EXISTS importado BOOLEAN DEFAULT FALSE;`);
    // Migración: bloqueo de cuenta por intentos fallidos de login
    await client.query(`ALTER TABLE users ADD COLUMN IF NOT EXISTS failed_login_attempts INT DEFAULT 0;`);
    await client.query(`ALTER TABLE users ADD COLUMN IF NOT EXISTS locked_until TIMESTAMPTZ;`);

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
    // Índice para JOINs por nombre en minúsculas (LOWER(ec.nombre) = LOWER(e.nombre))
    await client.query(`CREATE INDEX IF NOT EXISTS idx_catalogo_nombre_lower ON ejercicios_catalogo(LOWER(nombre));`);

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

    // Seed catálogo desde plantillas_ejercicios.json — upsert solo si el JSON cambió
    // Se guarda el hash SHA-1 del fichero en app_meta para no repetir upsert en cada arranque
    await client.query(`
      CREATE TABLE IF NOT EXISTS app_meta (
        key   TEXT PRIMARY KEY,
        value TEXT NOT NULL
      );
    `);
    const seedFile = path.join(__dirname, '../frontend/assets/plantillas_ejercicios.json');
    if (fs.existsSync(seedFile)) {
      try {
        const rawJson = fs.readFileSync(seedFile, 'utf8');
        const newHash = crypto.createHash('sha1').update(rawJson).digest('hex');
        const metaRow = await client.query(`SELECT value FROM app_meta WHERE key='catalogo_hash'`);
        const oldHash = metaRow.rows[0]?.value;

        if (newHash !== oldHash) {
          const ejs = (JSON.parse(rawJson)||[]).filter(e => e.nombre && e.grupo_muscular);
          let upserted = 0;
          for (const e of ejs) {
            await client.query(
              `INSERT INTO ejercicios_catalogo (nombre, grupo_muscular, subgrupo, equipo, tipo)
               VALUES ($1,$2,$3,$4,$5)
               ON CONFLICT (nombre) DO UPDATE
                 SET grupo_muscular=$2, subgrupo=$3, equipo=$4, tipo=$5`,
              [e.nombre, e.grupo_muscular, e.subgrupo||null, e.equipo||null, e.tipo||'fuerza']
            );
            upserted++;
          }
          await client.query(
            `INSERT INTO app_meta (key, value) VALUES ('catalogo_hash',$1)
             ON CONFLICT (key) DO UPDATE SET value=$1`,
            [newHash]
          );
          log.info({ upserted }, 'Catálogo sincronizado');
        } else {
          log.info('Catálogo sin cambios, seed omitido');
        }
      } catch(e) {
        log.warn({ err: e }, 'plantillas_ejercicios.json no se pudo leer');
      }
    }

    // Migración: eliminar plantillas genéricas duplicadas (user_id IS NULL) — ya están en ejercicios_catalogo
    await client.query(`DELETE FROM plantillas_ejercicios WHERE user_id IS NULL`);

    await client.query('COMMIT');
    log.info('PostgreSQL listo');
  } catch (err) {
    await client.query('ROLLBACK');
    log.error({ err }, 'Error al inicializar tablas');
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
