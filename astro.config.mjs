// @ts-check
import { defineConfig } from 'astro/config';
import sitemap from '@astrojs/sitemap';
import { existsSync, readdirSync } from 'node:fs';

// Solange eine Rubrik leer ist, gehört sie nicht in die Sitemap — Google würde
// sonst eine Seite indexieren, auf der nur „Noch keine …" steht. Dieselbe Regel
// wie in Header.astro, das den Nav-Punkt erst mit dem ersten Text zeigt.
// Hier per fs statt getCollection, weil die Config vor dem Content geladen wird.
const hatTexte = (ordner) =>
  existsSync(ordner) && readdirSync(ordner).some((datei) => datei.endsWith('.md'));

const leereRubriken = [
  ['/grundlagen/', './src/content/grundlagen'],
  ['/buecher/', './src/content/buecher'],
]
  .filter(([, ordner]) => !hatTexte(ordner))
  .map(([pfad]) => pfad);

// https://astro.build/config
export default defineConfig({
  site: 'https://www.annotanda.com',
  trailingSlash: 'always',
  integrations: [
    sitemap({
      filter: (seite) => !leereRubriken.includes(new URL(seite).pathname),
    }),
  ],
});
