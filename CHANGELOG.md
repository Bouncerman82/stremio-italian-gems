# Changelog

## 3.1.2 — 2026-07-26

### Fix tag locandine (Render)
- Preferenza DNS IPv4 per image.tmdb.org
- Download poster w342 (più leggero) in produzione

## 3.1.1 — 2026-07-26

### Fix tag sulle locandine (Render)
- Retry + User-Agent sul download immagini TMDB
- Meno concorrenza poster in produzione
- `node --use-system-ca` anche su `npm start` (SSL su Render)

## 3.1.0 — 2026-07-26

### Fix riproduzione
- Gli ID catalogo sono di nuovo **IMDb `tt…`** (non più `igems:tt…`)
- Così Torrentio e gli altri addon di stream funzionano su Gemme FILM/SERIE
- Prefissi: `tt` (titoli) + `igems` (solo tile info)
- Episodi serie: `tt…:stagione:episodio` compatibile con gli addon torrent

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
