require('dotenv').config();
const express = require('express');
const cors = require('cors');
const rateLimit = require('express-rate-limit');
const path = require('path');

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
  console.error('Error:', err.message);
  res.status(500).json({ ok: false, error: 'Error interno del servidor' });
});

// Log DATABASE_URL status al arrancar (sin mostrar credenciales)
const dbUrl = process.env.DATABASE_URL || '';
if (!dbUrl) {
  console.error('ERROR: DATABASE_URL no está configurada');
  process.exit(1);
}
const dbHost = dbUrl.replace(/postgresql:\/\/[^@]+@/, 'postgresql://***@');
console.log('[DB] Conectando a:', dbHost);

initDB()
  .then(() => {
    app.listen(PORT, '0.0.0.0', () => console.log(`GyMy v3 (PostgreSQL) → http://0.0.0.0:${PORT}`));
    // Limpiar reset_tokens expirados cada 6 horas
    const { pool } = require('./database/init');
    setInterval(async () => {
      try {
        const r = await pool.query(
          `UPDATE users SET reset_token=NULL, reset_token_exp=NULL WHERE reset_token IS NOT NULL AND reset_token_exp < NOW()`
        );
        if (r.rowCount > 0) console.log(`[Cleanup] ${r.rowCount} reset token(s) expirado(s) eliminado(s)`);
      } catch(e) { console.error('[Cleanup] Error:', e.message); }
    }, 6 * 60 * 60 * 1000);
  })
  .catch(err => {
    console.error('No se pudo conectar a PostgreSQL:', err.message || err.code || JSON.stringify(err));
    process.exit(1);
  });

module.exports = app;
