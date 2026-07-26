/**
 * Testi UX Italian Gems — layout a sezioni chiaro per Stremio (TV / mobile).
 * Doppio a capo: molti client schiacciano un solo \n.
 */

export function formatMetaBlocks(blocks) {
  return blocks
    .filter((b) => b && (b.body?.length || b.lines?.length))
    .map((b) => {
      const head = `▌ ${b.title}`;
      const body = b.lines?.length
        ? b.lines.join('\n')
        : String(b.body || '').trim();
      return `${head}\n${body}`;
    })
    .join('\n\n');
}

function mixOrderLines(intervalSec, bucket) {
  if (intervalSec > 0) {
    return [
      `› Stesso ordine se rientri entro ${Math.round(intervalSec / 60)} min`,
      `› (ciclo mix #${bucket ?? 0})`,
    ];
  }
  return ['› A ogni apertura del catalogo l’ordine dei titoli viene rimescolato'];
}

/**
 * Descrizione tile conteggio — spiega la logica della modalità attiva.
 */
export function buildCountTileDescription({
  kind,
  totalLabel,
  poolLabel,
  mode,
  intervalSec = 0,
  bucket,
  pageSize = 100,
  filterLabel,
}) {
  const kindWord = kind === 'serie' ? 'serie' : 'film';

  if (mode === 'top100-shuffle') {
    return formatMetaBlocks([
      {
        title: 'TOP 100 · VOTO 6,5+',
        body: [
          `Una selezione di ${poolLabel} ${kindWord}`,
          'con voto TMDB da 6,5 in su.',
          'Generi vari, non più vecchi di 30 anni,',
          'con preferenza per gli ultimi 5 anni.',
        ].join('\n'),
      },
      {
        title: 'SOGLIA VOTO',
        lines: [
          '› Entra solo chi ha voto 6,5 o superiore',
          '› Vale per film e per serie',
        ],
      },
      {
        title: 'LISTA NUOVA OGNI GIORNO',
        lines: [
          '› Ogni giorno i 100 titoli vengono rigenerati TUTTI',
          '› La lista del giorno dopo è completamente diversa',
          '› Per 24 ore restano sempre gli stessi 100',
          '› In quelle 24 ore cambia solo l’ordine (shuffle)',
        ],
      },
      {
        title: 'SHUFFLE (SOLO QUESTI 100)',
        lines: [
          ...mixOrderLines(intervalSec, bucket),
          '› Non entra nessun titolo fuori da questa lista del giorno',
        ],
      },
      filterLabel
        ? { title: 'FILTRI ATTIVI', body: filterLabel.replace(/ · /g, '\n') }
        : null,
      {
        title: 'COME USARLO',
        lines: [
          '› Scorri fino in fondo: sono circa 100 titoli',
          `› Circa ${pageSize} titoli per pagina`,
          '› Questa tile NON è un film/serie — torna indietro e apri un titolo sotto',
        ],
      },
    ]);
  }

  if (mode === 'popular-shuffle') {
    return formatMetaBlocks([
      {
        title: 'POPOLARI · ULTIMI 2 MESI',
        body: [
          `I ${kindWord} più popolari usciti`,
          `negli ultimi circa 60 giorni (fino a ${poolLabel}).`,
        ].join('\n'),
      },
      {
        title: 'FINESTRA CHE SCORRE NEL TEMPO',
        lines: [
          '› La lista è sempre “gli ultimi 2 mesi” rispetto a oggi',
          '› Man mano che passa il tempo entrano titoli nuovi',
          '› Quelli più vecchi escono dalla finestra',
          '› Se apri il giorno dopo puoi trovare un titolo nuovo',
          '  al posto di quello più vecchio uscito',
        ],
      },
      {
        title: 'SHUFFLE (SOLO QUESTI)',
        lines: [
          ...mixOrderLines(intervalSec, bucket),
          '› Lo shuffle riguarda solo i (fino a) 100 titoli di questa finestra',
        ],
      },
      filterLabel
        ? { title: 'FILTRI ATTIVI', body: filterLabel.replace(/ · /g, '\n') }
        : null,
      {
        title: 'COME USARLO',
        lines: [
          '› Scorri fino in fondo per vederli tutti',
          `› Circa ${pageSize} titoli per pagina`,
          '› Questa tile NON è un film/serie — torna indietro e apri un titolo sotto',
        ],
      },
    ]);
  }

  // Catalogo generale / filtri genere-mood-anno-paese
  return formatMetaBlocks([
    {
      title: 'CATALOGO GEMME',
      body: [
        `${totalLabel} ${kindWord} trovati su TMDB`,
        'con i filtri che hai scelto.',
      ].join('\n'),
    },
    {
      title: 'MIX IN CATALOGO',
      body: [
        `Qui vedi un mix di ${poolLabel} titoli`,
        'presi da quel totale, in ordine casuale.',
        'Scorri per vedere il resto del mix.',
      ].join('\n'),
    },
    filterLabel
      ? { title: 'FILTRI ATTIVI', body: filterLabel.replace(/ · /g, '\n') }
      : null,
    {
      title: 'COME FUNZIONA',
      lines: [
        ...mixOrderLines(intervalSec, bucket),
        '› Esci e rientra (o cambia un filtro) per aggiornare il mix',
        '› Filtri disponibili: Genere, Mood, Anno, Paese',
        '› Genere speciale: Popolari (2 mesi) e Top 100 (voto 6,5+)',
        `› Circa ${pageSize} titoli per pagina`,
        '› Questa tile NON è un film/serie — torna indietro e apri un titolo sotto',
      ],
    },
  ]);
}

/** Descrizione meta se Stremio riapre solo l’id della tile conteggio. */
export function buildCountMetaFallback(kind) {
  const kindWord = kind === 'serie' ? 'serie' : 'film';
  return formatMetaBlocks([
    {
      title: 'INFO CATALOGO',
      body: [
        `Questa tile spiega come funziona il catalogo ${kindWord}.`,
        'Non è un titolo da guardare.',
      ].join('\n'),
    },
    {
      title: 'COSA FARE',
      lines: [
        '› Torna indietro al catalogo',
        '› Apri un film o una serie sotto',
        '› Usa i filtri: Genere, Mood, Anno, Paese',
      ],
    },
    {
      title: 'LE TRE MODALITÀ',
      lines: [
        '› Top 100 (voto 6,5+): ogni giorno 100 titoli NUOVI e DIVERSI;',
        '  per 24 ore restano gli stessi e fanno solo shuffle',
        '› Popolari: sempre gli ultimi 2 mesi;',
        '  col tempo entrano titoli nuovi e escono i più vecchi',
        '› Altri filtri: mix da un campione più ampio (fino a 150)',
      ],
    },
  ]);
}

/**
 * Descrizione addon nel manifest Stremio (lista addon / installazione).
 * Testo corto ma chiaro: Stremio mostra poco spazio.
 */
export const ADDON_DESCRIPTION = [
  'Italian Gems — cataloghi FILM e SERIE con mix intelligente.',
  '',
  'TOP 100 (voto 6,5+): ogni giorno una lista completamente nuova di 100 titoli con voto da 6,5 in su. Per 24 ore restano gli stessi e si rimescolano solo di ordine.',
  '',
  'POPOLARI (ultimi 2 mesi): finestra scorrevole. Man mano che passa il tempo entrano titoli nuovi e escono i più vecchi.',
  '',
  'FILTRI: genere, mood, anno, paese di produzione. Mix generale fino a 150 titoli. Schede con trama, cast, regia.',
  '',
  'Riproduzione: usa i tuoi addon torrent/stream già installati (ID IMDb standard). Questo addon non fornisce video.',
].join('\n');
