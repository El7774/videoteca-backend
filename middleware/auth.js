// Questo "middleware" gira prima di ogni richiesta protetta.
// Controlla che nella richiesta ci sia un token valido (mandato dal browser
// nell'intestazione "Authorization: Bearer <token>") e, se sì, lascia
// proseguire la richiesta salvando l'id dell'utente su req.userId.
const jwt = require('jsonwebtoken');

function authMiddleware(req, res, next) {
  const header = req.headers.authorization || '';
  const token = header.startsWith('Bearer ') ? header.slice(7) : null;

  if (!token) {
    return res.status(401).json({ error: 'Token mancante. Effettua di nuovo il login.' });
  }

  try {
    const payload = jwt.verify(token, process.env.JWT_SECRET);
    req.userId = payload.userId;
    req.username = payload.username;
    next();
  } catch (err) {
    return res.status(401).json({ error: 'Sessione scaduta o non valida. Effettua di nuovo il login.' });
  }
}

module.exports = authMiddleware;
