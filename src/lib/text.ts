/**
 * Kleine Text-Helfer für Essays — geteilt von Startseite, Essay-Liste und
 * Essay-Seite, damit Lesezeit und Auszug überall gleich berechnet werden.
 */

/** Lesezeit in Minuten: 200 Wörter/Minute, aufgerundet, mindestens 1. */
export function lesezeit(body: string | undefined): number {
  const woerter = (body ?? '').split(/\s+/).filter(Boolean).length;
  return Math.max(1, Math.round(woerter / 200));
}

/**
 * Kurzer Auszug aus Markdown-Fließtext: Überschriften, Links und
 * Markdown-Zeichen entfernt, auf `max` Zeichen an einer Wortgrenze gekürzt.
 */
export function auszug(body: string | undefined, max = 180): string {
  const text = (body ?? '')
    .replace(/^#.*$/gm, '') // Überschriften
    .replace(/\[([^\]]+)\]\([^)]+\)/g, '$1') // Links → nur der Text
    .replace(/[*_>`#]/g, '') // verbliebene Markdown-Zeichen
    .replace(/\s+/g, ' ')
    .trim();
  if (text.length <= max) return text;
  return text.slice(0, max).replace(/\s+\S*$/, '') + ' …';
}

/**
 * Meta-Description aus dem Fließtext: bevorzugt ganze Sätze, weil Google und
 * Link-Vorschauen den Text ungekürzt anzeigen — ein abgeschnittener Satz liest
 * sich dort schlechter als ein kurzer vollständiger.
 */
export function beschreibung(body: string | undefined, max = 158): string {
  const text = auszug(body, 400).replace(/ …$/, '');
  if (text.length <= max) return text;

  const satzende = text.slice(0, max + 1).match(/^[\s\S]*[.!?»""](?=\s|$)/);
  if (satzende && satzende[0].length >= 80) return satzende[0].trim();

  return text.slice(0, max).replace(/\s+\S*$/, '') + ' …';
}
