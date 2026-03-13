require('dotenv').config();
const express = require('express');
const cors = require('cors');
const rateLimit = require('express-rate-limit');
const path = require('path');
const log = require('./logger');

const { initDB } = require('./database/init');
const authRoutes = require('./routes/auth.routes');
const gymRoutes = require('./routes/gym.routes');

const app = express();
app.set('trust proxy', 1); // Railway usa un proxy inverso
const PORT = process.env.PORT || 3000;
const FRONTEND = path.resolve(__dirname, 'frontend');

app.use(express.static(FRONTEND));
app.use(cors({
  origin: process.env.FRONTEND_URL || '*',
  methods: ['GET','POST','PUT','DELETE'],
  allowedHeaders: ['Content-Type','Authorization']
}));
app.use(express.json({ limit: '2mb' }));
app.use(express.urlencoded({ extended: true }));

app.use('/api/auth', rateLimit({ windowMs: 15*60*1000, max: 30, message: { ok: false, error: 'Demasiadas peticiones.' } }));
app.use('/api', rateLimit({ windowMs: 1*60*1000, max: 120, message: { ok: false, error: 'Demasiadas peticiones.' } }));

app.use('/api/auth', authRoutes);
app.use('/api', gymRoutes);

app.get('/api/ping', (req, res) => res.json({ ok: true, version: '3.0', db: 'postgresql', ts: new Date().toISOString() }));
app.get('*', (req, res) => res.sendFile(path.join(FRONTEND, 'index.html')));

app.use((err, req, res, next) => {
  log.error({ err, method: req.method, url: req.url }, 'Unhandled error');
  res.status(500).json({ ok: false, error: 'Error interno del servidor' });
});

// Log DATABASE_URL status al arrancar (sin mostrar credenciales)
const dbUrl = process.env.DATABASE_URL || '';
if (!dbUrl) {
  log.fatal('DATABASE_URL no está configurada');
  process.exit(1);
}
log.info({ host: dbUrl.replace(/postgresql:\/\/[^@]+@/, 'postgresql://***@') }, 'DB conectando');

initDB()
  .then(() => {
    const { pool } = require('./database/init');

    // Health check real — verifica conectividad con la BD
    app.get('/api/health', async (req, res) => {
      try {
        await pool.query('SELECT 1');
        res.json({ ok: true, db: 'ok', uptime: Math.floor(process.uptime()), ts: new Date().toISOString() });
      } catch(e) {
        log.error({ err: e }, 'Health check DB failed');
        res.status(503).json({ ok: false, db: 'error', error: e.message });
      }
    });

    app.listen(PORT, '0.0.0.0', () => log.info({ port: PORT }, 'GyMy v3 iniciado'));

    // Limpiar reset_tokens expirados cada 6 horas
    setInterval(async () => {
      try {
        const r = await pool.query(
          `UPDATE users SET reset_token=NULL, reset_token_exp=NULL WHERE reset_token IS NOT NULL AND reset_token_exp < NOW()`
        );
        if (r.rowCount > 0) log.info({ count: r.rowCount }, 'Reset tokens expirados eliminados');
      } catch(e) { log.error({ err: e }, 'Cleanup error'); }
    }, 6 * 60 * 60 * 1000);
  })
  .catch(err => {
    log.fatal({ err }, 'No se pudo conectar a PostgreSQL');
    process.exit(1);
  });

module.exports = app;
