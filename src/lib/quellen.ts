import { quellen, typReihenfolge } from '../data/quellen.js';

type Quelle = (typeof quellen)[number];

/**
 * Anker-ID einer Quelle für /quellen/#… — aus Autor und Titel, damit der Link
 * vom Essay aus stabil bleibt, solange die Angabe im Vault gleich bleibt.
 * Muss auf der Quellen-Seite und im Essay dieselbe ID ergeben, deshalb hier
 * an einer Stelle.
 */
export function anker(q: Quelle): string {
  return [q.autor, q.titel]
    .filter(Boolean)
    .join(' ')
    .toLowerCase()
    .replace(/ü/g, 'ue')
    .replace(/ö/g, 'oe')
    .replace(/ä/g, 'ae')
    .replace(/ß/g, 'ss')
    .replace(/[^a-z0-9\s-]/g, '')
    .trim()
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-')
    .slice(0, 60)
    .replace(/-$/, '');
}

/**
 * Schließt die Notiz einer Quellenangabe mit einem Punkt ab, falls sie keinen
 * hat. Im Vault sind die Notizen halbe Sätze ohne Satzzeichen — auf dem Schirm
 * trennt die eigene Zeile sie noch vom „Erwähnt in …", im Textfluss (Vorlesen,
 * Kopieren, Crawler) liefen die beiden Halbsätze aber ineinander.
 */
export function mitPunkt(text: string): string {
  return /[.!?…:;»"")\]]$/.test(text.trim()) ? text.trim() : `${text.trim()}.`;
}

/** Quellen eines Essays, in derselben Reihenfolge wie auf der Quellen-Seite. */
export function quellenZuEssay(slug: string): Quelle[] {
  return quellen
    .filter((q) => q.essays?.includes(slug))
    .sort((a, b) => typReihenfolge.indexOf(a.typ) - typReihenfolge.indexOf(b.typ));
}
