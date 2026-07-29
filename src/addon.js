import { AddonBuilder } from '@stremio-addon/sdk';
import { manifest } from './manifest.js';
import { config } from './config.js';
import { buildCatalog } from './services/catalog.js';
import {
  buildDetailedMeta,
  resolveSchedaStream,
} from './services/metaDetail.js';
import { buildCountMetaFallback } from './lib/copy.js';

function withTimeout(promise, timeoutMs, label) {
  let timer;
  const timeout = new Promise((_, reject) => {
    timer = setTimeout(
      () => reject(new Error(`${label} timed out after ${timeoutMs}ms`)),
      timeoutMs
    );
  });
  return Promise.race([promise, timeout]).finally(() => clearTimeout(timer));
}

export function buildAddon() {
  const builder = new AddonBuilder(manifest);

  builder.defineCatalogHandler(async ({ type, id, extra }) => {
    console.log(`[catalog] type=${type} id=${id} extra=`, extra);
    try {
      const result = await withTimeout(
        buildCatalog({ type, id, extra: extra || {} }),
        config.catalogTimeoutMs,
        `catalog ${type}/${id}`
      );
      return {
        metas: result.metas || [],
        cacheMaxAge: result.cacheMaxAge ?? 30,
        staleRevalidate: Math.min(result.cacheMaxAge ?? 30, 30),
        staleError: 60,
      };
    } catch (err) {
      console.error('[catalog] errore:', err.message);
      return { metas: [] };
    }
  });

  builder.defineMetaHandler(async ({ type, id }) => {
    console.log(`[meta] type=${type} id=${id}`);
    try {
      // Tile conteggio catalogo
      if (String(id).startsWith('igems:count:')) {
        const kind = String(id).endsWith(':serie') ? 'serie' : 'film';
        const meta = {
          id,
          type: type === 'series' ? 'series' : 'movie',
          name: `▣ Info catalogo · ${kind}`,
          releaseInfo: 'non è un titolo da guardare',
          description: buildCountMetaFallback(kind),
          poster: `${config.publicBaseUrl}/logo-v30.png`,
          posterShape: 'square',
        };
        return { meta };
      }
      const { meta } = await buildDetailedMeta({ type, id });
      if (!meta) return { meta: null };
      return { meta };
    } catch (err) {
      console.error('[meta] errore:', err.message);
      return { meta: null };
    }
  });

  /**
   * Stream “Scheda completa” (extra).
   * La riproduzione vera arriva dagli altri addon (Torrentio, ecc.)
   * perché gli id catalogo sono IMDb tt… standard.
   */
  builder.defineStreamHandler(async ({ type, id }) => {
    console.log(`[stream] type=${type} id=${id}`);
    try {
      if (String(id).startsWith('igems:count:')) {
        return { streams: [] };
      }
      // Per episodi (tt…:s:e) la scheda punta comunque al titolo
      const resolved = await resolveSchedaStream({ type, id });
      if (!resolved?.schedaUrl) return { streams: [] };

      return {
        streams: [
          {
            name: 'Italian Gems',
            title: 'Scheda · Cast · Regia · Trama',
            externalUrl: resolved.schedaUrl,
          },
        ],
      };
    } catch (err) {
      console.error('[stream] errore:', err.message);
      return { streams: [] };
    }
  });

  return builder.getInterface();
}
