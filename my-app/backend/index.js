require('dotenv').config();
const express = require('express');
const cors = require('cors');
const app = express();
app.use(express.json());
app.use(cors());
const path = require('path');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { query, pool } = require('./db');

const JWT_SECRET = process.env.JWT_SECRET || 'change_this_secret';

function verifyToken(req, res, next) {
  const auth = req.headers['authorization'] || '';
  const parts = auth.split(' ');
  if (parts.length !== 2 || parts[0] !== 'Bearer') return res.status(401).json({ error: 'missing token' });
  const token = parts[1];
  jwt.verify(token, JWT_SECRET, (err, payload) => {
    if (err) return res.status(401).json({ error: 'invalid token' });
    req.user = payload;
    next();
  });
}

app.post('/webhook/frontend', (req, res) => {
  console.log('[webhook/frontend] received:', JSON.stringify(req.body));
  res.json({status: 'ok', path: '/webhook/frontend', received: req.body});
});

app.post('/webhook/backend', (req, res) => {
  console.log('[webhook/backend] received:', JSON.stringify(req.body));
  res.json({status: 'ok', path: '/webhook/backend', received: req.body});
});

app.get('/health', (req, res) => res.send('ok'));

app.post('/auth/login', (req, res) => {
  (async () => {
    try {
      const { email, password } = req.body || {};
      if (!email || !password) return res.status(400).json({ error: 'email and password required' });

      const result = await query('SELECT * FROM usuarios_internos WHERE email = $1', [email]);
      const user = result.rows[0];
      if (!user) return res.status(401).json({ error: 'invalid credentials' });

      const match = bcrypt.compareSync(password, user.password);
      if (!match) return res.status(401).json({ error: 'invalid credentials' });

      const token = jwt.sign({ id: user.id, email: user.email, rol: user.rol }, JWT_SECRET, { expiresIn: '8h' });
      return res.json({ token, user: { id: user.id, email: user.email, rol: user.rol, nombre_usuario: user.nombre_usuario } });
    } catch (err) {
      console.error('auth error', err);
      return res.status(500).json({ error: 'server error' });
    }
  })();
});

// List users (only RH role)
app.get('/users', verifyToken, async (req, res) => {
  try {
    if (!req.user || req.user.rol !== 'rh') return res.status(403).json({ error: 'forbidden' });
    const result = await query('SELECT id, nombre_usuario, apellido_usuario, email, rol, activo, created_at FROM usuarios_internos ORDER BY id DESC');
    return res.json({ users: result.rows });
  } catch (err) {
    console.error('list users error', err);
    return res.status(500).json({ error: 'server error' });
  }
});

// Create user (only RH role)
app.post('/users', verifyToken, async (req, res) => {
  try {
    if (!req.user || req.user.rol !== 'rh') return res.status(403).json({ error: 'forbidden' });
    const { nombre_usuario, apellido_usuario, email, password, rol } = req.body || {};
    if (!email || !password || !nombre_usuario) return res.status(400).json({ error: 'missing fields' });
    // password rules: max 8, min 4, 1 lowercase, 1 uppercase, 1 digit
    const pwRegex = /^(?=.{4,8}$)(?=.*[a-z])(?=.*[A-Z])(?=.*\d).*$/;
    if (!pwRegex.test(password)) return res.status(400).json({ error: 'password rules not met' });

    const hashed = bcrypt.hashSync(password, 10);
    const insert = await query('INSERT INTO usuarios_internos (nombre_usuario, apellido_usuario, email, password, rol, activo) VALUES ($1,$2,$3,$4,$5,$6) RETURNING id, nombre_usuario, apellido_usuario, email, rol, activo, created_at',
      [nombre_usuario, apellido_usuario, email, hashed, rol || 'user', true]);
    return res.status(201).json({ user: insert.rows[0] });
  } catch (err) {
    console.error('create user error', err);
    if (err.code === '23505') return res.status(409).json({ error: 'email exists' });
    return res.status(500).json({ error: 'server error' });
  }
});

// Client login: authenticate against usuarios_empresas
app.post('/auth/login-client', (req, res) => {
  (async () => {
    try {
      const { email, password } = req.body || {};
      if (!email || !password) return res.status(400).json({ error: 'email and password required' });

      const result = await query('SELECT * FROM usuarios_empresas WHERE email = $1', [email]);
      const user = result.rows[0];
      if (!user) return res.status(401).json({ error: 'invalid credentials' });

      const match = bcrypt.compareSync(password, user.password);
      if (!match) return res.status(401).json({ error: 'invalid credentials' });

      const token = jwt.sign({ id: user.id, email: user.email, rol: 'cliente' }, JWT_SECRET, { expiresIn: '8h' });
      return res.json({ token, user: { id: user.id, email: user.email, rol: 'cliente', nombre_usuario: user.nombre_usuario, empresa_id: user.empresa_id } });
    } catch (err) {
      console.error('client auth error', err);
      return res.status(500).json({ error: 'server error' });
    }
  })();
});

const port = process.env.PORT || 3000;
app.listen(port, () => console.log(`Backend listening on http://localhost:${port}`));
