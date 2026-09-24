import { useEffect, useMemo, useState, type FormEvent } from "react";
import { Link, useParams } from "react-router-dom";
import {
  Symbol,
  AUFTRAG_PHASEN,
  PHASENFARBE,
  PHASENTEXT,
  phasenText,
  artVon,
  ansprechpartnerAnlegen,
  ansprechpartnerLoeschen,
  ansprechpartnerZuKunde,
  darf,
  erweiterungen,
  darfAuftraegeAendern,
  KERN_COLLECTIONS,
  kundeLaden,
  LEERER_ANSPRECHPARTNER,
  pb,
  verlauf,
  type Ansprechpartner,
  type Auftrag,
  type Kunde,
  type Protokollzeile,
  type Standort,
} from "@werkboq/core";
import { Verlaufsliste } from "../komponenten/Verlaufsliste";

/**
 * Kundenakte — der Arbeitsplatz, nicht das Formular.
 *
 * Kopfbereich mit den Angaben, die man am Telefon sofort braucht, darunter
 * Reiter für alles, was am Kunden hängt. Bearbeitet wird über den Knopf,
 * nicht durch Anklicken des Kunden — sonst landet man beim Nachsehen im
 * Formular.
 */

const REITER = [
  { id: "uebersicht", titel: "Übersicht" },
  { id: "auftraege", titel: "Aufträge" },
  { id: "standorte", titel: "Standorte" },
  { id: "ansprechpartner", titel: "Ansprechpartner" },
  { id: "dokumente", titel: "Dokumente" },
  { id: "verlauf", titel: "Verlauf" },
] as const;

type ReiterId = (typeof REITER)[number]["id"];

export function KundeAkte() {
  const { id } = useParams<{ id: string }>();
  const [kunde, setKunde] = useState<Kunde | null>(null);
  const [auftraege, setAuftraege] = useState<Auftrag[]>([]);
  const [standorte, setStandorte] = useState<Standort[]>([]);
  const [partner, setPartner] = useState<Ansprechpartner[]>([]);
  const [zeilen, setZeilen] = useState<Protokollzeile[]>([]);
  const [reiter, setReiter] = useState<ReiterId>("uebersicht");
  const [laedt, setLaedt] = useState(true);
  const [fehler, setFehler] = useState<string | null>(null);

  useEffect(() => {
    if (!id) return;
    setLaedt(true);
    Promise.all([
      kundeLaden(id),
      pb()
        .collection(KERN_COLLECTIONS.auftraege)
        .getFullList<Auftrag>({ filter: `kunde = "${id}"`, sort: "-created" })
        .catch(() => [] as Auftrag[]),
      pb()
        .collection(KERN_COLLECTIONS.standorte)
        .getFullList<Standort>({ filter: `kunde = "${id}"`, sort: "bezeichnung" })
        .catch(() => [] as Standort[]),
      ansprechpartnerZuKunde(id).catch(() => [] as Ansprechpartner[]),
      verlauf(id).catch(() => [] as Protokollzeile[]),
    ])
      .then(([k, a, s, p, v]) => {
        setKunde(k);
        setAuftraege(a);
        setStandorte(s);
        setPartner(p);
        setZeilen(v);
        setFehler(null);
      })
      .catch((e: unknown) => setFehler(e instanceof Error ? e.message : String(e)))
      .finally(() => setLaedt(false));
  }, [id]);

  const offen = useMemo(
    () => auftraege.filter((a) => a.phase !== "abgeschlossen").length,
    [auftraege],
  );

  if (laedt) return <Skelett />;
  if (fehler) return <p className="wb-fehler" role="alert">{fehler}</p>;
  if (!kunde) return <p className="wb-leer">Kunde nicht gefunden.</p>;

  const anschrift = [kunde.strasse, [kunde.plz, kunde.ort].filter(Boolean).join(" ")]
    .filter(Boolean)
    .join(", ");

  return (
    <article className="wb-akte">
      <header className="wb-akte__kopf">
        <div className="wb-akte__kennung">
          <span className="wb-initialen" aria-hidden="true">
            {initialen(kunde.name)}
          </span>
          <div>
            <h1>{kunde.name}</h1>
            <p className="wb-akte__unterzeile">
              {anschrift || "Keine Anschrift hinterlegt"}
              {kunde.intern && <span className="wb-plakette wb-plakette--info">Eigener Betrieb</span>}
            </p>
          </div>
        </div>

        <div className="wb-akte__aktionen">
          {darfAuftraegeAendern() && (
            <Link className="wb-button" to={`/auftraege/neu?kunde=${kunde.id}`}>
              Neuer Auftrag
            </Link>
          )}
          {darfAuftraegeAendern() && (
          <Link className="wb-button wb-button--sekundaer" to={`/kunden/${kunde.id}/bearbeiten`}>
            Bearbeiten
          </Link>
          )}
        </div>

        <dl className="wb-schnellfakten">
          <Fakt begriff="Telefon" wert={kunde.telefon} als="tel" />
          <Fakt begriff="E-Mail" wert={kunde.email} als="mail" />
          <Fakt begriff="UID" wert={kunde.uid} />
          <Fakt begriff="Offene Aufträge" wert={String(offen)} />
        </dl>
      </header>

      <nav className="wb-reiter" role="tablist">
        {REITER.map((r) => (
          <button
            key={r.id}
            role="tab"
            aria-selected={reiter === r.id}
            className={`wb-reiter__knopf${reiter === r.id ? " ist-aktiv" : ""}`}
            onClick={() => setReiter(r.id)}
          >
            {r.titel}
            {r.id === "auftraege" && auftraege.length > 0 && (
              <span className="wb-zaehler">{auftraege.length}</span>
            )}
            {r.id === "standorte" && standorte.length > 0 && (
              <span className="wb-zaehler">{standorte.length}</span>
            )}
            {r.id === "ansprechpartner" && partner.length > 0 && (
              <span className="wb-zaehler">{partner.length}</span>
            )}
          </button>
        ))}
      </nav>

      <div className="wb-akte__inhalt">
        {reiter === "uebersicht" && (
          <>
            <Uebersicht kunde={kunde} auftraege={auftraege} />
            {/* Blöcke der Bausteine zum Kunden, etwa seine Wartungsverträge.
                Der Kern kennt sie nicht namentlich. */}
            {erweiterungen("kunde.reiter").map(({ modulId, Komponente }) => (
              <Komponente key={modulId} datensatzId={kunde.id} />
            ))}
          </>
        )}
        {reiter === "auftraege" && <Auftragstabelle auftraege={auftraege} kundeId={kunde.id} />}
        {reiter === "standorte" && <Standortliste standorte={standorte} />}
        {reiter === "ansprechpartner" && (
          <Ansprechpartnerliste
            kundeId={kunde.id}
            partner={partner}
            beiAenderung={() => {
              // Auch der Verlauf muss nachgezogen werden — sonst zeigt der
              // Reiter daneben einen Stand von vor der Änderung.
              void ansprechpartnerZuKunde(kunde.id).then(setPartner).catch(() => undefined);
              void verlauf(kunde.id).then(setZeilen).catch(() => undefined);
            }}
          />
        )}
        {reiter === "dokumente" && (
          <NochNicht
            was="Dokumente"
            grund="Hängen derzeit am Auftrag, nicht am Kunden. Ob sie auch hier erscheinen sollen, ist offen."
          />
        )}
        {reiter === "verlauf" && (
          <section className="wb-block">
            <Verlaufsliste zeilen={zeilen} />
          </section>
        )}
      </div>
    </article>
  );
}

function Uebersicht({ kunde, auftraege }: { kunde: Kunde; auftraege: Auftrag[] }) {
  const jePhase = AUFTRAG_PHASEN.map((p) => ({
    phase: p,
    anzahl: auftraege.filter((a) => a.phase === p).length,
  })).filter((x) => x.anzahl > 0);

  return (
    <div className="wb-spalten">
      <section className="wb-block">
        <h2>Stammdaten</h2>
        <dl className="wb-daten">
          <Zeile begriff="Name" wert={kunde.name} />
          <Zeile begriff="Straße" wert={kunde.strasse} />
          <Zeile begriff="PLZ / Ort" wert={[kunde.plz, kunde.ort].filter(Boolean).join(" ")} />
          <Zeile begriff="Land" wert={kunde.land} />
          <Zeile begriff="Telefon" wert={kunde.telefon} />
          <Zeile begriff="E-Mail" wert={kunde.email} />
          <Zeile begriff="UID-Nummer" wert={kunde.uid} />
        </dl>
      </section>

      <section className="wb-block">
        <h2>Aufträge nach Phase</h2>
        {jePhase.length === 0 ? (
          <p className="wb-leer">Noch kein Auftrag für diesen Kunden.</p>
        ) : (
          <ul className="wb-phasen">
            {jePhase.map(({ phase, anzahl }) => (
              <li key={phase}>
                <span className={`wb-plakette wb-plakette--${PHASENFARBE[phase]}`}>
                  {PHASENTEXT[phase]}
                </span>
                <span className="wb-phasen__zahl">{anzahl}</span>
              </li>
            ))}
          </ul>
        )}
      </section>

      {kunde.notizen && (
        <section className="wb-block wb-block--breit">
          <h2>Notizen</h2>
          <div className="wb-notiz" dangerouslySetInnerHTML={{ __html: kunde.notizen }} />
        </section>
      )}
    </div>
  );
}

function Auftragstabelle({ auftraege, kundeId }: { auftraege: Auftrag[]; kundeId: string }) {
  if (auftraege.length === 0) {
    return (
      <div className="wb-nichts">
        <p>Für diesen Kunden ist noch kein Auftrag angelegt.</p>
        {darfAuftraegeAendern() && (
          <Link className="wb-button" to={`/auftraege/neu?kunde=${kundeId}`}>
            Ersten Auftrag anlegen
          </Link>
        )}
      </div>
    );
  }

  return (
    <div className="wb-tabelle-rahmen">
      <table className="wb-tabelle">
        <thead>
          <tr>
            <th scope="col">Nummer</th>
            <th scope="col">Titel</th>
            <th scope="col">Phase</th>
            <th scope="col">Beginn</th>
            <th scope="col">Modul</th>
          </tr>
        </thead>
        <tbody>
          {auftraege.map((a) => (
            <tr key={a.id}>
              <td className="wb-tabelle__kennung">{a.nummer}</td>
              <td>
                <Link to={`/auftraege/${a.id}`}>{a.titel}</Link>
              </td>
              <td>
                <span className={`wb-plakette wb-plakette--${PHASENFARBE[a.phase]}`}>
                  {phasenText(a.phase, artVon(a))}
                </span>
              </td>
              <td>{a.beginn ? new Date(a.beginn).toLocaleDateString("de-AT") : "—"}</td>
              <td>{a.modul ?? "—"}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function Standortliste({ standorte }: { standorte: Standort[] }) {
  if (standorte.length === 0) {
    return (
      <div className="wb-nichts">
        <p>
          Kein Standort hinterlegt. Standorte lohnen sich, sobald ein Kunde mehrere Objekte hat —
          etwa eine Gemeinde mit Amtshaus, Bauhof und Kindergarten.
        </p>
      </div>
    );
  }
  return (
    <ul className="wb-liste">
      {standorte.map((s) => (
        <li key={s.id}>
          <div className="wb-zeile">
            <span className="wb-zeile__titel">{s.bezeichnung}</span>
            <span className="wb-zeile__neben">
              {[s.strasse, s.plz, s.ort].filter(Boolean).join(", ") || "ohne Anschrift"}
            </span>
          </div>
        </li>
      ))}
    </ul>
  );
}

function Ansprechpartnerliste({
  kundeId,
  partner,
  beiAenderung,
}: {
  kundeId: string;
  partner: Ansprechpartner[];
  beiAenderung: () => void;
}) {
  const [maske, setMaske] = useState(false);
  const [werte, setWerte] = useState(LEERER_ANSPRECHPARTNER);
  const [fehler, setFehler] = useState<string | null>(null);

  async function anlegen(e: FormEvent) {
    e.preventDefault();
    if (!werte.name.trim()) {
      setFehler("Ein Name ist Pflicht.");
      return;
    }
    try {
      await ansprechpartnerAnlegen({ ...werte, kunde: kundeId });
      setWerte(LEERER_ANSPRECHPARTNER);
      setMaske(false);
      setFehler(null);
      beiAenderung();
    } catch (e: unknown) {
      setFehler(e instanceof Error ? e.message : String(e));
    }
  }

  async function entfernen(p: Ansprechpartner) {
    if (!confirm(`${p.name} entfernen?`)) return;
    await ansprechpartnerLoeschen(p);
    beiAenderung();
  }

  return (
    <div className="wb-abschnitt">
      {partner.length === 0 && !maske && (
        <div className="wb-nichts">
          <p>Kein Ansprechpartner hinterlegt.</p>
          <p className="wb-leer">
            Bei Gemeinden und größeren Betrieben ruft man selten „den Kunden" an, sondern den
            Bauhofleiter oder den Haustechniker.
          </p>
        </div>
      )}

      {partner.length > 0 && (
        <div className="wb-tabelle-rahmen">
          <table className="wb-tabelle">
            <thead>
              <tr>
                <th scope="col">Name</th>
                <th scope="col">Funktion</th>
                <th scope="col">Telefon</th>
                <th scope="col">E-Mail</th>
                <th scope="col" aria-label="Aktionen" />
              </tr>
            </thead>
            <tbody>
              {partner.map((p) => (
                <tr key={p.id}>
                  <td>{p.name}</td>
                  <td>{p.funktion || "—"}</td>
                  <td>{p.telefon ? <a href={`tel:${p.telefon.replace(/\s/g, "")}`}>{p.telefon}</a> : "—"}</td>
                  <td>{p.email ? <a href={`mailto:${p.email}`}>{p.email}</a> : "—"}</td>
                  <td className="wb-zelle--rechts">
                    {darf("technik") && (
                      <button
                        type="button"
                        className="wb-zeilenknopf"
                        onClick={() => void entfernen(p)}
                        title={`${p.name} entfernen`}
                      >
                        <Symbol name="muell" groesse={16} />
                      </button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {maske ? (
        <form className="wb-maske" onSubmit={anlegen}>
          <label className="wb-feld">
            <span>Name *</span>
            <input
              type="text"
              value={werte.name}
              onChange={(e) => setWerte({ ...werte, name: e.target.value })}
              required
              autoFocus
            />
          </label>
          <label className="wb-feld">
            <span>Funktion</span>
            <input
              type="text"
              placeholder="Bauhofleiter"
              value={werte.funktion ?? ""}
              onChange={(e) => setWerte({ ...werte, funktion: e.target.value })}
            />
          </label>
          <label className="wb-feld">
            <span>Telefon</span>
            <input
              type="tel"
              value={werte.telefon ?? ""}
              onChange={(e) => setWerte({ ...werte, telefon: e.target.value })}
            />
          </label>
          <label className="wb-feld">
            <span>E-Mail</span>
            <input
              type="email"
              value={werte.email ?? ""}
              onChange={(e) => setWerte({ ...werte, email: e.target.value })}
            />
          </label>
          {fehler && (
            <p className="wb-fehler wb-feld--breit" role="alert">
              {fehler}
            </p>
          )}
          <div className="wb-aktionen wb-feld--breit">
            <button className="wb-button" type="submit">
              Hinzufügen
            </button>
            <button
              className="wb-button wb-button--sekundaer"
              type="button"
              onClick={() => {
                setMaske(false);
                setFehler(null);
              }}
            >
              Abbrechen
            </button>
          </div>
        </form>
      ) : (
        darfAuftraegeAendern() && (
          <button className="wb-button" type="button" onClick={() => setMaske(true)}>
            <Symbol name="plus" groesse={18} />
            Ansprechpartner hinzufügen
          </button>
        )
      )}
    </div>
  );
}

function NochNicht({ was, grund }: { was: string; grund: string }) {
  return (
    <div className="wb-nichts">
      <p>
        <strong>{was}</strong> gibt es noch nicht.
      </p>
      <p className="wb-leer">{grund}</p>
    </div>
  );
}

function Fakt({ begriff, wert, als }: { begriff: string; wert?: string; als?: "tel" | "mail" }) {
  if (!wert) return null;
  const inhalt =
    als === "tel" ? (
      <a href={`tel:${wert.replace(/\s/g, "")}`}>{wert}</a>
    ) : als === "mail" ? (
      <a href={`mailto:${wert}`}>{wert}</a>
    ) : (
      wert
    );
  return (
    <div>
      <dt>{begriff}</dt>
      <dd>{inhalt}</dd>
    </div>
  );
}

function Zeile({ begriff, wert }: { begriff: string; wert?: string }) {
  return (
    <div>
      <dt>{begriff}</dt>
      <dd>{wert || "—"}</dd>
    </div>
  );
}

function Skelett() {
  return (
    <div className="wb-skelett" aria-busy="true" aria-label="Wird geladen">
      <div className="wb-skelett__balken wb-skelett__balken--titel" />
      <div className="wb-skelett__balken" />
      <div className="wb-skelett__balken" />
      <div className="wb-skelett__balken wb-skelett__balken--kurz" />
    </div>
  );
}

function initialen(name: string): string {
  return name
    .split(/\s+/)
    .filter((w) => /[A-Za-zÄÖÜäöü]/.test(w))
    .slice(0, 2)
    .map((w) => w[0]?.toUpperCase() ?? "")
    .join("");
}
