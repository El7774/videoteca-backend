const express = require('express');
const authMiddleware = require('../middleware/auth');

const router = express.Router();
router.use(authMiddleware);

const TMDB_BASE = 'https://api.themoviedb.org/3';

// ---- Ricerca titoli (film e serie TV) ----
router.get('/search', async (req, res) => {
  const query = (req.query.query || '').trim();
  if (!query) {
    return res.status(400).json({ error: 'Specifica un termine di ricerca.' });
  }
  if (!process.env.TMDB_API_KEY) {
    return res.status(500).json({ error: 'Il server non è configurato per la ricerca online (manca TMDB_API_KEY).' });
  }

  try {
    const url = `${TMDB_BASE}/search/multi?api_key=${process.env.TMDB_API_KEY}&language=it-IT&include_adult=false&query=${encodeURIComponent(query)}`;
    const tmdbRes = await fetch(url);
    const data = await tmdbRes.json();

    if (!tmdbRes.ok) {
      return res.status(502).json({ error: 'TMDB non ha risposto correttamente.' });
    }

    const results = (data.results || [])
      .filter(r => r.media_type === 'movie' || r.media_type === 'tv')
      .slice(0, 15)
      .map(r => ({
        tmdbId: r.id,
        mediaType: r.media_type, // 'movie' oppure 'tv'
        title: r.media_type === 'movie' ? r.title : r.name,
        year: ((r.media_type === 'movie' ? r.release_date : r.first_air_date) || '').slice(0, 4) || null,
        posterUrl: r.poster_path ? `https://image.tmdb.org/t/p/w342${r.poster_path}` : null,
        overview: r.overview || ''
      }));

    res.json(results);
  } catch (err) {
    console.error('Errore ricerca TMDB:', err);
    res.status(500).json({ error: 'Errore del server durante la ricerca.' });
  }
});

// ---- Dettagli di un titolo, già pronti per essere aggiunti alla collezione ----
router.get('/details', async (req, res) => {
  const { id, type } = req.query;
  if (!id || (type !== 'movie' && type !== 'tv')) {
    return res.status(400).json({ error: 'Parametri mancanti o non validi.' });
  }
  if (!process.env.TMDB_API_KEY) {
    return res.status(500).json({ error: 'Il server non è configurato per la ricerca online (manca TMDB_API_KEY).' });
  }

  try {
    const url = `${TMDB_BASE}/${type}/${id}?api_key=${process.env.TMDB_API_KEY}&language=it-IT`;
    const tmdbRes = await fetch(url);
    const data = await tmdbRes.json();

    if (!tmdbRes.ok) {
      return res.status(404).json({ error: 'Titolo non trovato su TMDB.' });
    }

    if (type === 'movie') {
      return res.json({
        title: data.title,
        type: 'film',
        episodeRuntime: data.runtime || null, // durata del film in minuti
        posterUrl: data.poster_path ? `https://image.tmdb.org/t/p/w500${data.poster_path}` : null,
        backdropUrl: data.backdrop_path ? `https://image.tmdb.org/t/p/w1280${data.backdrop_path}` : null,
        seasons: [{ episodeCount: 1, watched: [false] }]
      });
    }

    // Serie TV: una "stagione" per ogni stagione reale, con il numero di episodi corretto.
    // La stagione 0 di TMDB (di solito "Speciali") viene esclusa.
    const seasons = (data.seasons || [])
      .filter(s => s.season_number > 0 && s.episode_count > 0)
      .map(s => ({
        episodeCount: s.episode_count,
        watched: new Array(s.episode_count).fill(false)
      }));

    res.json({
      title: data.name,
      type: 'serie',
      episodeRuntime: (data.episode_run_time && data.episode_run_time[0]) || null, // minuti medi per episodio
      posterUrl: data.poster_path ? `https://image.tmdb.org/t/p/w500${data.poster_path}` : null,
      backdropUrl: data.backdrop_path ? `https://image.tmdb.org/t/p/w1280${data.backdrop_path}` : null,
      seasons: seasons.length ? seasons : [{ episodeCount: 1, watched: [false] }]
    });
  } catch (err) {
    console.error('Errore dettagli TMDB:', err);
    res.status(500).json({ error: 'Errore del server.' });
  }
});

// ---- Nomi degli episodi di una stagione (serie TV) ----
const episodesCache = new Map(); // 'tvId:season' -> { data, expiresAt }
const EPISODES_CACHE_TTL_MS = 60 * 60 * 1000; // 1 ora: i nomi degli episodi cambiano raramente

router.get('/episodes', async (req, res) => {
  const { tvId, season } = req.query;
  if (!tvId || !season) {
    return res.status(400).json({ error: 'Parametri mancanti.' });
  }
  if (!process.env.TMDB_API_KEY) {
    return res.status(500).json({ error: 'Il server non è configurato per la ricerca online (manca TMDB_API_KEY).' });
  }

  const cacheKey = tvId + ':' + season;
  const cached = episodesCache.get(cacheKey);
  if (cached && Date.now() < cached.expiresAt) {
    return res.json(cached.data);
  }

  try {
    const url = `${TMDB_BASE}/tv/${tvId}/season/${season}?api_key=${process.env.TMDB_API_KEY}&language=it-IT`;
    const tmdbRes = await fetch(url);
    const data = await tmdbRes.json();

    if (!tmdbRes.ok) {
      return res.status(502).json({ error: 'TMDB non ha risposto correttamente.' });
    }

    const episodes = (data.episodes || []).map(e => ({
      episodeNumber: e.episode_number,
      name: e.name || null
    }));

    episodesCache.set(cacheKey, { data: episodes, expiresAt: Date.now() + EPISODES_CACHE_TTL_MS });
    res.json(episodes);
  } catch (err) {
    console.error('Errore episodi TMDB:', err);
    res.status(500).json({ error: 'Errore del server.' });
  }
});

module.exports = router;
