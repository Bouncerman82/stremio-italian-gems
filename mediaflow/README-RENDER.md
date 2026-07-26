# MediaFlow remoto gratis (Render)

## Limiti Render free
- Dopo ~15 min senza richieste lo **spegne** (sleep)
- Al primo film dopo lo sleep aspetta 30–60 secondi
- Per tenerlo “caldo” ~2h: ping ogni 10 min su https://cron-job.org (gratis) verso `https://TUO-SERVIZIO.onrender.com/`

## Deploy (Dashboard Render)

1. https://dashboard.render.com → **New** → **Web Service**
2. Collega il repo `stremio-italian-gems` (o quello dove hai pushato)
3. Imposta:
   - **Name:** `mediaflow-stremio`
   - **Root Directory:** `mediaflow`
   - **Runtime:** Docker
   - **Instance type:** Free
4. Environment:
   - `API_PASSWORD` = `ItalianGemsMfp2026` (o una tua)
   - `DISABLE_SSL_VERIFICATION_GLOBALLY` = `true`
   - `FORWARDED_ALLOW_IPS` = `*`
5. **Create Web Service** → aspetta Deploy live
6. Copia URL tipo `https://mediaflow-stremio.onrender.com`

## StreamViX
- Proxy URL = URL Render
- Password = `API_PASSWORD`
- Backend = **MediaFlow**
- Reinstalla addon

## Nota
Il PC locale + tunnel resta più stabile mentre guardi.
Render free è comodo “remoto”, ma con sleep.
