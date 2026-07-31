const express = require('express');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const crypto = require('crypto');
const { Resend } = require('resend');
const pool = require('../db');

const router = express.Router();
const resend = new Resend(process.env.RESEND_API_KEY);

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

// ---- Richiesta di reset password ----
router.post('/forgot-password', async (req, res) => {
  const { identifier } = req.body || {};
  if (!identifier) {
    return res.status(400).json({ error: 'Inserisci username o email.' });
  }

  try {
    const result = await pool.query(
      'SELECT id, username, email FROM users WHERE username = $1 OR email = $1',
      [identifier]
    );
    const user = result.rows[0];

    // Rispondiamo SEMPRE con lo stesso messaggio, esista o no l'account:
    // così chi prova a indovinare non scopre quali username/email sono registrati.
    if (user) {
      const rawToken = crypto.randomBytes(32).toString('hex');
      const tokenHash = crypto.createHash('sha256').update(rawToken).digest('hex');
      const expires = new Date(Date.now() + 60 * 60 * 1000); // valido 1 ora

      await pool.query(
        'UPDATE users SET reset_token_hash = $1, reset_token_expires = $2 WHERE id = $3',
        [tokenHash, expires, user.id]
      );

      const resetLink = process.env.FRONTEND_URL + '/reset-password.html?token=' + rawToken;

      try {
        await resend.emails.send({
          from: 'Videoteca <onboarding@resend.dev>',
          to: user.email,
          subject: 'Reimposta la password del tuo account Videoteca',
          html: `
            <p>Ciao ${user.username},</p>
            <p>Hai richiesto di reimpostare la password del tuo account Videoteca.</p>
            <p><a href="${resetLink}">Clicca qui per scegliere una nuova password</a></p>
            <p>Il link è valido per un'ora. Se non sei stato tu a richiederlo, ignora pure questa email: la tua password resterà invariata.</p>
          `
        });
      } catch (emailErr) {
        // Logghiamo l'errore di invio ma non lo mostriamo all'utente,
        // per non rivelare se l'account esiste o meno.
        console.error('Errore invio email di reset:', emailErr);
      }
    }

    res.json({ ok: true, message: "Se l'account esiste, riceverai a breve un'email con le istruzioni." });
  } catch (err) {
    console.error('Errore forgot-password:', err);
    res.status(500).json({ error: 'Errore del server. Riprova più tardi.' });
  }
});

// ---- Conferma reset password (arriva dal link nell'email) ----
router.post('/reset-password', async (req, res) => {
  const { token, newPassword } = req.body || {};
  if (!token || !newPassword) {
    return res.status(400).json({ error: 'Dati mancanti.' });
  }
  if (newPassword.length < 6) {
    return res.status(400).json({ error: 'La password deve avere almeno 6 caratteri.' });
  }

  try {
    const tokenHash = crypto.createHash('sha256').update(token).digest('hex');
    const result = await pool.query(
      'SELECT id, reset_token_expires FROM users WHERE reset_token_hash = $1',
      [tokenHash]
    );
    const user = result.rows[0];

    if (!user || !user.reset_token_expires || new Date(user.reset_token_expires) < new Date()) {
      return res.status(400).json({ error: 'Il link non è valido o è scaduto. Richiedine uno nuovo dalla pagina di login.' });
    }

    const newHash = await bcrypt.hash(newPassword, 10);
    await pool.query(
      'UPDATE users SET password_hash = $1, reset_token_hash = NULL, reset_token_expires = NULL WHERE id = $2',
      [newHash, user.id]
    );

    res.json({ ok: true });
  } catch (err) {
    console.error('Errore reset-password:', err);
    res.status(500).json({ error: 'Errore del server. Riprova più tardi.' });
  }
});

module.exports = router;
