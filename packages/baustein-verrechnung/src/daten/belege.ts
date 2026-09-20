import {
  aktuellerRechtsraum,
  pb,
  protokollieren,
  runden,
  sicher,
  type Basisdatensatz,
  type Betrieb,
  type Kunde,
  type Rechtsraum,
  type UstSatz,
} from "@werkboq/core";

/**
 * Belege: Angebot, Auftragsbestätigung, Rechnung, Gutschrift.
 *
 * Alle vier in einer Collection, weil sie dieselbe Gestalt haben — Kopf,
 * Positionen, Summen — und sich nur in Nummernkreis, Pflichtangaben und
 * erlaubten Statuswechseln unterscheiden. Vier fast gleiche Tabellen wären
 * vier Stellen, an denen dieselbe Rundungsregel leicht verschieden steht.
 *
 * DIE POSITIONEN WERDEN EINGEFROREN.
 *
 * Ein Beleg kopiert die Positionen des Auftrags in eigene Zeilen
 * (`belegpositionen`). Ändert danach jemand die Auftragsposition, bleibt die
 * Rechnung, wie sie war. Alles andere wäre unhaltbar: eine Rechnung ist ein
 * Dokument, das aus dem Haus gegangen ist, kein Fenster in den aktuellen
 * Datenbestand.
 *
 * Und sie wird festgeschrieben. Ab `festgeschrieben` ändert sich am Beleg
 * nichts mehr — Korrektur heißt Storno per Gutschrift und neuer Beleg. Alle
 * drei Rechtsräume verlangen Aufbewahrung über Jahre (siehe `rechtsraum`);
 * Werkboq löscht nichts von selbst.
 */

export const BELEGARTEN = ["angebot", "auftragsbestaetigung", "rechnung", "gutschrift"] as const;
export type Belegart = (typeof BELEGARTEN)[number];

export const BELEGART_TEXT: Record<Belegart, string> = {
  angebot: "Angebot",
  auftragsbestaetigung: "Auftragsbestätigung",
  rechnung: "Rechnung",
  gutschrift: "Gutschrift",
};

/** Kürzel im Nummernkreis. Je Art und Jahr eigene, fortlaufende Zählung. */
export const BELEGART_KUERZEL: Record<Belegart, string> = {
  angebot: "AN",
  auftragsbestaetigung: "AB",
  rechnung: "RE",
  gutschrift: "GS",
};

export const BELEGSTATUS = [
  "entwurf",
  "offen",
  "angenommen",
  "abgelehnt",
  "bezahlt",
  "storniert",
] as const;
export type Belegstatus = (typeof BELEGSTATUS)[number];

export const STATUS_TEXT: Record<Belegstatus, string> = {
  entwurf: "Entwurf",
  offen: "Offen",
  angenommen: "Angenommen",
  abgelehnt: "Abgelehnt",
  bezahlt: "Bezahlt",
  storniert: "Storniert",
};

export const STATUS_FARBE: Record<Belegstatus, string> = {
  entwurf: "neutral",
  offen: "info",
  angenommen: "ok",
  abgelehnt: "warn",
  bezahlt: "ok",
  storniert: "neutral",
};

/**
 * Grund für einen Beleg ohne Umsatzsteuer.
 *
 * "bauleistung" ist der für Elektriker wichtigste Fall: in Österreich und
 * Deutschland geht die Steuerschuld auf den Empfänger über, wenn die Leistung
 * an einen Unternehmer geht, der selbst Bauleistungen erbringt. Dann darf
 * keine Steuer ausgewiesen werden, und auf der Rechnung muss der Hinweis
 * stehen. Die Schweiz kennt diesen Übergang nicht — dort fällt der Grund
 * über `moeglicheGruende` aus der Auswahl.
 */
export const STEUERFREI_GRUENDE = [
  "keiner",
  "bauleistung",
  "kleinunternehmer",
  "innergemeinschaftlich",
  "ausfuhr",
] as const;
export type SteuerfreiGrund = (typeof STEUERFREI_GRUENDE)[number];

/**
 * Satz, der bei Steuerfreiheit auf dem Beleg stehen muss — je Rechtsraum.
 *
 * Die Fundstellen unterscheiden sich: § 19 Abs 1a UStG in Österreich,
 * § 13b Abs 2 Nr 4 UStG in Deutschland, und in der Schweiz gibt es den
 * Übergang der Steuerschuld bei Bauleistungen gar nicht.
 */
export function steuerfreiHinweis(grund: SteuerfreiGrund, raum = aktuellerRechtsraum()): string {
  switch (grund) {
    case "keiner":
      return "";
    case "bauleistung":
      return raum.bauleistung.hinweis;
    case "kleinunternehmer":
      return raum.kleinunternehmer.hinweis;
    case "innergemeinschaftlich":
      return raum.id === "ch"
        ? "Steuerfreie Ausfuhrlieferung."
        : "Steuerfreie innergemeinschaftliche Lieferung. Übergang der Steuerschuld auf den Erwerber.";
    case "ausfuhr":
      return raum.id === "at"
        ? "Steuerfreie Ausfuhrlieferung gemäß § 7 UStG."
        : raum.id === "de"
          ? "Steuerfreie Ausfuhrlieferung gemäß § 6 UStG."
          : "Von der Steuer befreite Ausfuhr (Art. 23 MWSTG).";
  }
}

/** Welche Befreiungsgründe im jeweiligen Land überhaupt vorkommen. */
export function moeglicheGruende(raum = aktuellerRechtsraum()): SteuerfreiGrund[] {
  return STEUERFREI_GRUENDE.filter(
    (g) => g !== "bauleistung" || raum.bauleistung.moeglich,
  ).filter((g) => g !== "innergemeinschaftlich" || raum.id !== "ch");
}

/** Beschriftung eines Befreiungsgrundes im jeweiligen Land. */
export function grundText(grund: SteuerfreiGrund, raum = aktuellerRechtsraum()): string {
  switch (grund) {
    case "keiner":
      return `${raum.steuerName} ausweisen`;
    case "bauleistung":
      return `Bauleistung — Übergang der Steuerschuld (${raum.bauleistung.paragraf})`;
    case "kleinunternehmer":
      return `Kleinunternehmer (${raum.kleinunternehmer.paragraf})`;
    case "innergemeinschaftlich":
      return "Innergemeinschaftliche Lieferung";
    case "ausfuhr":
      return "Ausfuhrlieferung";
  }
}

export interface Beleg extends Basisdatensatz {
  belegart: Belegart;
  nummer: string;
  kunde: string;
  auftrag?: string;
  status: Belegstatus;
  datum: string;
  /** Zeitpunkt des Festschreibens. Gesetzt heißt: nicht mehr änderbar. */
  festgeschrieben?: string;

  /** Leistungszeitraum — Pflichtangabe auf jeder Rechnung. */
  leistungVon?: string;
  leistungBis?: string;

  /** Anschrift zum Zeitpunkt der Ausstellung, eingefroren wie die Positionen. */
  empfaengerName: string;
  empfaengerAnschrift: string;
  empfaengerUid?: string;

  steuerfrei: SteuerfreiGrund;
  zahlungszielTage: number;
  skontoProzent?: number;
  skontoTage?: number;

  kopftext?: string;
  fusstext?: string;

  /** Summen in Cent, beim Speichern aus den Positionen gerechnet. */
  netto: number;
  ust: number;
  brutto: number;
  /** Nettosumme je Steuersatz, als { "20": 107400, "10": 10000 }. */
  nettoJeSatz?: Record<string, number>;

  /** Gutschrift: auf welchen Beleg sie sich bezieht. */
  storniert?: string;
  /** Angebot: der daraus entstandene Folgebeleg. */
  folgebeleg?: string;
}

export interface Belegposition extends Basisdatensatz {
  beleg: string;
  pos: number;
  art: string;
  bezeichnung: string;
  beschreibung?: string;
  menge: number;
  einheit: string;
  einzelpreis: number;
  rabatt?: number;
  ustsatz: UstSatz;
  /** Betrag netto in Cent, beim Einfrieren gerechnet und mitgespeichert. */
  betrag: number;
  /** Woher die Zeile stammt: Positions- oder Zeitkennung. Nur zur Nachschau. */
  quelle?: string;
}

export type BelegEingabe = Omit<Beleg, keyof Basisdatensatz | "netto" | "ust" | "brutto">;
export type BelegpositionEingabe = Omit<Belegposition, keyof Basisdatensatz | "beleg" | "betrag">;

/** Zahlungsziel nach Handwerksüblichkeit: 14 Tage netto. */
export const LEERER_BELEG: Omit<BelegEingabe, "kunde" | "belegart" | "nummer"> = {
  status: "entwurf",
  datum: heute(),
  empfaengerName: "",
  empfaengerAnschrift: "",
  empfaengerUid: "",
  steuerfrei: "keiner",
  zahlungszielTage: 14,
  skontoProzent: 0,
  skontoTage: 0,
  kopftext: "",
  fusstext: "",
  nettoJeSatz: {},
};

export function heute(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

/** Nettowert einer Belegzeile in Cent, Rabatt abgezogen. */
export function zeilenwert(p: Pick<Belegposition, "menge" | "einzelpreis" | "rabatt">): number {
  return runden(p.menge * p.einzelpreis * (1 - (p.rabatt ?? 0) / 100));
}

export interface Belegsummen {
  nettoJeSatz: Record<string, number>;
  netto: number;
  ust: number;
  brutto: number;
}

/**
 * Summiert Belegzeilen.
 *
 * Bei Steuerfreiheit wird keine Steuer gerechnet, gleich welcher Satz an der
 * Zeile steht: der Grund liegt am Beleg, nicht an der Position. Sonst je
 * Steuersatz aus der gerundeten Nettosumme — dieselbe Reihenfolge wie im
 * Baustein Material und die, die die Rechnungsvorschriften voraussetzen.
 */
export function belegsummen(
  zeilen: Pick<Belegposition, "menge" | "einzelpreis" | "rabatt" | "ustsatz">[],
  steuerfrei: SteuerfreiGrund = "keiner",
): Belegsummen {
  const nettoJeSatz: Record<string, number> = {};
  for (const z of zeilen) {
    const satz = steuerfrei === "keiner" ? String(z.ustsatz) : "0";
    nettoJeSatz[satz] = (nettoJeSatz[satz] ?? 0) + zeilenwert(z);
  }
  let netto = 0;
  let ust = 0;
  for (const [satz, betrag] of Object.entries(nettoJeSatz)) {
    netto += betrag;
    ust += runden((betrag * Number(satz)) / 100);
  }
  return { nettoJeSatz, netto, ust, brutto: netto + ust };
}

/** Fälligkeitstag aus Belegdatum und Zahlungsziel. */
export function faelligAm(b: Pick<Beleg, "datum" | "zahlungszielTage">): string {
  const d = new Date(`${b.datum.slice(0, 10)}T00:00:00`);
  d.setDate(d.getDate() + (b.zahlungszielTage ?? 0));
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

/** Tage über die Fälligkeit hinaus; 0, solange noch Zeit ist. */
export function ueberfaelligSeit(b: Pick<Beleg, "datum" | "zahlungszielTage">, stichtag = heute()): number {
  const faellig = new Date(`${faelligAm(b)}T00:00:00`).getTime();
  const jetzt = new Date(`${stichtag}T00:00:00`).getTime();
  return Math.max(0, Math.round((jetzt - faellig) / 86400000));
}

/**
 * Was auf diesem Beleg nach den Rechnungsvorschriften des Rechtsraums fehlt.
 *
 * Gibt Sätze zurück, keine Feldnamen — die Liste steht in der Oberfläche und
 * soll einem Handwerker sagen, was zu tun ist, bevor die Rechnung aus dem
 * Haus geht. Geprüft wird nur, was Werkboq wissen kann; ob eine Leistung
 * tatsächlich eine Bauleistung ist, entscheidet nicht die Software.
 */
export function pflichtangaben(
  b: Pick<
    Beleg,
    | "belegart"
    | "nummer"
    | "datum"
    | "leistungVon"
    | "empfaengerName"
    | "empfaengerAnschrift"
    | "empfaengerUid"
    | "steuerfrei"
    | "brutto"
  >,
  betrieb: Betrieb | null,
  zeilenAnzahl: number,
  raum: Rechtsraum = aktuellerRechtsraum(),
): string[] {
  const fehlt: string[] = [];

  if (zeilenAnzahl === 0) fehlt.push("Der Beleg hat keine Positionen.");
  if (!betrieb) {
    fehlt.push("Es gibt keine Betriebsstammdaten — unter Einstellungen → Betrieb ausfüllen.");
    return fehlt;
  }

  // Für Angebote gelten die Rechnungsvorschriften nicht.
  if (b.belegart === "angebot" || b.belegart === "auftragsbestaetigung") {
    if (!b.empfaengerName.trim()) fehlt.push("Der Empfänger fehlt.");
    return fehlt;
  }

  const klein =
    raum.kleinbetragGrenze > 0 &&
    b.brutto <= raum.kleinbetragGrenze &&
    b.steuerfrei === "keiner";

  if (!String(betrieb.name ?? "").trim()) fehlt.push("Firmenname des Betriebs (Einstellungen).");
  if (!String(betrieb.strasse ?? "").trim() || !String(betrieb.ort ?? "").trim()) {
    fehlt.push("Anschrift des Betriebs (Einstellungen).");
  }
  if (!b.datum) fehlt.push("Ausstellungsdatum.");
  if (!b.leistungVon) fehlt.push("Leistungszeitraum oder Tag der Leistung.");

  if (klein) {
    // Kleinbetragsrechnung: Datum, Aussteller, Menge und Bezeichnung,
    // Zeitraum, Bruttobetrag und Steuersatz genügen.
    return fehlt;
  }

  if (!b.nummer) fehlt.push("Fortlaufende Rechnungsnummer.");
  if (!String(betrieb.uid ?? "").trim()) {
    fehlt.push(`${raum.uidName} des Betriebs (Einstellungen).`);
  }
  if (!b.empfaengerName.trim()) fehlt.push("Name des Leistungsempfängers.");
  if (!b.empfaengerAnschrift.trim()) fehlt.push("Anschrift des Leistungsempfängers.");

  if (b.steuerfrei === "bauleistung" && !String(b.empfaengerUid ?? "").trim()) {
    fehlt.push(
      `${raum.uidName} des Empfängers — beim Übergang der Steuerschuld muss sie auf der Rechnung stehen.`,
    );
  }
  if (
    b.steuerfrei === "keiner" &&
    raum.uidEmpfaengerAb > 0 &&
    b.brutto > raum.uidEmpfaengerAb &&
    !String(b.empfaengerUid ?? "").trim()
  ) {
    fehlt.push(
      `${raum.uidName} des Empfängers — ab ${raum.uidEmpfaengerAb / 100} ${raum.waehrungszeichen} brutto ist sie Pflicht, wenn er Unternehmer ist.`,
    );
  }

  return fehlt;
}

/** Nächste freie Belegnummer, je Art und Jahr fortlaufend: "RE-2026-0001". */
export async function naechsteBelegnummer(art: Belegart, jahr = new Date().getFullYear()): Promise<string> {
  const praefix = `${BELEGART_KUERZEL[art]}-${jahr}-`;
  const liste = await pb()
    .collection("belege")
    .getList<Beleg>(1, 1, { filter: `nummer ~ "${praefix}"`, sort: "-nummer" })
    .catch(() => null);
  const letzte = liste?.items[0]?.nummer ?? "";
  const zahl = Number(letzte.slice(praefix.length));
  return `${praefix}${String((Number.isFinite(zahl) ? zahl : 0) + 1).padStart(4, "0")}`;
}

export async function belegLaden(id: string): Promise<Beleg> {
  return await pb().collection("belege").getOne<Beleg>(id);
}

export async function belegpositionen(beleg: string): Promise<Belegposition[]> {
  return await pb()
    .collection("belegpositionen")
    .getFullList<Belegposition>({ filter: `beleg = "${sicher(beleg)}"`, sort: "pos" });
}

export async function belegeSuchen(
  filter: { art?: Belegart; status?: Belegstatus; kunde?: string; text?: string } = {},
  grenze = 200,
): Promise<Beleg[]> {
  const teile: string[] = [];
  if (filter.art) teile.push(`belegart = "${sicher(filter.art)}"`);
  if (filter.status) teile.push(`status = "${sicher(filter.status)}"`);
  if (filter.kunde) teile.push(`kunde = "${sicher(filter.kunde)}"`);
  if (filter.text?.trim()) {
    const t = sicher(filter.text.trim());
    teile.push(`(nummer ~ "${t}" || empfaengerName ~ "${t}")`);
  }
  const liste = await pb()
    .collection("belege")
    .getList<Beleg>(1, grenze, {
      filter: teile.join(" && "),
      sort: "-datum,-nummer",
    });
  return liste.items;
}

/** Anschrift eines Kunden als Block, wie er auf den Beleg gehört. */
export function anschriftVon(k: Kunde): string {
  return [k.strasse, [k.plz, k.ort].filter(Boolean).join(" "), k.land && k.land !== "Österreich" ? k.land : ""]
    .filter((z) => z && String(z).trim())
    .join("\n");
}

/**
 * Legt einen Beleg mit eingefrorenen Positionen an.
 *
 * Bewusst nicht über die Offline-Warteschlange: ein Beleg bekommt eine
 * fortlaufende Nummer, und die lässt sich offline nicht vergeben, ohne
 * Lücken oder Doppelte zu riskieren. Rechnungen schreibt man am Schreibtisch.
 */
export async function belegAnlegen(
  eingabe: BelegEingabe,
  zeilen: BelegpositionEingabe[],
): Promise<Beleg> {
  const summen = belegsummen(
    zeilen.map((z) => ({ ...z, betrag: 0 })),
    eingabe.steuerfrei,
  );

  const beleg = await pb()
    .collection("belege")
    .create<Beleg>({
      ...eingabe,
      netto: summen.netto,
      ust: summen.ust,
      brutto: summen.brutto,
      nettoJeSatz: summen.nettoJeSatz,
      auftrag: eingabe.auftrag || null,
      storniert: eingabe.storniert || null,
      folgebeleg: eingabe.folgebeleg || null,
    });

  for (const z of zeilen) {
    await pb()
      .collection("belegpositionen")
      .create({ ...z, beleg: beleg.id, betrag: zeilenwert({ ...z, rabatt: z.rabatt }) });
  }

  await protokollieren(
    "belege",
    beleg.id,
    "anlegen",
    `${BELEGART_TEXT[eingabe.belegart]} ${eingabe.nummer} angelegt`,
  );
  if (eingabe.auftrag) {
    await protokollieren(
      "auftraege",
      eingabe.auftrag,
      "aendern",
      `${BELEGART_TEXT[eingabe.belegart]} ${eingabe.nummer} erstellt`,
    );
  }

  return beleg;
}

/** Kopf eines Belegs ändern. Nach dem Festschreiben verweigert. */
export async function belegAendern(b: Beleg, eingabe: Partial<BelegEingabe>): Promise<void> {
  if (b.festgeschrieben) {
    throw new Error(
      "Der Beleg ist festgeschrieben und kann nicht mehr geändert werden. Korrektur über eine Gutschrift.",
    );
  }
  await pb().collection("belege").update(b.id, eingabe);
  await protokollieren("belege", b.id, "aendern", `${BELEGART_TEXT[b.belegart]} ${b.nummer} geändert`);
}

/** Summen neu aus den gespeicherten Zeilen rechnen. */
export async function summenNachziehen(beleg: Beleg): Promise<Belegsummen> {
  const zeilen = await belegpositionen(beleg.id);
  const summen = belegsummen(zeilen, beleg.steuerfrei);
  await pb().collection("belege").update(beleg.id, {
    netto: summen.netto,
    ust: summen.ust,
    brutto: summen.brutto,
    nettoJeSatz: summen.nettoJeSatz,
  });
  return summen;
}

/**
 * Festschreiben: der Beleg geht aus dem Haus.
 *
 * Danach ändert sich weder Kopf noch Zeile. Das ist keine Schikane, sondern
 * der Sinn eines Belegs — und die Voraussetzung dafür, dass die Nummern eine
 * nachvollziehbare Reihe bilden.
 */
export async function festschreiben(b: Beleg): Promise<void> {
  if (b.festgeschrieben) return;
  await pb()
    .collection("belege")
    .update(b.id, { festgeschrieben: new Date().toISOString(), status: "offen" });
  await protokollieren(
    "belege",
    b.id,
    "aendern",
    `${BELEGART_TEXT[b.belegart]} ${b.nummer} festgeschrieben`,
  );
}

export async function statusSetzen(b: Beleg, status: Belegstatus): Promise<void> {
  await pb().collection("belege").update(b.id, { status });
  await protokollieren(
    "belege",
    b.id,
    "aendern",
    `${BELEGART_TEXT[b.belegart]} ${b.nummer}: ${STATUS_TEXT[status]}`,
  );
}

/**
 * Storniert einen Beleg durch eine Gutschrift über denselben Betrag.
 *
 * Eine festgeschriebene Rechnung wird nicht gelöscht und nicht geändert —
 * das ist der Punkt an einer fortlaufenden Nummer. Stattdessen entsteht ein
 * Gegenbeleg, und beide bleiben stehen.
 */
export async function stornieren(b: Beleg): Promise<Beleg> {
  const zeilen = await belegpositionen(b.id);
  const nummer = await naechsteBelegnummer("gutschrift");

  const gutschrift = await belegAnlegen(
    {
      belegart: "gutschrift",
      nummer,
      kunde: b.kunde,
      auftrag: b.auftrag,
      status: "offen",
      datum: heute(),
      leistungVon: b.leistungVon,
      leistungBis: b.leistungBis,
      empfaengerName: b.empfaengerName,
      empfaengerAnschrift: b.empfaengerAnschrift,
      empfaengerUid: b.empfaengerUid,
      steuerfrei: b.steuerfrei,
      zahlungszielTage: 0,
      kopftext: `Storno zu ${BELEGART_TEXT[b.belegart]} ${b.nummer} vom ${new Date(b.datum).toLocaleDateString("de-AT")}.`,
      fusstext: b.fusstext,
      storniert: b.id,
      nettoJeSatz: {},
    },
    zeilen.map((z) => ({
      pos: z.pos,
      art: z.art,
      bezeichnung: z.bezeichnung,
      beschreibung: z.beschreibung,
      menge: -z.menge,
      einheit: z.einheit,
      einzelpreis: z.einzelpreis,
      rabatt: z.rabatt,
      ustsatz: z.ustsatz,
      quelle: z.quelle,
    })),
  );

  await pb().collection("belege").update(b.id, { status: "storniert" });
  await pb().collection("belege").update(gutschrift.id, { festgeschrieben: new Date().toISOString() });
  await protokollieren("belege", b.id, "aendern", `Storniert durch Gutschrift ${nummer}`);

  return gutschrift;
}

/** Löschen ist nur für Entwürfe erlaubt. */
export async function belegLoeschen(b: Beleg): Promise<void> {
  if (b.festgeschrieben) {
    throw new Error(
      "Festgeschriebene Belege werden nicht gelöscht — das wäre eine Lücke im Nummernkreis. Storno über eine Gutschrift.",
    );
  }
  for (const z of await belegpositionen(b.id)) {
    await pb().collection("belegpositionen").delete(z.id);
  }
  await pb().collection("belege").delete(b.id);
  await protokollieren("belege", b.id, "loeschen", `Entwurf ${b.nummer} gelöscht`);
}
