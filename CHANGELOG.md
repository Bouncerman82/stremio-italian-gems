# Changelog

## 3.0.0 — 2026-07-26

### Pronto per produzione
- Rimossa tutta la strumentazione di debug
- Endpoint `/health` per hosting
- Default più sicuri in produzione: meno concorrenza TMDB, probe cache più lunga, poster custom OFF su HTTPS
- `PUBLIC_BASE_URL` + `TMDB_API_KEY` documentati per deploy HTTPS
- README e `.env.example` aggiornati
- Logo definitivo, versioning stabile `3.0.0`

### Funzionalità (invariate / consolidate)
- Cataloghi Gemme FILM / Gemme SERIE
- Top 100 (voto 6,5+), lista nuova ogni giorno, shuffle solo sui 100
- Popolari ultimi 2 mesi (finestra scorrevole)
- Filtri: genere, mood, anno, paese
- Mix generale fino a 500 titoli
- Schede Cast / Regia / Trama (HTML)
- Nessun torrent / stream video: solo discovery e metadati
