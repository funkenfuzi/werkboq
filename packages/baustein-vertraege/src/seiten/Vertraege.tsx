import { useCallback, useEffect, useMemo, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { aktuellerRechtsraum, alsEuro, darfSchreiben, fehlersatz, schreibweiseVon, Symbol } from "@werkboq/core";
import { laufzeit, RHYTHMUS_TEXT, VERTRAGSSTATUS_TEXT } from "../daten/rechnen";
import { alleVertraege, heute, type Vertrag } from "../daten/vertraege";
import { Hinweisliste } from "../komponenten/Hinweisliste";

/**
 * Verträge — oben, was ansteht, darunter die Liste.
 *
 * Dasselbe Muster wie Fuhrpark und Angebote: wer den Menüpunkt öffnet, will
 * wissen, was zu tun ist. Die Liste läuft nicht weg.
 */
export function Vertraege() {
  const navigate = useNavigate();
  const [liste, setListe] = useState<Vertrag[] | null>(null);
  const [fehler, setFehler] = useState<string | null>(null);
  const [alle, setAlle] = useState(false);
  const sw = schreibweiseVon(aktuellerRechtsraum().id);

  const laden = useCallback(() => {
    alleVertraege()
      .then(setListe)
      .catch((e: unknown) => setFehler(fehlersatz(e)));
  }, []);
  useEffect(laden, [laden]);

  const aktiv = useMemo(() => (liste ?? []).filter((v) => v.status !== "beendet"), [liste]);
  const jahreswert = useMemo(
    () =>
      aktiv
        .filter((v) => v.status === "aktiv" && v.verrechnung === "pauschale" && v.pauschale && v.rhythmus)
        .reduce((s, v) => s + (v.pauschale ?? 0) * (12 / { monat: 1, quartal: 3, halbjahr: 6, jahr: 12 }[v.rhythmus!]), 0),
    [aktiv],
  );

  if (fehler && !liste) return <p className="wb-fehler" role="alert">{fehler}</p>;
  if (!liste) return <p className="wb-leer">Wird geladen …</p>;
  const gezeigt = alle ? liste : aktiv;
  const stichtag = heute();

  return (
    <section>
      <div className="wb-kopf">
        <div>
          <h1>Verträge</h1>
          <p className="wb-kopf__zahl">
            {aktiv.length} laufend
            {jahreswert > 0 && <> · {alsEuro(jahreswert, sw)} Pauschalen im Jahr</>}
          </p>
        </div>
        {darfSchreiben("buchhaltung") && (
          <Link className="wb-button" to="/vertraege/neu">
            <Symbol name="plus" groesse={18} />
            Neuer Vertrag
          </Link>
        )}
      </div>

      <section className="wb-block">
        <h2>Was ansteht</h2>
        <Hinweisliste vertraege={aktiv} beiAenderung={laden} />
      </section>

      {liste.length === 0 ? (
        <div className="wb-nichts">
          <p>Noch kein Wartungsvertrag.</p>
          <p className="wb-leer">
            Ein Vertrag erinnert an die nächste Wartung, an fällige Pauschalen und rechtzeitig an
            die Kündigungsfrist — die drei Dinge, die sonst im Kalender einer einzigen Person
            stehen.
          </p>
        </div>
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
                  <th scope="col">Kunde</th>
                  <th scope="col">Worum</th>
                  <th scope="col">Nächste Wartung</th>
                  <th scope="col">Verrechnung</th>
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
                      <td>{v.expand?.kunde?.name ?? "—"}</td>
                      <td>{v.titel}</td>
                      <td className="wb-tabelle__kennung">
                        {v.naechsteWartung ? new Date(`${v.naechsteWartung}T00:00:00`).toLocaleDateString("de-AT") : "—"}
                        <small className="wb-zelle--gedaempft"> · alle {v.intervallMonate} Mon.</small>
                      </td>
                      <td>
                        {v.verrechnung === "pauschale"
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
