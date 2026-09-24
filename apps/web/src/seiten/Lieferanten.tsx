import { useEffect, useMemo, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import {
  alleLieferanten,
  darfLieferantenAendern,
  fehlersatz,
  LIEFERANTENART_TEXT,
  Symbol,
  type Lieferant,
} from "@werkboq/core";

/**
 * Lieferanten und Dienstleister — bei wem der Betrieb kauft und wer für ihn
 * arbeitet. Gefiltert wird im Browser: ein Elektrobetrieb hat Dutzende
 * Lieferanten, nicht Tausende.
 */
export function Lieferanten() {
  const navigate = useNavigate();
  const [liste, setListe] = useState<Lieferant[] | null>(null);
  const [suche, setSuche] = useState("");
  const [alle, setAlle] = useState(false);
  const [fehler, setFehler] = useState<string | null>(null);

  useEffect(() => {
    alleLieferanten()
      .then(setListe)
      .catch((e: unknown) => setFehler(fehlersatz(e)));
  }, []);

  const gezeigt = useMemo(() => {
    const s = suche.trim().toLocaleLowerCase("de-AT");
    return (liste ?? [])
      .filter((l) => alle || l.aktiv !== false)
      .filter((l) => !s || [l.name, l.ort, l.kundennummer, l.ansprechpartner].some((x) => x?.toLocaleLowerCase("de-AT").includes(s)));
  }, [liste, suche, alle]);

  if (fehler && !liste) return <p className="wb-fehler" role="alert">{fehler}</p>;
  if (!liste) return <p className="wb-leer">Wird geladen …</p>;

  return (
    <section>
      <div className="wb-kopf">
        <div>
          <h1>Lieferanten</h1>
          <p className="wb-kopf__zahl">{liste.filter((l) => l.aktiv !== false).length} aktiv</p>
        </div>
        {darfLieferantenAendern() && (
          <Link className="wb-button" to="/lieferanten/neu">
            <Symbol name="plus" groesse={18} />
            Neuer Lieferant
          </Link>
        )}
      </div>

      {liste.length === 0 ? (
        <div className="wb-nichts">
          <p>Noch kein Lieferant erfasst.</p>
          <p className="wb-leer">
            Großhandel, Hersteller, aber auch die Firma, die die Feuerlöscher prüft, oder der
            Leasinggeber der Busse — wer hier steht, kann eigene Verträge mit Fristen bekommen.
          </p>
        </div>
      ) : (
        <>
          <div className="wb-werkzeugleiste">
            <div className="wb-suchfeld">
              <Symbol name="suche" groesse={18} />
              <input
                type="search"
                placeholder="Nach Name, Ort oder Kundennummer filtern"
                value={suche}
                onChange={(e) => setSuche(e.target.value)}
                autoCapitalize="none"
              />
            </div>
            <label className="wb-schalter">
              <input type="checkbox" checked={alle} onChange={(e) => setAlle(e.target.checked)} />
              <span>Auch inaktive</span>
            </label>
          </div>
          <div className="wb-tabelle-rahmen">
            <table className="wb-tabelle wb-tabelle--klickbar">
              <thead>
                <tr>
                  <th scope="col">Name</th>
                  <th scope="col">Art</th>
                  <th scope="col">Ort</th>
                  <th scope="col">Telefon</th>
                  <th scope="col">Unsere Kundennr.</th>
                </tr>
              </thead>
              <tbody>
                {gezeigt.map((l) => (
                  <tr
                    key={l.id}
                    tabIndex={0}
                    onClick={() => navigate(`/lieferanten/${l.id}`)}
                    onKeyDown={(e) => e.key === "Enter" && navigate(`/lieferanten/${l.id}`)}
                  >
                    <td>
                      {l.name}
                      {l.aktiv === false && <span className="wb-plakette wb-plakette--neutral">inaktiv</span>}
                    </td>
                    <td>{l.art ? LIEFERANTENART_TEXT[l.art] : "—"}</td>
                    <td>{l.ort || "—"}</td>
                    <td>{l.telefon || "—"}</td>
                    <td className="wb-tabelle__kennung">{l.kundennummer || "—"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}
    </section>
  );
}
