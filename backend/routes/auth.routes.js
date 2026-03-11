const express = require('express');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const crypto = require('crypto');
const nodemailer = require('nodemailer');
const rateLimit = require('express-rate-limit');
const { body, validationResult } = require('express-validator');
const { queryOne, queryAll } = require('../database/init');
const verifyToken = require('../middleware/verifyToken');
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
  const refreshToken = jwt.sign(payload, process.env.JWT_REFRESH_SECRET || process.env.JWT_SECRET + '_refresh', { expiresIn: '30d' });
  return { accessToken, refreshToken };
}

const validateRegister = [
  body('username').trim().isLength({ min: 3, max: 30 }).matches(/^[a-zA-Z0-9_]+$/),
  body('email').isEmail().normalizeEmail(),
  body('password').isLength({ min: 6 })
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
      'INSERT INTO users (username,email,password) VALUES ($1,$2,$3) RETURNING id,username,email',
      [username, email, hash]
    );
    const payload = { id: user.id, username: user.username, email: user.email };
    const { accessToken, refreshToken } = generateTokens(payload);
    await queryOne('UPDATE users SET refresh_token=$1 WHERE id=$2', [refreshToken, user.id]);
    res.status(201).json({ ok: true, accessToken, refreshToken, usuario: payload });
  } catch(e) { res.status(500).json({ ok: false, error: e.message }); }
});

// ── LOGIN ─────────────────────────────────────────────────
router.post('/login', validateLogin, async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) return res.status(400).json({ ok: false, error: errors.array()[0].msg });
  try {
    const { email, password } = req.body;
    const user = await queryOne('SELECT * FROM users WHERE email=$1', [email]);
    if (!user || !(await bcrypt.compare(password, user.password)))
      return res.status(401).json({ ok: false, error: 'Email o contraseña incorrectos' });
    await queryOne('UPDATE users SET last_login=NOW() WHERE id=$1', [user.id]);
    const payload = { id: user.id, username: user.username, email: user.email };
    const { accessToken, refreshToken } = generateTokens(payload);
    await queryOne('UPDATE users SET refresh_token=$1 WHERE id=$2', [refreshToken, user.id]);
    res.json({ ok: true, accessToken, refreshToken, usuario: payload });
  } catch(e) { res.status(500).json({ ok: false, error: e.message }); }
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
  } catch(e) { res.status(403).json({ ok: false, error: 'Refresh token expirado o inválido' }); }
});

// ── LOGOUT ────────────────────────────────────────────────
router.post('/logout', verifyToken, async (req, res) => {
  await queryOne('UPDATE users SET refresh_token=NULL WHERE id=$1', [req.user.id]);
  res.json({ ok: true, mensaje: 'Sesión cerrada' });
});

// ── PERFIL ────────────────────────────────────────────────
router.get('/me', verifyToken, async (req, res) => {
  const user = await queryOne('SELECT id,username,email,created_at,last_login FROM users WHERE id=$1', [req.user.id]);
  if (!user) return res.status(404).json({ ok: false, error: 'Usuario no encontrado' });
  res.json({ ok: true, usuario: user });
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
      console.log('\n[DEV] Reset link:', resetUrl, '\n');
    }
    res.json({ ok: true, mensaje: 'Si el email existe recibirás un enlace' });
  } catch(e) { res.status(500).json({ ok: false, error: e.message }); }
});

// ── RESET PASSWORD ────────────────────────────────────────
router.post('/reset-password', [body('password').isLength({ min: 6 })], async (req, res) => {
  try {
    const { token, password } = req.body;
    if (!token) return res.status(400).json({ ok: false, error: 'Token requerido' });
    const user = await queryOne('SELECT * FROM users WHERE reset_token=$1', [token]);
    if (!user || new Date(user.reset_token_exp) < new Date())
      return res.status(400).json({ ok: false, error: 'Token inválido o expirado' });
    const hash = await bcrypt.hash(password, 12);
    await queryOne('UPDATE users SET password=$1, reset_token=NULL, reset_token_exp=NULL WHERE id=$2', [hash, user.id]);
    res.json({ ok: true, mensaje: 'Contraseña actualizada correctamente' });
  } catch(e) { res.status(500).json({ ok: false, error: e.message }); }
});

module.exports = router;
