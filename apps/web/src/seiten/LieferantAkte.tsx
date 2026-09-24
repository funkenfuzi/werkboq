import { useEffect, useState, type FormEvent } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import {
  darfLieferantenAendern,
  erweiterungen,
  fehlersatz,
  LEERER_LIEFERANT,
  LIEFERANTENART_TEXT,
  LIEFERANTENARTEN,
  lieferantLaden,
  lieferantSpeichern,
  verlauf,
  type Lieferant,
  type LieferantEingabe,
  type Lieferantenart,
  type Protokollzeile,
} from "@werkboq/core";
import { Verlaufsliste } from "../komponenten/Verlaufsliste";

/**
 * Ein Lieferant: Angaben oben, darunter was an ihm hängt — die eigenen
 * Verträge etwa, die der Baustein Verträge einhängt. Unter /lieferanten/neu
 * gleich als Formular.
 */
export function LieferantAkte() {
  const { id } = useParams<{ id: string }>();
  const neu = !id || id === "neu";
  const navigate = useNavigate();
  const [l, setL] = useState<Lieferant | null>(null);
  const [bearbeiten, setBearbeiten] = useState(neu);
  const [zeilen, setZeilen] = useState<Protokollzeile[]>([]);
  const [fehler, setFehler] = useState<string | null>(null);

  useEffect(() => {
    if (neu || !id) return;
    lieferantLaden(id)
      .then(setL)
      .catch((e: unknown) => setFehler(fehlersatz(e)));
    void verlauf(id).then(setZeilen).catch(() => undefined);
  }, [id, neu]);

  if (fehler) return <p className="wb-fehler" role="alert">{fehler}</p>;
  if (!neu && !l) return <p className="wb-leer">Wird geladen …</p>;

  if (bearbeiten) {
    return (
      <Lieferantmaske
        vorher={l}
        fertig={(gespeichert) => {
          if (neu) {
            navigate(gespeichert ? `/lieferanten/${gespeichert.id}` : "/lieferanten");
            return;
          }
          if (gespeichert) setL(gespeichert);
          setBearbeiten(false);
        }}
      />
    );
  }
  if (!l) return null;

  const anschrift = [l.strasse, [l.plz, l.ort].filter(Boolean).join(" "), l.land].filter(Boolean).join(", ");

  return (
    <article className="wb-akte">
      <header className="wb-akte__kopf">
        <div className="wb-akte__kennung">
          <div>
            <h1>{l.name}</h1>
            <p className="wb-akte__unterzeile">
              {anschrift || "Keine Anschrift hinterlegt"}
              {l.art && <span className="wb-plakette wb-plakette--info">{LIEFERANTENART_TEXT[l.art]}</span>}
              {l.aktiv === false && <span className="wb-plakette wb-plakette--neutral">inaktiv</span>}
            </p>
          </div>
        </div>
        <div className="wb-akte__aktionen">
          <Link className="wb-button wb-button--sekundaer" to="/lieferanten">
            Zur Liste
          </Link>
          {darfLieferantenAendern() && (
            <button className="wb-button wb-button--sekundaer" type="button" onClick={() => setBearbeiten(true)}>
              Bearbeiten
            </button>
          )}
        </div>
        <dl className="wb-schnellfakten">
          {l.telefon && (
            <div>
              <dt>Telefon</dt>
              <dd>
                <a href={`tel:${l.telefon.replace(/\s/g, "")}`}>{l.telefon}</a>
              </dd>
            </div>
          )}
          {l.email && (
            <div>
              <dt>E-Mail</dt>
              <dd>
                <a href={`mailto:${l.email}`}>{l.email}</a>
              </dd>
            </div>
          )}
          {l.kundennummer && (
            <div>
              <dt>Unsere Kundennr.</dt>
              <dd>{l.kundennummer}</dd>
            </div>
          )}
          {l.ansprechpartner && (
            <div>
              <dt>Ansprechpartner</dt>
              <dd>{l.ansprechpartner}</dd>
            </div>
          )}
        </dl>
      </header>

      <div className="wb-akte__inhalt">
        {erweiterungen("lieferant.reiter").map(({ modulId, Komponente }) => (
          <Komponente key={modulId} datensatzId={l.id} />
        ))}
        {(l.notizen || l.web || l.uid) && (
          <section className="wb-block">
            <h2>Weitere Angaben</h2>
            <dl className="wb-daten">
              {l.web && (
                <div>
                  <dt>Web</dt>
                  <dd>{l.web}</dd>
                </div>
              )}
              {l.uid && (
                <div>
                  <dt>UID-Nummer</dt>
                  <dd>{l.uid}</dd>
                </div>
              )}
              {l.notizen && (
                <div>
                  <dt>Notizen</dt>
                  <dd>{l.notizen}</dd>
                </div>
              )}
            </dl>
          </section>
        )}
        <section className="wb-block">
          <h2>Verlauf</h2>
          <Verlaufsliste zeilen={zeilen} />
        </section>
      </div>
    </article>
  );
}

function Lieferantmaske({
  vorher,
  fertig,
}: {
  vorher: Lieferant | null;
  fertig: (gespeichert: Lieferant | null) => void;
}) {
  const [w, setW] = useState<LieferantEingabe>(() => {
    if (!vorher) return LEERER_LIEFERANT;
    const { id: _i, created: _c, updated: _u, ...rest } = vorher as Lieferant & { collectionId?: string; collectionName?: string };
    return { ...LEERER_LIEFERANT, ...rest };
  });
  const [fehler, setFehler] = useState<string | null>(null);
  const [laeuft, setLaeuft] = useState(false);
  const text = (k: keyof LieferantEingabe) => ({
    value: String(w[k] ?? ""),
    onChange: (e: { target: { value: string } }) => setW({ ...w, [k]: e.target.value }),
  });

  if (!darfLieferantenAendern()) {
    return (
      <div className="wb-nichts">
        <p>Lieferanten anlegen und ändern ist für diesen Zugang nicht freigegeben.</p>
        <p className="wb-leer">Dafür braucht es Schreibrecht in „Buchhaltung“ oder „Lager“.</p>
      </div>
    );
  }

  async function speichern(e: FormEvent) {
    e.preventDefault();
    if (!w.name.trim()) {
      setFehler("Ein Name ist Pflicht.");
      return;
    }
    setLaeuft(true);
    try {
      // Nur die Felder der Collection hinausschicken, nicht was PocketBase
      // beim Laden mitgab (collectionId …).
      const daten = Object.fromEntries(
        (Object.keys(LEERER_LIEFERANT) as (keyof LieferantEingabe)[]).map((k) => [k, w[k]]),
      ) as LieferantEingabe;
      fertig(await lieferantSpeichern(vorher, daten));
    } catch (e: unknown) {
      setFehler(fehlersatz(e));
      setLaeuft(false);
    }
  }

  return (
    <section>
      <div className="wb-kopf">
        <h1>{vorher ? vorher.name : "Neuer Lieferant"}</h1>
      </div>
      <form className="wb-maske" onSubmit={speichern}>
        <label className="wb-feld wb-feld--breit">
          <span>Name *</span>
          <input type="text" {...text("name")} required autoFocus={!vorher} />
        </label>
        <label className="wb-feld">
          <span>Art</span>
          <select value={w.art ?? ""} onChange={(e) => setW({ ...w, art: e.target.value as Lieferantenart })}>
            {LIEFERANTENARTEN.map((a) => (
              <option key={a} value={a}>
                {LIEFERANTENART_TEXT[a]}
              </option>
            ))}
          </select>
        </label>
        <label className="wb-feld">
          <span>Unsere Kundennummer dort</span>
          <input type="text" {...text("kundennummer")} />
        </label>
        <label className="wb-feld wb-feld--breit">
          <span>Straße</span>
          <input type="text" {...text("strasse")} />
        </label>
        <label className="wb-feld wb-feld--schmal">
          <span>PLZ</span>
          <input type="text" inputMode="numeric" {...text("plz")} />
        </label>
        <label className="wb-feld">
          <span>Ort</span>
          <input type="text" {...text("ort")} />
        </label>
        <label className="wb-feld">
          <span>Land</span>
          <input type="text" {...text("land")} />
        </label>
        <label className="wb-feld">
          <span>Telefon</span>
          <input type="tel" {...text("telefon")} />
        </label>
        <label className="wb-feld">
          <span>E-Mail</span>
          <input type="email" {...text("email")} />
        </label>
        <label className="wb-feld">
          <span>Ansprechpartner</span>
          <input type="text" {...text("ansprechpartner")} />
        </label>
        <label className="wb-feld">
          <span>Web</span>
          <input type="text" {...text("web")} />
        </label>
        <label className="wb-feld">
          <span>UID-Nummer</span>
          <input type="text" {...text("uid")} />
        </label>
        <label className="wb-feld wb-feld--breit">
          <span>Notizen</span>
          <textarea rows={3} {...text("notizen")} />
        </label>
        <label className="wb-schalter wb-feld--breit">
          <input type="checkbox" checked={w.aktiv !== false} onChange={(e) => setW({ ...w, aktiv: e.target.checked })} />
          <span>
            Aktiv
            <small>Inaktive stehen nicht mehr in der Auswahl, bleiben aber mit ihren Verträgen erhalten.</small>
          </span>
        </label>
        {fehler && (
          <p className="wb-fehler wb-feld--breit" role="alert">
            {fehler}
          </p>
        )}
        <div className="wb-aktionen wb-feld--breit">
          <button className="wb-button" type="submit" disabled={laeuft}>
            Speichern
          </button>
          <button className="wb-button wb-button--sekundaer" type="button" onClick={() => fertig(null)}>
            Abbrechen
          </button>
        </div>
      </form>
    </section>
  );
}
