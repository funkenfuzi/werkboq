import { KERN_COLLECTIONS, type Kunde } from "./typen";
import { pb } from "./client";
import { schreiben } from "./offline";

/**
 * Zugriff auf Kunden — die Wurzel des Datenmodells.
 *
 * Lesen geht direkt an PocketBase, Schreiben über die Offline-Warteschlange.
 * Die Oberfläche kennt PocketBase deshalb nicht und muss sich um den
 * Unterschied zwischen online und offline nicht kümmern.
 */

/** Felder, die ein Kunde beim Anlegen oder Ändern mitbringt. */
export type KundeEingabe = Omit<Kunde, keyof { id: 1; created: 1; updated: 1 }>;

export const LEERER_KUNDE: KundeEingabe = {
  name: "",
  intern: false,
  unternehmer: false,
  strasse: "",
  plz: "",
  ort: "",
  land: "Österreich",
  telefon: "",
  email: "",
  uid: "",
  notizen: "",
};

/**
 * Kunden suchen. `suche` durchsucht Name, Ort und E-Mail.
 *
 * Die Suche läuft auf dem Server, damit sie auch bei vielen Kunden noch
 * brauchbar ist. Anführungszeichen im Suchtext werden entfernt, sonst ließe
 * sich der Filterausdruck von außen aufbrechen.
 */
export async function kundenSuchen(suche = "", grenze = 200): Promise<Kunde[]> {
  const sauber = suche.trim().replace(/["\\]/g, "");
  const filter = sauber
    ? `name ~ "${sauber}" || ort ~ "${sauber}" || email ~ "${sauber}"`
    : "";

  const ergebnis = await pb()
    .collection(KERN_COLLECTIONS.kunden)
    .getList<Kunde>(1, grenze, {
      sort: "name",
      ...(filter ? { filter } : {}),
    });
  return ergebnis.items;
}

export async function kundeLaden(id: string): Promise<Kunde> {
  return await pb().collection(KERN_COLLECTIONS.kunden).getOne<Kunde>(id);
}

/**
 * Legt einen Kunden an. Ohne Netz landet er in der Warteschlange; dann gibt es
 * noch keine id, und der Rückgabewert ist undefined.
 */
export async function kundeAnlegen(eingabe: KundeEingabe): Promise<Kunde | undefined> {
  const ergebnis = await schreiben({
    art: "anlegen",
    collection: KERN_COLLECTIONS.kunden,
    daten: bereinigen(eingabe),
    lokaleId: `kunde-${Date.now()}`,
  });
  return ergebnis.status === "sofort" ? (ergebnis.datensatz as unknown as Kunde) : undefined;
}

export async function kundeAendern(id: string, eingabe: KundeEingabe): Promise<void> {
  await schreiben({
    art: "aendern",
    collection: KERN_COLLECTIONS.kunden,
    id,
    daten: bereinigen(eingabe),
  });
}

export async function kundeLoeschen(id: string): Promise<void> {
  await schreiben({ art: "loeschen", collection: KERN_COLLECTIONS.kunden, id });
}

/**
 * Der eigene Betrieb als interner Kunde.
 *
 * Eigene Vorhaben hängen an diesem Datensatz, damit auch sie einen Kunden als
 * Wurzel haben. Existiert er noch nicht, wird er beim ersten Zugriff angelegt.
 */
export async function internerKunde(): Promise<Kunde | undefined> {
  const treffer = await pb()
    .collection(KERN_COLLECTIONS.kunden)
    .getFirstListItem<Kunde>("intern = true")
    .catch(() => null);
  if (treffer) return treffer;

  return await kundeAnlegen({
    ...LEERER_KUNDE,
    name: "Eigener Betrieb",
    intern: true,
  });
}

/** Leere Zeichenketten und überflüssige Leerzeichen raus. */
function bereinigen(eingabe: KundeEingabe): Record<string, unknown> {
  const daten: Record<string, unknown> = {};
  for (const [schluessel, wert] of Object.entries(eingabe)) {
    daten[schluessel] = typeof wert === "string" ? wert.trim() : wert;
  }
  return daten;
}
