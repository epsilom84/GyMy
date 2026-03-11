const express = require('express');
const fs = require('fs');
const path = require('path');
const { body, query, validationResult } = require('express-validator');
const { pool, queryOne, queryAll, withTransaction } = require('../database/init');
const verifyToken = require('../middleware/verifyToken');
const router = express.Router();

// ─── GRUPOS Y SUBGRUPOS FIJOS (no editables por usuario ni por imports) ───────
const GRUPOS_VALIDOS = ['Piernas','Espalda','Core','Brazos Bíceps','Brazos Tríceps','Hombros','Pecho'];
const SUBGRUPOS_POR_GRUPO = {
  'Piernas':       ['Cuádriceps','Femoral','Gemelos','Glúteo'],
  'Espalda':       ['Dorsal','Lumbar','Trapecio'],
  'Core':          ['Recto abdominal'],
  'Brazos Bíceps': ['Bíceps'],
  'Brazos Tríceps':['Tríceps'],
  'Hombros':       ['Deltoides'],
  'Pecho':         ['Pectoral'],
};

// ─── CATÁLOGO DE EJERCICIOS ────────────────────────────────────────────────

// GET /api/catalogo - Todos los ejercicios del catálogo, agrupados por grupo muscular
router.get('/catalogo', async (req, res) => {
  try {
    const { grupo, equipo, tipo, q } = req.query;
    let sql = `SELECT id, nombre, grupo_muscular, subgrupo, equipo, tipo, descripcion
               FROM ejercicios_catalogo WHERE activo = TRUE`;
    const params = [];
    if (grupo)  { params.push(grupo);  sql += ` AND grupo_muscular ILIKE $${params.length}`; }
    if (equipo) { params.push(equipo); sql += ` AND equipo ILIKE $${params.length}`; }
    if (tipo)   { params.push(tipo);   sql += ` AND tipo ILIKE $${params.length}`; }
    if (q)      { params.push(`%${q}%`); sql += ` AND nombre ILIKE $${params.length}`; }
    sql += ` ORDER BY grupo_muscular, subgrupo, nombre`;
    const rows = await queryAll(sql, params);

    // Agrupar por grupo_muscular
    const agrupado = rows.reduce((acc, ej) => {
      if (!acc[ej.grupo_muscular]) acc[ej.grupo_muscular] = [];
      acc[ej.grupo_muscular].push(ej);
      return acc;
    }, {});

    res.json({ ok: true, total: rows.length, grupos: agrupado });
  } catch(e) {
    res.status(500).json({ ok: false, error: e.message });
  }
});

// GET /api/catalogo/grupos - Lista de grupos musculares y subgrupos disponibles (fijos)
router.get('/catalogo/grupos', async (req, res) => {
  try {
    const rows = await queryAll(
      `SELECT grupo_muscular, COUNT(*) as total
       FROM ejercicios_catalogo WHERE activo = TRUE
       GROUP BY grupo_muscular ORDER BY grupo_muscular`
    );
    // También devolver la estructura fija de subgrupos
    const estructura = GRUPOS_VALIDOS.map(g => ({
      grupo: g,
      subgrupos: SUBGRUPOS_POR_GRUPO[g] || [],
    }));
    res.json({ ok: true, grupos: rows, estructura });
  } catch(e) {
    res.status(500).json({ ok: false, error: e.message });
  }
});

// GET /api/catalogo/:id - Detalle de un ejercicio
router.get('/catalogo/:id', async (req, res) => {
  try {
    const ej = await queryOne(
      `SELECT * FROM ejercicios_catalogo WHERE id = $1 AND activo = TRUE`,
      [req.params.id]
    );
    if (!ej) return res.status(404).json({ ok: false, error: 'Ejercicio no encontrado' });
    res.json({ ok: true, ejercicio: ej });
  } catch(e) {
    res.status(500).json({ ok: false, error: e.message });
  }
});


// POST /api/catalogo - Crear nuevo ejercicio en el catálogo (requiere JWT)
// grupo_muscular debe ser uno de GRUPOS_VALIDOS; subgrupo lo fija el servidor
router.post('/catalogo', verifyToken, async (req, res) => {
  try {
    const { nombre, grupo_muscular, equipo, tipo, descripcion } = req.body;
    if (!nombre || !grupo_muscular) return res.status(400).json({ ok: false, error: 'nombre y grupo_muscular requeridos' });
    if (!GRUPOS_VALIDOS.includes(grupo_muscular))
      return res.status(400).json({ ok: false, error: `grupo_muscular debe ser uno de: ${GRUPOS_VALIDOS.join(', ')}` });
    // Verificar si ya existe (case-insensitive)
    const existing = await queryOne(
      `SELECT id FROM ejercicios_catalogo WHERE nombre ILIKE $1 AND activo = TRUE`,
      [nombre]
    );
    if (existing) return res.json({ ok: true, id: existing.id, created: false });
    // subgrupo: primer subgrupo fijo del grupo (no lo decide el usuario)
    const subgrupo = (SUBGRUPOS_POR_GRUPO[grupo_muscular] || [])[0] || grupo_muscular;
    const row = await queryOne(
      `INSERT INTO ejercicios_catalogo (nombre, grupo_muscular, subgrupo, equipo, tipo, descripcion, activo)
       VALUES ($1, $2, $3, $4, $5, $6, TRUE) RETURNING id`,
      [nombre, grupo_muscular, subgrupo, equipo||null, tipo||'genérico', descripcion||null]
    );
    res.status(201).json({ ok: true, id: row.id, created: true });
  } catch(e) { res.status(500).json({ ok: false, error: e.message }); }
});

// PATCH /api/catalogo/:id - Editar solo el tipo (y descripcion) de un ejercicio del catálogo
router.patch('/catalogo/:id', verifyToken, async (req, res) => {
  try {
    const { tipo, descripcion } = req.body;
    if (!tipo && descripcion === undefined)
      return res.status(400).json({ ok: false, error: 'Nada que actualizar. Solo tipo y descripcion son editables.' });
    const updates = [];
    const params = [];
    if (tipo)              { params.push(tipo);        updates.push(`tipo=$${params.length}`); }
    if (descripcion !== undefined) { params.push(descripcion); updates.push(`descripcion=$${params.length}`); }
    params.push(req.params.id);
    const row = await queryOne(
      `UPDATE ejercicios_catalogo SET ${updates.join(',')} WHERE id=$${params.length} AND activo=TRUE RETURNING id`,
      params
    );
    if (!row) return res.status(404).json({ ok: false, error: 'Ejercicio no encontrado' });
    res.json({ ok: true, id: row.id });
  } catch(e) { res.status(500).json({ ok: false, error: e.message }); }
});

// POST /api/catalogo/import — Reemplaza todo el catálogo desde un array de ejercicios (requiere JWT)
router.post('/catalogo/import', verifyToken, async (req, res) => {
  try {
    const { ejercicios } = req.body;
    if (!Array.isArray(ejercicios) || ejercicios.length === 0)
      return res.status(400).json({ ok: false, error: 'ejercicios debe ser un array no vacío' });

    const validos = ejercicios.filter(e => e.nombre && e.grupo_muscular);
    if (validos.length === 0)
      return res.status(400).json({ ok: false, error: 'Ningún ejercicio tiene nombre y grupo_muscular' });

    await withTransaction(async (client) => {
      await client.query(`DELETE FROM ejercicios_catalogo`);
      for (const e of validos) {
        await client.query(
          `INSERT INTO ejercicios_catalogo (nombre, grupo_muscular, subgrupo, equipo, tipo, descripcion, activo)
           VALUES ($1,$2,$3,$4,$5,$6,$7) ON CONFLICT (nombre) DO NOTHING`,
          [e.nombre, e.grupo_muscular, e.subgrupo||null, e.equipo||null, e.tipo||'fuerza', e.descripcion||null, e.activo !== false]
        );
      }
    });

    // Persistir en JSON para sobrevivir reinicios del servidor
    const seedFile = path.join(__dirname, '../frontend/assets/plantillas_ejercicios.json');
    fs.writeFileSync(seedFile, JSON.stringify(validos, null, 2), 'utf8');

    const grupos = [...new Set(validos.map(e => e.grupo_muscular))].sort();
    res.json({ ok: true, insertados: validos.length, grupos });
  } catch(e) {
    res.status(500).json({ ok: false, error: e.message });
  }
});

router.use(verifyToken);

const validateSesion = [
  body('fecha').isDate().withMessage('Fecha no válida (YYYY-MM-DD)'),
  body('tipo').notEmpty().withMessage('Tipo obligatorio'),
  body('duracion_min').optional({ nullable: true }).isInt({ min: 0, max: 600 }),
  body('calorias').optional({ nullable: true }).isInt({ min: 0, max: 10000 }),
  body('valoracion').optional({ nullable: true }).isInt({ min: 1, max: 5 }),
  body('ejercicios').optional().isArray(),
];

// ── Helper: cargar ejercicios de una sesión ────────────────
async function loadEjercicios(sesionId) {
  return queryAll(
    `SELECT e.*, ec.grupo_muscular, ec.subgrupo, ec.equipo AS equipo_catalogo
     FROM ejercicios e
     LEFT JOIN ejercicios_catalogo ec ON LOWER(ec.nombre) = LOWER(e.nombre)
     WHERE e.sesion_id=$1 ORDER BY e.id`,
    [sesionId]
  );
}

// ── Helper: insertar ejercicios en transacción ─────────────
async function insertEjercicios(client, sesionId, ejercicios) {
  if (!Array.isArray(ejercicios) || !ejercicios.length) return;
  for (const e of ejercicios) {
    const setsData = e.sets_data
      ? (typeof e.sets_data === 'string' ? e.sets_data : JSON.stringify(e.sets_data))
      : null;
    await client.query(
      'INSERT INTO ejercicios (sesion_id,nombre,series,reps,peso_kg,sets_data) VALUES ($1,$2,$3,$4,$5,$6)',
      [sesionId, e.nombre, e.series || null, e.reps ?? null, e.peso_kg ?? null, setsData]
    );
  }
}

// ── GET /api/sesiones ──────────────────────────────────────
router.get('/sesiones', [
  query('page').optional().isInt({ min: 1 }),
  query('limit').optional().isInt({ min: 1, max: 100 }),
  query('tipo').optional().isString(),
  query('desde').optional().isDate(),
  query('hasta').optional().isDate(),
  query('q').optional().isString(),
  query('grupo').optional().isString(),
  query('subgrupo').optional().isString(),
], async (req, res) => {
  try {
    const page = parseInt(req.query.page) || 1;
    const limit = Math.min(parseInt(req.query.limit) || 20, 100);
    const offset = (page - 1) * limit;
    const { tipo, desde, hasta, q, grupo, subgrupo } = req.query;
    const uid = req.user.id;

    let where = 'WHERE s.user_id=$1';
    const params = [uid];
    let pi = 2;

    if (tipo) { where += ` AND s.tipo=$${pi++}`; params.push(tipo); }
    if (desde) { where += ` AND s.fecha>=$${pi++}`; params.push(desde); }
    if (hasta) { where += ` AND s.fecha<=$${pi++}`; params.push(hasta); }
    if (q) {
      where += ` AND (
        s.tipo ILIKE $${pi}
        OR s.notas ILIKE $${pi}
        OR (
          TO_CHAR(s.fecha,'DD') || ' ' ||
          CASE EXTRACT(MONTH FROM s.fecha)::int
            WHEN 1 THEN 'ene' WHEN 2 THEN 'feb' WHEN 3 THEN 'mar' WHEN 4 THEN 'abr'
            WHEN 5 THEN 'may' WHEN 6 THEN 'jun' WHEN 7 THEN 'jul' WHEN 8 THEN 'ago'
            WHEN 9 THEN 'sep' WHEN 10 THEN 'oct' WHEN 11 THEN 'nov' WHEN 12 THEN 'dic'
          END || ' ' || TO_CHAR(s.fecha,'YYYY')
        ) ILIKE $${pi}
        OR TO_CHAR(s.fecha,'YYYY-MM-DD') ILIKE $${pi}
        OR TO_CHAR(s.fecha,'DD/MM/YYYY') ILIKE $${pi}
        OR EXISTS (
          SELECT 1 FROM ejercicios e2
          WHERE e2.sesion_id = s.id AND e2.nombre ILIKE $${pi}
        )
      )`;
      params.push('%'+q+'%');
      pi++;
    }
    if (grupo) {
      where += ` AND EXISTS (
        SELECT 1 FROM ejercicios ej2
        JOIN ejercicios_catalogo ec ON LOWER(ec.nombre) = LOWER(ej2.nombre)
        WHERE ej2.sesion_id = s.id AND ec.grupo_muscular = $${pi++}
      )`;
      params.push(grupo);
    }
    if (subgrupo) {
      where += ` AND EXISTS (
        SELECT 1 FROM ejercicios ej2
        JOIN ejercicios_catalogo ec ON LOWER(ec.nombre) = LOWER(ej2.nombre)
        WHERE ej2.sesion_id = s.id AND ec.subgrupo = $${pi++}
      )`;
      params.push(subgrupo);
    }

    const totalRow = await queryOne(`SELECT COUNT(*) as n FROM sesiones s ${where}`, params);
    const total = parseInt(totalRow.n);

    const sesiones = await queryAll(
      `SELECT s.* FROM sesiones s ${where} ORDER BY s.fecha DESC, s.id DESC LIMIT $${pi} OFFSET $${pi+1}`,
      [...params, limit, offset]
    );

    await Promise.all(sesiones.map(async s => { s.ejercicios = await loadEjercicios(s.id); }));

    res.json({ ok: true, total, page, pages: Math.ceil(total / limit), sesiones });
  } catch(e) { res.status(500).json({ ok: false, error: e.message }); }
});

// ── GET /api/sesiones/stats ────────────────────────────────
router.get('/sesiones/stats', async (req, res) => {
  try {
    const uid = req.user.id;

    const [totales, ultimasSemana, recientes, progreso, mejorEjercicio, fechasRow] = await Promise.all([
      queryOne(`
        SELECT COUNT(*) as total,
               COALESCE(SUM(duracion_min),0) as total_minutos,
               COALESCE(SUM(calorias),0) as total_calorias,
               COALESCE(AVG(valoracion),0) as media_valoracion
        FROM sesiones WHERE user_id=$1`, [uid]),
      queryOne(`SELECT COUNT(*) as n FROM sesiones WHERE user_id=$1 AND fecha >= NOW()-INTERVAL '7 days'`, [uid]),
      queryAll(`SELECT * FROM sesiones WHERE user_id=$1 ORDER BY fecha DESC, id DESC LIMIT 5`, [uid]),
      queryAll(`
        SELECT TO_CHAR(fecha,'IYYY-"W"IW') as semana,
               COUNT(*) as sesiones,
               COALESCE(SUM(duracion_min),0) as minutos,
               COALESCE(SUM(calorias),0) as calorias
        FROM sesiones
        WHERE user_id=$1 AND fecha >= NOW()-INTERVAL '56 days'
        GROUP BY semana ORDER BY semana ASC`, [uid]),
      queryAll(`
        SELECT e.nombre, MAX(e.peso_kg) as max_peso, COUNT(*) as veces
        FROM ejercicios e
        JOIN sesiones s ON s.id=e.sesion_id
        WHERE s.user_id=$1 AND e.peso_kg IS NOT NULL
        GROUP BY e.nombre ORDER BY max_peso DESC LIMIT 5`, [uid]),
      queryAll(`SELECT DISTINCT fecha::text FROM sesiones WHERE user_id=$1 ORDER BY fecha DESC`, [uid]),
    ]);

    // Racha de días consecutivos
    let racha = 0;
    if (fechasRow.length) {
      let current = new Date();
      current.setHours(0,0,0,0);
      for (const row of fechasRow) {
        const f = new Date(row.fecha);
        f.setHours(0,0,0,0);
        const diff = Math.round((current - f) / 86400000);
        if (diff <= 1) { racha++; current = f; }
        else break;
      }
    }

    // Cargar ejercicios de recientes
    for (const s of recientes) {
      s.ejercicios = await loadEjercicios(s.id);
    }

    res.json({ ok: true, stats: {
      total: parseInt(totales.total),
      totalMinutos: parseInt(totales.total_minutos),
      totalCalorias: parseInt(totales.total_calorias),
      mediaValoracion: Math.round(parseFloat(totales.media_valoracion)*10)/10,
      ultimasSemana: parseInt(ultimasSemana.n),
      recientes,
      progreso,
      racha,
      mejorEjercicio,
    }});
  } catch(e) { res.status(500).json({ ok: false, error: e.message }); }
});

// ── GET /api/sesiones/:id ──────────────────────────────────
router.get('/sesiones/:id', async (req, res) => {
  try {
    const s = await queryOne('SELECT * FROM sesiones WHERE id=$1 AND user_id=$2', [req.params.id, req.user.id]);
    if (!s) return res.status(404).json({ ok: false, error: 'Sesión no encontrada' });
    s.ejercicios = await loadEjercicios(s.id);
    res.json({ ok: true, sesion: s });
  } catch(e) { res.status(500).json({ ok: false, error: e.message }); }
});

// ── POST /api/sesiones ─────────────────────────────────────
router.post('/sesiones', validateSesion, async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) return res.status(400).json({ ok: false, error: errors.array()[0].msg });
  try {
    const { fecha, tipo, duracion_min, notas, calorias, valoracion, ejercicios, importado } = req.body;
    const sesion = await withTransaction(async (client) => {
      const row = await client.query(
        'INSERT INTO sesiones (user_id,fecha,tipo,duracion_min,notas,calorias,valoracion,importado) VALUES ($1,$2,$3,$4,$5,$6,$7,$8) RETURNING *',
        [req.user.id, fecha, tipo, duracion_min||null, notas||null, calorias||null, valoracion||null, importado||false]
      );
      const s = row.rows[0];
      await insertEjercicios(client, s.id, ejercicios);
      return s;
    });
    sesion.ejercicios = await loadEjercicios(sesion.id);
    res.status(201).json({ ok: true, mensaje: 'Sesión guardada', sesion });
  } catch(e) { res.status(500).json({ ok: false, error: e.message }); }
});

// ── PUT /api/sesiones/:id ──────────────────────────────────
router.put('/sesiones/:id', validateSesion, async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) return res.status(400).json({ ok: false, error: errors.array()[0].msg });
  try {
    const { fecha, tipo, duracion_min, notas, calorias, valoracion, ejercicios } = req.body;
    const sesion = await withTransaction(async (client) => {
      const check = await client.query('SELECT id FROM sesiones WHERE id=$1 AND user_id=$2', [req.params.id, req.user.id]);
      if (!check.rows[0]) throw new Error('NOT_FOUND');
      await client.query(
        'UPDATE sesiones SET fecha=$1,tipo=$2,duracion_min=$3,notas=$4,calorias=$5,valoracion=$6 WHERE id=$7',
        [fecha, tipo, duracion_min||null, notas||null, calorias||null, valoracion||null, req.params.id]
      );
      await client.query('DELETE FROM ejercicios WHERE sesion_id=$1', [req.params.id]);
      await insertEjercicios(client, req.params.id, ejercicios);
      const row = await client.query('SELECT * FROM sesiones WHERE id=$1', [req.params.id]);
      return row.rows[0];
    });
    sesion.ejercicios = await loadEjercicios(sesion.id);
    res.json({ ok: true, mensaje: 'Sesión actualizada', sesion });
  } catch(e) {
    if (e.message === 'NOT_FOUND') return res.status(404).json({ ok: false, error: 'Sesión no encontrada' });
    res.status(500).json({ ok: false, error: e.message });
  }
});

// ── DELETE /api/sesiones (eliminar todo el historial del usuario) ──
router.delete('/sesiones', async (req, res) => {
  try {
    await queryOne('DELETE FROM sesiones WHERE user_id=$1', [req.user.id]);
    res.json({ ok: true, mensaje: 'Historial eliminado' });
  } catch(e) { res.status(500).json({ ok: false, error: e.message }); }
});

// ── DELETE /api/sesiones/:id ───────────────────────────────
router.delete('/sesiones/:id', async (req, res) => {
  try {
    const row = await queryOne('DELETE FROM sesiones WHERE id=$1 AND user_id=$2 RETURNING id', [req.params.id, req.user.id]);
    if (!row) return res.status(404).json({ ok: false, error: 'Sesión no encontrada' });
    res.json({ ok: true, mensaje: 'Sesión eliminada' });
  } catch(e) { res.status(500).json({ ok: false, error: e.message }); }
});

// ── POST /api/sesiones/sync (offline batch) ───────────────
router.post('/sesiones/sync', async (req, res) => {
  try {
    const { sesiones } = req.body;
    if (!Array.isArray(sesiones) || !sesiones.length)
      return res.status(400).json({ ok: false, error: 'No hay sesiones' });
    await withTransaction(async (client) => {
      for (const s of sesiones) {
        const row = await client.query(
          'INSERT INTO sesiones (user_id,fecha,tipo,duracion_min,notas,calorias,valoracion) VALUES ($1,$2,$3,$4,$5,$6,$7) RETURNING id',
          [req.user.id, s.fecha, s.tipo, s.duracion_min||null, s.notas||null, s.calorias||null, s.valoracion||null]
        );
        await insertEjercicios(client, row.rows[0].id, s.ejercicios);
      }
    });
    res.json({ ok: true, mensaje: sesiones.length + ' sesiones sincronizadas' });
  } catch(e) { res.status(500).json({ ok: false, error: e.message }); }
});

// ── GET /api/sesiones/export/csv ───────────────────────────
router.get('/sesiones/export/csv', async (req, res) => {
  try {
    const sesiones = await queryAll('SELECT * FROM sesiones WHERE user_id=$1 ORDER BY fecha DESC', [req.user.id]);
    const rows = ['fecha,tipo,duracion_min,calorias,valoracion,notas'];
    sesiones.forEach(s => {
      rows.push([
        s.fecha, s.tipo, s.duracion_min||'', s.calorias||'',
        s.valoracion||'', (s.notas||'').replace(/,/g,' ')
      ].join(','));
    });
    res.setHeader('Content-Type', 'text/csv');
    res.setHeader('Content-Disposition', 'attachment; filename=gymy_export.csv');
    res.send(rows.join('\n'));
  } catch(e) { res.status(500).json({ ok: false, error: e.message }); }
});

// ── GET /api/ejercicios/historial?nombre=X ─────────────────
router.get('/ejercicios/historial', async (req, res) => {
  try {
    const { nombre } = req.query;
    if (!nombre) return res.status(400).json({ ok: false, error: 'Nombre requerido' });
    const rows = await queryAll(`
      SELECT e.nombre, e.peso_kg, e.reps, e.series, e.sets_data,
             s.fecha::text, s.id AS sesion_id
      FROM ejercicios e
      JOIN sesiones s ON s.id = e.sesion_id
      WHERE s.user_id = $1
        AND LOWER(e.nombre) = LOWER($2)
      ORDER BY s.fecha DESC, s.id DESC
      LIMIT 50`, [req.user.id, nombre]);
    res.json({ ok: true, historial: rows });
  } catch(e) { res.status(500).json({ ok: false, error: e.message }); }
});


// ── POST /api/ai/import — proxy to Anthropic API ──────────────────
router.post('/ai/import', async (req, res) => {
  try {
    const { prompt } = req.body;
    if (!prompt) return res.status(400).json({ ok: false, error: 'prompt required' });

    const response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': process.env.ANTHROPIC_API_KEY || '',
        'anthropic-version': '2023-06-01'
      },
      body: JSON.stringify({
        model: 'claude-haiku-4-5-20251001',
        max_tokens: 4000,
        messages: [{ role: 'user', content: prompt }]
      })
    });

    if (!response.ok) {
      const err = await response.text();
      return res.status(502).json({ ok: false, error: 'AI error: ' + err.slice(0, 200) });
    }

    const data = await response.json();
    const text = data.content?.[0]?.text || '';
    res.json({ ok: true, text });
  } catch(e) {
    res.status(500).json({ ok: false, error: e.message });
  }
});

// ── GET /api/plantillas — propias del usuario ──────────────────────────────
router.get('/plantillas', async (req, res) => {
  try {
    const rows = await queryAll(
      `SELECT id, nombre, grupo_muscular, subgrupo, equipo, tipo, user_id,
              TRUE AS propia
       FROM plantillas_ejercicios
       WHERE activo = TRUE AND user_id = $1
       ORDER BY grupo_muscular, nombre`,
      [req.user.id]
    );
    res.json({ ok: true, plantillas: rows });
  } catch(e) { res.status(500).json({ ok: false, error: e.message }); }
});

// ── POST /api/plantillas — crear plantilla personal ─────────────────────────
// grupo_muscular debe ser de GRUPOS_VALIDOS; subgrupo no lo elige el usuario
router.post('/plantillas', async (req, res) => {
  try {
    const { nombre, grupo_muscular, equipo, tipo } = req.body;
    if (!nombre || !grupo_muscular)
      return res.status(400).json({ ok: false, error: 'nombre y grupo_muscular requeridos' });
    if (!GRUPOS_VALIDOS.includes(grupo_muscular))
      return res.status(400).json({ ok: false, error: `grupo_muscular debe ser uno de: ${GRUPOS_VALIDOS.join(', ')}` });
    const existing = await queryOne(
      `SELECT id FROM plantillas_ejercicios WHERE lower(nombre)=lower($1) AND user_id=$2 AND activo=TRUE`,
      [nombre, req.user.id]
    );
    if (existing) return res.json({ ok: true, id: existing.id, created: false });
    // Si el ejercicio está en el catálogo, heredar su subgrupo; si no, usar el primero del grupo
    const catEj = await queryOne(
      `SELECT subgrupo FROM ejercicios_catalogo WHERE nombre ILIKE $1 AND activo=TRUE LIMIT 1`, [nombre]
    );
    const subgrupo = catEj?.subgrupo || (SUBGRUPOS_POR_GRUPO[grupo_muscular] || [])[0] || grupo_muscular;
    const row = await queryOne(
      `INSERT INTO plantillas_ejercicios (nombre, grupo_muscular, subgrupo, equipo, tipo, user_id)
       VALUES ($1,$2,$3,$4,$5,$6) RETURNING id`,
      [nombre, grupo_muscular, subgrupo, equipo||null, tipo||'genérico', req.user.id]
    );
    res.status(201).json({ ok: true, id: row.id, created: true });
  } catch(e) { res.status(500).json({ ok: false, error: e.message }); }
});

// ── POST /api/plantillas/bulk — importar varias plantillas ──────────────────
// grupo_muscular y subgrupo: se toman del catálogo si existe el ejercicio;
// si no, grupo debe ser válido y subgrupo se asigna automáticamente.
router.post('/plantillas/bulk', async (req, res) => {
  try {
    const { ejercicios } = req.body;
    if (!Array.isArray(ejercicios) || !ejercicios.length)
      return res.status(400).json({ ok: false, error: 'ejercicios array requerido' });
    let count = 0;
    for (const e of ejercicios) {
      if (!e.nombre) continue;
      // Buscar en catálogo para obtener grupo/subgrupo canónicos
      const catEj = await queryOne(
        `SELECT grupo_muscular, subgrupo FROM ejercicios_catalogo WHERE nombre ILIKE $1 AND activo=TRUE LIMIT 1`,
        [e.nombre]
      );
      const grupo = catEj?.grupo_muscular || e.grupo_muscular;
      if (!grupo || !GRUPOS_VALIDOS.includes(grupo)) continue; // grupo inválido → saltar
      const subgrupo = catEj?.subgrupo || (SUBGRUPOS_POR_GRUPO[grupo] || [])[0] || grupo;
      const exists = await queryOne(
        `SELECT id FROM plantillas_ejercicios WHERE lower(nombre)=lower($1) AND user_id=$2`,
        [e.nombre, req.user.id]
      );
      if (exists) continue;
      await queryOne(
        `INSERT INTO plantillas_ejercicios (nombre, grupo_muscular, subgrupo, equipo, tipo, user_id)
         VALUES ($1,$2,$3,$4,$5,$6) RETURNING id`,
        [e.nombre, grupo, subgrupo, e.equipo||null, e.tipo||'genérico', req.user.id]
      );
      count++;
    }
    res.json({ ok: true, creados: count });
  } catch(e) { res.status(500).json({ ok: false, error: e.message }); }
});

// ── DELETE /api/plantillas/:id — eliminar plantilla propia ─────────────────
router.delete('/plantillas/:id', async (req, res) => {
  try {
    const row = await queryOne(
      `DELETE FROM plantillas_ejercicios WHERE id=$1 AND user_id=$2 RETURNING id`,
      [req.params.id, req.user.id]
    );
    if (!row) return res.status(404).json({ ok: false, error: 'Plantilla no encontrada o sin permisos' });
    res.json({ ok: true, mensaje: 'Plantilla eliminada' });
  } catch(e) { res.status(500).json({ ok: false, error: e.message }); }
});

// ── DELETE /api/plantillas — eliminar todas las plantillas propias ──────────
router.delete('/plantillas', async (req, res) => {
  try {
    await pool.query(`DELETE FROM plantillas_ejercicios WHERE user_id=$1`, [req.user.id]);
    res.json({ ok: true, mensaje: 'Plantillas personales eliminadas' });
  } catch(e) { res.status(500).json({ ok: false, error: e.message }); }
});

module.exports = router;