/**
 * Rechtsraum: Österreich, Deutschland, Schweiz.
 *
 * Werkboq soll in allen drei Ländern verkauft werden, und in allen dreien
 * gelten andere Steuersätze, andere Pflichtangaben auf der Rechnung, andere
 * Verzugszinsen und andere Normen. Statt diese Unterschiede über den Code zu
 * verstreuen, stehen sie hier an einer Stelle — jeder Baustein fragt das
 * Profil und rechnet damit.
 *
 * DAS LAND WIRD BEIM EINRICHTEN GEWÄHLT UND DANN FESTGESCHRIEBEN.
 *
 * Sobald der erste Beleg existiert, lässt es sich nicht mehr ändern. Das ist
 * keine Bequemlichkeit, sondern notwendig: ein bestehender Beleg trägt einen
 * Steuersatz, eine Währung und einen Pflichthinweis aus dem Recht seines
 * Landes. Würde man nachträglich umschalten, stünden alte Rechnungen mit
 * falscher Rechtsgrundlage da — und niemand würde es merken.
 *
 * ZINSSÄTZE VERALTEN.
 * Der Basiszinssatz wird halbjährlich neu festgesetzt. Die Werte hier tragen
 * jeweils Stand und Fundstelle; ändert er sich, ist genau eine Zahl je Land
 * zu ändern. Werkboq schlägt Zinsen vor, es behauptet sie nicht — im
 * Mahnblock lässt sich jeder Betrag überschreiben.
 *
 * Und das Selbstverständliche: das ist Software, keine Steuerberatung. Ob
 * eine Leistung eine Bauleistung ist, ob ein Kunde Unternehmer ist, welcher
 * Satz auf welche Leistung gehört — das entscheidet der Betrieb, nicht das
 * Programm.
 */

export const LAENDER = ["at", "de", "ch"] as const;
export type Land = (typeof LAENDER)[number];

export interface Steuersatz {
  satz: number;
  /** Was darunter fällt, in der Sprache des jeweiligen Landes. */
  titel: string;
}

export interface Rechtsraum {
  id: Land;
  name: string;
  waehrung: "EUR" | "CHF";
  waehrungszeichen: string;
  /** Trennzeichen für Tausender und Dezimalstellen. */
  tausender: string;
  komma: string;

  /** Wie die Steuer im jeweiligen Land heißt. */
  steuerName: string;
  steuerKurz: string;
  steuersaetze: Steuersatz[];
  /** Voreinstellung für eine neue Position. */
  normalsatz: number;

  /** Wie das Firmenregister heißt, das im Briefkopf steht. */
  registerName: string;

  /** Wie die Steuernummer heißt und aussieht. */
  uidName: string;
  /** Kurzform für Tabellenköpfe und den Briefkopf. */
  uidKurz: string;
  uidMuster: string;
  uidPlatzhalter: string;

  /** Fundstelle der Rechnungspflichtangaben. */
  rechnungParagraf: string;
  /** Kleinbetragsrechnung: bis zu diesem Bruttobetrag in Cent/Rappen. */
  kleinbetragGrenze: number;
  kleinbetragParagraf: string;
  /** Ab diesem Bruttobetrag ist die Steuernummer des Empfängers Pflicht. 0 = nie. */
  uidEmpfaengerAb: number;

  /** Umkehr der Steuerschuld bei Bauleistungen — in der Schweiz gibt es das nicht. */
  bauleistung: { moeglich: boolean; paragraf: string; hinweis: string };

  /** Weitere steuerfreie Fälle mit der jeweiligen Fundstelle. */
  kleinunternehmer: { paragraf: string; hinweis: string; grenze: string };

  /** Verzugszinsen im Jahr, in Prozent. */
  verzugB2B: number;
  verzugB2BParagraf: string;
  verzugB2C: number;
  verzugB2CParagraf: string;
  /** Pauschale für Betreibungs-/Beitreibungskosten im B2B, in Cent. 0 = keine. */
  betreibungskosten: number;
  betreibungskostenParagraf: string;
  /** Woher der Basiszinssatz stammt und wann er zuletzt festgesetzt wurde. */
  zinsStand: string;

  /** Aufbewahrungsfrist für Belege. */
  aufbewahrung: string;

  /** Elektrotechnische Normen und Nachweise. */
  elektroNorm: string;
  pruefbericht: string;

  /** Registrierkassen-/Kassenpflicht, die Werkboq bewusst nicht abdeckt. */
  kasse: string;
}

export const RECHTSRAEUME: Record<Land, Rechtsraum> = {
  at: {
    id: "at",
    name: "Österreich",
    waehrung: "EUR",
    waehrungszeichen: "€",
    tausender: ".",
    komma: ",",

    steuerName: "Umsatzsteuer",
    steuerKurz: "USt",
    steuersaetze: [
      { satz: 20, titel: "Normalsatz" },
      { satz: 13, titel: "ermäßigt" },
      { satz: 10, titel: "ermäßigt" },
      { satz: 0, titel: "steuerfrei" },
    ],
    normalsatz: 20,

    registerName: "Firmenbuch",
    uidName: "UID-Nummer",
    uidKurz: "UID",
    uidMuster: "^ATU\\d{8}$",
    uidPlatzhalter: "ATU12345678",

    rechnungParagraf: "§ 11 UStG",
    kleinbetragGrenze: 40000,
    kleinbetragParagraf: "§ 11 Abs 6 UStG",
    uidEmpfaengerAb: 1000000,

    bauleistung: {
      moeglich: true,
      paragraf: "§ 19 Abs 1a UStG",
      hinweis:
        "Übergang der Steuerschuld auf den Leistungsempfänger gemäß § 19 Abs 1a UStG (Bauleistung).",
    },
    kleinunternehmer: {
      paragraf: "§ 6 Abs 1 Z 27 UStG",
      hinweis:
        "Umsatzsteuerbefreit — Kleinunternehmer gemäß § 6 Abs 1 Z 27 UStG. Kein Ausweis von Umsatzsteuer.",
      grenze: "55.000 € brutto im Jahr, Toleranz bis 60.500 €",
    },

    // Basiszinssatz 1,53 % (OeNB), unverändert seit 11.6.2025, für 2026 bestätigt.
    verzugB2B: 10.73,
    verzugB2BParagraf: "§ 456 UGB",
    verzugB2C: 4,
    verzugB2CParagraf: "§ 1000 ABGB",
    betreibungskosten: 4000,
    betreibungskostenParagraf: "§ 458 UGB",
    zinsStand: "Basiszinssatz 1,53 % plus 9,2 Punkte (OeNB, Stand 2026)",

    aufbewahrung: "7 Jahre (§ 132 BAO)",

    elektroNorm: "OVE E 8101",
    pruefbericht: "Prüfbefund nach OVE E 8101",

    kasse:
      "Registrierkassenpflicht ab 15.000 € Jahresumsatz netto und zugleich 7.500 € Barumsatz netto (RKSV).",
  },

  de: {
    id: "de",
    name: "Deutschland",
    waehrung: "EUR",
    waehrungszeichen: "€",
    tausender: ".",
    komma: ",",

    steuerName: "Umsatzsteuer",
    steuerKurz: "USt",
    steuersaetze: [
      { satz: 19, titel: "Regelsatz" },
      { satz: 7, titel: "ermäßigt" },
      { satz: 0, titel: "steuerfrei" },
    ],
    normalsatz: 19,

    registerName: "Handelsregister",
    uidName: "Umsatzsteuer-Identifikationsnummer",
    uidKurz: "USt-IdNr.",
    uidMuster: "^DE\\d{9}$",
    uidPlatzhalter: "DE123456789",

    rechnungParagraf: "§ 14 UStG",
    kleinbetragGrenze: 25000,
    kleinbetragParagraf: "§ 33 UStDV",
    uidEmpfaengerAb: 0, // bei Reverse Charge und ig. Lieferungen, nicht betragsabhängig

    bauleistung: {
      moeglich: true,
      paragraf: "§ 13b Abs 2 Nr 4 UStG",
      hinweis:
        "Steuerschuldnerschaft des Leistungsempfängers gemäß § 13b Abs 2 Nr 4 UStG (Bauleistung).",
    },
    kleinunternehmer: {
      paragraf: "§ 19 UStG",
      hinweis:
        "Kein Ausweis von Umsatzsteuer aufgrund der Kleinunternehmerregelung nach § 19 UStG.",
      grenze: "Vorjahr bis 25.000 €, laufendes Jahr bis 100.000 €",
    },

    // Basiszinssatz 1,52 % (Deutsche Bundesbank), seit 1.7.2026.
    verzugB2B: 10.52,
    verzugB2BParagraf: "§ 288 Abs 2 BGB",
    verzugB2C: 6.52,
    verzugB2CParagraf: "§ 288 Abs 1 BGB",
    betreibungskosten: 4000,
    betreibungskostenParagraf: "§ 288 Abs 5 BGB",
    zinsStand: "Basiszinssatz 1,52 % plus 9 bzw. 5 Punkte (Bundesbank, seit 1.7.2026)",

    aufbewahrung: "8 Jahre für Rechnungen und Buchungsbelege (§ 147 AO, seit BEG IV)",

    elektroNorm: "DIN VDE 0100 / DIN VDE 0105-100",
    pruefbericht: "Prüfprotokoll nach DIN VDE 0100-600, Wiederholungsprüfung nach DGUV V3",

    kasse:
      "Kassen mit elektronischer Aufzeichnung brauchen eine zertifizierte technische Sicherheitseinrichtung (KassenSichV).",
  },

  ch: {
    id: "ch",
    name: "Schweiz",
    waehrung: "CHF",
    waehrungszeichen: "CHF",
    tausender: "’",
    komma: ".",

    steuerName: "Mehrwertsteuer",
    steuerKurz: "MWST",
    steuersaetze: [
      { satz: 8.1, titel: "Normalsatz" },
      { satz: 3.8, titel: "Beherbergung" },
      { satz: 2.6, titel: "reduziert" },
      { satz: 0, titel: "von der Steuer ausgenommen" },
    ],
    normalsatz: 8.1,

    registerName: "Handelsregister",
    uidName: "UID / MWST-Nummer",
    uidKurz: "UID",
    uidMuster: "^CHE-?\\d{3}\\.?\\d{3}\\.?\\d{3}( MWST)?$",
    uidPlatzhalter: "CHE-123.456.789 MWST",

    rechnungParagraf: "Art. 26 MWSTG",
    kleinbetragGrenze: 0, // keine Erleichterung im Gesetz vorgesehen
    kleinbetragParagraf: "",
    uidEmpfaengerAb: 0,

    bauleistung: {
      moeglich: false,
      paragraf: "",
      hinweis: "",
    },
    kleinunternehmer: {
      paragraf: "Art. 10 Abs 2 MWSTG",
      hinweis: "Nicht mehrwertsteuerpflichtig (Art. 10 Abs 2 MWSTG). Kein Ausweis von MWST.",
      grenze: "Steuerpflicht ab CHF 100’000 Inlandsumsatz im Jahr",
    },

    verzugB2B: 5,
    verzugB2BParagraf: "Art. 104 OR",
    verzugB2C: 5,
    verzugB2CParagraf: "Art. 104 OR",
    betreibungskosten: 0,
    betreibungskostenParagraf: "",
    zinsStand: "5 % gesetzlicher Verzugszins (Art. 104 Abs 1 OR)",

    aufbewahrung: "10 Jahre (Art. 958f OR)",

    elektroNorm: "NIN / SN 411000",
    pruefbericht: "Sicherheitsnachweis (SiNa) mit Mess- und Prüfprotokoll nach NIV",

    kasse: "Keine Registrierkassenpflicht; die ordnungsgemässe Buchführung nach OR genügt.",
  },
};

/** Der Rechtsraum zu einer Kennung. Unbekanntes fällt auf Österreich zurück. */
export function rechtsraum(land: string | undefined | null): Rechtsraum {
  const id = String(land ?? "at").toLowerCase();
  return RECHTSRAEUME[(LAENDER as readonly string[]).includes(id) ? (id as Land) : "at"];
}

/** Die Steuersätze eines Landes als reine Zahlen, absteigend. */
export function saetzeVon(r: Rechtsraum): number[] {
  return r.steuersaetze.map((s) => s.satz);
}

/** "20 % Normalsatz" bzw. "8.1 % Normalsatz". */
export function satzText(r: Rechtsraum, satz: number): string {
  const eintrag = r.steuersaetze.find((s) => s.satz === satz);
  const zahl = zahlText(r, satz);
  return eintrag ? `${zahl} % ${eintrag.titel}` : `${zahl} %`;
}

/** Zahl in der Schreibweise des Landes — in der Schweiz mit Punkt. */
export function zahlText(r: Rechtsraum, wert: number): string {
  const text = Number.isInteger(wert) ? String(wert) : wert.toFixed(1);
  return r.komma === "," ? text.replace(".", ",") : text;
}

/**
 * Prüft eine Steuernummer grob auf die Form des Landes.
 * Bewusst nur die Form: ob die Nummer gültig ist, weiß nur die Finanz.
 */
export function uidPlausibel(r: Rechtsraum, uid: string): boolean {
  const sauber = uid.trim().replace(/\s+/g, " ");
  if (sauber === "") return true;
  return new RegExp(r.uidMuster, "i").test(sauber);
}

// ------------------------------------------------------------------------
// Der gewählte Rechtsraum dieses Betriebs
// ------------------------------------------------------------------------

/**
 * Einmal beim Start geladen und danach im Speicher.
 *
 * Synchron abfragbar, weil ihn jede Maske und jede Tabelle braucht — ein
 * Steuersatz-Auswahlfeld kann nicht auf das Netz warten. Voreinstellung ist
 * Österreich; sie greift nur, solange nichts geladen wurde.
 */
let gewaehlt: Rechtsraum = RECHTSRAEUME.at;

/** Liest den Rechtsraum aus den Betriebsstammdaten. */
export async function rechtsraumLaden(
  laden: () => Promise<{ rechtsraum?: string } | null>,
): Promise<Rechtsraum> {
  try {
    const betrieb = await laden();
    gewaehlt = rechtsraum(betrieb?.rechtsraum);
  } catch {
    // Kein Netz, keine Rechte, kein Datensatz: bei der Voreinstellung bleiben.
  }
  return gewaehlt;
}

/** Der Rechtsraum dieses Betriebs. */
export function aktuellerRechtsraum(): Rechtsraum {
  return gewaehlt;
}

/**
 * Setzt den Rechtsraum sofort, ohne auf das Neuladen zu warten.
 *
 * Nur für den Augenblick gedacht, in dem beim Einrichten das Land gewählt
 * und gespeichert wird: die Masken sollen danach sofort mit den richtigen
 * Sätzen arbeiten. Gespeichert wird der Wert am Betrieb, nicht hier.
 */
export function rechtsraumSetzen(land: string): Rechtsraum {
  gewaehlt = rechtsraum(land);
  return gewaehlt;
}
