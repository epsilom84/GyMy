const express = require('express');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const crypto = require('crypto');
const nodemailer = require('nodemailer');
const rateLimit = require('express-rate-limit');
const { body, validationResult } = require('express-validator');
const { queryOne, queryAll } = require('../database/init');
const verifyToken = require('../middleware/verifyToken');
const log = require('../logger');
const router = express.Router();

const forgotPasswordLimiter = rateLimit({
  windowMs: 60 * 60 * 1000, // 1 hora
  max: 3,
  message: { ok: false, error: 'Demasiados intentos. Espera 1 hora.' },
  standardHeaders: true,
  legacyHeaders: false,
});

// ── Email ──────────────────────────────────────────────────
function getMailer() {
  if (!process.env.EMAIL_USER) return null;
  return nodemailer.createTransport({
    service: 'gmail',
    auth: { user: process.env.EMAIL_USER, pass: process.env.EMAIL_PASS }
  });
}

function generateTokens(payload) {
  const accessToken = jwt.sign(payload, process.env.JWT_SECRET, { expiresIn: '15m' });
  const refreshToken = jwt.sign(payload, process.env.JWT_REFRESH_SECRET || process.env.JWT_SECRET + '_refresh', { expiresIn: '7d' });
  return { accessToken, refreshToken };
}

const validateRegister = [
  body('username').trim().isLength({ min: 3, max: 30 }).matches(/^[a-zA-Z0-9_]+$/),
  body('email').isEmail().normalizeEmail(),
  body('password').isLength({ min: 8 }).withMessage('La contraseña debe tener al menos 8 caracteres')
];
const validateLogin = [
  body('email').isEmail().normalizeEmail(),
  body('password').notEmpty()
];

// ── REGISTRO ──────────────────────────────────────────────
router.post('/register', validateRegister, async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) return res.status(400).json({ ok: false, error: errors.array()[0].msg });
  try {
    const { username, email, password } = req.body;
    const exists = await queryOne('SELECT id FROM users WHERE username=$1 OR email=$2', [username, email]);
    if (exists) return res.status(409).json({ ok: false, error: 'Usuario o email ya registrado' });
    const hash = await bcrypt.hash(password, 12);
    const user = await queryOne(
      'INSERT INTO users (username,email,password) VALUES ($1,$2,$3) RETURNING id,username,email,nivel_usuario',
      [username, email, hash]
    );
    const payload = { id: user.id, username: user.username, email: user.email, nivel_usuario: user.nivel_usuario };
    const { accessToken, refreshToken } = generateTokens(payload);
    await queryOne('UPDATE users SET refresh_token=$1 WHERE id=$2', [refreshToken, user.id]);
    res.status(201).json({ ok: true, accessToken, refreshToken, usuario: payload });
  } catch(e) {
    log.error({ err: e, url: req.url }, 'Register error');
    res.status(500).json({ ok: false, error: 'Error interno del servidor' });
  }
});

const MAX_FAILED_ATTEMPTS = 5;
const LOCKOUT_MINUTES = 15;

// ── LOGIN ─────────────────────────────────────────────────
router.post('/login', validateLogin, async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) return res.status(400).json({ ok: false, error: errors.array()[0].msg });
  try {
    const { email, password } = req.body;
    const user = await queryOne('SELECT * FROM users WHERE email=$1', [email]);

    // Usuario no encontrado: responder igual que contraseña incorrecta (evita enumeración)
    if (!user) return res.status(401).json({ ok: false, error: 'Email o contraseña incorrectos' });

    // Comprobar bloqueo por intentos fallidos
    if (user.locked_until && new Date(user.locked_until) > new Date()) {
      const mins = Math.ceil((new Date(user.locked_until) - new Date()) / 60000);
      return res.status(429).json({ ok: false, error: `Cuenta bloqueada. Intenta en ${mins} min.` });
    }

    const passOk = await bcrypt.compare(password, user.password);
    if (!passOk) {
      const attempts = (user.failed_login_attempts || 0) + 1;
      const lock = attempts >= MAX_FAILED_ATTEMPTS
        ? new Date(Date.now() + LOCKOUT_MINUTES * 60 * 1000)
        : null;
      await queryOne(
        'UPDATE users SET failed_login_attempts=$1, locked_until=$2 WHERE id=$3',
        [attempts, lock, user.id]
      );
      if (lock) return res.status(429).json({ ok: false, error: `Demasiados intentos. Cuenta bloqueada ${LOCKOUT_MINUTES} min.` });
      return res.status(401).json({ ok: false, error: 'Email o contraseña incorrectos' });
    }

    // Login correcto: resetear contadores y actualizar refresh token
    const payload = { id: user.id, username: user.username, email: user.email, nivel_usuario: user.nivel_usuario || 2 };
    const { accessToken, refreshToken } = generateTokens(payload);
    await queryOne(
      'UPDATE users SET refresh_token=$1, last_login=NOW(), failed_login_attempts=0, locked_until=NULL WHERE id=$2',
      [refreshToken, user.id]
    );
    res.json({ ok: true, accessToken, refreshToken, usuario: payload });
  } catch(e) {
    log.error({ err: e, url: req.url }, 'Login error');
    res.status(500).json({ ok: false, error: 'Error interno del servidor' });
  }
});

// ── REFRESH TOKEN ─────────────────────────────────────────
router.post('/refresh', async (req, res) => {
  const { refreshToken } = req.body;
  if (!refreshToken) return res.status(401).json({ ok: false, error: 'Refresh token requerido' });
  try {
    const decoded = jwt.verify(refreshToken, process.env.JWT_REFRESH_SECRET || process.env.JWT_SECRET + '_refresh');
    const user = await queryOne('SELECT * FROM users WHERE id=$1 AND refresh_token=$2', [decoded.id, refreshToken]);
    if (!user) return res.status(403).json({ ok: false, error: 'Refresh token inválido' });
    const payload = { id: user.id, username: user.username, email: user.email };
    const tokens = generateTokens(payload);
    await queryOne('UPDATE users SET refresh_token=$1 WHERE id=$2', [tokens.refreshToken, user.id]);
    res.json({ ok: true, ...tokens });
  } catch(e) {
    log.error({ err: e, url: req.url }, 'Refresh error');
    res.status(403).json({ ok: false, error: 'Refresh token expirado o inválido' });
  }
});

// ── LOGOUT ────────────────────────────────────────────────
router.post('/logout', verifyToken, async (req, res) => {
  await queryOne('UPDATE users SET refresh_token=NULL WHERE id=$1', [req.user.id]);
  res.json({ ok: true, mensaje: 'Sesión cerrada' });
});

// ── PERFIL ────────────────────────────────────────────────
router.get('/me', verifyToken, async (req, res) => {
  const user = await queryOne('SELECT id,username,email,created_at,last_login,edad,genero,peso_corporal FROM users WHERE id=$1', [req.user.id]);
  if (!user) return res.status(404).json({ ok: false, error: 'Usuario no encontrado' });
  res.json({ ok: true, usuario: user });
});

// ── ACTUALIZAR PERFIL FÍSICO ──────────────────────────────
router.put('/me', verifyToken, [
  body('edad').optional({ nullable: true }).isInt({ min: 10, max: 120 }),
  body('genero').optional({ nullable: true }).isIn(['M', 'F', 'O']),
  body('peso_corporal').optional({ nullable: true }).isFloat({ min: 20, max: 300 }),
], async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) return res.status(400).json({ ok: false, errores: errors.array() });
  try {
    const { edad, genero, peso_corporal } = req.body;
    await queryOne(
      `UPDATE users SET edad=$1, genero=$2, peso_corporal=$3 WHERE id=$4`,
      [edad || null, genero || null, peso_corporal || null, req.user.id]
    );
    res.json({ ok: true });
  } catch(e) {
    log.error({ err: e, url: req.url }, 'Update profile error');
    res.status(500).json({ ok: false, error: 'Error interno del servidor' });
  }
});

// ── FORGOT PASSWORD ───────────────────────────────────────
router.post('/forgot-password', forgotPasswordLimiter, [body('email').isEmail().normalizeEmail()], async (req, res) => {
  try {
    const { email } = req.body;
    const user = await queryOne('SELECT * FROM users WHERE email=$1', [email]);
    if (!user) return res.json({ ok: true, mensaje: 'Si el email existe recibirás un enlace' });
    const token = crypto.randomBytes(32).toString('hex');
    const exp = new Date(Date.now() + 3600000); // 1 hora
    await queryOne('UPDATE users SET reset_token=$1, reset_token_exp=$2 WHERE id=$3', [token, exp, user.id]);
    const resetUrl = (process.env.FRONTEND_URL || 'http://localhost:3000') + '/?token=' + token;
    const mailer = getMailer();
    if (mailer) {
      await mailer.sendMail({
        from: process.env.EMAIL_USER, to: email,
        subject: 'GyMy - Recuperar contraseña',
        html: `<p>Haz clic para resetear tu contraseña (caduca en 1h):</p><a href="${resetUrl}">${resetUrl}</a>`
      });
    } else {
      log.info({ resetUrl }, 'DEV reset link (no mailer configured)');
    }
    res.json({ ok: true, mensaje: 'Si el email existe recibirás un enlace' });
  } catch(e) {
    log.error({ err: e, url: req.url }, 'Forgot password error');
    res.status(500).json({ ok: false, error: 'Error interno del servidor' });
  }
});

// ── RESET PASSWORD ────────────────────────────────────────
router.post('/reset-password', [
  body('email').isEmail().normalizeEmail().withMessage('Email no válido'),
  body('password').isLength({ min: 8 }).withMessage('La contraseña debe tener al menos 8 caracteres'),
], async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) return res.status(400).json({ ok: false, error: errors.array()[0].msg });
  try {
    const { token, email, password } = req.body;
    if (!token) return res.status(400).json({ ok: false, error: 'Token requerido' });
    const user = await queryOne('SELECT * FROM users WHERE reset_token=$1', [token]);
    // Verificar token válido, no expirado y que el email coincide con el propietario del token
    if (!user || new Date(user.reset_token_exp) < new Date() || user.email !== email)
      return res.status(400).json({ ok: false, error: 'Token inválido o expirado' });
    const hash = await bcrypt.hash(password, 12);
    await queryOne('UPDATE users SET password=$1, reset_token=NULL, reset_token_exp=NULL WHERE id=$2', [hash, user.id]);
    res.json({ ok: true, mensaje: 'Contraseña actualizada correctamente' });
  } catch(e) {
    log.error({ err: e, url: req.url }, 'Reset password error');
    res.status(500).json({ ok: false, error: 'Error interno del servidor' });
  }
});

module.exports = router;
