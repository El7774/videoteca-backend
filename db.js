// Gestisce la connessione al database PostgreSQL.
// La stringa di connessione arriva da una variabile d'ambiente (DATABASE_URL),
// così non la scriviamo mai direttamente nel codice.
const { Pool } = require('pg');

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  // Necessario per connettersi a Neon/Render Postgres da alcuni ambienti:
  ssl: { rejectUnauthorized: false }
});

module.exports = pool;
