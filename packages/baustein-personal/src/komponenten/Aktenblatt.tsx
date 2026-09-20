import { useEffect, useState, type FormEvent } from "react";
import {
  aktuellerRechtsraum,
  alsEingabe,
  alsEuro,
  ausGeld,
  fehlersatz,
  schreibweiseVon,
  type Mitarbeiter,
} from "@werkboq/core";
import {
  BESCHAEFTIGUNG_TEXT,
  BESCHAEFTIGUNGSARTEN,
  dienstjahre,
  LEERE_PERSONALDATEN,
  LOHNART_TEXT,
  personaldatenLaden,
  personaldatenSpeichern,
  svnrPlausibel,
  type Beschaeftigungsart,
  type Lohnart,
  type Personaldaten,
  type PersonaldatenEingabe,
} from "../daten/personaldaten";

/**
 * Die eigentliche Personalakte.
 *
 * Hier stehen die Angaben, die nur das Personalwesen und der Betroffene
 * selbst sehen dürfen — Geburtsdatum, Sozialversicherungsnummer, Lohn. Die
 * Regel dafür steht in PocketBase, nicht hier; was diese Maske ausblendet,
 * wäre sonst über die API trotzdem zu holen.
 *
 * Die Akte entsteht erst beim ersten Speichern. Ein leerer Datensatz je
 * Mitarbeiter wäre Ballast und würde vortäuschen, es gäbe schon etwas.
 */
export function Aktenblatt({
  mitarbeiter,
  darfAendern,
}: {
  mitarbeiter: Mitarbeiter;
  darfAendern: boolean;
}) {
  const [vorhanden, setVorhanden] = useState<Personaldaten | null>(null);
  const [werte, setWerte] = useState<Omit<PersonaldatenEingabe, "mitarbeiter">>(
    LEERE_PERSONALDATEN,
  );
  const [lohnText, setLohnText] = useState("0,00");
  const [laedt, setLaedt] = useState(true);
  const [laeuft, setLaeuft] = useState(false);
  const [fehler, setFehler] = useState<string | null>(null);
  const [hinweis, setHinweis] = useState<string | null>(null);

  const sw = schreibweiseVon(aktuellerRechtsraum().id);

  useEffect(() => {
    let weg = false;
    setLaedt(true);
    personaldatenLaden(mitarbeiter.id)
      .then((d) => {
        if (weg) return;
        setVorhanden(d);
        if (d) {
          setWerte({ ...LEERE_PERSONALDATEN, ...d });
          setLohnText(alsEingabe(d.lohn ?? 0, sw));
        }
      })
      .catch((e: unknown) => !weg && setFehler(fehlersatz(e)))
      .finally(() => !weg && setLaedt(false));
    return () => {
      weg = true;
    };
  }, [mitarbeiter.id, sw]);

  function feld<K extends keyof typeof werte>(name: K, wert: (typeof werte)[K]) {
    setWerte((v) => ({ ...v, [name]: wert }));
  }

  async function speichern(e: FormEvent) {
    e.preventDefault();
    const lohn = ausGeld(lohnText);
    if (Number.isNaN(lohn)) {
      setFehler("Der Lohn ist keine Zahl.");
      return;
    }
    setLaeuft(true);
    try {
      const gespeichert = await personaldatenSpeichern(
        mitarbeiter.id,
        { ...werte, lohn },
        vorhanden,
      );
      setVorhanden(gespeichert);
      setFehler(null);
      setHinweis("Gespeichert.");
    } catch (e: unknown) {
      setFehler(fehlersatz(e));
      setHinweis(null);
    } finally {
      setLaeuft(false);
    }
  }

  if (laedt) return <p className="wb-leer">Wird geladen …</p>;

  const jahre = dienstjahre(werte.eintritt);
  const svnrOk = svnrPlausibel(werte.svnr ?? "");

  if (!darfAendern) {
    return (
      <section className="wb-block">
        <h2>Personalakte</h2>
        {!vorhanden ? (
          <p className="wb-leer">Für {mitarbeiter.name} ist noch keine Akte angelegt.</p>
        ) : (
          <dl className="wb-daten">
            <Fakt begriff="Geburtsdatum" wert={datum(werte.geburtsdatum)} />
            <Fakt begriff="Anschrift" wert={anschrift(werte)} />
            <Fakt begriff="Eintritt" wert={datum(werte.eintritt)} />
            <Fakt begriff="Austritt" wert={datum(werte.austritt)} />
            <Fakt
              begriff="Beschäftigung"
              wert={werte.beschaeftigung ? BESCHAEFTIGUNG_TEXT[werte.beschaeftigung] : undefined}
            />
            <Fakt begriff="Kollektivvertrag" wert={werte.kollektivvertrag} />
            <Fakt
              begriff="Urlaubsanspruch"
              wert={werte.urlaubsanspruch ? `${werte.urlaubsanspruch} Werktage` : undefined}
            />
          </dl>
        )}
        <p className="wb-leer wb-notiz">
          Nur Leserecht. Lohn und Sozialversicherungsnummer erscheinen hier nicht.
        </p>
      </section>
    );
  }

  return (
    <section className="wb-block">
      <div className="wb-block__kopf">
        <h2>Personalakte</h2>
        {jahre !== null && (
          <span className="wb-block__summe">
            {jahre} {jahre === 1 ? "Dienstjahr" : "Dienstjahre"}
          </span>
        )}
      </div>

      {!vorhanden && (
        <p className="wb-leer wb-notiz">
          Für {mitarbeiter.name} gibt es noch keine Akte. Sie entsteht beim ersten Speichern.
        </p>
      )}

      <form className="wb-maske" onSubmit={speichern}>
        <h3 className="wb-maske__abschnitt">Person</h3>

        <label className="wb-feld wb-feld--schmal">
          <span>Geburtsdatum</span>
          <input
            type="date"
            value={(werte.geburtsdatum ?? "").slice(0, 10)}
            onChange={(e) => feld("geburtsdatum", e.target.value)}
          />
        </label>

        <label className="wb-feld">
          <span>Geburtsort</span>
          <input
            type="text"
            value={werte.geburtsort ?? ""}
            onChange={(e) => feld("geburtsort", e.target.value)}
          />
        </label>

        <label className="wb-feld wb-feld--schmal">
          <span>Sozialversicherungsnummer</span>
          <input
            type="text"
            inputMode="numeric"
            maxLength={12}
            placeholder="1234010180"
            value={werte.svnr ?? ""}
            onChange={(e) => feld("svnr", e.target.value)}
            aria-invalid={!svnrOk}
          />
          <small className={svnrOk ? "wb-notiz" : "wb-fehler"}>
            {svnrOk
              ? "Zehn Ziffern: laufende Nummer, Prüfziffer, Geburtsdatum."
              : "Die Prüfziffer passt nicht — meist ein Zahlendreher."}
          </small>
        </label>

        <label className="wb-feld">
          <span>Staatsbürgerschaft</span>
          <input
            type="text"
            value={werte.staatsbuergerschaft ?? ""}
            onChange={(e) => feld("staatsbuergerschaft", e.target.value)}
          />
        </label>

        <label className="wb-feld wb-feld--breit">
          <span>Anschrift</span>
          <input
            type="text"
            value={werte.anschrift ?? ""}
            onChange={(e) => feld("anschrift", e.target.value)}
          />
        </label>

        <label className="wb-feld wb-feld--schmal">
          <span>PLZ</span>
          <input type="text" value={werte.plz ?? ""} onChange={(e) => feld("plz", e.target.value)} />
        </label>

        <label className="wb-feld">
          <span>Ort</span>
          <input type="text" value={werte.ort ?? ""} onChange={(e) => feld("ort", e.target.value)} />
        </label>

        <label className="wb-feld wb-feld--breit">
          <span>IBAN für die Lohnzahlung</span>
          <input
            type="text"
            value={werte.iban ?? ""}
            onChange={(e) => feld("iban", e.target.value)}
          />
        </label>

        <label className="wb-feld">
          <span>Im Notfall verständigen</span>
          <input
            type="text"
            value={werte.notfallkontakt ?? ""}
            onChange={(e) => feld("notfallkontakt", e.target.value)}
          />
        </label>

        <label className="wb-feld">
          <span>Telefon im Notfall</span>
          <input
            type="tel"
            value={werte.notfalltelefon ?? ""}
            onChange={(e) => feld("notfalltelefon", e.target.value)}
          />
        </label>

        <h3 className="wb-maske__abschnitt">Dienstverhältnis</h3>

        <label className="wb-feld wb-feld--schmal">
          <span>Eintritt</span>
          <input
            type="date"
            value={(werte.eintritt ?? "").slice(0, 10)}
            onChange={(e) => feld("eintritt", e.target.value)}
          />
        </label>

        <label className="wb-feld wb-feld--schmal">
          <span>Austritt</span>
          <input
            type="date"
            value={(werte.austritt ?? "").slice(0, 10)}
            onChange={(e) => feld("austritt", e.target.value)}
          />
        </label>

        <label className="wb-feld">
          <span>Austrittsgrund</span>
          <input
            type="text"
            value={werte.austrittsgrund ?? ""}
            onChange={(e) => feld("austrittsgrund", e.target.value)}
          />
        </label>

        <label className="wb-feld">
          <span>Beschäftigungsart</span>
          <select
            value={werte.beschaeftigung ?? "vollzeit"}
            onChange={(e) => feld("beschaeftigung", e.target.value as Beschaeftigungsart)}
          >
            {BESCHAEFTIGUNGSARTEN.map((b) => (
              <option key={b} value={b}>
                {BESCHAEFTIGUNG_TEXT[b]}
              </option>
            ))}
          </select>
        </label>

        <label className="wb-feld">
          <span>Kollektivvertrag</span>
          <input
            type="text"
            placeholder="Elektro- und Elektronikindustrie"
            value={werte.kollektivvertrag ?? ""}
            onChange={(e) => feld("kollektivvertrag", e.target.value)}
          />
        </label>

        <label className="wb-feld wb-feld--schmal">
          <span>Verwendungsgruppe</span>
          <input
            type="text"
            value={werte.verwendungsgruppe ?? ""}
            onChange={(e) => feld("verwendungsgruppe", e.target.value)}
          />
        </label>

        <h3 className="wb-maske__abschnitt">Lohn und Urlaub</h3>

        <label className="wb-feld wb-feld--schmal">
          <span>Lohnart</span>
          <select
            value={werte.lohnart ?? "monat"}
            onChange={(e) => feld("lohnart", e.target.value as Lohnart)}
          >
            {(["monat", "stunde"] as const).map((l) => (
              <option key={l} value={l}>
                {LOHNART_TEXT[l]}
              </option>
            ))}
          </select>
        </label>

        <label className="wb-feld wb-feld--schmal">
          <span>Lohn brutto</span>
          <input
            type="text"
            inputMode="decimal"
            value={lohnText}
            onChange={(e) => setLohnText(e.target.value)}
          />
          <small className="wb-notiz">{alsEuro(ausGeld(lohnText) || 0, sw)}</small>
        </label>

        <label className="wb-feld wb-feld--schmal">
          <span>Urlaubsanspruch (Werktage)</span>
          <input
            type="number"
            min={0}
            step={0.5}
            value={werte.urlaubsanspruch ?? 0}
            onChange={(e) => feld("urlaubsanspruch", Number(e.target.value))}
          />
          <small className="wb-notiz">
            Gesetzlich mindestens 25, ab 25 Dienstjahren 30 — die Anrechnung von Vordienstzeiten
            rechnet Werkboq nicht, die steht im Vertrag.
          </small>
        </label>

        <label className="wb-feld wb-feld--schmal">
          <span>Übertrag aus dem Vorjahr</span>
          <input
            type="number"
            step={0.5}
            value={werte.urlaubUebertrag ?? 0}
            onChange={(e) => feld("urlaubUebertrag", Number(e.target.value))}
          />
        </label>

        <label className="wb-feld wb-feld--breit">
          <span>Notizen</span>
          <textarea
            rows={3}
            value={werte.notizen ?? ""}
            onChange={(e) => feld("notizen", e.target.value)}
          />
        </label>

        {fehler && (
          <p className="wb-fehler wb-feld--breit" role="alert">
            {fehler}
          </p>
        )}
        {hinweis && (
          <p className="wb-hinweis wb-feld--breit" role="status">
            {hinweis}
          </p>
        )}

        <div className="wb-aktionen wb-feld--breit">
          <button className="wb-button" type="submit" disabled={laeuft}>
            {vorhanden ? "Speichern" : "Akte anlegen"}
          </button>
        </div>
      </form>
    </section>
  );
}

function anschrift(w: { anschrift?: string; plz?: string; ort?: string }): string | undefined {
  const zeile = [w.plz, w.ort].filter(Boolean).join(" ");
  return [w.anschrift, zeile].filter(Boolean).join(", ") || undefined;
}

function datum(t?: string): string | undefined {
  if (!t) return undefined;
  return new Date(`${t.slice(0, 10)}T00:00:00`).toLocaleDateString("de-AT");
}

function Fakt({ begriff, wert }: { begriff: string; wert?: string }) {
  if (!wert) return null;
  return (
    <div>
      <dt>{begriff}</dt>
      <dd>{wert}</dd>
    </div>
  );
}
