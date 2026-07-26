#!/usr/bin/env node
/**
 * publizieren.mjs — Essays UND feste Seiten aus Obsidian veröffentlichen
 *
 *   npm run publizieren
 *
 * Liest aus dem Obsidian-Vault:
 *   - Essays   aus „annotanda Essays" (nur `status: fertig`)
 *   - Seiten   aus „annotanda Seiten" (Über, Lektüre, Quellen — ohne status)
 *
 * Zeigt, was sich ändern würde, und committet erst nach Bestätigung
 * (der post-commit-Hook pusht, Vercel deployt).
 *
 * Vault-Konventionen:
 *   - Essays: Dateien mit `_` am Anfang werden ignoriert; %%Kommentare%%
 *     entfernt; Titel: `title:` > erste `#` > Dateiname.
 *   - Wikilinks [[…]]: zeigt das Ziel auf einen Essay, der nach diesem Lauf
 *     existiert (im Repo oder in diesem Lauf mit status:fertig), wird ein
 *     interner Link /essays/<slug>/ daraus — sonst wie bisher reiner Text
 *     (nie ein 404-Link).
 *   - Seiten: feste Dateinamen Über.md / Lektüre.md / Quellen.md.
 *     Über = freies Markdown. Lektüre/Quellen = Listen unter Überschriften
 *     (siehe _Anleitung.md im Seiten-Ordner).
 */

import { createInterface } from 'node:readline';
import { readdirSync, readFileSync, writeFileSync, existsSync, mkdirSync } from 'node:fs';
import { join, dirname, basename } from 'node:path';
import { fileURLToPath } from 'node:url';
import { execFileSync } from 'node:child_process';

const __dir = dirname(fileURLToPath(import.meta.url));

const VAULT_BASIS = join(
  process.env.HOME,
  'Library/Mobile Documents/iCloud~md~obsidian/Documents/Luis',
  '06 - annotanda'
);
const ESSAY_VAULT = join(VAULT_BASIS, 'annotanda Essays');
const RESUEMEE_VAULT = join(VAULT_BASIS, 'annotanda Bücher');
const GRUNDLAGEN_VAULT = join(VAULT_BASIS, 'annotanda Grundlagen');
const SEITEN_VAULT = join(VAULT_BASIS, 'annotanda Seiten');
const ESSAY_ORDNER = join(__dir, 'src/content/essays');
const RESUEMEE_ORDNER = join(__dir, 'src/content/buecher');
const GRUNDLAGEN_ORDNER = join(__dir, 'src/content/grundlagen');

// ── Hilfsfunktionen ───────────────────────────────────────────────────────

function slugify(text) {
  return text
    .toLowerCase()
    .replace(/ü/g, 'ue')
    .replace(/ö/g, 'oe')
    .replace(/ä/g, 'ae')
    .replace(/ß/g, 'ss')
    .replace(/[^a-z0-9\s-]/g, '')
    .trim()
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-');
}

/** Sehr einfaches Frontmatter-Parsing: nur `schluessel: wert`-Zeilen */
function parseFrontmatter(text) {
  const m = text.match(/^---\r?\n([\s\S]*?)\r?\n---\r?\n?/);
  if (!m) return { daten: {}, body: text };
  const daten = {};
  for (const zeile of m[1].split(/\r?\n/)) {
    const km = zeile.match(/^([\w-]+):\s*(.*)$/);
    if (km) daten[km[1]] = km[2].trim().replace(/^["']|["']$/g, '');
  }
  return { daten, body: text.slice(m[0].length) };
}

/** Wikilink-Ziel für den Map-Lookup normalisieren:
 *  Pfad-Präfix („annotanda Essays/Titel") und #Anker abschneiden. */
function wikiZielName(ziel) {
  let t = ziel.split('#')[0];
  const slash = t.lastIndexOf('/');
  if (slash !== -1) t = t.slice(slash + 1);
  return t.trim();
}

const normKey = (s) => s.normalize('NFC').toLowerCase().trim();

/**
 * Obsidian-Syntax in normales Markdown übersetzen.
 * `slugMap` (normalisierter Titel/Dateiname → Essay-Slug) löst Wikilinks zu
 * internen Links auf; ohne Treffer bleibt das alte Verhalten: reiner Text.
 * Wichtig: %%-Blöcke fliegen ZUERST raus — Werkstatt-Wikilinks werden nie
 * zu Links, und die Mermaid-Extraktion passiert schon vor diesem Aufruf.
 */
function bereinige(body, slugMap = null) {
  const ersetzeWikilink = (_, ziel, alias) => {
    const name = wikiZielName(ziel);
    const text = (alias || name).trim();
    const slug = slugMap?.get(normKey(name));
    return slug ? `[${text}](/essays/${slug}/)` : text;
  };

  return body
    .replace(/%%[\s\S]*?%%/g, '') // Obsidian-Kommentare
    .replace(/!\[\[[^\]]+\]\]/g, '') // Einbettungen (Bilder etc.) — kommen nicht mit
    .replace(/\[\[([^\]|]+)\|([^\]]+)\]\]/g, ersetzeWikilink) // [[Ziel|Text]]
    .replace(/\[\[([^\]]+)\]\]/g, (m, ziel) => ersetzeWikilink(m, ziel, null)) // [[Ziel]]
    .trim();
}

/**
 * Trägt einen Frontmatter-Wert (z. B. `substack_url`, `steady_url`) in eine
 * Obsidian-Notiz ein (Essay/Resümee/Grundlagen — daher der Vault-Ordner als
 * Parameter). Die Notiz bleibt die Quelle der Wahrheit — stünde der Link nur
 * im Repo, wäre er beim nächsten Lauf wieder überschrieben. Ein vorhandener
 * (auch leerer) Schlüssel wird ersetzt, sonst wird die Zeile vor dem
 * schließenden `---` eingefügt. Ohne Frontmatter passiert nichts — dann fehlte
 * auch `status: fertig`, der Essay wäre gar nicht so weit gekommen.
 */
function setzeFrontmatterWert(vault, datei, schluessel, wert) {
  const pfad = join(vault, datei);
  const roh = readFileSync(pfad, 'utf-8');
  const block = roh.match(/^---\r?\n[\s\S]*?\r?\n---/)?.[0];
  if (!block) return false;

  const zeile = `${schluessel}: "${wert}"`;
  const re = new RegExp(`^${schluessel}:.*$`, 'm');
  const neuerBlock = re.test(block)
    ? block.replace(re, zeile)
    : block.replace(/(\r?\n)---$/, `$1${zeile}$1---`);

  writeFileSync(pfad, neuerBlock + roh.slice(block.length), 'utf-8');
  return true;
}

/** Titel einer Notiz bestimmen: Frontmatter `title` > erste `#`-Zeile > Dateiname. */
function notizTitel(daten, body, datei) {
  const h1 = body.match(/^\s*#\s+(.+)$/m);
  return daten.title || h1?.[1].trim() || basename(datei, '.md');
}

/** true, wenn die Notiz eine ungerade Zahl von %% enthält — also ein
 *  Werkstattblock geöffnet, aber nicht geschlossen wurde. Dann würde sein
 *  privater Inhalt beim Publizieren öffentlich (bereinige entfernt nur
 *  vollständige %%…%%-Paare). */
function werkstattOffen(body) {
  return ((body.match(/%%/g) || []).length % 2) === 1;
}

/** Findet eine Datei im Ordner unabhängig von Unicode-Normalisierung/Groß-Klein */
function findeDatei(ordner, name) {
  if (!existsSync(ordner)) return null;
  const ziel = name.normalize('NFC').toLowerCase();
  for (const d of readdirSync(ordner)) {
    if (d.normalize('NFC').toLowerCase() === ziel) return join(ordner, d);
  }
  return null;
}

// ── Listen-Parser für Lektüre & Quellen ────────────────────────────────────

/** Eine Listenzeile „- Autor: Titel (Jahr) — Notiz {essay-slug}" → Objekt */
function parseEintrag(zeile) {
  let s = zeile.replace(/^\s*[-*]\s+/, '').trim();
  if (!s) return null;
  const e = {};

  // {essay-slug, …} ganz am Ende (nur Quellen)
  const mEss = s.match(/\{([^}]+)\}\s*$/);
  if (mEss) {
    e.essays = mEss[1].split(',').map((x) => x.trim()).filter(Boolean);
    s = s.slice(0, mEss.index).trim();
  }

  // Notiz nach Gedankenstrich „ — "
  const dash = s.indexOf(' — ');
  if (dash !== -1) {
    e.notiz = s.slice(dash + 3).trim();
    s = s.slice(0, dash).trim();
  }

  // Jahr in (…) am Ende — aber nicht, wenn das die schließende Klammer
  // eines Markdown-Links [Titel](url) ist (URLs enthalten immer „://")
  const mJahr = s.match(/\s*\(([^)]+)\)\s*$/);
  if (mJahr && !mJahr[1].includes('://')) {
    const j = mJahr[1].trim();
    e.jahr = /^\d+$/.test(j) ? Number(j) : j;
    s = s.slice(0, mJahr.index).trim();
  }

  // Autor vor dem ersten „: "
  const colon = s.indexOf(': ');
  let titel = s;
  if (colon !== -1) {
    e.autor = s.slice(0, colon).trim();
    titel = s.slice(colon + 2).trim();
  }

  // Markdown-Link [Titel](url)
  const mLink = titel.match(/^\[([^\]]+)\]\(([^)]+)\)$/);
  if (mLink) {
    e.titel = mLink[1].trim();
    e.url = mLink[2].trim();
  } else {
    e.titel = titel;
  }

  return e;
}

/** Body in { sektionsschlüssel: [einträge] } zerlegen, Überschriften per Map */
function parseSektionen(body, headingMap) {
  const map = {};
  for (const k in headingMap) map[k.normalize('NFC')] = headingMap[k];
  const result = {};
  let aktuell = null;
  for (const roh of body.split(/\r?\n/)) {
    const h = roh.match(/^#{1,6}\s+(.+?)\s*$/);
    if (h) {
      aktuell = map[h[1].trim().toLowerCase().normalize('NFC')] || null;
      if (aktuell && !result[aktuell]) result[aktuell] = [];
      continue;
    }
    if (aktuell && /^\s*[-*]\s+/.test(roh)) {
      const e = parseEintrag(roh);
      if (e) result[aktuell].push(e);
    }
  }
  return result;
}

function parseLektuere(body) {
  const r = parseSektionen(body, {
    gerade: 'aktuell',
    geplant: 'geplant',
    abgeschlossen: 'abgeschlossen',
    empfohlen: 'empfohlen',
  });
  return {
    aktuell: r.aktuell || [],
    geplant: r.geplant || [],
    abgeschlossen: r.abgeschlossen || [],
    empfohlen: r.empfohlen || [],
  };
}

function parseQuellen(body) {
  const r = parseSektionen(body, {
    'primärtexte': 'primaertext',
    'primärquellen': 'primaertext',
    'bücher': 'buch',
    'aufsätze': 'aufsatz',
    'online': 'online',
    'online-quellen': 'online',
  });
  const out = [];
  for (const [typ, arr] of Object.entries(r)) {
    for (const e of arr) out.push({ ...e, typ });
  }
  return out;
}

// ── Generatoren für die Datendateien ───────────────────────────────────────

const KOPF = (quelle) =>
  `// AUTOMATISCH GENERIERT aus Obsidian (annotanda Seiten/${quelle})\n` +
  `// via \`npm run publizieren\`. Nicht von Hand bearbeiten — Änderungen hier\n` +
  `// werden beim nächsten Publizieren überschrieben.\n`;

/** Normalisiert einen Buchtitel für den Abgleich Lektüre ↔ Resümee:
 *  klein, Umlaute aufgelöst, alles außer Buchstaben/Ziffern weg. So matcht
 *  „Was bedeutet das alles?" auch gegen den langen Untertitel in der Liste. */
function buchKey(s) {
  return (s || '')
    .toLowerCase()
    .replace(/ü/g, 'ue')
    .replace(/ö/g, 'oe')
    .replace(/ä/g, 'ae')
    .replace(/ß/g, 'ss')
    .replace(/[^a-z0-9]/g, '');
}

// Gefüllt beim Vorab-Scan der fertigen Resümees: { key, slug } je Buch.
// genLektuere hängt an jedes passende Buch den Resümee-Slug.
const resuemeeIndex = [];

/** Resümee-Slug für ein Buch aus der Lektüre-Liste, falls eins existiert.
 *  Treffer, wenn ein Schlüssel im anderen steckt (kurzer Titel ↔ langer). */
function findeResuemee(buchTitel) {
  const k = buchKey(buchTitel);
  if (!k) return null;
  for (const e of resuemeeIndex) {
    if (k.includes(e.key) || e.key.includes(k)) return e.slug;
  }
  return null;
}

function genLektuere(body) {
  const d = parseLektuere(body);
  // Jedem Buch den Resümee-Slug beilegen (nur wo es eins gibt).
  for (const abschnitt of [d.aktuell, d.geplant, d.abgeschlossen, d.empfohlen]) {
    for (const buch of abschnitt) {
      const slug = findeResuemee(buch.titel);
      if (slug) buch.resuemee = slug;
    }
  }
  const j = (a) => JSON.stringify(a, null, 2);
  return (
    KOPF('Lektüre.md') +
    `\nexport const aktuell = ${j(d.aktuell)};\n` +
    `\nexport const geplant = ${j(d.geplant)};\n` +
    `\nexport const abgeschlossen = ${j(d.abgeschlossen)};\n` +
    `\nexport const empfohlen = ${j(d.empfohlen)};\n`
  );
}

function genQuellen(body) {
  const q = parseQuellen(body);
  return (
    KOPF('Quellen.md') +
    `\nexport const quellen = ${JSON.stringify(q, null, 2)};\n` +
    `\nexport const typReihenfolge = ['primaertext', 'buch', 'aufsatz', 'online'];\n` +
    `\nexport const typLabel = {\n` +
    `  primaertext: 'Primärtexte',\n` +
    `  buch: 'Bücher',\n` +
    `  aufsatz: 'Aufsätze',\n` +
    `  online: 'Online',\n` +
    `};\n`
  );
}

/**
 * argumente.js aus den gesammelten ```mermaid-Blöcken der Essays bauen.
 * Reihenfolge: neuester Essay zuerst (wie in der Argumente-Übersicht).
 */
function genArgumente(liste) {
  const sortiert = [...liste].sort((a, b) =>
    String(b.datum).localeCompare(String(a.datum))
  );
  const karten = sortiert
    .map(
      (k) =>
        `  {\n` +
        `    slug: ${JSON.stringify(k.slug)},\n` +
        `    titel: ${JSON.stringify(k.titel)},\n` +
        `    diagramm: ${JSON.stringify('\n' + k.diagramm + '\n')},\n` +
        `  },`
    )
    .join('\n');
  return (
    '// AUTOMATISCH GENERIERT aus den ```mermaid-Blöcken der Essay-Notizen\n' +
    '// via `npm run publizieren`. Nicht von Hand bearbeiten — Änderungen hier\n' +
    '// werden beim nächsten Publizieren überschrieben.\n' +
    `\nexport const argumente = [\n${karten}\n];\n`
  );
}

// ── Slug-Map für Wikilink-Auflösung ────────────────────────────────────────
// Enthält nur Essays, die nach diesem Lauf wirklich eine Route haben:
// (a) Vault-Notizen mit status:fertig, (b) bereits publizierte Repo-Essays.
// Ideen/Entwürfe fehlen bewusst — deren Wikilinks bleiben Text, nie 404.

const slugMap = new Map();

function merkeSlug(schluessel, slug) {
  if (schluessel) slugMap.set(normKey(schluessel), slug);
}

if (existsSync(ESSAY_ORDNER)) {
  for (const datei of readdirSync(ESSAY_ORDNER)) {
    if (!datei.endsWith('.md')) continue;
    const slug = basename(datei, '.md');
    const { daten } = parseFrontmatter(readFileSync(join(ESSAY_ORDNER, datei), 'utf-8'));
    merkeSlug(slug, slug);
    merkeSlug(daten.title, slug);
  }
}

if (existsSync(ESSAY_VAULT)) {
  for (const datei of readdirSync(ESSAY_VAULT)) {
    if (!datei.endsWith('.md') || datei.startsWith('_')) continue;
    const { daten, body } = parseFrontmatter(readFileSync(join(ESSAY_VAULT, datei), 'utf-8'));
    if (daten.status !== 'fertig') continue;
    const h1 = body.match(/^\s*#\s+(.+)$/m);
    const titel = daten.title || h1?.[1].trim() || basename(datei, '.md');
    const slug = slugify(daten.slug || titel);
    merkeSlug(basename(datei, '.md'), slug); // Wikilinks zeigen auf den Dateinamen
    merkeSlug(titel, slug);
  }
}

// ── Vorab-Scan: welche Bücher haben ein Resümee? ────────────────────────────
// Baut resuemeeIndex (Buch-Schlüssel → Resümee-Slug), damit genLektuere die
// Lektüre-Liste mit „Resümee lesen"-Links versehen kann. Ein Resümee bindet
// sich über die Eigenschaft `buch` an ein Buch — fehlt sie, dient der Titel
// als Schlüssel. Nur fertige Resümees (Vault) und bereits publizierte (Repo).

function merkeResuemee(buchOderTitel, slug) {
  const key = buchKey(buchOderTitel);
  if (key && !resuemeeIndex.some((e) => e.key === key)) {
    resuemeeIndex.push({ key, slug });
  }
}

if (existsSync(RESUEMEE_ORDNER)) {
  for (const datei of readdirSync(RESUEMEE_ORDNER)) {
    if (!datei.endsWith('.md')) continue;
    const slug = basename(datei, '.md');
    const { daten } = parseFrontmatter(readFileSync(join(RESUEMEE_ORDNER, datei), 'utf-8'));
    merkeResuemee(daten.buch || daten.title, slug);
  }
}

if (existsSync(RESUEMEE_VAULT)) {
  for (const datei of readdirSync(RESUEMEE_VAULT)) {
    if (!datei.endsWith('.md') || datei.startsWith('_')) continue;
    const { daten, body } = parseFrontmatter(readFileSync(join(RESUEMEE_VAULT, datei), 'utf-8'));
    if (daten.status !== 'fertig') continue;
    const h1 = body.match(/^\s*#\s+(.+)$/m);
    const titel = daten.title || h1?.[1].trim() || basename(datei, '.md');
    const slug = slugify(daten.slug || titel);
    merkeResuemee(daten.buch || titel, slug);
  }
}

// ── Essays sammeln ──────────────────────────────────────────────────────────

const kandidaten = []; // { art, label, ziel, inhalt, url }
const argumentListe = []; // { slug, titel, diagramm, datum } — für argumente.js
const fertigeEssays = []; // { datei, vault, slug, titel, ziel, url, substackUrl, baueInhalt }
const fertigeResuemees = []; // dieselbe Form — für den gemeinsamen Substack-Schritt
const fertigeGrundlagen = []; // ebenso
const offeneWerkstatt = []; // Titel von Notizen mit ungeradem %% (offener Werkstattblock)

if (existsSync(ESSAY_VAULT)) {
  for (const datei of readdirSync(ESSAY_VAULT)) {
    if (!datei.endsWith('.md') || datei.startsWith('_')) continue;

    const roh = readFileSync(join(ESSAY_VAULT, datei), 'utf-8');
    const { daten, body } = parseFrontmatter(roh);
    if (daten.status !== 'fertig') continue;
    if (werkstattOffen(body)) offeneWerkstatt.push(notizTitel(daten, body, datei));

    const h1 = body.match(/^\s*#\s+(.+)$/m);
    const titel = daten.title || h1?.[1].trim() || basename(datei, '.md');

    // Slug: Frontmatter `slug:` gewinnt (hält die URL stabil, auch wenn der
    // Titel anders lautet als der Dateiname), sonst aus dem Titel abgeleitet.
    const slug = slugify(daten.slug || titel);
    const datum = daten.date || new Date().toISOString().split('T')[0];

    // Argument-Diagramm: der erste ```mermaid-Block der Notiz wird zur
    // Argument-Karte und aus dem Essay-Text entfernt (samt einer davor
    // stehenden „## Argument"-Zeile, falls vorhanden).
    const mMermaid = body.match(/```mermaid\r?\n([\s\S]*?)```/);
    const diagramm = mMermaid ? mMermaid[1].trim() : null;
    if (diagramm) argumentListe.push({ slug, titel, diagramm, datum });

    let essayRoh = body;
    if (diagramm) {
      essayRoh = essayRoh
        .replace(/[ \t]*#{1,6}[ \t]*Argument[ \t]*\r?\n+/gi, '')
        .replace(/```mermaid\r?\n[\s\S]*?```\r?\n?/g, '');
    }

    const text = bereinige(essayRoh.replace(/^\s*#\s+.+\r?\n+/, ''), slugMap);
    if (!text) {
      console.log(`· „${titel}" ist noch leer — übersprungen.`);
      continue;
    }

    // Als Funktion, damit der Substack-Schritt weiter unten denselben Essay
    // mit ergänztem Link noch einmal bauen kann.
    const baueInhalt = ({ substack, steady } = {}) => {
      const frontmatter = [
        '---',
        `title: "${titel.replace(/"/g, '\\"')}"`,
        `date: ${datum}`,
        ...(substack ? [`substack_url: "${substack}"`] : []),
        ...(steady ? [`steady_url: "${steady}"`] : []),
        ...(daten.bild ? [`bild: "${daten.bild}"`] : []),
        ...(daten.bild_untertitel
          ? [`bild_untertitel: "${daten.bild_untertitel.replace(/"/g, '\\"')}"`]
          : []),
        '---',
      ].join('\n');
      return `${frontmatter}\n\n${text}\n`;
    };

    const ziel = join(ESSAY_ORDNER, `${slug}.md`);
    const url = `https://www.annotanda.com/essays/${slug}/`;

    fertigeEssays.push({
      datei,
      vault: ESSAY_VAULT,
      slug,
      titel,
      ziel,
      url,
      substackUrl: daten.substack_url || null,
      steadyUrl: daten.steady_url || null,
      baueInhalt,
    });

    const inhalt = baueInhalt({ substack: daten.substack_url, steady: daten.steady_url });
    if (existsSync(ziel) && readFileSync(ziel, 'utf-8') === inhalt) continue;
    kandidaten.push({
      art: existsSync(ziel) ? 'aktualisiert' : 'neu',
      label: titel,
      ziel,
      inhalt,
      url,
    });
  }
}

// ── Resümees sammeln ────────────────────────────────────────────────────────
// Zweite Textform, bewusst wie die Essays: Notiz mit `# Titel`, status:fertig,
// eigene Datei in src/content/buecher/. Kein Argument-Diagramm. `buch` bindet
// optional an ein Buch der Lektüre-Liste (siehe resuemeeIndex/genLektuere).

if (existsSync(RESUEMEE_VAULT)) {
  for (const datei of readdirSync(RESUEMEE_VAULT)) {
    if (!datei.endsWith('.md') || datei.startsWith('_')) continue;

    const roh = readFileSync(join(RESUEMEE_VAULT, datei), 'utf-8');
    const { daten, body } = parseFrontmatter(roh);
    if (daten.status !== 'fertig') continue;
    if (werkstattOffen(body)) offeneWerkstatt.push(notizTitel(daten, body, datei));

    const h1 = body.match(/^\s*#\s+(.+)$/m);
    const titel = daten.title || h1?.[1].trim() || basename(datei, '.md');
    const slug = slugify(daten.slug || titel);
    const datum = daten.date || new Date().toISOString().split('T')[0];
    const buch = daten.buch || null;

    const text = bereinige(body.replace(/^\s*#\s+.+\r?\n+/, ''), slugMap);
    if (!text) {
      console.log(`· „${titel}" ist noch leer — übersprungen.`);
      continue;
    }

    const baueInhalt = ({ substack, steady } = {}) => {
      const frontmatter = [
        '---',
        `title: "${titel.replace(/"/g, '\\"')}"`,
        `date: ${datum}`,
        ...(buch ? [`buch: "${buch.replace(/"/g, '\\"')}"`] : []),
        ...(substack ? [`substack_url: "${substack}"`] : []),
        ...(steady ? [`steady_url: "${steady}"`] : []),
        '---',
      ].join('\n');
      return `${frontmatter}\n\n${text}\n`;
    };

    const ziel = join(RESUEMEE_ORDNER, `${slug}.md`);
    const url = `https://www.annotanda.com/buecher/${slug}/`;

    fertigeResuemees.push({
      datei,
      vault: RESUEMEE_VAULT,
      slug,
      titel,
      ziel,
      url,
      substackUrl: daten.substack_url || null,
      steadyUrl: daten.steady_url || null,
      baueInhalt,
    });

    const inhalt = baueInhalt({ substack: daten.substack_url, steady: daten.steady_url });
    if (existsSync(ziel) && readFileSync(ziel, 'utf-8') === inhalt) continue;
    kandidaten.push({
      art: existsSync(ziel) ? 'aktualisiert' : 'neu',
      label: `Resümee: ${titel}`,
      ziel,
      inhalt,
      url,
    });
  }
}

// ── Grundlagen sammeln ──────────────────────────────────────────────────────
// Dritte Textform: erklärende, immergrüne Texte. Wie die Resümees — Notiz mit
// `# Titel`, status:fertig, eigene Datei in src/content/grundlagen/. Kein
// Argument-Diagramm, keine Lektüre-Bindung.

if (existsSync(GRUNDLAGEN_VAULT)) {
  for (const datei of readdirSync(GRUNDLAGEN_VAULT)) {
    if (!datei.endsWith('.md') || datei.startsWith('_')) continue;

    const roh = readFileSync(join(GRUNDLAGEN_VAULT, datei), 'utf-8');
    const { daten, body } = parseFrontmatter(roh);
    if (daten.status !== 'fertig') continue;
    if (werkstattOffen(body)) offeneWerkstatt.push(notizTitel(daten, body, datei));

    const h1 = body.match(/^\s*#\s+(.+)$/m);
    const titel = daten.title || h1?.[1].trim() || basename(datei, '.md');
    const slug = slugify(daten.slug || titel);
    const datum = daten.date || new Date().toISOString().split('T')[0];

    const text = bereinige(body.replace(/^\s*#\s+.+\r?\n+/, ''), slugMap);
    if (!text) {
      console.log(`· „${titel}" ist noch leer — übersprungen.`);
      continue;
    }

    const baueInhalt = ({ substack, steady } = {}) => {
      const frontmatter = [
        '---',
        `title: "${titel.replace(/"/g, '\\"')}"`,
        `date: ${datum}`,
        ...(substack ? [`substack_url: "${substack}"`] : []),
        ...(steady ? [`steady_url: "${steady}"`] : []),
        '---',
      ].join('\n');
      return `${frontmatter}\n\n${text}\n`;
    };

    const ziel = join(GRUNDLAGEN_ORDNER, `${slug}.md`);
    const url = `https://www.annotanda.com/grundlagen/${slug}/`;

    fertigeGrundlagen.push({
      datei,
      vault: GRUNDLAGEN_VAULT,
      slug,
      titel,
      ziel,
      url,
      substackUrl: daten.substack_url || null,
      steadyUrl: daten.steady_url || null,
      baueInhalt,
    });

    const inhalt = baueInhalt({ substack: daten.substack_url, steady: daten.steady_url });
    if (existsSync(ziel) && readFileSync(ziel, 'utf-8') === inhalt) continue;
    kandidaten.push({
      art: existsSync(ziel) ? 'aktualisiert' : 'neu',
      label: `Grundlagen: ${titel}`,
      ziel,
      inhalt,
      url,
    });
  }
}

// ── Argument-Karten aus den Essays generieren ───────────────────────────────
// Nur wenn mindestens ein fertiger Essay einen ```mermaid-Block hat — sonst
// bleibt eine evtl. noch von Hand gepflegte argumente.js unangetastet.
if (argumentListe.length > 0) {
  const zielArg = join(__dir, 'src/data/argumente.js');
  const inhaltArg = genArgumente(argumentListe);
  if (!(existsSync(zielArg) && readFileSync(zielArg, 'utf-8') === inhaltArg)) {
    kandidaten.push({
      art: existsSync(zielArg) ? 'aktualisiert' : 'neu',
      label: 'Argumente (aus Essays)',
      ziel: zielArg,
      inhalt: inhaltArg,
      url: 'https://www.annotanda.com/argumente/',
      seite: true,
      name: 'Argumente',
    });
  }
}

// ── Seiten sammeln (Über, Lektüre, Quellen) ─────────────────────────────────

const SEITEN = [
  {
    name: 'Über',
    vault: 'Über.md',
    ziel: join(__dir, 'src/inhalte/ueber.md'),
    pfad: '/ueber/',
    erzeuge: (body) => bereinige(body, slugMap) + '\n',
  },
  {
    name: 'Lektüre',
    vault: 'Lektüre.md',
    ziel: join(__dir, 'src/data/lektuere.js'),
    pfad: '/lektuere/',
    erzeuge: genLektuere,
  },
  {
    name: 'Quellen',
    vault: 'Quellen.md',
    ziel: join(__dir, 'src/data/quellen.js'),
    pfad: '/quellen/',
    erzeuge: genQuellen,
  },
];

for (const seite of SEITEN) {
  const quelle = findeDatei(SEITEN_VAULT, seite.vault);
  if (!quelle) continue;

  const { body } = parseFrontmatter(readFileSync(quelle, 'utf-8'));
  const inhalt = seite.erzeuge(body);

  if (existsSync(seite.ziel) && readFileSync(seite.ziel, 'utf-8') === inhalt) continue;
  kandidaten.push({
    art: existsSync(seite.ziel) ? 'aktualisiert' : 'neu',
    label: `Seite: ${seite.name}`,
    ziel: seite.ziel,
    inhalt,
    url: `https://www.annotanda.com${seite.pfad}`,
    seite: true,
    name: seite.name,
  });
}

// ── Schutz: offene Werkstattblöcke ──────────────────────────────────────────
// Eine ungerade Zahl von %% heißt: ein Werkstattblock wurde nicht geschlossen.
// Beim Publizieren würde sein privater Inhalt öffentlich (genau der
// „Frei im Paragraphen"-Fehler). Lieber hart abbrechen, bevor irgendetwas
// geschrieben oder gefragt wird, als versehentlich Privates veröffentlichen.
if (offeneWerkstatt.length > 0) {
  console.log('\n⚠  Abbruch — offener Werkstattblock (%% ohne schließendes %%):\n');
  for (const t of offeneWerkstatt) console.log(`     • „${t}"`);
  console.log('\n   Sonst würde die Werkstatt öffentlich. Schließ den Block mit einem');
  console.log('   zweiten %% am Ende der Notiz und starte publizieren neu.\n');
  process.exit(1);
}

// ── Nichts zu tun? ──────────────────────────────────────────────────────────

// Fertige Texte (Essays/Resümees/Grundlagen), bei denen ein Cross-Post-Link
// (Substack oder Steady) noch fehlt. Bewusst ALLE, nicht nur die geänderten:
// der Normalfall ist „am Sonntag veröffentlicht, jetzt drüben online" — da hat
// sich am Text nichts getan, nur der Link kommt dazu.
const ohneLink = [...fertigeEssays, ...fertigeResuemees, ...fertigeGrundlagen].filter(
  (e) => !e.substackUrl || !e.steadyUrl
);

if (kandidaten.length === 0 && ohneLink.length === 0) {
  console.log('\nNichts zu veröffentlichen — keine fertigen, geänderten Essays');
  console.log('und keine geänderten Seiten im Vault.\n');
  process.exit(0);
}

// Eigene Frage-Funktion statt rl.question: Bei mehreren Fragen hintereinander
// verschluckt readline gepipte Eingaben (die Zeilen sind schon da, bevor die
// zweite Frage überhaupt gestellt wird). Deshalb werden Zeilen gepuffert und
// beantwortete Fragen bedienen sich daraus. Endet die Eingabe früher als die
// Fragen (Strg-D, kurze Pipe), zählt das als leere Antwort — das Skript hängt
// dann nicht, sondern nimmt die sichere Vorgabe (Nein/Überspringen).
const rl = createInterface({ input: process.stdin, output: process.stdout });

const zeilenPuffer = [];
const wartende = [];
let eingabeBeendet = false;

rl.on('line', (zeile) => {
  const naechste = wartende.shift();
  if (naechste) naechste(zeile);
  else zeilenPuffer.push(zeile);
});

rl.on('close', () => {
  eingabeBeendet = true;
  while (wartende.length) wartende.shift()('');
});

const frage = (text) => {
  process.stdout.write(text);
  if (zeilenPuffer.length) return Promise.resolve(zeilenPuffer.shift());
  if (eingabeBeendet) return Promise.resolve('');
  return new Promise((resolve) => wartende.push(resolve));
};

// ── Cross-Post-Links eintragen (Substack · Steady) ──────────────────────────
// Der Link geht zuerst in die Obsidian-Notiz (Quelle der Wahrheit), dann in die
// Veröffentlichung — so muss publizieren nicht zweimal laufen. Pro Text wird
// nur nach den Plattformen gefragt, deren Link noch fehlt.

let vaultGeaendert = false;
const istUrl = (s) => /^https?:\/\/\S+$/i.test(s);

if (ohneLink.length > 0) {
  console.log('\n── Cross-Posts (Substack · Steady) ──────────────────────\n');
  for (const e of ohneLink) {
    const fehlt = [!e.substackUrl && 'Substack', !e.steadyUrl && 'Steady']
      .filter(Boolean)
      .join(' + ');
    console.log(`  ○ ohne ${fehlt}   ${e.titel}`);
  }

  const jetzt = await frage(`\nLinks jetzt eintragen? [j/N] `);

  if (jetzt.trim().toLowerCase() === 'j') {
    for (const e of ohneLink) {
      let geaendert = false;

      // Nur fragen, wo der Link fehlt; leere Eingabe überspringt.
      const abfrage = async (label, schluessel, feld) => {
        if (e[feld]) return;
        const eingabe = (await frage(`\n  „${e.titel}" — ${label}-URL (Enter = überspringen): `)).trim();
        if (!eingabe) return;
        if (!istUrl(eingabe)) {
          console.log('  ⚠ Sieht nicht nach einer URL aus — übersprungen.');
          return;
        }
        e[feld] = eingabe;
        if (setzeFrontmatterWert(e.vault, e.datei, schluessel, eingabe)) vaultGeaendert = true;
        geaendert = true;
      };

      await abfrage('Substack', 'substack_url', 'substackUrl');
      await abfrage('Steady', 'steady_url', 'steadyUrl');

      if (!geaendert) continue;

      const inhalt = e.baueInhalt({ substack: e.substackUrl, steady: e.steadyUrl });
      const schonKandidat = kandidaten.find((k) => k.ziel === e.ziel);
      if (schonKandidat) {
        schonKandidat.inhalt = inhalt;
      } else if (!(existsSync(e.ziel) && readFileSync(e.ziel, 'utf-8') === inhalt)) {
        kandidaten.push({
          art: existsSync(e.ziel) ? 'aktualisiert' : 'neu',
          label: e.titel,
          ziel: e.ziel,
          inhalt,
          url: e.url,
        });
      }
    }
  }
}

if (kandidaten.length === 0) {
  rl.close();
  console.log('\nNichts zu veröffentlichen — keine fertigen, geänderten Essays');
  console.log('und keine geänderten Seiten im Vault.\n');
  process.exit(0);
}

// ── Zeigen, fragen, veröffentlichen ────────────────────────────────────────

console.log('\n── annotanda · publizieren ──────────────────────────────\n');
for (const k of kandidaten) {
  const marke = k.art === 'neu' ? '＋ neu        ' : '↻ aktualisiert';
  console.log(`  ${marke}  ${k.label}`);
}

const antwort = await frage(`\nVeröffentlichen? Commit + Push + Vercel-Deploy folgen. [j/N] `);
rl.close();

if (antwort.trim().toLowerCase() !== 'j') {
  console.log('\nAbgebrochen — die Website bleibt unverändert.');
  // Ehrlich bleiben: der Link steht dann schon in der Notiz, nur noch nicht online.
  if (vaultGeaendert) {
    console.log('Die eingetragenen Substack-Links stehen bereits in Obsidian —');
    console.log('der nächste Lauf nimmt sie mit.');
  }
  console.log('');
  process.exit(0);
}

for (const k of kandidaten) {
  mkdirSync(dirname(k.ziel), { recursive: true }); // Bücher-Ordner ist evtl. neu
  writeFileSync(k.ziel, k.inhalt, 'utf-8');
}

const essays = kandidaten.filter((k) => !k.seite).map((k) => k.label);
const seiten = kandidaten.filter((k) => k.seite).map((k) => k.name);
const teile = [];
if (essays.length) teile.push(`essay: ${essays.join(', ')}`);
if (seiten.length) teile.push(`seiten: ${seiten.join(', ')}`);
const nachricht = teile.join(' · ');

execFileSync('git', ['add', ...kandidaten.map((k) => k.ziel)], { cwd: __dir });
execFileSync('git', ['commit', '-m', nachricht], { cwd: __dir, stdio: 'inherit' });

console.log('\n── Veröffentlicht ─────────────────────────────────────');
for (const k of kandidaten) {
  console.log(`  ${k.url}`);
}
console.log('Vercel deployt in ~20 Sekunden.\n');
