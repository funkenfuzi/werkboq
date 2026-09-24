import { dienstAnbieten, type WerkboqModul } from "@werkboq/core";
import { Fuhrpark } from "./seiten/Fuhrpark";
import { Fahrzeugakte } from "./seiten/Fahrzeugakte";
import { Fristenkachel } from "./erweiterungen/Fristenkachel";
import { alleFahrzeuge } from "./daten/fahrzeuge";

export * from "./daten/fahrzeuge";
export * from "./daten/fristen";

/**
 * Baustein Fuhrpark.
 *
 * Fahrzeuge und das, was an ihnen abläuft. Kein Fuhrparkmanagement —
 * Tankkarten, Spritverbrauch und Restwertprognose sind ein eigenes
 * Produkt. Hier geht es um die eine Frage, an der ein Handwerksbetrieb
 * regelmäßig Geld und Nerven verliert: welche Frist läuft ab, ohne dass es
 * jemandem auffällt.
 *
 * Dasselbe Muster wie die Personaldokumente mit Ablaufdatum, und bewusst
 * ebenso schmal.
 *
 * WAS DIESER BAUSTEIN NICHT TUT: gesetzliche Fristen ausrechnen. Wie oft
 * ein Fahrzeug vorzuführen ist, hängt von Klasse, Alter und Nutzung ab —
 * in Österreich, Deutschland und der Schweiz jeweils anders. Eine falsch
 * gerechnete Frist ist schlimmer als keine, weil der Betrieb sich darauf
 * verlässt. Eingetragen wird das Datum vom Papier; der Rechtsraum liefert
 * nur den Namen und die Fundstelle.
 */
export const bausteinFuhrpark: WerkboqModul = {
  id: "fuhrpark",
  name: "Fuhrpark",
  beschreibung:
    "Fahrzeuge mit Kilometerstand und Zuordnung, wiederkehrende Fristen für Begutachtung, Service, Reifen, Versicherung und Leasing — mit Erinnerung auf der Startseite.",
  art: "baustein",
  version: "0.1.0",
  benoetigtKern: "^0.1.0",


  navigation: [
    {
      pfad: "/fuhrpark",
      titel: "Fuhrpark",
      symbol: "fahrzeug",
      komponente: Fuhrpark,
      bereich: "fuhrpark",
      gruppe: "betrieb",
    },
    {
      pfad: "/fuhrpark/:id",
      titel: "Fahrzeug",
      komponente: Fahrzeugakte,
      bereich: "fuhrpark",
      gruppe: "betrieb",
      versteckt: true,
    },
  ],

  erweiterungen: {
    "dashboard.kachel": Fristenkachel,
  },

  initialisieren: () => {
    // Die Zeiterfassung bietet bei einer Fahrt das Fahrzeug an, ohne
    // diesen Baustein zu kennen — sie fragt, und der Fuhrpark antwortet.
    dienstAnbieten("fahrzeuge", async () =>
      (await alleFahrzeuge(true)).map((f) => ({
        id: f.id,
        kennzeichen: f.kennzeichen,
        bezeichnung: f.bezeichnung,
        mitarbeiter: f.mitarbeiter || undefined,
      })),
    );
  },
};

export default bausteinFuhrpark;
