import type { WerkboqModul } from "@werkboq/core";
import { Vertraege } from "./seiten/Vertraege";
import { VertragAkte } from "./seiten/VertragAkte";
import { VertragsKachel } from "./erweiterungen/VertragsKachel";
import { KundeVertraege } from "./erweiterungen/KundeVertraege";

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
 * Was er von anderen nimmt, wenn sie da sind:
 *   belegentwurf — die Verrechnung legt den Entwurf für die Pauschale an.
 * Ohne Verrechnung fehlt nur dieser Knopf.
 */
export const bausteinVertraege: WerkboqModul = {
  id: "vertraege",
  name: "Wartungsverträge",
  beschreibung:
    "Wartungsverträge mit Intervall, Pauschale oder Aufwand, Laufzeit und Kündigungsfrist. Erinnert an fällige Wartungen, Pauschalen und Kündigungstermine.",
  art: "baustein",
  version: "0.1.0",
  benoetigtKern: "^0.1.0",
  ergaenzt: ["verrechnung"],

  navigation: [
    { pfad: "/vertraege", titel: "Verträge", symbol: "wiederholung", komponente: Vertraege, bereich: "buchhaltung" },
    { pfad: "/vertraege/:id", titel: "Vertrag", komponente: VertragAkte, bereich: "buchhaltung", versteckt: true },
  ],

  erweiterungen: {
    "dashboard.kachel": VertragsKachel,
    "kunde.reiter": KundeVertraege,
  },
};

export default bausteinVertraege;
