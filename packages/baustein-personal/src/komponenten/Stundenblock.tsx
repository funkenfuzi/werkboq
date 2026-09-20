import { useCallback, useEffect, useState } from "react";
import { dienst, fehlersatz, type Mitarbeiter } from "@werkboq/core";
import { abwesenheitenZuMitarbeiter, type Abwesenheit } from "../daten/abwesenheiten";
import { personaldatenLaden, type Personaldaten } from "../daten/personaldaten";
import { abwesenheitstext, monatsauswertung, monatsname, type Monatsauswertung } from "../daten/lohn";

/**
 * Die Stunden eines Mitarbeiters, Monat für Monat.
 *
 * Die Zahlen kommen aus der Zeiterfassung, über den Dienst `tagesstunden`.
 * Ist dieser Baustein nicht gekauft, gibt es keine Stunden — dann steht das
 * hier auch so da, statt eine Null zu zeigen, die nach "nicht gearbeitet"
 * aussieht. Genau an dieser Stelle merkt man, was ein Baustein wert ist.
 */
export function Stundenblock({ mitarbeiter }: { mitarbeiter: Mitarbeiter }) {
  const [jahr, setJahr] = useState(new Date().getFullYear());
  const [zeilen, setZeilen] = useState<Monatsauswertung[]>([]);
  const [laedt, setLaedt] = useState(true);
  const [fehler, setFehler] = useState<string | null>(null);

  const stundenDienst = dienst("tagesstunden");

  const laden = useCallback(() => {
    setLaedt(true);
    Promise.all([
      abwesenheitenZuMitarbeiter(mitarbeiter.id, jahr).catch((): Abwesenheit[] => []),
      personaldatenLaden(mitarbeiter.id).catch((): Personaldaten | null => null),
      stundenDienst
        ? stundenDienst(`${jahr}-01-01`, `${jahr}-12-31`).catch(() => ({}))
        : Promise.resolve({} as Record<string, number>),
    ])
      .then(([abwesenheiten, daten, tagesminuten]) => {
        const proMonat = new Array(12).fill(0);
        for (const [schluessel, minuten] of Object.entries(tagesminuten)) {
          const [wer, tag] = schluessel.split("|");
          if (wer !== mitarbeiter.id || !tag) continue;
          const monat = Number(tag.slice(5, 7));
          if (monat >= 1 && monat <= 12) proMonat[monat - 1] += minuten;
        }

        setZeilen(
          proMonat.map((minuten, i) =>
            monatsauswertung(mitarbeiter, jahr, i + 1, minuten, 0, abwesenheiten, daten),
          ),
        );
      })
      .catch((e: unknown) => setFehler(fehlersatz(e)))
      .finally(() => setLaedt(false));
  }, [mitarbeiter, jahr, stundenDienst]);

  useEffect(laden, [laden]);

  const summe = zeilen.reduce(
    (s, z) => ({
      soll: s.soll + z.sollstunden,
      ist: s.ist + z.iststunden,
      mehr: s.mehr + z.mehrstunden,
    }),
    { soll: 0, ist: 0, mehr: 0 },
  );

  return (
    <section className="wb-block">
      <div className="wb-block__kopf">
        <h2>Stunden {jahr}</h2>
        <label className="wb-feld wb-feld--schmal wb-feld--inline">
          <span className="wb-verborgen">Jahr</span>
          <select value={jahr} onChange={(e) => setJahr(Number(e.target.value))}>
            {[jahr + 1, jahr, jahr - 1, jahr - 2]
              .filter((j, i, alle) => alle.indexOf(j) === i)
              .sort((a, b) => b - a)
              .map((j) => (
                <option key={j} value={j}>
                  {j}
                </option>
              ))}
          </select>
        </label>
      </div>

      {!stundenDienst && (
        <p className="wb-leer wb-notiz">
          Der Baustein Zeiterfassung ist nicht freigeschaltet — es gibt keine gebuchten Stunden.
          Sollstunden und Abwesenheiten stehen trotzdem.
        </p>
      )}

      {!mitarbeiter.wochenstunden && (
        <p className="wb-hinweis">
          Für {mitarbeiter.name} sind keine Wochenstunden hinterlegt. Ohne sie gibt es keine
          Sollzeit und damit keine Mehrstunden — unter „Stammdaten“ eintragen.
        </p>
      )}

      {fehler && (
        <p className="wb-fehler" role="alert">
          {fehler}
        </p>
      )}

      {laedt && zeilen.length === 0 && <p className="wb-leer">Wird geladen …</p>}

      {zeilen.length > 0 && (
        <div className="wb-tabelle-rahmen">
          <table className="wb-tabelle">
            <thead>
              <tr>
                <th scope="col">Monat</th>
                <th scope="col" className="wb-zelle--rechts">Soll</th>
                <th scope="col" className="wb-zelle--rechts">Ist</th>
                <th scope="col" className="wb-zelle--rechts">Differenz</th>
                <th scope="col">Abwesend</th>
              </tr>
            </thead>
            <tbody>
              {zeilen.map((z) => (
                <tr key={z.monat}>
                  <td>{monatsname(z.monat)}</td>
                  <td className="wb-zelle--rechts wb-tabelle__kennung">{stunden(z.sollstunden)}</td>
                  <td className="wb-zelle--rechts wb-tabelle__kennung">{stunden(z.iststunden)}</td>
                  <td
                    className={`wb-zelle--rechts wb-tabelle__kennung ${
                      z.mehrstunden < 0 ? "wb-verzug" : ""
                    }`}
                  >
                    {z.mehrstunden > 0 ? "+" : ""}
                    {stunden(z.mehrstunden)}
                  </td>
                  <td className="wb-zelle--gedaempft">{abwesenheitstext(z.abwesenheitstage)}</td>
                </tr>
              ))}
            </tbody>
            <tfoot>
              <tr>
                <th scope="row">Jahr</th>
                <td className="wb-zelle--rechts wb-tabelle__kennung">{stunden(summe.soll)}</td>
                <td className="wb-zelle--rechts wb-tabelle__kennung">{stunden(summe.ist)}</td>
                <td className="wb-zelle--rechts wb-tabelle__kennung wb-zelle--betont">
                  {summe.mehr > 0 ? "+" : ""}
                  {stunden(summe.mehr)}
                </td>
                <td />
              </tr>
            </tfoot>
          </table>
        </div>
      )}

      <p className="wb-leer wb-notiz">
        Die Differenz ist eine Rohzahl gegen die vereinbarte Wochenarbeitszeit. Ob eine Stunde als
        Überstunde mit Zuschlag oder als Mehrarbeit gilt, entscheidet der Kollektivvertrag — nicht
        dieses Programm. Feiertage sind in der Sollzeit nicht abgezogen.
      </p>
    </section>
  );
}

function stunden(n: number): string {
  return `${String(Math.round(n * 100) / 100).replace(".", ",")} h`;
}
