import { useCallback, useEffect, useState } from "react";
import { Symbol } from "./Symbol";
import { fehlersatz } from "../werkzeug/fehler";
import {
  landesvorwahl,
  mailAdresse,
  VERSANDWEG_TEXT,
  versandBestaetigen,
  versandFesthalten,
  versandZuDatensatz,
  waNummer,
  whatsappAdresse,
  type Versandweg,
  type Versandzeile,
} from "../daten/versand";

export interface Versandvorlage {
  /** Collection, zu der der Datensatz gehört — für den Verlauf. */
  bereich: string;
  datensatz: string;
  /** "Rechnung RE-2026-0001" — steht so im Nachweis. */
  bezeichnung: string;
  betreff: string;
  nachricht: string;
  empfaengerMail?: string;
  empfaengerTelefon?: string;
  /** Land des Betriebs, für die Ländervorwahl bei WhatsApp. */
  rechtsraum?: string;
}

/**
 * Ein Dokument hinausschicken und festhalten, dass es geschehen ist.
 *
 * WERKBOQ VERSCHICKT NICHTS SELBST, und der Kasten sagt das auch.
 *
 * Es öffnet das Mailprogramm oder WhatsApp mit fertigem Text. Ein Anhang
 * lässt sich dabei nicht mitgeben — weder über `mailto:` noch über einen
 * `wa.me`-Link, das erlauben beide Standards nicht. Also: Text vorbereiten,
 * PDF aus der Druckansicht anhängen, senden.
 *
 * Danach fragt Werkboq nach, ob wirklich abgeschickt wurde. Es kann es
 * nicht wissen, und ein Nachweis, der bloß sagt "wir haben ein Fenster
 * geöffnet", wäre eine Lüge mit Zeitstempel.
 */
export function Versandblock({
  vorlage,
  beiDrucken,
}: {
  vorlage: Versandvorlage;
  /** Öffnet die Druckansicht — der Weg zum PDF. */
  beiDrucken?: () => void;
}) {
  const [zeilen, setZeilen] = useState<Versandzeile[]>([]);
  const [offen, setOffen] = useState(false);
  const [laedt, setLaedt] = useState(true);
  const [fehler, setFehler] = useState<string | null>(null);

  const laden = useCallback(() => {
    setLaedt(true);
    versandZuDatensatz(vorlage.datensatz)
      .then(setZeilen)
      .catch((e: unknown) => setFehler(fehlersatz(e)))
      .finally(() => setLaedt(false));
  }, [vorlage.datensatz]);

  useEffect(laden, [laden]);

  const bestaetigt = zeilen.filter((z) => z.bestaetigt);
  const offeneFragen = zeilen.filter((z) => !z.bestaetigt && !z.nichtErfolgt && z.weg !== "druck");

  return (
    <section className="wb-block">
      <div className="wb-block__kopf">
        <h2>Versand</h2>
        {bestaetigt.length > 0 && (
          <span className="wb-block__summe">
            zuletzt {new Date(bestaetigt[0]!.created).toLocaleDateString("de-AT")}
          </span>
        )}
        {!offen && (
          <button className="wb-button" type="button" onClick={() => setOffen(true)}>
            <Symbol name="mail" groesse={18} />
            Senden
          </button>
        )}
      </div>

      {fehler && (
        <p className="wb-fehler" role="alert">
          {fehler}
        </p>
      )}

      {offen && (
        <Versandmaske
          vorlage={vorlage}
          beiDrucken={beiDrucken}
          beiFertig={() => {
            setOffen(false);
            laden();
          }}
          beiAbbruch={() => setOffen(false)}
          beiFehler={setFehler}
        />
      )}

      {offeneFragen.length > 0 && (
        <div className="wb-warnkasten">
          <Symbol name="warnung" groesse={18} />
          <div>
            <strong>Ist das wirklich hinausgegangen?</strong>
            <ul className="wb-mangelliste">
              {offeneFragen.map((z) => (
                <li key={z.id}>
                  {VERSANDWEG_TEXT[z.weg]} an {z.empfaenger || "unbekannt"},{" "}
                  {new Date(z.created).toLocaleString("de-AT", {
                    day: "numeric",
                    month: "numeric",
                    year: "numeric",
                    hour: "2-digit",
                    minute: "2-digit",
                  })}
                  <span className="wb-aktionen wb-aktionen--eng">
                    <button
                      type="button"
                      className="wb-button wb-button--klein"
                      onClick={() =>
                        void versandBestaetigen(z, true)
                          .then(laden)
                          .catch((e: unknown) => setFehler(fehlersatz(e)))
                      }
                    >
                      Ja, abgeschickt
                    </button>
                    <button
                      type="button"
                      className="wb-button wb-button--sekundaer wb-button--klein"
                      onClick={() =>
                        void versandBestaetigen(z, false)
                          .then(laden)
                          .catch((e: unknown) => setFehler(fehlersatz(e)))
                      }
                    >
                      Nein
                    </button>
                  </span>
                </li>
              ))}
            </ul>
          </div>
        </div>
      )}

      {laedt && zeilen.length === 0 && <p className="wb-leer">Wird geladen …</p>}

      {!laedt && zeilen.length === 0 && !offen && (
        <p className="wb-leer">Noch nicht versendet.</p>
      )}

      {bestaetigt.length > 0 && (
        <ul className="wb-versandliste">
          {bestaetigt.map((z) => (
            <li key={z.id}>
              <Symbol name={z.weg === "whatsapp" ? "telefon" : z.weg === "mail" ? "mail" : "beleg"} groesse={16} />
              <span>
                {VERSANDWEG_TEXT[z.weg]}
                {z.empfaenger ? ` an ${z.empfaenger}` : ""}
                <small>
                  {new Date(z.created).toLocaleString("de-AT", {
                    day: "numeric",
                    month: "numeric",
                    year: "numeric",
                    hour: "2-digit",
                    minute: "2-digit",
                  })}
                  {z.benutzername ? ` · ${z.benutzername}` : ""}
                </small>
              </span>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

function Versandmaske({
  vorlage,
  beiDrucken,
  beiFertig,
  beiAbbruch,
  beiFehler,
}: {
  vorlage: Versandvorlage;
  beiDrucken?: () => void;
  beiFertig: () => void;
  beiAbbruch: () => void;
  beiFehler: (f: string) => void;
}) {
  const [mail, setMail] = useState(vorlage.empfaengerMail ?? "");
  const [telefon, setTelefon] = useState(vorlage.empfaengerTelefon ?? "");
  const [betreff, setBetreff] = useState(vorlage.betreff);
  const [text, setText] = useState(vorlage.nachricht);
  const [laeuft, setLaeuft] = useState(false);

  const vorwahl = landesvorwahl(vorlage.rechtsraum);
  const nummer = telefon.trim() ? waNummer(telefon, vorwahl) : null;

  async function festhalten(weg: Versandweg, adresse?: string, empfaenger?: string) {
    setLaeuft(true);
    try {
      await versandFesthalten(vorlage.bereich, vorlage.datensatz, vorlage.bezeichnung, weg, {
        empfaenger,
        betreff,
        nachricht: text,
      });
      if (adresse) window.open(adresse, weg === "mail" ? "_self" : "_blank");
      beiFertig();
    } catch (e: unknown) {
      beiFehler(fehlersatz(e));
    } finally {
      setLaeuft(false);
    }
  }

  return (
    <div className="wb-maske">
      <p className="wb-hinweis wb-feld--breit">
        Werkboq öffnet dein Mailprogramm oder WhatsApp mit fertigem Text.{" "}
        <strong>Die Datei musst du selbst anhängen</strong> — weder ein Mail-Link noch ein
        WhatsApp-Link kann einen Anhang mitgeben, das erlauben beide Standards nicht. Das PDF
        holst du aus der Druckansicht.
      </p>

      <label className="wb-feld wb-feld--breit">
        <span>Betreff</span>
        <input type="text" value={betreff} onChange={(e) => setBetreff(e.target.value)} />
      </label>

      <label className="wb-feld wb-feld--breit">
        <span>Nachricht</span>
        <textarea rows={6} value={text} onChange={(e) => setText(e.target.value)} />
      </label>

      <label className="wb-feld">
        <span>E-Mail</span>
        <input
          type="email"
          value={mail}
          onChange={(e) => setMail(e.target.value)}
          placeholder="kunde@example.at"
        />
      </label>

      <label className="wb-feld">
        <span>Mobilnummer für WhatsApp</span>
        <input
          type="tel"
          value={telefon}
          onChange={(e) => setTelefon(e.target.value)}
          placeholder="0664 1234567"
        />
        <small className={telefon.trim() && !nummer ? "wb-fehler" : "wb-notiz"}>
          {telefon.trim() && !nummer
            ? "Das ist keine brauchbare Nummer."
            : nummer
              ? `Wird gewählt als +${nummer}`
              : `Führende Null wird durch +${vorwahl} ersetzt.`}
        </small>
      </label>

      <div className="wb-aktionen wb-feld--breit">
        <button
          className="wb-button"
          type="button"
          disabled={laeuft || !mail.trim()}
          onClick={() =>
            void festhalten("mail", mailAdresse(mail, betreff, text), mail.trim())
          }
        >
          <Symbol name="mail" groesse={18} />
          Mailprogramm öffnen
        </button>

        <button
          className="wb-button"
          type="button"
          disabled={laeuft || !nummer}
          onClick={() => {
            const adresse = whatsappAdresse(telefon, `${betreff}\n\n${text}`, vorwahl);
            if (adresse) void festhalten("whatsapp", adresse, `+${nummer}`);
          }}
        >
          <Symbol name="telefon" groesse={18} />
          WhatsApp öffnen
        </button>

        {beiDrucken && (
          <button
            className="wb-button wb-button--sekundaer"
            type="button"
            disabled={laeuft}
            onClick={() => {
              void festhalten("druck");
              beiDrucken();
            }}
          >
            <Symbol name="beleg" groesse={18} />
            Drucken oder als PDF
          </button>
        )}

        <button
          className="wb-button wb-button--sekundaer"
          type="button"
          disabled={laeuft}
          onClick={() => void festhalten("uebergabe", undefined, "persönlich")}
        >
          Persönlich übergeben
        </button>

        <button className="wb-button wb-button--sekundaer" type="button" onClick={beiAbbruch}>
          Abbrechen
        </button>
      </div>
    </div>
  );
}
