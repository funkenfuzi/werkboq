import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { darf, darfSchreiben, type ErweiterungsProps } from "@werkboq/core";
import { laufzeit, VERTRAGSSTATUS_TEXT } from "../daten/rechnen";
import { heute, vertraegeZuKunde, type Vertrag } from "../daten/vertraege";

/** Die Verträge eines Kunden, in seiner Übersicht. */
export function KundeVertraege({ datensatzId }: ErweiterungsProps) {
  const [liste, setListe] = useState<Vertrag[] | null>(null);
  const sichtbar = darf("buchhaltung");
  useEffect(() => {
    if (!datensatzId || !sichtbar) return;
    vertraegeZuKunde(datensatzId).then(setListe).catch(() => setListe([]));
  }, [datensatzId, sichtbar]);

  if (!sichtbar || !datensatzId || liste === null) return null;
  if (!liste.length && !darfSchreiben("buchhaltung")) return null;

  return (
    <section className="wb-block">
      <div className="wb-block__kopf">
        <h2>Wartungsverträge</h2>
        {darfSchreiben("buchhaltung") && (
          <Link className="wb-button wb-button--sekundaer wb-button--klein" to={`/vertraege/neu?kunde=${datensatzId}`}>
            Neuer Vertrag
          </Link>
        )}
      </div>
      {liste.length === 0 ? (
        <p className="wb-leer">Kein Wartungsvertrag.</p>
      ) : (
        <ul className="wb-fristenliste">
          {liste.map((v) => {
            const l = laufzeit(v, heute());
            return (
              <li key={v.id}>
                <span className={`wb-plakette wb-plakette--${v.status === "aktiv" ? "ok" : v.status === "gekuendigt" ? "warn" : "neutral"}`}>
                  {VERTRAGSSTATUS_TEXT[v.status]}
                </span>
                <Link className="wb-fristenliste__was" to={`/vertraege/${v.id}`}>
                  <strong>{v.nummer}</strong>
                  <span>{v.titel}</span>
                </Link>
                <span className="wb-fristenliste__wann">
                  {v.naechsteWartung ? `Wartung ${new Date(`${v.naechsteWartung}T00:00:00`).toLocaleDateString("de-AT")}` : ""}
                  {l.ende ? ` · bis ${new Date(`${l.ende}T00:00:00`).toLocaleDateString("de-AT")}` : ""}
                </span>
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}
