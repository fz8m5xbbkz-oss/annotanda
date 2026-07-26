#!/usr/bin/env node
/**
 * karten.mjs — Social-Cards (og:image) für die Essays bauen
 *
 *   npm run karten          nur fehlende Karten
 *   npm run karten -- alle  alle neu zeichnen (z. B. nach Design-Änderung)
 *
 * Warum ein Skript und keine Build-Zeit-Lösung: die Karten sollen genau wie
 * die Seite aussehen (Source Serif, Papierbeige, Olivgrün) — dafür braucht es
 * einen echten Textrenderer. Statt satori/sharp/@vercel/og zu installieren
 * nimmt das Skript den Chrome, der auf dem Mac schon liegt, und legt fertige
 * PNGs in public/og/ ab. Vercel baut die also nie selbst, sie liegen im Repo.
 *
 * Fehlt Chrome, bricht nichts ab — es wird nur gemeldet und übersprungen;
 * die Seiten fallen dann auf die allgemeine Karte /og/annotanda.png zurück.
 */

import { readdirSync, readFileSync, writeFileSync, existsSync, mkdirSync, rmSync } from 'node:fs';
import { join, dirname, basename } from 'node:path';
import { fileURLToPath } from 'node:url';
import { execFileSync } from 'node:child_process';
import { tmpdir } from 'node:os';

const __dir = dirname(fileURLToPath(import.meta.url));
const ESSAY_ORDNER = join(__dir, 'src/content/essays');
const OG_ORDNER = join(__dir, 'public/og');
const FONT = join(__dir, 'public/fonts/SourceSerif4Variable-Roman.woff2');

const CHROME = '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';

const BREITE = 1200;
const HOEHE = 630;

/** Nur `schluessel: wert`-Zeilen — dieselbe Sparversion wie in publizieren.mjs. */
function parseFrontmatter(text) {
  const m = text.match(/^---\r?\n([\s\S]*?)\r?\n---\r?\n?([\s\S]*)$/);
  if (!m) return { daten: {}, body: text };
  const daten = {};
  for (const zeile of m[1].split(/\r?\n/)) {
    const treffer = zeile.match(/^([A-Za-z_][\w-]*):\s*(.*)$/);
    if (treffer) daten[treffer[1]] = treffer[2].trim().replace(/^["']|["']$/g, '');
  }
  return { daten, body: m[2] };
}

function escapeHtml(text) {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}

/** Lange Titel dürfen den Rand nicht sprengen — Größe grob nach Länge. */
function titelGroesse(titel) {
  if (titel.length <= 24) return 88;
  if (titel.length <= 40) return 74;
  if (titel.length <= 60) return 62;
  return 52;
}

function baueHtml({ titel, meta, fontBase64 }) {
  const groesse = titelGroesse(titel);
  return `<!doctype html>
<meta charset="utf-8">
<style>
  @font-face {
    font-family: 'Source Serif 4';
    src: url(data:font/woff2;base64,${fontBase64}) format('woff2-variations');
    font-weight: 200 900;
  }
  html, body { margin: 0; padding: 0; }
  body {
    width: ${BREITE}px;
    height: ${HOEHE}px;
    background: #EDE6D7;
    /* dieselbe Papierkörnung wie auf der Seite */
    background-image: url("data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' width='240' height='240'><filter id='n'><feTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='2' stitchTiles='stitch'/><feColorMatrix values='0 0 0 0 0.08 0 0 0 0 0.06 0 0 0 0 0.04 0 0 0 0.05 0'/></filter><rect width='100%' height='100%' filter='url(%23n)'/></svg>");
    font-family: 'Source Serif 4', Georgia, serif;
    color: #1a1a1a;
    display: flex;
    flex-direction: column;
    justify-content: space-between;
    box-sizing: border-box;
    /* Olivgrüne Kante links — der einzige Schmuck, damit die Karte auch als
       Daumennagel als annotanda erkennbar ist. Als border, nicht als
       position:fixed-Pseudoelement: das zeichnet Chrome im Screenshot nicht. */
    border-left: 10px solid #5b6b3e;
    padding: 68px 80px;
    overflow: hidden;
  }
  .wortmarke {
    font-size: 26px;
    letter-spacing: 0.06em;
    color: #5b6b3e;
  }
  .titel {
    font-size: ${groesse}px;
    font-weight: 400;
    line-height: 1.18;
    margin: 0;
    max-height: ${Math.round(groesse * 1.18 * 3)}px;
    overflow: hidden;
  }
  .fuss {
    display: flex;
    justify-content: space-between;
    align-items: baseline;
    font-size: 22px;
    color: #6b6b6b;
    border-top: 1px solid rgba(26, 26, 26, 0.15);
    padding-top: 20px;
  }
  .fuss .domain { color: #5b6b3e; }
</style>
<div class="wortmarke">annotanda</div>
<h1 class="titel">${escapeHtml(titel)}</h1>
<div class="fuss">
  <span>${escapeHtml(meta)}</span>
  <span class="domain">annotanda.com</span>
</div>
`;
}

function chromeVorhanden() {
  return existsSync(CHROME);
}

/** Rendert eine HTML-Datei zu genau einem PNG in Kartengröße. */
function schiesseFoto(htmlPfad, zielPfad) {
  // --virtual-time-budget gibt der eingebetteten Schrift Zeit zu laden,
  // sonst schießt Chrome das Foto in der Fallback-Serif.
  execFileSync(
    CHROME,
    [
      '--headless=new',
      '--disable-gpu',
      '--hide-scrollbars',
      '--force-device-scale-factor=1',
      `--window-size=${BREITE},${HOEHE}`,
      '--virtual-time-budget=3000',
      `--screenshot=${zielPfad}`,
      `file://${htmlPfad}`,
    ],
    { stdio: 'ignore' }
  );
}

const formatDatum = (roh) => {
  const d = new Date(roh);
  if (Number.isNaN(d.valueOf())) return '';
  return d.toLocaleDateString('de-DE', { day: '2-digit', month: 'long', year: 'numeric' });
};

const lesezeit = (body) =>
  Math.max(1, Math.round((body ?? '').split(/\s+/).filter(Boolean).length / 200));

/**
 * Baut die allgemeine Karte plus je eine pro Essay. Fehlende Karten immer,
 * `neuZeichnen` (Slugs) auch bei geändertem Titel, `alle: true` restlos alle.
 * Gibt die Liste der geschriebenen Dateien zurück (leer, wenn nichts zu tun war).
 */
export function generiereKarten({ alle = false, neuZeichnen = [], still = false } = {}) {
  const log = (text) => {
    if (!still) console.log(text);
  };

  if (!chromeVorhanden()) {
    log('· Google Chrome nicht gefunden — Social-Cards übersprungen.');
    return [];
  }

  const fontBase64 = readFileSync(FONT).toString('base64');
  mkdirSync(OG_ORDNER, { recursive: true });

  const auftraege = [
    {
      slug: 'annotanda',
      ziel: join(OG_ORDNER, 'annotanda.png'),
      titel: 'Philosophie aus dem Inneren der Verwaltung',
      meta: 'Ein öffentliches Denktagebuch',
    },
  ];

  if (existsSync(ESSAY_ORDNER)) {
    for (const datei of readdirSync(ESSAY_ORDNER)) {
      if (!datei.endsWith('.md')) continue;
      const slug = basename(datei, '.md');
      const { daten, body } = parseFrontmatter(readFileSync(join(ESSAY_ORDNER, datei), 'utf-8'));
      const datum = formatDatum(daten.date);
      auftraege.push({
        slug,
        ziel: join(OG_ORDNER, `${slug}.png`),
        titel: daten.title || slug,
        meta: [datum, `${lesezeit(body)} Min. Lesezeit`].filter(Boolean).join(' · '),
      });
    }
  }

  const offen = alle
    ? auftraege
    : auftraege.filter((a) => !existsSync(a.ziel) || neuZeichnen.includes(a.slug));
  if (offen.length === 0) return [];

  const arbeitsordner = join(tmpdir(), `annotanda-karten-${process.pid}`);
  mkdirSync(arbeitsordner, { recursive: true });

  const geschrieben = [];
  try {
    for (const auftrag of offen) {
      const htmlPfad = join(arbeitsordner, `${basename(auftrag.ziel, '.png')}.html`);
      writeFileSync(htmlPfad, baueHtml({ ...auftrag, fontBase64 }));
      schiesseFoto(htmlPfad, auftrag.ziel);
      geschrieben.push(auftrag.ziel);
      log(`· Karte gezeichnet: og/${basename(auftrag.ziel)}`);
    }
  } finally {
    rmSync(arbeitsordner, { recursive: true, force: true });
  }

  return geschrieben;
}

// Direkt aufgerufen (npm run karten), nicht importiert
if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const alle = process.argv.includes('alle');
  const geschrieben = generiereKarten({ alle });
  if (geschrieben.length === 0) console.log('Nichts zu zeichnen — alle Karten sind da.');
}
