/**
 * Mermaid-Flowcharts zur Bauzeit in Knoten und Kanten zerlegen.
 *
 * Warum: die Diagramme werden erst im Browser von Mermaid gezeichnet. Ohne
 * JavaScript — und für jeden Crawler, der keins ausführt — stünde sonst nur
 * der rohe `flowchart TD`-Quelltext auf der Seite. Aus dem Ergebnis dieser
 * Funktion baut die Argument-Seite eine Textfassung, die immer im HTML steht.
 *
 * Erwartet die Schreibweise, die in den Essay-Notizen benutzt wird:
 *   ID["Beschriftung mit <br> als Umbruch"]
 *   A --> B     stützt
 *   A -.-> B    Einwand (gestrichelt)
 */

export type Knoten = {
  id: string;
  text: string;
  /** Ziele der durchgezogenen Kanten — was dieser Schritt stützt */
  stuetzt: string[];
  /**
   * Ziele der gestrichelten Kanten — das, wogegen sich dieser Knoten wendet.
   *
   * Konvention seit 09.08.2026: **Der Einwand ist immer die Quelle** der
   * gestrichelten Kante (`E1 -.-> P5`, `E1 -.-> S`). Bis dahin zeigte sie im
   * selben Diagramm in zwei Rollen, weshalb die Textfassung nur unbestimmt
   * „Einwand: Nr. X" schreiben konnte; jetzt darf sie „Einwand gegen" sagen.
   * Neue Diagramme bitte in dieser Richtung anlegen.
   */
  einwand: string[];
};

/** `<br>` und HTML-Entities aus der Mermaid-Beschriftung zu normalem Text. */
function entschluessele(text: string): string {
  return text
    .replace(/<br\s*\/?>/gi, ' ')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&amp;/g, '&')
    .replace(/\s+/g, ' ')
    .trim();
}

/**
 * Zerlegt ein Diagramm. Knoten in der Reihenfolge ihrer Deklaration — die ist
 * in den Notizen von oben nach unten gedacht (These, Schritte, Einwand,
 * Schluss) und trägt damit schon die Leserichtung.
 */
export function zerlegeDiagramm(diagramm: string): Knoten[] {
  const reihenfolge: string[] = [];
  const knoten = new Map<string, Knoten>();

  const hole = (id: string): Knoten => {
    let k = knoten.get(id);
    if (!k) {
      k = { id, text: id, stuetzt: [], einwand: [] };
      knoten.set(id, k);
      reihenfolge.push(id);
    }
    return k;
  };

  for (const zeile of diagramm.split(/\r?\n/)) {
    const text = zeile.trim();
    if (!text || /^(flowchart|graph)\b/i.test(text)) continue;

    // Kante zuerst prüfen: `A --> B` bzw. `A -.-> B`
    const kante = text.match(/^(\w+)\s*(-\.->|-->)\s*(\w+)/);
    if (kante) {
      const [, von, art, nach] = kante;
      const ziel = hole(nach);
      if (art === '-.->') hole(von).einwand.push(ziel.id);
      else hole(von).stuetzt.push(ziel.id);
      continue;
    }

    // Knoten mit Beschriftung: ID["…"] — auch ('…') und [/…/] u. ä. tolerieren
    const beschriftung = text.match(/^(\w+)\s*[[({]+\s*["']?([\s\S]*?)["']?\s*[\])}]+\s*$/);
    if (beschriftung) {
      const [, id, roh] = beschriftung;
      hole(id).text = entschluessele(roh);
    }
  }

  return reihenfolge.map((id) => knoten.get(id)!);
}

/** Beschriftung zu einer ID — für die Auflösung der Kanten in der Textfassung. */
export function textVon(knoten: Knoten[], id: string): string {
  return knoten.find((k) => k.id === id)?.text ?? id;
}
