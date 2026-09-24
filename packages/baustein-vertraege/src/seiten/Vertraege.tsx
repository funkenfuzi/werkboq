import { useCallback, useEffect, useMemo, useState } from "react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import { aktuellerRechtsraum, alsEuro, darfSchreiben, fehlersatz, schreibweiseVon, Symbol } from "@werkboq/core";
import { istEigener, KATEGORIE_TEXT, laufzeit, RHYTHMUS_MONATE, RHYTHMUS_TEXT, VERTRAGSSTATUS_TEXT } from "../daten/rechnen";
import { alleVertraege, heute, partnerName, type Vertrag } from "../daten/vertraege";
import { Hinweisliste } from "../komponenten/Hinweisliste";

/**
 * Verträge — oben, was ansteht, darunter die Liste.
 *
 * Dasselbe Muster wie Fuhrpark und Angebote: wer den Menüpunkt öffnet, will
 * wissen, was zu tun ist. Die Liste läuft nicht weg.
 *
 * Zwei Reiter: Verträge mit Kunden (wir leisten, wir verrechnen) und
 * eigene Verträge mit Lieferanten (wir zahlen). Welcher offen ist, steht in
 * der Adresse — ein Lesezeichen auf die eigenen Verträge bleibt eines.
 */
export function Vertraege() {
  const navigate = useNavigate();
  const [liste, setListe] = useState<Vertrag[] | null>(null);
  const [fehler, setFehler] = useState<string | null>(null);
  const [alle, setAlle] = useState(false);
  const [parameter, setParameter] = useSearchParams();
  const eigene = parameter.get("ansicht") === "eigene";
  const sw = schreibweiseVon(aktuellerRechtsraum().id);

  const laden = useCallback(() => {
    alleVertraege()
      .then(setListe)
      .catch((e: unknown) => setFehler(fehlersatz(e)));
  }, []);
  useEffect(laden, [laden]);

  const dieser = useMemo(() => (liste ?? []).filter((v) => istEigener(v) === eigene), [liste, eigene]);
  const aktiv = useMemo(() => dieser.filter((v) => v.status !== "beendet"), [dieser]);
  const anzahl = (e: boolean) => (liste ?? []).filter((v) => istEigener(v) === e && v.status !== "beendet").length;
  // Kundenverträge: Pauschalen, die hereinkommen. Eigene: Kosten, die hinausgehen.
  const jahreswert = useMemo(
    () =>
      aktiv
        .filter((v) => v.status === "aktiv" && (eigene || v.verrechnung === "pauschale") && v.pauschale && v.rhythmus)
        .reduce((s, v) => s + (v.pauschale ?? 0) * (12 / RHYTHMUS_MONATE[v.rhythmus!]), 0),
    [aktiv, eigene],
  );

  if (fehler && !liste) return <p className="wb-fehler" role="alert">{fehler}</p>;
  if (!liste) return <p className="wb-leer">Wird geladen …</p>;
  const gezeigt = alle ? dieser : aktiv;
  const stichtag = heute();

  return (
    <section>
      <div className="wb-kopf">
        <div>
          <h1>Verträge</h1>
          <p className="wb-kopf__zahl">
            {aktiv.length} laufend
            {jahreswert > 0 && <> · {alsEuro(jahreswert, sw)} {eigene ? "Kosten" : "Pauschalen"} im Jahr</>}
          </p>
        </div>
        {darfSchreiben("buchhaltung") && (
          <Link className="wb-button" to={eigene ? "/vertraege/neu?richtung=lieferant" : "/vertraege/neu"}>
            <Symbol name="plus" groesse={18} />
            {eigene ? "Neuer eigener Vertrag" : "Neuer Vertrag"}
          </Link>
        )}
      </div>

      <nav className="wb-reiter" role="tablist">
        {([
          [false, "Mit Kunden"],
          [true, "Eigene"],
        ] as const).map(([e, titel]) => (
          <button
            key={titel}
            type="button"
            role="tab"
            aria-selected={eigene === e}
            className={`wb-reiter__knopf${eigene === e ? " ist-aktiv" : ""}`}
            onClick={() => setParameter(e ? { ansicht: "eigene" } : {}, { replace: true })}
          >
            {titel}
            {anzahl(e) > 0 && <span className="wb-zaehler">{anzahl(e)}</span>}
          </button>
        ))}
      </nav>

      <section className="wb-block">
        <h2>Was ansteht</h2>
        <Hinweisliste vertraege={aktiv} beiAenderung={laden} />
      </section>

      {dieser.length === 0 ? (
        eigene ? (
          <div className="wb-nichts">
            <p>Noch kein eigener Vertrag.</p>
            <p className="wb-leer">
              Die Feuerlöscherprüfung, das Leasing der Busse, die Betriebshaftpflicht, das
              Handy-Paket: Verträge, bei denen der Betrieb zahlt. Werkboq erinnert an den nächsten
              Prüftermin und rechtzeitig vor der Kündigungsfrist — dann, wenn sich Nachverhandeln
              noch lohnt.
            </p>
          </div>
        ) : (
          <div className="wb-nichts">
            <p>Noch kein Wartungsvertrag.</p>
            <p className="wb-leer">
              Ein Vertrag erinnert an die nächste Wartung, an fällige Pauschalen und rechtzeitig an
              die Kündigungsfrist — die drei Dinge, die sonst im Kalender einer einzigen Person
              stehen.
            </p>
          </div>
        )
      ) : (
        <>
          <div className="wb-werkzeugleiste">
            <label className="wb-schalter">
              <input type="checkbox" checked={alle} onChange={(e) => setAlle(e.target.checked)} />
              <span>Auch beendete zeigen</span>
            </label>
          </div>
          <div className="wb-tabelle-rahmen">
            <table className="wb-tabelle wb-tabelle--klickbar">
              <thead>
                <tr>
                  <th scope="col">Nummer</th>
                  <th scope="col">{eigene ? "Partner" : "Kunde"}</th>
                  <th scope="col">Worum</th>
                  <th scope="col">{eigene ? "Nächster Termin" : "Nächste Wartung"}</th>
                  <th scope="col">{eigene ? "Kosten" : "Verrechnung"}</th>
                  <th scope="col">Läuft bis</th>
                  <th scope="col">Status</th>
                </tr>
              </thead>
              <tbody>
                {gezeigt.map((v) => {
                  const l = laufzeit(v, stichtag);
                  return (
                    <tr key={v.id} tabIndex={0} onClick={() => navigate(`/vertraege/${v.id}`)} onKeyDown={(e) => e.key === "Enter" && navigate(`/vertraege/${v.id}`)}>
                      <td className="wb-tabelle__kennung">{v.nummer}</td>
                      <td>{partnerName(v)}</td>
                      <td>
                        {v.titel}
                        {eigene && v.kategorie && <small className="wb-zelle--gedaempft"> · {KATEGORIE_TEXT[v.kategorie]}</small>}
                      </td>
                      <td className="wb-tabelle__kennung">
                        {v.naechsteWartung ? new Date(`${v.naechsteWartung}T00:00:00`).toLocaleDateString("de-AT") : "—"}
                        {v.intervallMonate ? <small className="wb-zelle--gedaempft"> · alle {v.intervallMonate} Mon.</small> : null}
                      </td>
                      <td>
                        {eigene
                          ? v.pauschale
                            ? `${alsEuro(v.pauschale, sw)} ${RHYTHMUS_TEXT[v.rhythmus ?? "jahr"]}`
                            : "—"
                          : v.verrechnung === "pauschale"
                            ? `${alsEuro(v.pauschale ?? 0, sw)} ${RHYTHMUS_TEXT[v.rhythmus ?? "jahr"]}`
                            : "nach Aufwand"}
                      </td>
                      <td className="wb-tabelle__kennung">
                        {l.ende ? new Date(`${l.ende}T00:00:00`).toLocaleDateString("de-AT") : "unbefristet"}
                        {l.verlaengertSich && v.status === "aktiv" && <small className="wb-zelle--gedaempft"> · verlängert sich</small>}
                      </td>
                      <td>
                        <span className={`wb-plakette wb-plakette--${v.status === "aktiv" ? "ok" : v.status === "gekuendigt" ? "warn" : "neutral"}`}>
                          {VERTRAGSSTATUS_TEXT[v.status]}
                        </span>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </>
      )}
    </section>
  );
}
