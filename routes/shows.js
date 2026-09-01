const express = require('express');
const pool = require('../db');
const authMiddleware = require('../middleware/auth');

const router = express.Router();
router.use(authMiddleware);

// Wrapper per le rotte async: cattura gli errori del database (che in
// Express 4 crasherebbero il processo) e li passa al gestore errori JSON
// in fondo al file.
const wrapAsync = (fn) => (req, res, next) =>
  Promise.resolve(fn(req, res, next)).catch(next);

// Restituisce l'intera collezione dell'utente loggato
router.get('/', wrapAsync(async (req, res) => {
  const result = await pool.query('SELECT shows FROM users WHERE id = $1', [req.userId]);
  res.json(result.rows[0] ? result.rows[0].shows : []);
}));

// Sovrascrive l'intera collezione con quella ricevuta.
// Rispecchia esattamente come il frontend già lavora: mantiene l'intero
// array "shows" in memoria e lo salva per intero a ogni modifica.
router.put('/', wrapAsync(async (req, res) => {
  const shows = req.body;
  if (!Array.isArray(shows)) {
    return res.status(400).json({ error: 'Formato non valido: attesa una lista di titoli.' });
  }
  await pool.query('UPDATE users SET shows = $1 WHERE id = $2', [JSON.stringify(shows), req.userId]);
  res.json({ ok: true });
}));

// ---- Gestore errori JSON: risposte 500 coerenti col resto dell'API ----
router.use((err, req, res, next) => {
  console.error('Errore /api/shows:', err);
  if (!res.headersSent) {
    res.status(500).json({ error: 'Errore del server. Riprova più tardi.' });
  }
});

module.exports = router;
