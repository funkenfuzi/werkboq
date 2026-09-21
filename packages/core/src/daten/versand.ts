import { pb } from "./client";
import { aktuellerBenutzer } from "../benutzer/rechte";
import { sicher } from "../werkzeug/zeitrechnung";
import { protokollieren } from "./protokoll";
import type { Basisdatensatz } from "./typen";

/**
 * Dokumente hinausschicken — und festhalten, dass es geschehen ist.
 *
 * WAS DIESES MODUL KANN UND WAS NICHT. Bitte einmal lesen, bevor jemand
 * "aber es verschickt doch gar nichts" schreibt: nein, und das ist Absicht.
 *
 * Werkboq hat keinen Mailserver. Es könnte einen bekommen, aber dann müsste
 * ein Handwerksbetrieb SMTP-Zugangsdaten hinterlegen, SPF und DKIM für seine
 * Domain einrichten, und wenn das schiefgeht, landen seine Rechnungen
 * wortlos im Spam — was schlimmer ist, als sie nie geschickt zu haben. Das
 * ist ein eigenes Vorhaben mit eigenem Betrieb.
 *
 * Stattdessen öffnet Werkboq das, was der Anwender ohnehin benutzt:
 *
 *   MAIL: ein `mailto:`-Link mit Empfänger, Betreff und fertigem Text. Das
 *   Mailprogramm geht auf, der Anwender hängt das PDF an und drückt auf
 *   Senden. Ein Anhang lässt sich über mailto nicht mitgeben — das ist
 *   keine Lücke in Werkboq, das erlaubt der Standard schlicht nicht.
 *
 *   WHATSAPP: ein `wa.me`-Link mit Nummer und fertigem Text. Eine Datei
 *   anhängen kann nur die WhatsApp Business API — ein kostenpflichtiger
 *   Dienst mit Vorlagen, die Meta genehmigen muss. Über einen Link geht das
 *   nicht, von niemandem, mit keinem Trick.
 *
 * WAS BLEIBT, IST DER NACHWEIS, und der ist der eigentliche Wert. Die Frage
 * im Streit lautet nicht "über welchen Kanal", sondern "haben Sie die
 * Rechnung je bekommen?". Darauf muss man ein Datum nennen können.
 *
 * Deshalb wird jeder Versand festgehalten — und deshalb fragt Werkboq
 * hinterher nach, ob wirklich abgeschickt wurde. Es kann es nicht wissen
 * und behauptet es nicht: ein Versandnachweis, der bloß sagt "wir haben ein
 * Fenster geöffnet", wäre eine Lüge mit Zeitstempel.
 */

export const VERSANDWEGE = ["mail", "whatsapp", "druck", "uebergabe", "post"] as const;
export type Versandweg = (typeof VERSANDWEGE)[number];

export const VERSANDWEG_TEXT: Record<Versandweg, string> = {
  mail: "E-Mail",
  whatsapp: "WhatsApp",
  druck: "Ausgedruckt",
  uebergabe: "Persönlich übergeben",
  post: "Mit der Post",
};

export const VERSANDWEG_SYMBOL: Record<Versandweg, string> = {
  mail: "mail",
  whatsapp: "telefon",
  druck: "beleg",
  uebergabe: "kunden",
  post: "beleg",
};

export interface Versandzeile extends Basisdatensatz {
  bereich: string;
  datensatz: string;
  bezeichnung: string;
  weg: Versandweg;
  empfaenger?: string;
  betreff?: string;
  nachricht?: string;
  /** Hat der Anwender bestätigt, dass er wirklich abgeschickt hat? */
  bestaetigt?: boolean;
  benutzername?: string;
}

export async function versandZuDatensatz(datensatz: string): Promise<Versandzeile[]> {
  return await pb()
    .collection("versand")
    .getFullList<Versandzeile>({ filter: `datensatz = "${sicher(datensatz)}"`, sort: "-created" });
}

/**
 * Hält einen Versand fest.
 *
 * `bestaetigt` ist anfangs false: zu diesem Zeitpunkt wurde nur ein Fenster
 * geöffnet. Erst wenn der Anwender bejaht, wird daraus ein Nachweis.
 */
export async function versandFesthalten(
  bereich: string,
  datensatz: string,
  bezeichnung: string,
  weg: Versandweg,
  einzelheiten: { empfaenger?: string; betreff?: string; nachricht?: string } = {},
): Promise<Versandzeile> {
  const b = aktuellerBenutzer();
  const neu = await pb().collection("versand").create<Versandzeile>({
    bereich,
    datensatz,
    bezeichnung,
    weg,
    empfaenger: einzelheiten.empfaenger ?? "",
    betreff: einzelheiten.betreff ?? "",
    nachricht: einzelheiten.nachricht ?? "",
    bestaetigt: weg === "druck",
    benutzer: b?.id ?? null,
    benutzername: b?.name || b?.email || "",
  });
  await protokollieren(
    bereich,
    datensatz,
    "aendern",
    `${bezeichnung} über ${VERSANDWEG_TEXT[weg]}${einzelheiten.empfaenger ? ` an ${einzelheiten.empfaenger}` : ""}`,
  );
  return neu;
}

/** Der Anwender bestätigt, dass er wirklich abgeschickt hat. */
export async function versandBestaetigen(z: Versandzeile, ja: boolean): Promise<void> {
  await pb().collection("versand").update(z.id, { bestaetigt: ja });
  await protokollieren(
    z.bereich,
    z.datensatz,
    "aendern",
    ja
      ? `${z.bezeichnung}: Versand über ${VERSANDWEG_TEXT[z.weg]} bestätigt`
      : `${z.bezeichnung}: Versand über ${VERSANDWEG_TEXT[z.weg]} als nicht erfolgt vermerkt`,
  );
}

/** Wann ging es zuletzt bestätigt hinaus? Null, wenn noch nie. */
export function zuletztVersendet(zeilen: Versandzeile[]): Versandzeile | null {
  return zeilen.find((z) => z.bestaetigt) ?? null;
}

// ------------------------------------------------------------------------
// Die Adressen, die das jeweilige Programm öffnen
// ------------------------------------------------------------------------

/**
 * `mailto:` mit Empfänger, Betreff und Text.
 *
 * Alles wird prozentkodiert — ein Umlaut oder ein Zeilenumbruch im Betreff
 * zerlegt sonst die Adresse, und dann öffnet sich ein leeres Fenster ohne
 * erkennbaren Grund.
 */
export function mailAdresse(an: string, betreff: string, text: string): string {
  const teile = [`subject=${encodeURIComponent(betreff)}`, `body=${encodeURIComponent(text)}`];
  return `mailto:${encodeURIComponent(an.trim())}?${teile.join("&")}`;
}

/**
 * Telefonnummer für wa.me: nur Ziffern, mit Länderkennzahl, ohne Plus.
 *
 * "0664 / 123 45 67" ist die Schreibweise, die in jedem Kundendatensatz
 * steht, und die WhatsApp nicht versteht. Die führende Null wird durch die
 * Landesvorwahl ersetzt — ohne sie landet die Nachricht nirgends.
 */
export function waNummer(telefon: string, land = "43"): string | null {
  let ziffern = telefon.replace(/[^\d+]/g, "");
  if (ziffern.startsWith("+")) ziffern = ziffern.slice(1);
  else if (ziffern.startsWith("00")) ziffern = ziffern.slice(2);
  else if (ziffern.startsWith("0")) ziffern = land + ziffern.slice(1);
  else if (ziffern.length <= 9) ziffern = land + ziffern;
  // Kürzer als acht Stellen ist keine Mobilnummer, sondern ein Tippfehler.
  return ziffern.length >= 8 ? ziffern : null;
}

/** `wa.me`-Adresse mit vorbereitetem Text. Null, wenn die Nummer nicht taugt. */
export function whatsappAdresse(telefon: string, text: string, land = "43"): string | null {
  const nummer = waNummer(telefon, land);
  if (!nummer) return null;
  return `https://wa.me/${nummer}?text=${encodeURIComponent(text)}`;
}

/** Ländervorwahl zum Rechtsraum — für die WhatsApp-Nummer. */
export function landesvorwahl(rechtsraum: string | undefined | null): string {
  switch (String(rechtsraum ?? "at").toLowerCase()) {
    case "de":
      return "49";
    case "ch":
      return "41";
    default:
      return "43";
  }
}
