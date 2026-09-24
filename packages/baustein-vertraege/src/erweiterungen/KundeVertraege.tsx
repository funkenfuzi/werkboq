import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { darf, darfSchreiben, type ErweiterungsProps } from "@werkboq/core";
import { istEigener, laufzeit, VERTRAGSSTATUS_TEXT } from "../daten/rechnen";
import { heute, vertraegeZuKunde, vertraegeZuLieferant, type Vertrag } from "../daten/vertraege";

/** Die Verträge eines Kunden, in seiner Übersicht. */
export function KundeVertraege({ datensatzId }: ErweiterungsProps) {
  return (
    <Vertragsblock
      id={datensatzId}
      laden={vertraegeZuKunde}
      titel="Wartungsverträge"
      leer="Kein Wartungsvertrag."
      neu={`/vertraege/neu?kunde=${datensatzId}`}
    />
  );
}

/** Die eigenen Verträge mit einem Lieferanten, in seiner Akte. */
export function LieferantVertraege({ datensatzId }: ErweiterungsProps) {
  return (
    <Vertragsblock
      id={datensatzId}
      laden={vertraegeZuLieferant}
      titel="Verträge"
      leer="Kein Vertrag mit diesem Lieferanten."
      neu={`/vertraege/neu?lieferant=${datensatzId}`}
    />
  );
}

function Vertragsblock({
  id,
  laden,
  titel,
  leer,
  neu,
}: {
  id?: string;
  laden: (id: string) => Promise<Vertrag[]>;
  titel: string;
  leer: string;
  neu: string;
}) {
  const [liste, setListe] = useState<Vertrag[] | null>(null);
  const sichtbar = darf("buchhaltung");
  useEffect(() => {
    if (!id || !sichtbar) return;
    laden(id).then(setListe).catch(() => setListe([]));
  }, [id, sichtbar, laden]);

  if (!sichtbar || !id || liste === null) return null;
  if (!liste.length && !darfSchreiben("buchhaltung")) return null;
  const tag = (t: string) => new Date(`${t}T00:00:00`).toLocaleDateString("de-AT");

  return (
    <section className="wb-block">
      <div className="wb-block__kopf">
        <h2>{titel}</h2>
        {darfSchreiben("buchhaltung") && (
          <Link className="wb-button wb-button--sekundaer wb-button--klein" to={neu}>
            Neuer Vertrag
          </Link>
        )}
      </div>
      {liste.length === 0 ? (
        <p className="wb-leer">{leer}</p>
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
                  {[
                    v.naechsteWartung ? `${istEigener(v) ? "Termin" : "Wartung"} ${tag(v.naechsteWartung)}` : "",
                    l.ende ? `bis ${tag(l.ende)}` : "",
                    l.letzterKuendigungstag && l.verlaengertSich && v.status === "aktiv" ? `kündbar bis ${tag(l.letzterKuendigungstag)}` : "",
                  ]
                    .filter(Boolean)
                    .join(" · ")}
                </span>
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}
