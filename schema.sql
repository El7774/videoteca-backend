-- Schema del database Videoteca.
-- Una sola tabella "users": ogni riga è un account, con dentro tutto
-- ciò che prima stava nel localStorage del browser.

CREATE TABLE IF NOT EXISTS users (
  id             SERIAL PRIMARY KEY,
  username       TEXT UNIQUE NOT NULL,
  email          TEXT UNIQUE NOT NULL,
  password_hash  TEXT NOT NULL,
  avatar         TEXT,                          -- immagine come stringa base64, oppure NULL
  settings       JSONB NOT NULL DEFAULT '{}'::jsonb,  -- tema, vista, preferiti compressi...
  shows          JSONB NOT NULL DEFAULT '[]'::jsonb,  -- l'intera collezione di titoli
  created_at     TIMESTAMPTZ NOT NULL DEFAULT now()
);
