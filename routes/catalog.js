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
        posterUrl: r.poster_path ? `https://image.tmdb.org/t/p/w200${r.poster_path}` : null,
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
      seasons: seasons.length ? seasons : [{ episodeCount: 1, watched: [false] }]
    });
  } catch (err) {
    console.error('Errore dettagli TMDB:', err);
    res.status(500).json({ error: 'Errore del server.' });
  }
});

// ==========================================================
// Anime (Jikan API — non ufficiale, basata su MyAnimeList, gratuita e senza chiave)
// ==========================================================

const JIKAN_BASE = 'https://api.jikan.moe/v4';

function parseJikanDuration(duration) {
  // Jikan restituisce la durata come testo, es. "24 min per ep" oppure "1 hr 30 min"
  if (!duration) return null;
  let minutes = 0;
  const hrMatch = duration.match(/(\d+)\s*hr/);
  const minMatch = duration.match(/(\d+)\s*min/);
  if (hrMatch) minutes += parseInt(hrMatch[1], 10) * 60;
  if (minMatch) minutes += parseInt(minMatch[1], 10);
  return minutes || null;
}

// ---- Ricerca anime ----
router.get('/search-anime', async (req, res) => {
  const query = (req.query.query || '').trim();
  if (!query) {
    return res.status(400).json({ error: 'Specifica un termine di ricerca.' });
  }

  try {
    const url = `${JIKAN_BASE}/anime?q=${encodeURIComponent(query)}&limit=15&sfw=true`;
    const jikanRes = await fetch(url);
    const data = await jikanRes.json();

    if (!jikanRes.ok) {
      return res.status(502).json({ error: 'Jikan non ha risposto correttamente.' });
    }

    const results = (data.data || []).map(a => ({
      malId: a.mal_id,
      mediaType: a.type === 'Movie' ? 'movie' : 'tv',
      title: a.title_english || a.title,
      year: a.year || (a.aired && a.aired.prop && a.aired.prop.from && a.aired.prop.from.year) || null,
      posterUrl: (a.images && a.images.jpg && a.images.jpg.image_url) || null,
      overview: a.synopsis || ''
    }));

    res.json(results);
  } catch (err) {
    console.error('Errore ricerca Jikan:', err);
    res.status(500).json({ error: 'Errore del server durante la ricerca.' });
  }
});

// ---- Dettagli di un anime, già pronti per essere aggiunti alla collezione ----
router.get('/details-anime', async (req, res) => {
  const { id } = req.query;
  if (!id) {
    return res.status(400).json({ error: 'Parametro mancante.' });
  }

  try {
    const url = `${JIKAN_BASE}/anime/${id}`;
    const jikanRes = await fetch(url);
    const payload = await jikanRes.json();
    const a = payload.data;

    if (!jikanRes.ok || !a) {
      return res.status(404).json({ error: 'Titolo non trovato su MyAnimeList.' });
    }

    const isMovie = a.type === 'Movie';
    const episodeCount = a.episodes || 1; // se ancora in corso, Jikan può non saperlo ancora
    const title = a.title_english || a.title;
    const episodeRuntime = parseJikanDuration(a.duration);

    res.json({
      title,
      type: isMovie ? 'film' : 'serie',
      episodeRuntime,
      seasons: isMovie
        ? [{ episodeCount: 1, watched: [false] }]
        : [{ episodeCount, watched: new Array(episodeCount).fill(false) }]
    });
  } catch (err) {
    console.error('Errore dettagli Jikan:', err);
    res.status(500).json({ error: 'Errore del server.' });
  }
});

module.exports = router;
