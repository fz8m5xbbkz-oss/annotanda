# annotanda — Projekt-Kontext für Claude

Diese Datei ist die Übergabe-Akte: Wenn Claude Code im Projekt-Ordner gestartet wird,
liest er sie automatisch und ist sofort auf Stand. Bitte vor jeder substantiellen
Änderung kurz reinschauen.

---

## Wer und was

- **Autor:** Luis Frenzel
- **Projektname:** **annotanda** (lateinisch: „das Anzumerkende" — was
  festgehalten werden muss; vorher notitia, umbenannt 19.07.2026)
- **Positionierung:** „Philosophie aus dem Inneren der Verwaltung — ein öffentliches
  Denktagebuch."
- **Kontext:** Luis beginnt im September 2026 ein Studium der Allgemeinen Verwaltung
  an der Landesdirektion Sachsen. Die Seite ist sein Versuch, Philosophie und
  Verwaltungspraxis zusammenzudenken.
- **Produkt:** Ein wöchentlicher Essay, jeden Sonntag (seit Juli 2026, vorher
  monatlich). **Substack ist der primäre Kanal**, annotanda das öffentliche
  Archiv.

## Adressen / Konten

| | |
|---|---|
| **Live-URL** | https://www.annotanda.com |
| **GitHub-Repo** | https://github.com/fz8m5xbbkz-oss/annotanda — am 09.08.2026 von `notitia` umbenannt. Remote: `git@github.com:fz8m5xbbkz-oss/annotanda.git` |
| **Substack** | https://luisfzl.substack.com |
| **Bluesky** | https://bsky.app/profile/luis-57.bsky.social |
| **Kontakt-Mail** | luisfrenzel@gmx.net (öffentlich, auf /ueber) |
| **Git-Identität** | `Luis` / `denkfeld@outlook.de` |

## Tech-Stack

- **Astro 6.2** mit Content Collections, deployt als Static Site
- **Markdown** als primäres Schreibformat
- **GitHub** als Code-Hosting + Single Source of Truth
- **Vercel** für Build und Hosting (Free-Plan; deployt automatisch bei jedem Push auf `main`)
- **Keine Datenbank, kein CMS, keine Cookie-Banner, kein Newsletter-Popup**
- **Zähler seit 27.07.2026: Vercel Web Analytics** (`@vercel/analytics`, in
  `Basis.astro` als `<Analytics />` am Ende von `<body>`). Cookiefrei, keine
  IP-Speicherung, keine Wiedererkennung über Aufrufe hinweg — deshalb auch
  kein Cookie-Banner nötig. Zählt auch die ClientRouter-Seitenwechsel
  (verifiziert). **Muss im Vercel-Projekt unter Analytics aktiviert sein**,
  sonst läuft das Skript ins Leere. Die frühere Regel „keine Analytics" gilt
  nicht mehr; sie galt Trackern, nicht Zahlen.
- **Eingebaute Integrationen:** `@astrojs/sitemap`, `@astrojs/rss`, `marked`,
  `@vercel/analytics`
- **Substack:** kein Feed-Mixing mehr (Juni 2026 entfernt) — Essays verlinken
  einzeln über `substack_url` im Frontmatter („auch auf Substack ↗")
- **Auto-Push:** SSH-Key eingerichtet, post-commit-Hook pusht automatisch

## Verzeichnis-Struktur (wichtigste Stellen)

```
src/
├── pages/
│   ├── index.astro              Startseite (Manifest + CTAs — „Newsletter
│   │                             abonnieren" führt seit Juli 2026 zu Steady,
│   │                             nicht mehr zu Substack + Teaser neuester
│   │                             Essay + „Gerade auf dem Tisch" + Stöbern)
│   ├── ueber.astro              Über-Seite (rendert inhalte/ueber.md + Sokrates)
│   ├── lektuere.astro           Leseprotokoll (Gerade/Geplant/Abgeschlossen/
│   │                             Empfohlen; leere Sektionen blenden sich aus)
│   ├── quellen.astro            Quellenverzeichnis (nach Typ gruppiert,
│   │                             „erwähnt in"-Querverweise auf Essays)
│   ├── rss.xml.ts               RSS-Feed (Volltext via @astrojs/rss + marked)
│   ├── essays/
│   │   ├── index.astro          Liste (nur lokale Essays + Auszug + Lesezeit)
│   │   └── [slug].astro         Essay-Seite (leserModus=true, Fortschrittsbalken)
│   └── argumente/
│       ├── index.astro          Liste der Argument-Karten
│       └── [slug].astro         Mermaid-Baumdiagramm (CDN, kein npm install;
│                                 rendert über astro:page-load, is:inline)
│                                 + Textfassung im <details> für ohne-JS/Crawler
├── content/
│   ├── essays/*.md              Essays (Frontmatter: nur title + date Pflicht,
│   │                             feld default philosophie-ethik, optional substack_url)
│   └── felder/*.md              Philosophie-Felder (nur noch philosophie-ethik aktiv)
├── data/
│   ├── argumente.js             GENERIERT aus Obsidian (```mermaid-Block je Essay)
│   ├── lektuere.js              GENERIERT aus Obsidian (nicht von Hand bearbeiten)
│   └── quellen.js               GENERIERT aus Obsidian (nicht von Hand bearbeiten)
├── inhalte/
│   ├── start.md                 Manifest-Text der Startseite
│   └── ueber.md                 GENERIERT aus Obsidian (nicht von Hand bearbeiten)
├── components/
│   ├── Header.astro             Wordmark + Nav + Dark-Mode-Toggle. Grundlagen
│   │                             und Bücher erscheinen erst, wenn ihre
│   │                             Collection einen Text hat (leere Rubrik = keine
│   │                             Sackgasse; Sitemap-Filter in astro.config.mjs
│   │                             folgt derselben Regel)
│   ├── Footer.astro             Copyright + Knöpfe (Newsletter → Steady,
│   │                             Substack, Unterstützen, Bluesky)
│   ├── Vignette.astro           SVG-Buchschmuck, ein Motiv pro Seite
│   ├── SokratesBueste.astro     gezeichneter Sokrates auf /ueber
│   └── Randschmuck.astro        Ranken in den Seitenrändern (nur Desktop ≥1200px)
├── layouts/Basis.astro          HTML-Hülle inkl. Meta, OpenGraph, leserModus-Prop,
│                                 ClientRouter, Tinte-Cursor, Scroll-Reveals
├── lib/
│   ├── text.ts                  Lesezeit + Auszug + Meta-Description (geteilt)
│   ├── quellen.ts               Anker-IDs + Quellen je Essay (Essay ↔ /quellen)
│   ├── argument.ts              Mermaid-Diagramm → Knoten/Kanten (Textfassung
│   │                             der Argument-Karten, ohne JS lesbar)
│   └── rubriken.ts              Hat Grundlagen/Bücher schon einen Text?
│                                 (steuert die Nav; per import.meta.glob statt
│                                 getCollection — sonst warnt Astro pro Seite)
└── styles/global.css            Tokens, Reset, Dark Mode, Reader-Mode-CSS

public/
├── fonts/                       Source Serif 4 (variable, Roman + Italic)
└── og/                          GENERIERT: Social-Cards (1200×630 PNG) je Essay
                                  + annotanda.png als allgemeine Karte

neuer-essay.mjs                  CLI: npm run neu → leere Essay-Datei (nur Titel-Frage)
karten.mjs                       CLI: npm run karten → Social-Cards zeichnen
                                  (`npm run karten -- alle` = alle neu)
publizieren.mjs                  CLI: npm run publizieren → Essays aus Obsidian
                                  importieren + nach Bestätigung committen/pushen
THESIS.md                        Thiel-Direktive: ein Satz, was annotanda glaubt
AUDIENCE.md                      Godin-Direktive: für wen / für wen nicht
astro.config.mjs                 site-URL + trailingSlash: always + Sitemap
```

## Konventionen

### Slugs

- **Immer lowercase, Bindestriche, keine Umlaute** (`ü→ue`, `ö→oe`, `ä→ae`, `ß→ss`)
- **Dateiname = Slug.** Beispiel: `einfuehrung-in-philosophisches-denken.md`
- **Slug einer Entität nicht mehr ändern, sobald angelegt** — Slug-Wechsel kaskadiert
  durch alle Essay-Referenzen

### Frontmatter

- **Immer drei Striche oben UND unten** (`---`), sonst greift kein Schema
- **Pflicht nur noch:** `title`, `date` — `feld` hat Default `philosophie-ethik`,
  `themengebiet`/`unterthema` sind optional (Juni 2026 entschlackt, wurden nirgends angezeigt)
- `teaser` (optional, Juli 2026): eigene Meta-Description und Social-Card-Zeile.
  Fehlt sie, nimmt `lib/text.ts → beschreibung()` den Textanfang bis zum
  letzten ganzen Satz unter 158 Zeichen.
- Tippfehler bricht den Build

### Veröffentlichungs-Workflow

**Hauptweg — Schreiben in Obsidian (seit Juni 2026):**

1. Notiz im Vault-Ordner `06 - annotanda/annotanda Essays/` schreiben
   (erste Zeile `# Titel`; Anleitung liegt als `_Anleitung.md` im Ordner)
2. Wenn fertig: Eigenschaft `status: fertig` setzen
   (optional `slug:` im Frontmatter, falls URL ≠ Titel bleiben soll —
   z. B. hält `slug: willkommen` die URL von „Warum dieses annotanda" stabil)
3. `npm run publizieren` — zeigt neue/geänderte Essays UND Seiten, fragt
   einmal nach, committet (Hook pusht, Vercel deployt).
   Alias `annotanda` (in ~/.zshrc) geht von überall.

**Drei Abfragen vor dem Bestätigungsschritt**, beide über *alle* fertigen
Texte (nicht nur die geänderten — beides wird typischerweise nachgereicht):

1. **Cross-Post-Links** — fragt pro Text nach fehlender Substack-/Steady-URL,
   schreibt sie ins Frontmatter der Obsidian-Notiz.
2. **Quellen** — listet je Text, wie viele Belege im Verzeichnis stehen, und
   markiert Texte ohne Beleg mit `⚠`. Pro Quelle: Rubrik, Titel, Autor, Jahr,
   URL, Notiz. Kennt `Quellen.md` den Titel schon, wird **kein zweiter Eintrag
   angelegt** — der bestehende bekommt nur den Essay-Slug dazu (eine Quelle,
   ein Eintrag, beliebig viele Texte). Geschrieben wird in die Vault-Notiz
   `annotanda Seiten/Quellen.md`; `src/data/quellen.js` wird im selben Lauf
   neu erzeugt, damit nichts zweimal laufen muss.

3. **Argument-Karte** — bietet für jeden fertigen Essay ohne ```mermaid-Block
   an, eine anzulegen. Abgefragt werden These, Ausgangspunkte, Schritte,
   Einwände und Schluss (leere Eingabe beendet die Gruppe), danach die Kanten
   in Kurzform: `T>A1` stützt, `E1~S` ist ein Einwand. Knoten-IDs, `<br>`-
   Umbrüche bei 46 Zeichen und die Mermaid-Syntax entstehen daraus; der Block
   wird in die Obsidian-Notiz geschrieben und `argumente.js` im selben Lauf
   neu erzeugt. Vor dem Schreiben wird das fertige Diagramm gezeigt.

**Interne Verweise** entstehen auf zwei Wegen: `[[Titel]]` (ausdrücklich,
wirkt überall) und ein Essay-Titel 1:1 im Fließtext (automatisch). Der
automatische Weg greift bewusst **nicht** im eigenen Essay, nur beim ersten
Vorkommen und **nicht in Anführungszeichen** — annotanda-Titel sind teils
gewöhnliche Sätze („Dafür bin ich nicht zuständig" ist im gleichnamigen Essay
wörtliche Rede). Gesetzte Auto-Links werden vor dem Bestätigen aufgelistet.
Details und Schutzzonen in `verlinkeTitel()`.

Beide Abfragen schreiben **zuerst in den Vault**. Brichst du danach beim
Veröffentlichen ab, stehen die Eingaben schon in Obsidian und der nächste
Lauf nimmt sie mit.

**Feste Seiten — ebenfalls aus Obsidian (seit Juni 2026):**

Ordner `06 - annotanda/annotanda Seiten/` mit `Über.md`, `Lektüre.md`,
`Quellen.md` (+ `_Anleitung.md`). Kein `status: fertig` nötig — geänderte
Seiten erscheinen beim nächsten `npm run publizieren` im Bestätigungsschritt.
Über = freies Markdown; Lektüre/Quellen = Listen unter festen Überschriften,
werden zu `src/data/lektuere.js` / `quellen.js` generiert.

**Kein Nebenweg mehr (seit Juli 2026):** Ins Repo schreibt niemand Inhalt
von Hand — die Presse (`npm run publizieren`) ist der einzige Weg
Vault → Repo. `neuer-essay.mjs` (`npm run neu`) stammt aus der Zeit davor
und sollte nicht mehr benutzt werden.

## Arbeitsweise (Luis' Präferenzen)

- **Erst erklären, dann bauen.** Vor jeder Datei-Erstellung oder jedem Befehl in
  einem Satz sagen, was passiert und warum.
- **Kleine Schritte.** Lieber fünf kleine Commits, in denen Luis folgen kann, als
  ein riesiges Setup-Skript.
- **Kein Magie-Boilerplate.** Konfigurationsdateien knapp erklären, nicht
  referenzweise.
- **Bei Unsicherheit fragen.** Lieber Rückfrage als Annahme.
- **Keine vorzeitige Optimierung.** Keine Plugins/Frameworks, die wir nicht
  brauchen.
- **Sprache:** Deutsch in Antworten an Luis und in allen Inhalten.

## Was du **NICHT** tun sollst

- Keine `npm install` von Paketen außerhalb des Astro-Standards ohne Rückfrage.
- Keine fertigen Themes oder Templates aus dem Internet ziehen.
- Kein automatisches Deployment einrichten, das Luis nicht ausdrücklich will.
- Keine Karteikarten-Sektion bauen — das macht Luis später selbst.
- Luis nicht überreden, doch noch ein CMS oder eine Datenbank dranzuhängen.
  Decap CMS wurde diskutiert und nicht eingebaut — bewusste Entscheidung.
- **Keine Stockbilder.** Bilder werden, falls nötig, von Wikimedia Commons mit
  CC-Lizenz und korrekter Attribution geholt — oder Luis liefert sie selbst.
- **Kein automatischer Bluesky-Feed auf der Startseite.** War drin, bewusst entfernt.
- **Kein Newsletter-Formular im Footer.** Nur Knöpfe, die wegführen:
  „Newsletter" (→ Steady-Anmeldung, seit Juli 2026 nicht mehr Substack),
  „Substack", „Unterstützen", „Bluesky".
- **Kein Magazin-Editorial-Layout.** Einmal gebaut, nach Luis-Feedback zurückgerollt.
  Nicht nochmal versuchen, außer Luis fragt explizit.
- **Kein Steady-`widget_loader` im `<head>`, kein eingebetteter Steady-Checkout,
  keine Paywall/Layers auf der eigenen Seite.** Alles drei im Juli 2026 geprüft
  und verworfen: fremdes JS auf jeder Seite widerspricht der Linie
  „statisch, datensparsam, keine Analytics", das Auto-Design des Checkouts passt
  nicht zur Papier/Tinte-Optik, und eine Paywall widerspricht dem Modell
  „alles frei, Unterstützung freiwillig". Es bleibt beim schlichten Link
  „Bei Steady unterstützen" — der Checkout läuft auf Steadys Seite.
  Rückfallidee, falls je gewünscht: **nicht** global einbinden, sondern eine
  einzige eigene Seite (z. B. `/mitglied-werden/`), die Loader + Checkout lädt.
- **Kein rss-parser.** Falls je wieder Fremd-Feeds gelesen werden: fetch +
  Regex statt npm-Paket (rss-parser ist inkompatibel mit Edge-Runtimes;
  die alte fetch-Implementierung liegt in der Git-Historie, `src/lib/substack.ts`
  wurde im Juli 2026 als toter Code entfernt).

## Design (eingespielt, nicht ohne Rücksprache ändern)

- **Schrift:** Source Serif 4 (variable, selbst gehostet) für Lesetext, System-Sans
  (`var(--schrift-ui)` = `-apple-system, ...`) für UI/Meta
- **Hintergrund:** warmes Papierbeige `#EDE6D7` mit dezenter SVG-Papierkörnung
- **Tinte:** `#1a1a1a`
- **Akzent:** gedecktes Olivgrün `#5b6b3e`
- **Spaltenbreite:** schmal, 38rem (`--max-breite`)
- **Wordmark:** klein und aufrecht, ohne kursive Spielereien
  (hat seit Juni 2026 eine Buchstaben-Welle beim Hover)
- Keine Hero-Bilder, keine bunten Cards, keine großen Display-Schriften
- **Vignetten (Juni 2026):** selbst gezeichneter SVG-Buchschmuck (`Vignette.astro`),
  feine Strichzeichnungen in Tinte/Akzent, ein Motiv pro Seite (Siegel, Feder, Baum,
  Bücher, Karteikarte, Säule), zeichnen sich beim Laden selbst (Keyframe `zeichnen`);
  ⁂ als Schlusszeichen unter jedem Essay. Weiterhin keine Fotos, keine Stockbilder.
- **Reader Mode:** auf mobilen Geräten (≤640px) Header/Footer ausgeblendet,
  `← Essays`-Link direkt im Artikel
- **Dark Mode:** „dunkles Papier" (`#211d17`/`#e6dfd0`, Akzent aufgehellt `#93a565`),
  Toggle im Header, System-Präferenz als Default, Wahl in `localStorage` (`farbschema`)
- **Bewegung (verspielt — auf Luis' Wunsch Juni 2026, vorher bewusst zurückhaltend):**
  Feder-Easing `--feder` (leichtes Überschwingen), Keyframes `einblenden` + `aufklaren`
  (Blur-in), Scroll-Reveals via `[data-reveal]` + IntersectionObserver (Script in
  `Basis.astro`), Wordmark-Buchstabenwelle beim Hover, zirkulärer Dark-Mode-Wipe
  (View Transition API, mit Fallback), Hover-Pfeile in Essay-Liste und CTAs,
  federnde Footer-Knöpfe, wellige Link-Unterstreichung beim Hover.
  Globaler `prefers-reduced-motion`-Schutz in `global.css` bleibt bestehen.
  **Der Essay-Lesetext selbst bleibt ruhig** — Animationen nur an Titel/Meta/Navigation.

## Stand der Dinge (Juli 2026)

### Live und gut

- 14 Routen: `/`, `/essays` (+4 Essays), `/argumente` (+4 Karten),
  `/lektuere`, `/quellen`, `/ueber` — Essays und Karten wachsen mit jedem
  Sonntag automatisch mit
- `/rss.xml` — Volltext-Feed (via `@astrojs/rss` + `marked`)
- Sitemap, robots.txt (Vercel-URL), OG-Tags aktiv — jede Seite mit **eigener**
  meta-description und eigener Social-Card (`summary_large_image`)
- SSH-Key + post-commit-Hook: jeder Commit pusht automatisch
- Obsidian-Publishing komplett: Essays, Seiten (Über, Lektüre, Quellen),
  Argument-Karten (```mermaid-Block) und Wikilink-Auflösung zu internen
  Links — ein `annotanda`-Lauf transportiert alles
- Dark Mode, View Transitions, Reader Mode mobil, Vignetten, Sokrates-Relief,
  Randschmuck, 3D-Effekte — verifiziert auf Mobil + Desktop, hell + dunkel
- Unter jedem Essay: Quellenapparat (aus `src/data/quellen.js`, verlinkt auf
  `/quellen/#anker`) und Vor/Zurück zum älteren/neueren Essay. Beides blendet
  sich aus, wenn es nichts zu zeigen gibt. Der Lesetext bleibt bewusst
  link-frei — keine Inline-Fußnoten im Zitat.
- Argument-Karten sind ohne JavaScript lesbar: `lib/argument.ts` zerlegt das
  Mermaid-Diagramm zur Bauzeit in Knoten und Kanten, die Textfassung steht immer
  im HTML. Das Diagramm wird erst sichtbar, wenn Mermaid wirklich gezeichnet hat
  (`.diagramm-wrapper.gezeichnet`) — scheitert das CDN, bleibt die Textfassung
  offen statt rohen `flowchart TD`-Code zu zeigen. **Nicht** auf `display: none`
  umstellen: Mermaid braucht Layout, um Textbreiten zu messen.
- THESIS.md gesetzt (14.07.2026: „Jeder Bescheid entscheidet eine Frage,
  an der sich die Philosophie seit zweitausend Jahren abarbeitet.") +
  AUDIENCE.md im Repo

### Social-Cards (Juli 2026)

Die og:image-PNGs liegen fertig in `public/og/` und werden **lokal** gezeichnet:
`karten.mjs` schreibt eine HTML-Karte und lässt den auf dem Mac installierten
Google Chrome (`--headless=new --screenshot`) ein Foto machen. Bewusst so, statt
satori/sharp/@vercel/og zu installieren — kein neues Paket, und Vercel baut die
Bilder nie selbst. `publizieren.mjs` ruft `generiereKarten()` nach dem Schreiben
der Essay-Dateien auf und legt die PNGs mit in den Commit. Fehlt Chrome, wird
übersprungen; die Seite fällt dann auf `/og/annotanda.png` zurück.

Nach einer Design-Änderung an der Karte: `npm run karten -- alle`.

### Offen

- **Search Console**: neue Property für `www.annotanda.com` anlegen,
  Verification-Tag (`obr4TfpPoqxxoENkMkBbSC6NvdY7PJ75ZJf47q4Guaw`) ist bereits
  in `src/layouts/Basis.astro` hinterlegt
- **Quellen für „Frei im Paragraphen"**: Nagel („Was bedeutet das alles?") und
  Libet fehlen in `annotanda Seiten/Quellen.md` im Vault — deshalb zeigt der
  Essay noch keinen Quellen-Block. Sobald sie mit `{frei-im-paragraphen}` in der
  Liste stehen, erscheint er von selbst.

### Verlauf der Namensgebung (zur Orientierung)

1. **denkfeld** (initial): „Selbstgesteuertes Lernen in fünf Feldern"
2. **magnolia** (zwischenphase): Name ohne klare inhaltliche Bindung
3. **quaestio** (Mai 2026): Latein für „Frage"
4. **notitia** (Mai–Juli 2026): Latein für „Kenntnis, Notiz, Aktenkenntnis"
5. **annotanda** (seit 19.07.2026, mit eigener Domain www.annotanda.com):
   Latein für „das Anzumerkende" — was festgehalten werden muss

## Wenn du nach Anweisung auf Luis schreibst

Du sprichst Luis konsistent mit „du" an. Du erklärst nicht alles, was du tust,
sondern das, was er beim nächsten Mal selbst tun können soll. Du flaggst Risiken
und konfliktreiche Stellen (Briefing-Verstöße, Build-Schadenspotential), bevor
du handelst. Du machst keine Witze auf seine Kosten.
