import { defineCollection, z } from 'astro:content';
import { glob } from 'astro/loaders';

const essays = defineCollection({
  loader: glob({ pattern: '**/*.md', base: './src/content/essays' }),
  schema: z.object({
    // Pflicht ist nur, was die Seite wirklich braucht: Titel und Datum.
    title: z.string(),
    date: z.coerce.date(),
    feld: z.string().default('philosophie-ethik'),
    themengebiet: z.string().optional(),
    unterthema: z.string().optional(),
    // Meta-Description und Social-Card-Untertitel. Fehlt sie, wird der
    // Textanfang genommen (siehe lib/text.ts → beschreibung).
    teaser: z.string().optional(),
    substack_url: z.string().url().optional(),
    steady_url: z.string().url().optional(),
    // Optionales getöntes Kopfbild (Pfad in public/, z. B. /bilder/kamiros.jpg)
    // plus Bildunterschrift. Bewusste Ausnahme von der bildlosen Optik.
    bild: z.string().optional(),
    bild_untertitel: z.string().optional(),
  }),
});

// Resümees — zweite Textform neben den Essays: Buchbesprechungen. Bewusst
// dieselbe Maschinerie (eigene Notizen im Vault, status:fertig, publizieren).
// `buch` verknüpft optional mit einem Titel aus der Lektüre-Liste, damit der
// dort einen „Resümee lesen"-Link bekommen kann.
const buecher = defineCollection({
  loader: glob({ pattern: '**/*.md', base: './src/content/buecher' }),
  schema: z.object({
    title: z.string(),
    date: z.coerce.date(),
    buch: z.string().optional(),
    teaser: z.string().optional(),
    substack_url: z.string().url().optional(),
    steady_url: z.string().url().optional(),
  }),
});

// Grundlagen — dritte Textform: erklärende, immergrüne Texte („Was ist X?").
// Kein Sonntags-Takt, keine Meinung zu Ende gedacht, sondern Erschließung.
// Wieder dieselbe Maschinerie wie Essays/Resümees.
const grundlagen = defineCollection({
  loader: glob({ pattern: '**/*.md', base: './src/content/grundlagen' }),
  schema: z.object({
    title: z.string(),
    date: z.coerce.date(),
    teaser: z.string().optional(),
    substack_url: z.string().url().optional(),
    steady_url: z.string().url().optional(),
  }),
});

const felder = defineCollection({
  loader: glob({ pattern: '**/*.md', base: './src/content/felder' }),
  schema: z.object({
    title: z.string(),
    position: z.number().optional(),
  }),
});

export const collections = { essays, buecher, grundlagen, felder };
