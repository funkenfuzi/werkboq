import { dienstAnbieten, type WerkboqModul } from "@werkboq/core";
import { Personal } from "./seiten/Personal";
import { Personalakte } from "./seiten/Personalakte";
import { Lohnvorbereitung } from "./seiten/Lohnvorbereitung";
import { abwesenheitenImZeitraum } from "./daten/abwesenheiten";
import "./gestaltung/personal.css";

export * from "./daten/abwesenheiten";
export * from "./daten/personaldaten";
export * from "./daten/dokumente";
export * from "./daten/lohn";

/**
 * Baustein Personalwesen.
 *
 * Personalakte, Abwesenheiten, Dokumente mit Ablauffrist und die Zahlen für
 * die Lohnverrechnung. Der Mitarbeiterdatensatz selbst bleibt im Kern —
 * Aufträge, Zeiten und Termine verweisen darauf, und wer dieses Modul nicht
 * gekauft hat, muss trotzdem jemanden einplanen können. Was dieser Baustein
 * hinzufügt, ist alles, was um eine Person herum verwaltet wird.
 *
 * Was er von anderen nimmt, wenn sie da sind:
 *   tagesstunden — die gebuchten Minuten aus der Zeiterfassung. Fehlt sie,
 *   zeigt die Lohnvorbereitung Sollzeit und Abwesenheiten und sagt, warum
 *   keine Iststunden dastehen.
 *
 * Was er anbietet:
 *   abwesend — wer an welchem Tag nicht da ist, ohne den Grund. Die Planung
 *   fragt danach, um niemanden einzuteilen, der auf Urlaub ist.
 *
 * DIE RECHTE STEHEN NICHT IN DIESEM MODUL.
 *
 * Was hier ausgeblendet wird, ist Bequemlichkeit. Der Schutz steht in den
 * Collection-Regeln in server/einrichten.mjs: Personaldaten, Dokumente und
 * Abwesenheiten liest nur, wer den Bereich „personal“ hat, plus der
 * Betroffene selbst. Ohne diese Regeln wäre jede Sozialversicherungsnummer
 * für jeden Angemeldeten über die API zu holen, ganz gleich, was die
 * Oberfläche zeigt.
 *
 * Was er bewusst NICHT tut:
 *   - keine Lohnverrechnung. Kein Lohnzettel, keine Sozialversicherung,
 *     keine Zuschlagsstufen. Die Regeln dafür stehen im Kollektivvertrag und
 *     ändern sich jedes Jahr; ein Fehler darin zahlt der Betrieb.
 *   - keine Feiertage. Sie unterscheiden sich je Bundesland, und ein falsch
 *     geratener Feiertag verfälscht Sollzeit und Urlaubstage still.
 *   - keine Zeiterfassung. Die ist ein eigener Baustein und bleibt es.
 */
export const bausteinPersonal: WerkboqModul = {
  id: "personal",
  name: "Personalwesen",
  beschreibung:
    "Personalakte, Urlaub und Krankenstand mit Resturlaubsrechnung, Dokumente mit Ablauffrist und die Stundenauswertung für die Lohnverrechnung. Personaldaten sind auch serverseitig gesperrt.",
  art: "baustein",
  version: "0.1.0",
  benoetigtKern: "^0.1.0",
  ergaenzt: ["zeiterfassung", "planung"],


  navigation: [
    {
      pfad: "/personal",
      titel: "Personal",
      symbol: "personal",
      komponente: Personal,
      bereich: "personal",
    },
    {
      pfad: "/personal/lohn",
      titel: "Lohnvorbereitung",
      symbol: "geld",
      komponente: Lohnvorbereitung,
      bereich: "personal",
    },
    {
      pfad: "/personal/:id",
      titel: "Personalakte",
      komponente: Personalakte,
      bereich: "personal",
      versteckt: true,
    },
  ],

  async initialisieren() {
    /**
     * Wer ist an welchem Tag nicht da?
     *
     * Bewusst ohne den Grund: die Planung muss wissen, dass jemand fehlt,
     * nicht ob es Urlaub oder Krankenstand war. Dass der Dienst hier
     * filtert, ersetzt keine Zugriffsregel — die Collection selbst ist
     * gesperrt, und wer sie nicht lesen darf, bekommt von diesem Dienst
     * ohnehin nichts. Es ist die zweite Hürde, nicht die erste.
     */
    dienstAnbieten("abwesend", async (von, bis) => {
      const tage: Record<string, true> = {};
      const liste = await abwesenheitenImZeitraum(von, bis, true).catch(() => []);
      for (const a of liste) {
        const ende = new Date(`${a.bis.slice(0, 10)}T00:00:00`);
        for (
          const d = new Date(`${a.von.slice(0, 10)}T00:00:00`);
          d <= ende;
          d.setDate(d.getDate() + 1)
        ) {
          const tag = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(
            d.getDate(),
          ).padStart(2, "0")}`;
          if (tag >= von && tag <= bis) tage[`${a.mitarbeiter}|${tag}`] = true;
        }
      }
      return tage;
    });
  },
};

export default bausteinPersonal;
