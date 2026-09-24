import { dienstAnbieten, type WerkboqModul } from "@werkboq/core";
import { Kalender } from "./seiten/Kalender";
import { termineAmTag } from "./daten/termine";

export * from "./daten/termine";

/**
 * Baustein Planung.
 *
 * Dispo-Kalender: Mitarbeiter als Zeilen, Tage als Spalten, Termine per
 * Ziehen zwischen Tagen und Personen. Braucht aus dem Kern nur die
 * Mitarbeiter und — wenn ein Termin an einem Auftrag hängen soll — die
 * Aufträge.
 *
 * Was dieser Baustein von anderen nimmt, wenn es da ist:
 *   tagesstunden — gebuchte Minuten je Mitarbeiter und Tag, aus der
 *                  Zeiterfassung. Damit stehen geplant und gebucht
 *                  nebeneinander; das ist der eigentliche Wert der Planung.
 * Fehlt die Zeiterfassung, fällt die zweite Zahl weg und der Plan zeigt nur
 * das Geplante. Eine harte Abhängigkeit gibt es nicht.
 *
 * Was er anbietet:
 *   tagestermine — wer heute wo hin muss. Die Startseite fragt danach; ist
 *   die Planung nicht gekauft, antwortet niemand und die Tagesansicht sagt
 *   das, statt einen leeren Tag zu zeigen.
 */
export const bausteinPlanung: WerkboqModul = {
  id: "planung",
  name: "Planung",
  beschreibung:
    "Dispo-Kalender über die Woche: wer ist wann auf welcher Baustelle. Termine per Ziehen verschieben, Urlaub und Schulung ohne Auftrag.",
  art: "baustein",
  version: "0.1.0",
  benoetigtKern: "^0.1.0",
  ergaenzt: ["zeiterfassung"],


  navigation: [
    {
      pfad: "/planung",
      titel: "Planung",
      symbol: "kalender",
      komponente: Kalender,
      bereich: "technik",
      gruppe: "auftraege",
    },
  ],

  async initialisieren() {
    dienstAnbieten("tagestermine", async (tag, mitarbeiterId) => {
      const termine = await termineAmTag(tag, mitarbeiterId);
      return termine.map((t) => ({
        id: t.id,
        titel: t.titel,
        beginn: t.ganztags ? "" : (t.beginn ?? ""),
        ende: t.ganztags ? "" : (t.ende ?? ""),
        ganztags: Boolean(t.ganztags),
        ort: t.ort ?? "",
        auftrag: t.auftrag || undefined,
        mitarbeiter: t.mitarbeiter ?? [],
      }));
    });
  },
};

export default bausteinPlanung;
