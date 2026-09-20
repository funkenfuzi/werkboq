import { useEffect, useState, type FormEvent } from "react";
import { useNavigate, useParams } from "react-router-dom";
import {
  darf,
  kundeAendern,
  kundeAnlegen,
  kundeLaden,
  kundeLoeschen,
  LEERER_KUNDE,
  type KundeEingabe,
} from "@werkboq/core";

export function KundeBearbeiten() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const neu = !id || id === "neu";

  const [werte, setWerte] = useState<KundeEingabe>(LEERER_KUNDE);
  const [laedt, setLaedt] = useState(!neu);
  const [speichert, setSpeichert] = useState(false);
  const [fehler, setFehler] = useState<string | null>(null);
  const [hinweis, setHinweis] = useState<string | null>(null);

  useEffect(() => {
    if (neu || !id) return;
    setLaedt(true);
    kundeLaden(id)
      .then((k) => setWerte({ ...LEERER_KUNDE, ...k }))
      .catch((e: unknown) => setFehler(e instanceof Error ? e.message : String(e)))
      .finally(() => setLaedt(false));
  }, [id, neu]);

  function feld<K extends keyof KundeEingabe>(name: K, wert: KundeEingabe[K]) {
    setWerte((v) => ({ ...v, [name]: wert }));
  }

  async function speichern(e: FormEvent) {
    e.preventDefault();
    if (!werte.name.trim()) {
      setFehler("Ein Name ist Pflicht — alles andere kann später kommen.");
      return;
    }
    setSpeichert(true);
    setFehler(null);
    try {
      if (neu) {
        const angelegt = await kundeAnlegen(werte);
        if (angelegt) {
          navigate(`/kunden/${angelegt.id}`, { replace: true });
        } else {
          // Ohne Netz gibt es noch keine id — zurück zur Liste, der Vorgang
          // liegt in der Warteschlange und wird später übertragen.
          setHinweis("Ohne Verbindung gespeichert. Wird übertragen, sobald Netz da ist.");
          navigate("/kunden");
        }
      } else if (id) {
        await kundeAendern(id, werte);
        setHinweis("Gespeichert.");
      }
    } catch (e: unknown) {
      setFehler(e instanceof Error ? e.message : String(e));
    } finally {
      setSpeichert(false);
    }
  }

  async function loeschen() {
    if (!id || neu) return;
    if (!confirm(`„${werte.name}" wirklich löschen? Das lässt sich nicht rückgängig machen.`)) {
      return;
    }
    try {
      await kundeLoeschen(id);
      navigate("/kunden");
    } catch (e: unknown) {
      setFehler(e instanceof Error ? e.message : String(e));
    }
  }

  if (laedt) return <p className="wb-leer">Wird geladen …</p>;

  return (
    <section>
      <div className="wb-kopf">
        <h1>{neu ? "Neuer Kunde" : werte.name || "Kunde"}</h1>
        <button className="wb-button wb-button--sekundaer" type="button" onClick={() => navigate("/kunden")}>
          Zurück
        </button>
      </div>

      <form className="wb-maske" onSubmit={speichern}>
        <label className="wb-feld wb-feld--breit">
          <span>Name *</span>
          <input
            type="text"
            value={werte.name}
            onChange={(e) => feld("name", e.target.value)}
            required
            autoFocus={neu}
          />
        </label>

        <label className="wb-schalter wb-feld--breit">
          <input
            type="checkbox"
            checked={werte.intern ?? false}
            onChange={(e) => feld("intern", e.target.checked)}
          />
          <span>
            Eigener Betrieb (interner Kunde)
            <small>Für eigene Vorhaben, damit auch sie einen Kunden als Wurzel haben.</small>
          </span>
        </label>

        <label className="wb-feld wb-feld--breit">
          <span>Straße</span>
          <input type="text" value={werte.strasse ?? ""} onChange={(e) => feld("strasse", e.target.value)} />
        </label>

        <label className="wb-feld wb-feld--schmal">
          <span>PLZ</span>
          <input type="text" inputMode="numeric" value={werte.plz ?? ""} onChange={(e) => feld("plz", e.target.value)} />
        </label>

        <label className="wb-feld">
          <span>Ort</span>
          <input type="text" value={werte.ort ?? ""} onChange={(e) => feld("ort", e.target.value)} />
        </label>

        <label className="wb-feld">
          <span>Land</span>
          <input type="text" value={werte.land ?? ""} onChange={(e) => feld("land", e.target.value)} />
        </label>

        <label className="wb-feld">
          <span>Telefon</span>
          <input type="tel" value={werte.telefon ?? ""} onChange={(e) => feld("telefon", e.target.value)} />
        </label>

        <label className="wb-feld">
          <span>E-Mail</span>
          <input type="email" value={werte.email ?? ""} onChange={(e) => feld("email", e.target.value)} />
        </label>

        <label className="wb-feld">
          <span>UID-Nummer</span>
          <input
            type="text"
            placeholder="ATU………"
            value={werte.uid ?? ""}
            onChange={(e) => feld("uid", e.target.value)}
          />
        </label>

        <label className="wb-feld wb-feld--breit">
          <span>Notizen</span>
          <textarea rows={4} value={werte.notizen ?? ""} onChange={(e) => feld("notizen", e.target.value)} />
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
          <button className="wb-button" type="submit" disabled={speichert}>
            {speichert ? "Speichert …" : "Speichern"}
          </button>
          {!neu && darf("verwaltung") && (
            <button className="wb-button wb-button--gefahr" type="button" onClick={loeschen}>
              Löschen
            </button>
          )}
        </div>
      </form>
    </section>
  );
}
