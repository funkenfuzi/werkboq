import { useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import {
  alsEuro,
  alsGeld,
  alsMenge,
  betriebLaden,
  fehlersatz,
  type Betrieb,
} from "@werkboq/core";
import {
  BELEGART_TEXT,
  belegLaden,
  belegpositionen,
  faelligAm,
  KLEINBETRAG_GRENZE,
  STEUERFREI_HINWEIS,
  type Beleg,
  type Belegposition,
} from "../daten/belege";
import { skontoBis, skontobetrag } from "../daten/zahlungen";

/**
 * Druckansicht eines Belegs.
 *
 * Bewusst eine Seite im Browser mit Druckstil statt einer PDF-Bibliothek:
 * jeder Rechner kann aus dem Druckdialog ein PDF machen, es kommen keine
 * zwei Megabyte Schriften ins Bündel, und die Ansicht sieht aus wie das,
 * was hinterher aus dem Drucker kommt.
 *
 * Aufbewahrung: die Daten stehen in der Datenbank und sind ab dem
 * Festschreiben unveränderlich — das ist das, was § 132 BAO sieben Jahre
 * lang verlangt. Das PDF ist eine Darstellung davon, nicht das Original.
 */
export function BelegDruck() {
  const { id } = useParams<{ id: string }>();
  const [beleg, setBeleg] = useState<Beleg | null>(null);
  const [zeilen, setZeilen] = useState<Belegposition[]>([]);
  const [betrieb, setBetrieb] = useState<Betrieb | null>(null);
  const [fehler, setFehler] = useState<string | null>(null);

  useEffect(() => {
    if (!id) return;
    belegLaden(id)
      .then(async (b) => {
        setBeleg(b);
        setZeilen(await belegpositionen(b.id));
        setBetrieb(await betriebLaden().catch(() => null));
      })
      .catch((e: unknown) => setFehler(fehlersatz(e)));
  }, [id]);

  if (fehler) return <p className="wb-fehler">{fehler}</p>;
  if (!beleg) return <p className="wb-leer">Wird geladen …</p>;

  const d = (t?: string) => (t ? new Date(t).toLocaleDateString("de-AT") : "");
  const klein = beleg.brutto <= KLEINBETRAG_GRENZE && beleg.steuerfrei === "keiner";
  const skonto = skontobetrag(beleg);

  return (
    <>
      <div className="wb-drucksteuerung">
        <Link className="wb-button wb-button--sekundaer" to={`/belege/${beleg.id}`}>
          Zurück
        </Link>
        <button className="wb-button" type="button" onClick={() => window.print()}>
          Drucken
        </button>
        {!beleg.festgeschrieben && (
          <span className="wb-plakette">Entwurf — noch nicht festgeschrieben</span>
        )}
      </div>

      <article className="wb-druckseite">
        <header className="wb-druck__kopf">
          <div className="wb-druck__absender">
            <strong>{betrieb?.name}</strong>
            {betrieb?.strasse && <span>{betrieb.strasse}</span>}
            <span>{[betrieb?.plz, betrieb?.ort].filter(Boolean).join(" ")}</span>
            {betrieb?.telefon && <span>Tel. {betrieb.telefon}</span>}
            {betrieb?.email && <span>{betrieb.email}</span>}
          </div>
        </header>

        <div className="wb-druck__anschrift">
          <p className="wb-druck__ruecksender">
            {[betrieb?.name, betrieb?.strasse, [betrieb?.plz, betrieb?.ort].filter(Boolean).join(" ")]
              .filter(Boolean)
              .join(" · ")}
          </p>
          <p className="wb-druck__empfaenger">
            {beleg.empfaengerName}
            {beleg.empfaengerAnschrift &&
              beleg.empfaengerAnschrift.split("\n").map((z) => <span key={z}>{z}</span>)}
          </p>
        </div>

        <div className="wb-druck__titelzeile">
          <h1>
            {BELEGART_TEXT[beleg.belegart]} {klein && beleg.belegart === "rechnung" ? "" : beleg.nummer}
          </h1>
          <dl className="wb-druck__eckdaten">
            <div>
              <dt>Datum</dt>
              <dd>{d(beleg.datum)}</dd>
            </div>
            {beleg.leistungVon && (
              <div>
                <dt>Leistungszeitraum</dt>
                <dd>
                  {d(beleg.leistungVon)}
                  {beleg.leistungBis && beleg.leistungBis !== beleg.leistungVon
                    ? ` – ${d(beleg.leistungBis)}`
                    : ""}
                </dd>
              </div>
            )}
            {betrieb?.uid && (
              <div>
                <dt>UID</dt>
                <dd>{betrieb.uid}</dd>
              </div>
            )}
            {beleg.empfaengerUid && (
              <div>
                <dt>UID Empfänger</dt>
                <dd>{beleg.empfaengerUid}</dd>
              </div>
            )}
          </dl>
        </div>

        {beleg.kopftext && <p className="wb-druck__text">{beleg.kopftext}</p>}

        <table className="wb-druck__tabelle">
          <thead>
            <tr>
              <th>Pos</th>
              <th>Bezeichnung</th>
              <th className="r">Menge</th>
              <th>Einheit</th>
              <th className="r">Einzelpreis</th>
              {beleg.steuerfrei === "keiner" && <th className="r">USt</th>}
              <th className="r">Betrag</th>
            </tr>
          </thead>
          <tbody>
            {zeilen.map((z) => (
              <tr key={z.id}>
                <td>{z.pos}</td>
                <td>
                  {z.bezeichnung}
                  {z.beschreibung && <small>{z.beschreibung}</small>}
                </td>
                <td className="r">{alsMenge(z.menge)}</td>
                <td>{z.einheit}</td>
                <td className="r">{alsGeld(z.einzelpreis)}</td>
                {beleg.steuerfrei === "keiner" && <td className="r">{z.ustsatz} %</td>}
                <td className="r">{alsGeld(z.betrag)}</td>
              </tr>
            ))}
          </tbody>
        </table>

        <dl className="wb-druck__summen">
          {Object.entries(beleg.nettoJeSatz ?? {})
            .sort((a, b) => Number(b[0]) - Number(a[0]))
            .map(([satz, betrag]) => (
              <div key={satz}>
                <dt>Nettobetrag {beleg.steuerfrei === "keiner" ? `${satz} %` : ""}</dt>
                <dd>{alsEuro(betrag)}</dd>
              </div>
            ))}
          {beleg.steuerfrei === "keiner" && (
            <div>
              <dt>Umsatzsteuer</dt>
              <dd>{alsEuro(beleg.ust)}</dd>
            </div>
          )}
          <div className="gesamt">
            <dt>Gesamtbetrag</dt>
            <dd>{alsEuro(beleg.brutto)}</dd>
          </div>
        </dl>

        {beleg.steuerfrei !== "keiner" && (
          <p className="wb-druck__pflichthinweis">{STEUERFREI_HINWEIS[beleg.steuerfrei]}</p>
        )}

        {beleg.belegart === "rechnung" && (
          <p className="wb-druck__text">
            Zahlbar ohne Abzug bis {d(faelligAm(beleg))}.
            {skonto > 0 && skontoBis(beleg) && (
              <>
                {" "}
                Bei Zahlung bis {d(skontoBis(beleg)!)} gewähren wir {beleg.skontoProzent} % Skonto
                ({alsEuro(beleg.brutto - skonto)}).
              </>
            )}
            {betrieb?.iban && (
              <>
                {" "}
                Bitte auf {betrieb.iban}
                {betrieb.bank ? ` bei der ${betrieb.bank}` : ""} unter Angabe von{" "}
                {beleg.nummer} überweisen.
              </>
            )}
          </p>
        )}

        {beleg.fusstext && <p className="wb-druck__text">{beleg.fusstext}</p>}

        <footer className="wb-druck__fuss">
          {[
            [betrieb?.name, betrieb?.inhaber],
            [
              betrieb?.firmenbuch && `FN ${betrieb.firmenbuch}`,
              betrieb?.gericht,
              betrieb?.uid && `UID ${betrieb.uid}`,
            ],
            [betrieb?.iban && `IBAN ${betrieb.iban}`, betrieb?.bic && `BIC ${betrieb.bic}`],
          ]
            // Leere Angaben ganz weglassen, sonst stehen im Fuß einzelne
            // Trennpunkte ohne Inhalt davor.
            .map((teile) => teile.filter(Boolean).join(" · "))
            .filter((zeile) => zeile !== "")
            .map((zeile) => <span key={zeile}>{zeile}</span>)}
        </footer>
      </article>
    </>
  );
}
