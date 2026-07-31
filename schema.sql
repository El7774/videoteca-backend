-- Schema del database Videoteca.
-- Una sola tabella "users": ogni riga è un account, con dentro tutto
-- ciò che prima stava nel localStorage del browser.

CREATE TABLE IF NOT EXISTS users (
  id                    SERIAL PRIMARY KEY,
  username              TEXT UNIQUE NOT NULL,
  email                 TEXT UNIQUE NOT NULL,
  password_hash         TEXT NOT NULL,
  avatar                TEXT,                          -- immagine come stringa base64, oppure NULL
  settings              JSONB NOT NULL DEFAULT '{}'::jsonb,  -- tema, vista, preferiti compressi...
  shows                 JSONB NOT NULL DEFAULT '[]'::jsonb,  -- l'intera collezione di titoli
  reset_token_hash      TEXT,                          -- hash del token di reset password, se richiesto
  reset_token_expires   TIMESTAMPTZ,                   -- scadenza del token di reset (1 ora)
  created_at            TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Se la tabella esiste già da prima (database creato prima di questa modifica),
-- esegui anche queste due righe da sole nell'SQL Editor di Neon per aggiungere
-- le nuove colonne senza perdere i dati già presenti:
--
-- ALTER TABLE users ADD COLUMN IF NOT EXISTS reset_token_hash TEXT;
-- ALTER TABLE users ADD COLUMN IF NOT EXISTS reset_token_expires TIMESTAMPTZ;
