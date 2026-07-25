import { AddonBuilder } from '@stremio-addon/sdk';
import { manifest } from './manifest.js';
import { buildCatalog } from './services/catalog.js';

/**
 * Costruisce l'interfaccia dell'add-on e collega i cataloghi a TMDB.
 */
export function buildAddon() {
  const builder = new AddonBuilder(manifest);

  builder.defineCatalogHandler(async ({ type, id, extra }) => {
    console.log(`[catalog] type=${type} id=${id} extra=`, extra);

    if (type !== 'movie') {
      return { metas: [] };
    }

    try {
      return await buildCatalog({ id, extra: extra || {} });
    } catch (err) {
      console.error('[catalog] errore:', err.message);
      return { metas: [] };
    }
  });

  return builder.getInterface();
}
