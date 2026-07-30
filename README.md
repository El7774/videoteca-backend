# Videoteca — Backend

API in Node.js + Express + PostgreSQL per la Videoteca. Gestisce account,
autenticazione, la collezione di titoli, l'avatar e le impostazioni.

## Struttura

```
backend/
├── server.js          punto di ingresso del server
├── db.js              connessione al database PostgreSQL
├── schema.sql          definizione della tabella "users"
├── middleware/
│   └── auth.js        verifica il token di accesso (JWT)
├── routes/
│   ├── auth.js         /api/auth/register, /api/auth/login
│   ├── me.js           /api/me (profilo, username, password, avatar, elimina account)
│   └── shows.js        /api/shows (la collezione di titoli)
├── package.json
├── .env.example        modello delle variabili d'ambiente
└── .gitignore
```

## Variabili d'ambiente richieste

Copia `.env.example` in un file chiamato `.env` e compila i valori:

- `DATABASE_URL` — stringa di connessione al database (da Neon)
- `JWT_SECRET` — una stringa lunga e casuale, a tua scelta
- `ALLOWED_ORIGINS` — l'indirizzo del tuo sito GitHub Pages
- `PORT` — porta locale (Render la imposta da sé in produzione)

Il file `.env` **non va mai caricato su GitHub**: è già escluso da `.gitignore`.

## Provare in locale (facoltativo)

Se vuoi testare il server sul tuo computer prima di pubblicarlo:

1. Installa [Node.js](https://nodejs.org) (versione LTS).
2. Apri un terminale in questa cartella ed esegui `npm install`.
3. Crea il file `.env` come descritto sopra (puoi usare un database Neon anche per i test locali).
4. Esegui `npm start`.
5. Il server risponde su `http://localhost:3000`.

Per pubblicarlo online, però, segui la guida di deploy ricevuta in chat
(Neon per il database, Render per il server).
