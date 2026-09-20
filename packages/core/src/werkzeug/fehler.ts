/**
 * Fehler von PocketBase in Sätze übersetzen, die ein Handwerker versteht.
 *
 * Die Bibliothek wirft einen ClientResponseError mit einer Meldung wie
 * "Failed to create record." — richtig, aber nutzlos. Was wirklich schiefging,
 * steht darunter in `response.data`, feldweise. Je nach Version liegt das an
 * unterschiedlichen Stellen, deshalb sucht `feldfehler` an allen dreien.
 */

export type Feldfehler = Record<string, { code?: string; message?: string }>;

/** Die feldweisen Meldungen aus einem PocketBase-Fehler, oder ein leeres Objekt. */
export function feldfehler(e: unknown): Feldfehler {
  if (!e || typeof e !== "object") return {};
  const kandidaten = [
    (e as { response?: { data?: unknown } }).response?.data,
    (e as { data?: { data?: unknown } }).data?.data,
    (e as { data?: unknown }).data,
  ];
  for (const k of kandidaten) {
    if (k && typeof k === "object" && !Array.isArray(k)) {
      const eintraege = Object.entries(k as Record<string, unknown>).filter(
        ([, v]) => v && typeof v === "object" && "message" in (v as object),
      );
      if (eintraege.length > 0) return Object.fromEntries(eintraege) as Feldfehler;
    }
  }
  return {};
}

/** Deutsche Namen für die Felder, die in Meldungen auftauchen. */
const FELDNAMEN: Record<string, string> = {
  nummer: "Nummer",
  bezeichnung: "Bezeichnung",
  name: "Name",
  email: "E-Mail",
  password: "Passwort",
  preis: "Preis",
  menge: "Menge",
  einheit: "Einheit",
  datum: "Datum",
  beginn: "Beginn",
  ende: "Ende",
  kunde: "Kunde",
  auftrag: "Auftrag",
  titel: "Titel",
  ustsatz: "Steuersatz",
};

/**
 * Ein Satz, der sagt, was zu tun ist.
 *
 * `besonders` erlaubt dem Aufrufer, für einzelne Felder etwas Treffenderes zu
 * sagen als die allgemeine Regel — etwa „Diese Artikelnummer gibt es schon"
 * statt „Nummer: Wert muss eindeutig sein".
 */
export function fehlersatz(e: unknown, besonders: Record<string, string> = {}): string {
  const felder = feldfehler(e);
  const namen = Object.keys(felder);

  for (const feld of namen) {
    if (besonders[feld]) return besonders[feld];
  }

  if (namen.length > 0) {
    return namen
      .map((feld) => `${FELDNAMEN[feld] ?? feld}: ${uebersetzen(felder[feld])}`)
      .join(" · ");
  }

  // Kein Netz: die Bibliothek meldet Status 0, ohne Feldangaben.
  const status = (e as { status?: number })?.status;
  if (status === 0) return "Keine Verbindung zum Server. Läuft PocketBase?";
  if (status === 403) return "Dafür fehlen dir die Rechte.";
  if (status === 404) return "Der Datensatz existiert nicht mehr.";

  return e instanceof Error ? e.message : String(e);
}

function uebersetzen(angabe?: { code?: string; message?: string }): string {
  switch (angabe?.code) {
    case "validation_not_unique":
      return "gibt es schon";
    case "validation_required":
      return "fehlt";
    case "validation_invalid_value":
      return "ist kein zulässiger Wert";
    case "validation_min_text_constraint":
    case "validation_length_out_of_range":
      return "hat die falsche Länge";
    default:
      return angabe?.message ?? "ist ungültig";
  }
}
