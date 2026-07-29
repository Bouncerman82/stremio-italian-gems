function escapeHtml(text) {
  return String(text || '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

/** Blocco INFO sopra la trama (sostituisce i badge sulle locandine). */
function renderInfoBox(data) {
  const rows = [
    data.rating
      ? {
          k: 'Voto',
          v: `★ ${data.rating}/10${data.voteCount ? ` · ${data.voteCount} voti` : ''}`,
          gold: true,
        }
      : null,
    (data.genres || []).length
      ? {
          k: 'Genere',
          v: data.genres.map((g) => (typeof g === 'string' ? g : g.name)).join(' · '),
        }
      : null,
    data.year ? { k: 'Anno', v: String(data.year) } : null,
    data.country ? { k: 'Paese', v: String(data.country) } : null,
    data.runtime ? { k: 'Durata', v: String(data.runtime) } : null,
    data.seasonsCount ? { k: 'Stagioni', v: String(data.seasonsCount) } : null,
    data.language ? { k: 'Lingua', v: String(data.language) } : null,
  ].filter(Boolean);

  if (!rows.length) return '';

  return `
    <div class="section">
      <h2>Informazioni</h2>
      <div class="info-box">
        ${rows
          .map(
            (r) => `<div class="row"><span class="k">${escapeHtml(r.k)}</span>
              <span class="v${r.gold ? ' gold' : ''}">${escapeHtml(r.v)}</span></div>`
          )
          .join('')}
      </div>
    </div>`;
}

/**
 * CSS pensato per telecomando Android TV / box:
 * focus visibile, target grandi, barra Indietro fissa, no hover-only.
 */
const baseCss = `
  :root {
    --bg: #0b1210;
    --panel: #12201c;
    --line: #1f3a33;
    --text: #e8f2ee;
    --muted: #9bb5ac;
    --accent: #14b8a6;
    --gold: #f5c518;
    --focus: #f5c518;
    --nav-h: 64px;
  }
  * { box-sizing: border-box; }
  html { font-size: 18px; }
  body {
    margin: 0;
    font-family: "Segoe UI", "Trebuchet MS", system-ui, sans-serif;
    background:
      radial-gradient(1200px 600px at 10% -10%, #134e4a 0%, transparent 55%),
      radial-gradient(900px 500px at 100% 0%, #1e293b 0%, transparent 50%),
      var(--bg);
    color: var(--text);
    min-height: 100vh;
    line-height: 1.55;
    padding-top: var(--nav-h);
    padding-left: max(1rem, env(safe-area-inset-left));
    padding-right: max(1rem, env(safe-area-inset-right));
    padding-bottom: max(1.5rem, env(safe-area-inset-bottom));
  }

  /* Barra Indietro sempre visibile (telecomando) */
  .tv-nav {
    position: fixed; top: 0; left: 0; right: 0; z-index: 100;
    height: var(--nav-h);
    display: flex; align-items: center; gap: .75rem;
    padding: 0 1rem;
    background: rgba(8, 14, 12, .96);
    border-bottom: 1px solid var(--line);
  }
  .tv-btn {
    display: inline-flex; align-items: center; justify-content: center;
    min-height: 48px; min-width: 48px;
    padding: .65rem 1.1rem;
    border-radius: 10px;
    border: 2px solid var(--line);
    background: #16352e;
    color: var(--text);
    font-size: 1rem; font-weight: 700;
    text-decoration: none;
    cursor: pointer;
  }
  .tv-btn:focus, .tv-btn:focus-visible,
  a:focus, a:focus-visible, button:focus, button:focus-visible {
    outline: 3px solid var(--focus);
    outline-offset: 3px;
    border-color: var(--focus);
    text-decoration: none;
  }
  .tv-btn.primary { background: var(--accent); color: #042f2e; border-color: #5eead4; }
  .tv-nav .title {
    flex: 1; color: var(--muted); font-size: .9rem;
    white-space: nowrap; overflow: hidden; text-overflow: ellipsis;
  }

  a { color: var(--accent); text-decoration: none; }
  .wrap { max-width: 980px; margin: 0 auto; padding: 1.25rem 0 3rem; }
  .brand {
    display: inline-flex; align-items: center; gap: .6rem;
    color: var(--muted); font-size: .85rem; letter-spacing: .04em; text-transform: uppercase;
    margin-bottom: 1rem;
  }
  .brand span { width: .55rem; height: .55rem; border-radius: 999px; background: var(--accent); }
  .card {
    background: linear-gradient(180deg, rgba(20,40,35,.92), rgba(12,22,19,.96));
    border: 1px solid var(--line);
    border-radius: 18px;
    overflow: hidden;
    box-shadow: 0 20px 50px rgba(0,0,0,.35);
  }
  .hero {
    display: grid;
    grid-template-columns: 220px 1fr;
    gap: 1.5rem;
    padding: 1.5rem;
  }
  @media (max-width: 720px) {
    .hero { grid-template-columns: 1fr; }
  }
  .photo {
    width: 100%;
    aspect-ratio: 2/3;
    object-fit: cover;
    border-radius: 12px;
    background: #0a0f0e;
    border: 1px solid var(--line);
  }
  h1 { margin: 0 0 .4rem; font-size: clamp(1.6rem, 3vw, 2.2rem); letter-spacing: -0.02em; }
  .meta { color: var(--muted); margin-bottom: 1rem; }
  .chips { display: flex; flex-wrap: wrap; gap: .55rem; margin: 1rem 0 1.25rem; }
  .chip {
    display: inline-flex; align-items: center; justify-content: center;
    min-height: 44px;
    padding: .45rem .9rem; border-radius: 999px;
    background: rgba(20,184,166,.12); border: 2px solid rgba(20,184,166,.35);
    color: #99f6e4; font-size: .9rem; font-weight: 700;
  }
  .chip.gold { background: rgba(245,197,24,.12); border-color: rgba(245,197,24,.4); color: #fde68a; }
  .section { padding: 0 1.5rem 1.5rem; }
  .section h2 {
    margin: 0 0 .75rem; font-size: 1rem; text-transform: uppercase;
    letter-spacing: .08em; color: var(--accent);
  }
  .bio, .role, .info-box {
    background: rgba(0,0,0,.22);
    border: 1px solid var(--line);
    border-radius: 12px;
    padding: 1rem 1.1rem;
    white-space: pre-wrap;
  }
  .info-box {
    display: grid;
    grid-template-columns: repeat(auto-fill, minmax(140px, 1fr));
    gap: .65rem 1rem;
    white-space: normal;
    margin-bottom: 1rem;
  }
  .info-box .row { min-width: 0; }
  .info-box .k {
    display: block; font-size: .72rem; color: var(--muted);
    text-transform: uppercase; letter-spacing: .06em; margin-bottom: .15rem;
  }
  .info-box .v { font-weight: 700; font-size: .98rem; color: var(--text); }
  .info-box .v.gold { color: var(--gold); }
  .role { margin-bottom: 1rem; border-left: 3px solid var(--accent); }
  .side {
    display: flex; gap: 1rem; align-items: center;
    margin-top: 1rem; padding-top: 1rem; border-top: 1px solid var(--line);
  }
  .side img { width: 64px; border-radius: 8px; border: 1px solid var(--line); }
  .side .label { font-size: .75rem; color: var(--muted); text-transform: uppercase; letter-spacing: .06em; }

  .grid {
    display: grid;
    grid-template-columns: repeat(auto-fill, minmax(150px, 1fr));
    gap: 1rem;
    padding: 1.25rem 1.5rem 1.75rem;
  }
  .tile, .person {
    display: block; color: inherit; text-decoration: none;
    background: rgba(0,0,0,.25); border: 2px solid var(--line);
    border-radius: 12px; overflow: hidden;
  }
  .tile img, .person img { width: 100%; aspect-ratio: 2/3; object-fit: cover; display: block; background: #000; }
  .tile .t, .person .p { padding: .65rem .7rem .8rem; font-size: .88rem; font-weight: 700; }
  .person .r { color: var(--muted); font-size: .8rem; margin-top: .25rem; font-weight: 500; }
  .people {
    display: grid;
    grid-template-columns: repeat(auto-fill, minmax(150px, 1fr));
    gap: .85rem;
  }
  .hint { color: var(--muted); font-size: .95rem; padding: 0 1.5rem 1rem; }
`;

const tvNavScript = `
<script>
(function () {
  var exitRoot = document.body.getAttribute('data-exit-root') === '1';
  var backHref = document.body.getAttribute('data-back-href') || '';

  function goPluginBack() {
    if (backHref) {
      window.location.href = backHref;
      return;
    }
    // Root scheda: chiudi la webview tornando indietro nella history
    // (è ciò che fa il Back del telecomando su Android TV / Stremio)
    try {
      if (window.history.length > 1) {
        window.history.go(1 - window.history.length);
        return;
      }
    } catch (e) {}
    try { window.close(); } catch (e2) {}
  }

  window.__igemsGoBack = goPluginBack;

  document.addEventListener('keydown', function (e) {
    var code = e.keyCode || e.which;
    var isBack = e.key === 'Escape' || e.key === 'BrowserBack' || code === 27 || code === 461;

    // Android KEYCODE_BACK = 4 → sulla scheda root NON bloccarlo:
    // deve chiudere la webview e tornare a Stremio da solo.
    if (code === 4) {
      if (exitRoot) {
        // lascia gestire a Stremio / sistema
        return;
      }
      e.preventDefault();
      goPluginBack();
      return;
    }

    if (!isBack) return;
    e.preventDefault();
    goPluginBack();
  });

  window.addEventListener('load', function () {
    var btn = document.getElementById('tv-back');
    if (btn) btn.focus();
  });
})();
</script>
`;

/**
 * @param {object} opts
 * @param {string} [opts.backHref] — livello precedente nel plugin
 * @param {boolean} [opts.exitToStremio] — root: esci dalla webview verso Stremio
 * @param {string} [opts.label]
 */
function navBar({ backHref, exitToStremio = false, label = 'Scheda' }) {
  let href;
  let text;
  let onclick;

  if (backHref) {
    href = escapeHtml(backHref);
    text = '← Indietro alla Scheda';
    onclick = '';
  } else {
    // Root: niente stremio:// (non funziona nella webview).
    // Usa history per chiudere come fa il Back del telecomando.
    href = '#';
    text = '← Chiudi / Torna a Stremio';
    onclick = ' onclick="window.__igemsGoBack(); return false;"';
  }

  return `
  <nav class="tv-nav" aria-label="Navigazione">
    <a id="tv-back" class="tv-btn primary" href="${href}"${onclick} tabindex="1">${escapeHtml(text)}</a>
    <div class="title">${escapeHtml(label)}</div>
  </nav>`;
}

function shell({ title, backHref, exitToStremio, navLabel, body }) {
  const isRoot = !!exitToStremio && !backHref;
  return `<!DOCTYPE html>
<html lang="it">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>${escapeHtml(title)}</title>
  <style>${baseCss}</style>
</head>
<body data-exit-root="${isRoot ? '1' : '0'}" data-back-href="${backHref ? escapeHtml(backHref) : ''}">
  ${navBar({ backHref, exitToStremio: isRoot, label: navLabel || title })}
  <div class="wrap">
    ${body}
    ${
      isRoot
        ? `<p class="hint" style="margin-top:1rem">Suggerimento TV: premi anche il tasto <strong>BACK</strong> del telecomando per chiudere e tornare a Stremio.</p>`
        : ''
    }
  </div>
  ${tvNavScript}
</body>
</html>`;
}

/** @deprecated — non usare più redirect stremio:// (non funzionano in webview) */
export function renderExitToStremioHtml() {
  // Redirect immediato alla chiusura via history (stesso meccanismo del Back)
  return `<!DOCTYPE html>
<html lang="it">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>Chiudi</title>
  <style>${baseCss}</style>
</head>
<body data-exit-root="1">
  <nav class="tv-nav">
    <a id="tv-back" class="tv-btn primary" href="#" onclick="window.__igemsGoBack(); return false;" tabindex="1">← Chiudi / Torna a Stremio</a>
    <div class="title">Uscita</div>
  </nav>
  <div class="wrap">
    <article class="card">
      <div class="section" style="padding:1.5rem">
        <h1>Chiudi questa pagina</h1>
        <p class="meta">Premi <strong>BACK</strong> sul telecomando, oppure OK sul pulsante sopra.</p>
      </div>
    </article>
  </div>
  ${tvNavScript}
  <script>setTimeout(function(){ try { window.__igemsGoBack(); } catch(e){} }, 100);</script>
</body>
</html>`;
}

export function renderPersonHtml(data) {
  const { person, ruolo, operaTitle, operaPoster, photo, biography, backHref, imdbUrl } =
    data;
  const birth = [person.birthday, person.place_of_birth].filter(Boolean).join(' · ');
  const alsoKnown = (person.also_known_as || []).slice(0, 4).join(' · ');

  const body = `
    <div class="brand"><span></span> Italian Gems · Profilo</div>
    <article class="card">
      <div class="hero">
        ${photo ? `<img class="photo" src="${escapeHtml(photo)}" alt="${escapeHtml(person.name)}" />` : '<div class="photo"></div>'}
        <div>
          <h1>${escapeHtml(person.name)}</h1>
          <div class="meta">${escapeHtml(birth || 'Dati anagrafici non disponibili')}</div>
          ${alsoKnown ? `<div class="meta">Anche noto come: ${escapeHtml(alsoKnown)}</div>` : ''}
          <div class="chips">
            <span class="chip">${escapeHtml(ruolo ? 'Ruolo nel titolo' : 'Profilo')}</span>
            ${person.known_for_department ? `<span class="chip gold">${escapeHtml(person.known_for_department)}</span>` : ''}
            ${imdbUrl ? `<a class="chip" href="${escapeHtml(imdbUrl)}" tabindex="0">Apri su IMDb</a>` : ''}
          </div>
          ${
            ruolo
              ? `<div class="role"><strong>Parte interpretata</strong><br/>${escapeHtml(ruolo)}${
                  operaTitle ? `<br/><em>in “${escapeHtml(operaTitle)}”</em>` : ''
                }</div>`
              : ''
          }
          ${
            operaTitle
              ? `<div class="side">${
                  operaPoster ? `<img src="${escapeHtml(operaPoster)}" alt="" />` : ''
                }<div><div class="label">Opera</div><div>${escapeHtml(operaTitle)}</div></div></div>`
              : ''
          }
        </div>
      </div>
      <div class="section">
        <h2>Biografia</h2>
        <div class="bio">${escapeHtml(biography)}</div>
      </div>
    </article>`;

  return shell({
    title: `${person.name} — Cast & Regia`,
    backHref: backHref || undefined,
    exitToStremio: !backHref,
    navLabel: 'Profilo attore / regia',
    body,
  });
}

export function renderTramaHtml(data) {
  const body = `
    <div class="brand"><span></span> Italian Gems · Trama</div>
    <article class="card">
      <div class="hero" style="background:
        linear-gradient(90deg, rgba(11,18,16,.92), rgba(11,18,16,.55)),
        url('${escapeHtml(data.backdrop || data.poster || '')}') center/cover; align-items:end;">
        ${data.poster ? `<img class="photo" src="${escapeHtml(data.poster)}" alt="" />` : ''}
        <div>
          <h1>${escapeHtml(data.title)}</h1>
          <div class="meta">${escapeHtml(data.year || '')} · ★ ${escapeHtml(data.rating)} · ${escapeHtml(data.country)}</div>
          <div class="chips">
            ${(data.genres || []).map((g) => `<span class="chip">${escapeHtml(g)}</span>`).join('')}
          </div>
        </div>
      </div>
      ${renderInfoBox(data)}
      <div class="section">
        <h2>Trama</h2>
        <div class="bio">${escapeHtml(data.overview)}</div>
      </div>
    </article>`;

  return shell({
    title: `Trama — ${data.title}`,
    backHref: data.backHref,
    exitToStremio: !data.backHref,
    navLabel: 'Trama',
    body,
  });
}

export function renderGenreHtml(data) {
  const items = data.items || [];
  const body = `
    <div class="brand"><span></span> Italian Gems · Genere</div>
    <article class="card">
      <div style="padding:1.5rem 1.5rem 0">
        <h1>${escapeHtml(data.genre)}</h1>
        <div class="meta">${data.type === 'series' ? 'Serie' : 'Film'} · ${items.length} titoli</div>
      </div>
      <p class="hint">Usa ← Indietro sul telecomando per tornare. OK per aprire un titolo.</p>
      <div class="grid">
        ${items
          .map(
            (it) => `<a class="tile" href="${escapeHtml(it.tramaUrl)}" tabindex="0">
              ${it.poster ? `<img src="${escapeHtml(it.poster)}" alt="" />` : '<div style="aspect-ratio:2/3;background:#111"></div>'}
              <div class="t">${escapeHtml(it.title)}</div>
            </a>`
          )
          .join('')}
      </div>
    </article>`;

  return shell({
    title: `Genere — ${data.genre}`,
    backHref: data.backHref,
    exitToStremio: !data.backHref,
    navLabel: `Genere: ${data.genre}`,
    body,
  });
}

export function renderSchedaHtml(data) {
  const body = `
    <div class="brand"><span></span> Italian Gems · Scheda completa</div>
    <article class="card">
      <div class="hero" style="background:
        linear-gradient(90deg, rgba(11,18,16,.94), rgba(11,18,16,.55)),
        url('${escapeHtml(data.backdrop || data.poster || '')}') center/cover; align-items:end;">
        ${data.poster ? `<img class="photo" src="${escapeHtml(data.poster)}" alt="" />` : ''}
        <div>
          <h1>${escapeHtml(data.title)}</h1>
          <div class="meta">${escapeHtml(data.year || '')} · ★ ${escapeHtml(data.rating)} · ${escapeHtml(data.country)}</div>
          <div class="chips">
            ${(data.genres || [])
              .map(
                (g) =>
                  `<a class="chip" href="${escapeHtml(g.url)}" tabindex="0">${escapeHtml(g.name)}</a>`
              )
              .join('')}
          </div>
        </div>
      </div>

      ${renderInfoBox(data)}

      <div class="section">
        <h2>Trama</h2>
        <div class="bio">${escapeHtml(data.overview)}</div>
      </div>

      <div class="section">
        <h2>Regia</h2>
        <div class="people">
          ${(data.directors || [])
            .map(
              (d) => `<a class="person" href="${escapeHtml(d.url)}" tabindex="0">
              ${d.photo ? `<img src="${escapeHtml(d.photo)}" alt="" />` : '<div style="aspect-ratio:2/3;background:#111"></div>'}
              <div class="p"><div class="n">${escapeHtml(d.name)}</div><div class="r">Regia</div></div>
            </a>`
            )
            .join('') || '<div class="meta">Nessun regista trovato</div>'}
        </div>
      </div>

      <div class="section">
        <h2>Cast</h2>
        <div class="people">
          ${(data.cast || [])
            .map(
              (a) => `<a class="person" href="${escapeHtml(a.url)}" tabindex="0">
              ${a.photo ? `<img src="${escapeHtml(a.photo)}" alt="" />` : '<div style="aspect-ratio:2/3;background:#111"></div>'}
              <div class="p"><div class="n">${escapeHtml(a.name)}</div><div class="r">${escapeHtml(a.ruolo)}</div></div>
            </a>`
            )
            .join('') || '<div class="meta">Cast non disponibile</div>'}
        </div>
      </div>
    </article>`;

  return shell({
    title: `${data.title} — Scheda`,
    // Root: chiusura webview (niente stremio:// / intent)
    backHref: undefined,
    exitToStremio: true,
    navLabel: 'Scheda completa',
    body,
  });
}
