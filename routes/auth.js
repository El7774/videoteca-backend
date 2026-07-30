const express = require('express');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const pool = require('../db');

const router = express.Router();

function makeToken(user) {
  // Il token contiene id e username, firmato con la chiave segreta del server.
  // Scade dopo 30 giorni: dopo, l'utente dovrà rifare il login.
  return jwt.sign(
    { userId: user.id, username: user.username },
    process.env.JWT_SECRET,
    { expiresIn: '30d' }
  );
}

router.post('/register', async (req, res) => {
  const { username, email, password } = req.body || {};
  if (!username || !email || !password) {
    return res.status(400).json({ error: 'Username, email e password sono obbligatori.' });
  }

  try {
    const existing = await pool.query(
      'SELECT id FROM users WHERE username = $1 OR email = $2',
      [username, email]
    );
    if (existing.rows.length > 0) {
      return res.status(409).json({ error: 'Username o email già in uso.' });
    }

    // Non salviamo MAI la password in chiaro: bcrypt la trasforma in un
    // hash irreversibile. Il "10" è il costo computazionale dell'hashing.
    const passwordHash = await bcrypt.hash(password, 10);

    const result = await pool.query(
      'INSERT INTO users (username, email, password_hash) VALUES ($1, $2, $3) RETURNING id, username',
      [username, email, passwordHash]
    );
    const user = result.rows[0];

    res.json({ token: makeToken(user), username: user.username });
  } catch (err) {
    console.error('Errore registrazione:', err);
    res.status(500).json({ error: 'Errore del server durante la registrazione.' });
  }
});

router.post('/login', async (req, res) => {
  const { username, password } = req.body || {};
  if (!username || !password) {
    return res.status(400).json({ error: 'Username e password sono obbligatori.' });
  }

  try {
    // Accetta sia l'username che l'email nello stesso campo di login
    const result = await pool.query(
      'SELECT * FROM users WHERE username = $1 OR email = $1',
      [username]
    );
    const user = result.rows[0];
    if (!user) {
      return res.status(401).json({ error: 'Username, email o password non corretti.' });
    }

    const valid = await bcrypt.compare(password, user.password_hash);
    if (!valid) {
      return res.status(401).json({ error: 'Username, email o password non corretti.' });
    }

    res.json({ token: makeToken(user), username: user.username });
  } catch (err) {
    console.error('Errore login:', err);
    res.status(500).json({ error: 'Errore del server durante il login.' });
  }
});

module.exports = router;
