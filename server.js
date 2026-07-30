require('dotenv').config();
const express = require('express');
const cors = require('cors');

const authRoutes = require('./routes/auth');
const meRoutes = require('./routes/me');
const showsRoutes = require('./routes/shows');

const app = express();

// CORS: per sicurezza, accettiamo richieste solo dai siti indicati in
// ALLOWED_ORIGINS (es. il tuo indirizzo GitHub Pages), separati da virgola.
// In locale, senza questa variabile impostata, accetta tutto (comodo per testare).
const allowedOrigins = (process.env.ALLOWED_ORIGINS || '')
  .split(',')
  .map(s => s.trim())
  .filter(Boolean);

app.use(cors({
  origin: function (origin, callback) {
    if (!origin || allowedOrigins.length === 0 || allowedOrigins.includes(origin)) {
      callback(null, true);
    } else {
      console.log('Richiesta CORS rifiutata. Origine ricevuta:', JSON.stringify(origin), '| Origini consentite:', allowedOrigins);
      callback(new Error('Origine non consentita da CORS: ' + origin));
    }
  }
}));

// Aumentiamo il limite perché l'avatar (immagine in base64) può pesare qualche centinaio di KB
app.use(express.json({ limit: '5mb' }));

app.use('/api/auth', authRoutes);
app.use('/api/me', meRoutes);
app.use('/api/shows', showsRoutes);

app.get('/', (req, res) => {
  res.send('Videoteca API attiva.');
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log('Server avviato sulla porta ' + PORT);
});
