import { useCallback, useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { alleMitarbeiter, dienst, fehlersatz, Symbol, type Mitarbeiter } from "@werkboq/core";
import { abwesenheitenImZeitraum, type Abwesenheit } from "../daten/abwesenheiten";
import { personaldatenLaden, type Personaldaten } from "../daten/personaldaten";
import {
  abwesenheitstext,
  alsCsv,
  monatsauswertung,
  monatsname,
  type Monatsauswertung,
} from "../daten/lohn";

/**
 * Was die Lohnverrechnung braucht — für alle Mitarbeiter, einen Monat lang.
 *
 * Werkboq rechnet keinen Lohn und stellt keinen Lohnzettel aus. Es liefert
 * Sollstunden, Iststunden, die Differenz und die Abwesenheitstage. Daraus
 * macht die Lohnverrechnung einen Lohnzettel — mit Kollektivvertrag,
 * Zuschlagsstufen und Sozialversicherung.
 *
 * Diese Grenze ist Absicht. Ein falsch gerechneter Zuschlag ist ein Fehler,
 * den der Betrieb nachzahlt und verantwortet, und die Regeln dafür ändern
 * sich jedes Jahr in jedem Kollektivvertrag anders.
 */
export function Lohnvorbereitung() {
  const jetzt = new Date();
  const [jahr, setJahr] = useState(jetzt.getFullYear());
  const [monat, setMonat] = useState(jetzt.getMonth() + 1);
  const [zeilen, setZeilen] = useState<Monatsauswertung[]>([]);
  const [laedt, setLaedt] = useState(true);
  const [fehler, setFehler] = useState<string | null>(null);

  const stundenDienst = dienst("tagesstunden");

  const laden = useCallback(() => {
    setLaedt(true);
    const ersterTag = `${jahr}-${String(monat).padStart(2, "0")}-01`;
    const letzterTag = `${jahr}-${String(monat).padStart(2, "0")}-${String(
      new Date(jahr, monat, 0).getDate(),
    ).padStart(2, "0")}`;

    Promise.all([
      alleMitarbeiter(true),
      abwesenheitenImZeitraum(ersterTag, letzterTag, true).catch((): Abwesenheit[] => []),
      stundenDienst
        ? stundenDienst(ersterTag, letzterTag).catch(() => ({}))
        : Promise.resolve({} as Record<string, number>),
    ])
      .then(async ([mitarbeiter, abwesenheiten, tagesminuten]) => {
        const minutenJe = new Map<string, number>();
        for (const [schluessel, minuten] of Object.entries(tagesminuten)) {
          const wer = schluessel.split("|")[0];
          if (wer) minutenJe.set(wer, (minutenJe.get(wer) ?? 0) + minuten);
        }

        const akten = await Promise.all(
          mitarbeiter.map((m) => personaldatenLaden(m.id).catch((): Personaldaten | null => null)),
        );

        setZeilen(
          mitarbeiter.map((m: Mitarbeiter, i: number) =>
            monatsauswertung(
              m,
              jahr,
              monat,
              minutenJe.get(m.id) ?? 0,
              0,
              abwesenheiten.filter((a) => a.mitarbeiter === m.id),
              akten[i],
            ),
          ),
        );
      })
      .catch((e: unknown) => setFehler(fehlersatz(e)))
      .finally(() => setLaedt(false));
  }, [jahr, monat, stundenDienst]);

  useEffect(laden, [laden]);

  function herunterladen() {
    const blob = new Blob([alsCsv(zeilen)], { type: "text/csv;charset=utf-8" });
    const adresse = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = adresse;
    link.download = `lohnvorbereitung-${jahr}-${String(monat).padStart(2, "0")}.csv`;
    link.click();
    URL.revokeObjectURL(adresse);
  }

  const summe = zeilen.reduce(
    (s, z) => ({
      soll: s.soll + z.sollstunden,
      ist: s.ist + z.iststunden,
      mehr: s.mehr + z.mehrstunden,
    }),
    { soll: 0, ist: 0, mehr: 0 },
  );

  return (
    <article className="wb-seite">
      <header className="wb-seite__kopf">
        <h1>Lohnvorbereitung</h1>
        <button
          className="wb-button"
          type="button"
          disabled={zeilen.length === 0}
          onClick={herunterladen}
        >
          <Symbol name="beleg" groesse={18} />
          Als CSV
        </button>
      </header>

      <div className="wb-werkzeugleiste">
        <label className="wb-feld wb-feld--schmal wb-feld--inline">
          <span>Monat</span>
          <select value={monat} onChange={(e) => setMonat(Number(e.target.value))}>
            {Array.from({ length: 12 }, (_, i) => i + 1).map((m) => (
              <option key={m} value={m}>
                {monatsname(m)}
              </option>
            ))}
          </select>
        </label>
        <label className="wb-feld wb-feld--schmal wb-feld--inline">
          <span>Jahr</span>
          <select value={jahr} onChange={(e) => setJahr(Number(e.target.value))}>
            {[jetzt.getFullYear() + 1, jetzt.getFullYear(), jetzt.getFullYear() - 1].map((j) => (
              <option key={j} value={j}>
                {j}
              </option>
            ))}
          </select>
        </label>
      </div>

      {!stundenDienst && (
        <p className="wb-hinweis">
          Ohne den Baustein Zeiterfassung gibt es keine Iststunden. Die Auswertung zeigt dann nur
          Sollzeit und Abwesenheiten.
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
                <th scope="col">Mitarbeiter</th>
                <th scope="col" className="wb-zelle--rechts">Soll</th>
                <th scope="col" className="wb-zelle--rechts">Ist</th>
                <th scope="col" className="wb-zelle--rechts">Differenz</th>
                <th scope="col">Abwesend</th>
              </tr>
            </thead>
            <tbody>
              {zeilen.map((z) => (
                <tr key={z.mitarbeiter.id}>
                  <td>
                    <Link to={`/personal/${z.mitarbeiter.id}?reiter=stunden`}>
                      {z.mitarbeiter.name}
                    </Link>
                  </td>
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
                <th scope="row">Summe</th>
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
        Sollstunden aus den Wochenstunden mal Werktage, Fünftagewoche unterstellt. Feiertage sind
        nicht abgezogen — sie unterscheiden sich je Bundesland, und ein falsch geratener Feiertag
        verfälscht die Sollzeit still. Die Differenz ist keine Überstundenabrechnung.
      </p>
    </article>
  );
}

function stunden(n: number): string {
  return `${String(Math.round(n * 100) / 100).replace(".", ",")} h`;
}
