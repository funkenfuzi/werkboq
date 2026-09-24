import type { WerkboqModul } from "@werkboq/core";
import { Vertraege } from "./seiten/Vertraege";
import { VertragAkte } from "./seiten/VertragAkte";
import { VertragsKachel } from "./erweiterungen/VertragsKachel";
import { KundeVertraege, LieferantVertraege } from "./erweiterungen/KundeVertraege";

export * from "./daten/rechnen";
export * from "./daten/vertraege";

/**
 * Baustein Verträge.
 *
 * Wartungsverträge: wie oft gewartet wird, wie verrechnet (Pauschale im
 * Voraus oder nach Aufwand je Wartung), wie lange er läuft und bis wann
 * gekündigt werden kann. Er legt nichts von selbst an — er erinnert, und
 * ein Klick macht aus der fälligen Wartung einen Auftrag und aus der
 * fälligen Pauschale einen Rechnungsentwurf.
 *
 * Seit September 2026 auch in die andere Richtung: eigene Verträge mit
 * Lieferanten und Dienstleistern — Feuerlöscherprüfung, Leasing,
 * Versicherung. Dort gibt es nichts zu verrechnen, aber dieselben Uhren:
 * wiederkehrender Termin, Laufzeit, Kündigungsfrist.
 *
 * Was er von anderen nimmt, wenn sie da sind:
 *   belegentwurf — die Verrechnung legt den Entwurf für die Pauschale an.
 * Ohne Verrechnung fehlt nur dieser Knopf.
 */
export const bausteinVertraege: WerkboqModul = {
  id: "vertraege",
  name: "Verträge",
  beschreibung:
    "Wartungsverträge mit Kunden (Intervall, Pauschale oder Aufwand) und eigene Verträge mit Lieferanten (Prüftermine, Leasing, Versicherung) — mit Laufzeit und Kündigungsfrist. Erinnert an fällige Wartungen, Pauschalen, Termine und Kündigungsfristen.",
  art: "baustein",
  version: "0.1.0",
  benoetigtKern: "^0.1.0",
  ergaenzt: ["verrechnung"],

  navigation: [
    { pfad: "/vertraege", titel: "Verträge", symbol: "wiederholung", komponente: Vertraege, bereich: "buchhaltung", gruppe: "kunden" },
    { pfad: "/vertraege/:id", titel: "Vertrag", komponente: VertragAkte, bereich: "buchhaltung", gruppe: "kunden", versteckt: true },
  ],

  erweiterungen: {
    "dashboard.kachel": VertragsKachel,
    "kunde.reiter": KundeVertraege,
    "lieferant.reiter": LieferantVertraege,
  },
};

export default bausteinVertraege;
