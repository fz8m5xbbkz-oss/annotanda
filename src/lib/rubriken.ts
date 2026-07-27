/**
 * Welche Rubriken haben schon einen Text?
 *
 * Steuert, ob „Grundlagen" und „Bücher" in der Navigation auftauchen — ein
 * Nav-Punkt auf eine leere Seite ist für den Leser eine Sackgasse und für
 * Google eine dünne Seite. Sobald der erste Text steht, erscheint der Punkt
 * von selbst.
 *
 * Bewusst `import.meta.glob` statt `getCollection`: Astro warnt bei jedem
 * Aufruf auf eine leere Collection („does not exist or is empty") — bei einer
 * Abfrage pro Seite waren das 42 Warnungen pro Build. Vite löst das Glob zur
 * Bauzeit statisch auf, ohne Laufzeitkosten und ohne Rauschen.
 */

const grundlagen = import.meta.glob('../content/grundlagen/*.md');
const buecher = import.meta.glob('../content/buecher/*.md');

export const hatGrundlagen = Object.keys(grundlagen).length > 0;
export const hatBuecher = Object.keys(buecher).length > 0;
