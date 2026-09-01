const express = require('express');
const bcrypt = require('bcryptjs');
const pool = require('../db');
const authMiddleware = require('../middleware/auth');

const router = express.Router();
router.use(authMiddleware); // tutte le rotte qui sotto richiedono un login valido

// ---- Info account ----
router.get('/', async (req, res) => {
  const result = await pool.query(
    'SELECT username, avatar, settings FROM users WHERE id = $1',
    [req.userId]
  );
  res.json(result.rows[0]);
});

// ---- Cambia username ----
router.patch('/username', async (req, res) => {
  const { newUsername, password } = req.body || {};
  if (!newUsername || !password) {
    return res.status(400).json({ error: 'Compila tutti i campi.' });
  }

  const result = await pool.query('SELECT * FROM users WHERE id = $1', [req.userId]);
  const user = result.rows[0];
  const valid = await bcrypt.compare(password, user.password_hash);
  if (!valid) {
    return res.status(401).json({ error: 'Password non corretta.' });
  }

  const existing = await pool.query(
    'SELECT id FROM users WHERE username = $1 AND id != $2',
    [newUsername, req.userId]
  );
  if (existing.rows.length > 0) {
    return res.status(409).json({ error: 'Username già in uso.' });
  }

  await pool.query('UPDATE users SET username = $1 WHERE id = $2', [newUsername, req.userId]);
  res.json({ username: newUsername });
});

// ---- Cambia password ----
router.patch('/password', async (req, res) => {
  const { currentPassword, newPassword } = req.body || {};
  if (!currentPassword || !newPassword) {
    return res.status(400).json({ error: 'Compila tutti i campi.' });
  }

  const result = await pool.query('SELECT * FROM users WHERE id = $1', [req.userId]);
  const user = result.rows[0];
  const valid = await bcrypt.compare(currentPassword, user.password_hash);
  if (!valid) {
    return res.status(401).json({ error: 'Password attuale non corretta.' });
  }

  const newHash = await bcrypt.hash(newPassword, 10);
  await pool.query('UPDATE users SET password_hash = $1 WHERE id = $2', [newHash, req.userId]);
  res.json({ ok: true });
});

// ---- Avatar (immagine come stringa base64) ----
router.put('/avatar', async (req, res) => {
  const { avatar } = req.body || {};
  await pool.query('UPDATE users SET avatar = $1 WHERE id = $2', [avatar || null, req.userId]);
  res.json({ ok: true });
});

// ---- Impostazioni (tema, vista, stato preferiti compressi...) ----
router.put('/settings', async (req, res) => {
  const settings = req.body || {};
  await pool.query('UPDATE users SET settings = $1 WHERE id = $2', [JSON.stringify(settings), req.userId]);
  res.json({ ok: true });
});

// ---- Elimina account ----
router.delete('/', async (req, res) => {
  const { password } = req.body || {};
  if (!password) {
    return res.status(400).json({ error: 'Password obbligatoria per confermare.' });
  }

  const result = await pool.query('SELECT * FROM users WHERE id = $1', [req.userId]);
  const user = result.rows[0];
  const valid = await bcrypt.compare(password, user.password_hash);
  if (!valid) {
    return res.status(401).json({ error: 'Password non corretta.' });
  }

  await pool.query('DELETE FROM users WHERE id = $1', [req.userId]);
  res.json({ ok: true });
});

module.exports = router;
