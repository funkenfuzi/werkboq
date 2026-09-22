import { useEffect, useState, type FormEvent } from "react";
import { useNavigate, useParams, useSearchParams } from "react-router-dom";
import {
  auftragAendern,
  auftragAnlegen,
  auftragLaden,
  kundenSuchen,
  LEERER_AUFTRAG,
  naechsteNummer,
  AUFTRAGSART_HINWEIS,
  AUFTRAGSART_TEXT,
  AUFTRAGSARTEN,
  artVon,
  phasenFuer,
  type Auftrag,
  type AuftragEingabe,
  type AuftragPhase,
  type Auftragsart,
  type Kunde,
} from "@werkboq/core";

/**
 * Auftrag anlegen und ändern.
 *
 * Beim Anlegen aus einer Kundenakte heraus kommt der Kunde über ?kunde=… mit
 * und ist dann vorbelegt — sonst tippt man ihn zweimal.
 */
export function AuftragBearbeiten() {
  const { id } = useParams<{ id: string }>();
  const [suchparameter] = useSearchParams();
  const navigate = useNavigate();
  const neu = !id;

  const [werte, setWerte] = useState<AuftragEingabe>(LEERER_AUFTRAG);
  const [vorher, setVorher] = useState<Auftrag | null>(null);
  const [kunden, setKunden] = useState<Kunde[]>([]);
  const [laedt, setLaedt] = useState(true);
  const [speichert, setSpeichert] = useState(false);
  const [fehler, setFehler] = useState<string | null>(null);

  useEffect(() => {
    async function start() {
      const alleKunden = await kundenSuchen("", 300).catch(() => [] as Kunde[]);
      setKunden(alleKunden);

      if (neu) {
        setWerte({
          ...LEERER_AUFTRAG,
          nummer: await naechsteNummer(),
          kunde: suchparameter.get("kunde") ?? "",
        });
      } else if (id) {
        const a = await auftragLaden(id);
        setVorher(a);
        setWerte({
          kunde: a.kunde,
          standort: a.standort ?? "",
          nummer: a.nummer,
          titel: a.titel,
          phase: a.phase,
          modul: a.modul ?? "",
          beschreibung: a.beschreibung ?? "",
          beginn: a.beginn ? a.beginn.slice(0, 10) : "",
          ende: a.ende ? a.ende.slice(0, 10) : "",
        });
      }
      setLaedt(false);
    }
    start().catch((e: unknown) => {
      setFehler(e instanceof Error ? e.message : String(e));
      setLaedt(false);
    });
  }, [id, neu, suchparameter]);

  function feld<K extends keyof AuftragEingabe>(name: K, wert: AuftragEingabe[K]) {
    setWerte((v) => ({ ...v, [name]: wert }));
  }

  async function speichern(e: FormEvent) {
    e.preventDefault();
    if (!werte.kunde) {
      setFehler("Ohne Kunde geht es nicht — jeder Auftrag hängt an einem Kunden.");
      return;
    }
    if (!werte.titel.trim() || !werte.nummer.trim()) {
      setFehler("Nummer und Titel sind Pflicht.");
      return;
    }
    setSpeichert(true);
    setFehler(null);
    try {
      if (neu) {
        const angelegt = await auftragAnlegen(werte);
        navigate(angelegt ? `/auftraege/${angelegt.id}` : "/auftraege");
      } else if (vorher) {
        await auftragAendern(vorher, werte);
        navigate(`/auftraege/${vorher.id}`);
      }
    } catch (e: unknown) {
      setFehler(fehlertext(e, werte.nummer));
    } finally {
      setSpeichert(false);
    }
  }

  if (laedt) return <p className="wb-leer">Wird geladen …</p>;

  return (
    <section>
      <div className="wb-kopf">
        <h1>{neu ? "Neuer Auftrag" : `Auftrag ${werte.nummer} bearbeiten`}</h1>
        <button className="wb-button wb-button--sekundaer" type="button" onClick={() => navigate(-1)}>
          Abbrechen
        </button>
      </div>

      <form className="wb-maske" onSubmit={speichern}>
        <label className="wb-feld wb-feld--breit">
          <span>Kunde *</span>
          <select value={werte.kunde} onChange={(e) => feld("kunde", e.target.value)} required>
            <option value="">— bitte wählen —</option>
            {kunden.map((k) => (
              <option key={k.id} value={k.id}>
                {k.name}
                {k.ort ? ` (${k.ort})` : ""}
              </option>
            ))}
          </select>
        </label>

        <label className="wb-feld wb-feld--schmal">
          <span>Nummer *</span>
          <input type="text" value={werte.nummer} onChange={(e) => feld("nummer", e.target.value)} required />
        </label>

        <label className="wb-feld">
          <span>Art</span>
          <select
            value={artVon(werte)}
            onChange={(e) => feld("art", e.target.value as Auftragsart)}
          >
            {AUFTRAGSARTEN.map((a) => (
              <option key={a} value={a}>
                {AUFTRAGSART_TEXT[a]}
              </option>
            ))}
          </select>
          <small className="wb-notiz">{AUFTRAGSART_HINWEIS[artVon(werte)]}</small>
        </label>

        <label className="wb-feld">
          <span>Phase</span>
          <select
            value={werte.phase}
            onChange={(e) => feld("phase", e.target.value as AuftragPhase)}
          >
            {phasenFuer(werte).map((p) => (
              <option key={p.stufe} value={p.stufe}>
                {p.text}
              </option>
            ))}
          </select>
          <small className="wb-notiz">
            Die Auftragsart bestimmt, welche Phasen zur Wahl stehen und wie sie heißen.
            Die Namen lassen sich unter Einstellungen → Phasen ändern.
          </small>
        </label>

        <label className="wb-feld">
          <span>Modul</span>
          <input
            type="text"
            placeholder="elektro"
            value={werte.modul ?? ""}
            onChange={(e) => feld("modul", e.target.value)}
          />
        </label>

        <label className="wb-feld wb-feld--breit">
          <span>Titel *</span>
          <input
            type="text"
            value={werte.titel}
            onChange={(e) => feld("titel", e.target.value)}
            required
            autoFocus={neu}
          />
        </label>

        <label className="wb-feld">
          <span>Beginn</span>
          <input type="date" value={werte.beginn ?? ""} onChange={(e) => feld("beginn", e.target.value)} />
        </label>

        <label className="wb-feld">
          <span>Ende</span>
          <input type="date" value={werte.ende ?? ""} onChange={(e) => feld("ende", e.target.value)} />
        </label>

        <label className="wb-feld wb-feld--breit">
          <span>Beschreibung</span>
          <textarea
            rows={5}
            value={werte.beschreibung ?? ""}
            onChange={(e) => feld("beschreibung", e.target.value)}
          />
        </label>

        {fehler && (
          <p className="wb-fehler wb-feld--breit" role="alert">
            {fehler}
          </p>
        )}

        <div className="wb-aktionen wb-feld--breit">
          <button className="wb-button" type="submit" disabled={speichert}>
            {speichert ? "Speichert …" : "Speichern"}
          </button>
        </div>
      </form>
    </section>
  );
}

/**
 * Macht aus einem PocketBase-Fehler einen Satz, mit dem ein Mensch etwas
 * anfangen kann. Die Meldung selbst ist immer "Failed to create record" —
 * welches Feld gestört hat, steht erst in response.data.
 */
function fehlertext(e: unknown, nummer: string): string {
  const daten = (e as { response?: { data?: Record<string, { message?: string }> } })?.response?.data;
  if (daten?.nummer) {
    return `Die Auftragsnummer ${nummer} gibt es schon. Nummern müssen eindeutig sein.`;
  }
  if (daten && Object.keys(daten).length > 0) {
    const felder = Object.entries(daten)
      .map(([feld, angabe]) => `${feld}: ${angabe?.message ?? "ungültig"}`)
      .join("; ");
    return `Konnte nicht gespeichert werden — ${felder}`;
  }
  return e instanceof Error ? e.message : String(e);
}
