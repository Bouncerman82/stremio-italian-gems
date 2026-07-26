# Italian Gems — addon Stremio

Cataloghi **FILM** e **SERIE** con mix intelligente, filtri e schede dettagliate.

> **Cosa non fa:** non fornisce torrent né link di streaming video.  
> Serve per scoprire titoli (Top 100, Popolari, filtri) e aprire metadati / scheda cast-trama.  
> Per riprodurre i contenuti usa altri addon torrent/streaming in Stremio.

## Funzionalità

| Modalità | Comportamento |
|----------|----------------|
| **Top 100 — voto 6,5+** | Ogni giorno 100 titoli nuovi (voto ≥ 6,5). Per 24h restano gli stessi e fanno solo shuffle. |
| **Popolari — ultimi 2 mesi** | Finestra scorrevole: col tempo entrano titoli nuovi e escono i più vecchi. Shuffle solo su quei ≤100. |
| **Filtri** | Genere, mood, anno, paese di produzione |
| **Mix generale** | Campione fino a 500 titoli dal totale TMDB filtrato |
| **Scheda** | Trama, cast, regia, pagine HTML Cast/Regia/Trama |

## Installazione locale

1. Node.js ≥ 18
2. Copia env e inserisci la chiave TMDB:

```bash
cp .env.example .env
# modifica TMDB_API_KEY=
```

3. Avvia:

```bash
npm install
npm run start:win   # Windows
# oppure: npm start
```

4. In Stremio → Addon → URL:

```
http://localhost:7000/manifest.json
```

## Deploy online (HTTPS)

Stremio fuori dalla LAN richiede **HTTPS**.

### Variabili obbligatorie sul host

| Variabile | Esempio |
|-----------|---------|
| `TMDB_API_KEY` | chiave da [TMDB API](https://www.themoviedb.org/settings/api) |
| `PUBLIC_BASE_URL` | `https://tuo-servizio.onrender.com` (senza `/` finale) |
| `CUSTOM_POSTERS` | `0` consigliato sui piani free (risparmia RAM) |

Opzionali: `TMDB_CONCURRENCY=4`, `DATA_CACHE_SECONDS=21600`, `PORT` (impostato dal host).

### Render (consigliato, file `render.yaml` incluso)

1. Push del repo su GitHub
2. [Render](https://render.com) → New → Web Service → collega il repo
3. Runtime Node, build `npm install`, start `npm start`
4. Imposta secrets:
   - `TMDB_API_KEY`
   - `PUBLIC_BASE_URL` = URL HTTPS che Render ti assegna (es. `https://stremio-italian-gems.onrender.com`)
5. Health check: `/health`
6. Dopo il deploy, in Stremio installa:

```
https://TUO-URL.onrender.com/manifest.json
```

> Piano free Render: il servizio può “addormentarsi” dopo inattività; la prima richiesta può impiegare ~30–60s.

### Beamup

Se usi [Beamup](https://github.com/Stremio/beamup-cli) (`beamup.json` presente):

```bash
npx beamup
```

Poi imposta `PUBLIC_BASE_URL` all’URL Beamup e la `TMDB_API_KEY` secondo la documentazione del host.

## Endpoint utili

| Path | Uso |
|------|-----|
| `/manifest.json` | Installazione Stremio |
| `/health` | Healthcheck hosting |
| `/` | Pagina info + link install |

## Sviluppo

```bash
npm run dev
```

Logo: `public/logo-v30.png` (anche referenziato nel manifest).

## Licenza

MIT — dati film/serie da [TMDB](https://www.themoviedb.org/).
