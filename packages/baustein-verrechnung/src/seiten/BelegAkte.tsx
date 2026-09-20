import { useCallback, useEffect, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import {
  alsEuro,
  alsGeld,
  alsMenge,
  ausGeld,
  betriebLaden,
  fehlersatz,
  kundeLaden,
  Symbol,
  type Betrieb,
  type Kunde,
} from "@werkboq/core";
import {
  BELEGART_TEXT,
  belegAendern,
  belegLaden,
  belegLoeschen,
  belegpositionen,
  faelligAm,
  festschreiben,
  heute,
  KLEINBETRAG_GRENZE,
  pflichtangaben,
  STATUS_FARBE,
  STATUS_TEXT,
  STEUERFREI_HINWEIS,
  STEUERFREI_TEXT,
  STEUERFREI_GRUENDE,
  statusSetzen,
  stornieren,
  ueberfaelligSeit,
  type Beleg,
  type Belegposition,
  type SteuerfreiGrund,
} from "../daten/belege";
import {
  bezahlt as summeBezahlt,
  offen as nochOffen,
  skontoBis,
  skontobetrag,
  zahlungBuchen,
  zahlungenZuBeleg,
  zahlungLoeschen,
  ZAHLUNGSART_TEXT,
  ZAHLUNGSARTEN,
  type Zahlung,
  type Zahlungsart,
} from "../daten/zahlungen";
import { Mahnblock } from "../erweiterungen/Mahnblock";

/** Ein Beleg mit allem, was daran hängt: Zeilen, Zahlungen, Mahnungen. */
export function BelegAkte() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [beleg, setBeleg] = useState<Beleg | null>(null);
  const [zeilen, setZeilen] = useState<Belegposition[]>([]);
  const [zahlungen, setZahlungen] = useState<Zahlung[]>([]);
  const [kunde, setKunde] = useState<Kunde | null>(null);
  const [betrieb, setBetrieb] = useState<Betrieb | null>(null);
  const [laedt, setLaedt] = useState(true);
  const [fehler, setFehler] = useState<string | null>(null);

  const laden = useCallback(() => {
    if (!id) return;
    belegLaden(id)
      .then(async (b) => {
        setBeleg(b);
        const [z, zl, k, bt] = await Promise.all([
          belegpositionen(b.id),
          zahlungenZuBeleg(b.id),
          kundeLaden(b.kunde).catch(() => null),
          betriebLaden().catch(() => null),
        ]);
        setZeilen(z);
        setZahlungen(zl);
        setKunde(k);
        setBetrieb(bt);
        setFehler(null);
      })
      .catch((e: unknown) => setFehler(fehlersatz(e)))
      .finally(() => setLaedt(false));
  }, [id]);

  useEffect(laden, [laden]);

  if (laedt) return <p className="wb-leer">Wird geladen …</p>;
  if (!beleg) {
    return (
      <div className="wb-nichts">
        <p>Diesen Beleg gibt es nicht.</p>
        <Link className="wb-button" to="/belege">
          Zur Belegliste
        </Link>
      </div>
    );
  }

  const fehlt = pflichtangaben(beleg, betrieb, zeilen.length);
  const bezahlt = summeBezahlt(zahlungen);
  const offen = nochOffen(beleg, zahlungen);
  const ueberfaellig = beleg.status === "offen" ? ueberfaelligSeit(beleg) : 0;
  const istRechnung = beleg.belegart === "rechnung";
  const klein = istRechnung && beleg.brutto <= KLEINBETRAG_GRENZE && beleg.steuerfrei === "keiner";

  async function tu(was: () => Promise<void>) {
    try {
      await was();
      setFehler(null);
      laden();
    } catch (e: unknown) {
      setFehler(fehlersatz(e));
    }
  }

  return (
    <article className="wb-akte">
      <header className="wb-akte__kopf">
        <div>
          <p className="wb-akte__kennung">
            {BELEGART_TEXT[beleg.belegart]} · {beleg.nummer}
            {kunde && (
              <>
                {" · "}
                <Link to={`/kunden/${kunde.id}`}>{kunde.name}</Link>
              </>
            )}
          </p>
          <h1>{alsEuro(beleg.brutto)}</h1>
          <p className="wb-akte__unterzeile">
            <span className={`wb-plakette wb-plakette--${STATUS_FARBE[beleg.status]}`}>
              {STATUS_TEXT[beleg.status]}
            </span>
            <span>vom {new Date(beleg.datum).toLocaleDateString("de-AT")}</span>
            {istRechnung && beleg.status !== "entwurf" && (
              <span>
                fällig {new Date(faelligAm(beleg)).toLocaleDateString("de-AT")}
                {ueberfaellig > 0 && (
                  <strong className="wb-verzug"> · {ueberfaellig} Tage überfällig</strong>
                )}
              </span>
            )}
            {beleg.festgeschrieben && <span>festgeschrieben</span>}
          </p>
        </div>

        <div className="wb-akte__aktionen">
          <Link className="wb-button wb-button--sekundaer" to={`/belege/${beleg.id}/druck`}>
            Drucken
          </Link>
          {!beleg.festgeschrieben && (
            <button
              className="wb-button"
              type="button"
              disabled={fehlt.length > 0}
              title={fehlt.length > 0 ? "Erst die fehlenden Pflichtangaben ergänzen" : undefined}
              onClick={() => void tu(() => festschreiben(beleg))}
            >
              Festschreiben
            </button>
          )}
          {beleg.festgeschrieben && beleg.status !== "storniert" && istRechnung && (
            <button
              className="wb-button wb-button--gefahr"
              type="button"
              onClick={() => {
                if (!confirm("Diesen Beleg durch eine Gutschrift stornieren?")) return;
                void tu(async () => {
                  const g = await stornieren(beleg);
                  navigate(`/belege/${g.id}`);
                });
              }}
            >
              Stornieren
            </button>
          )}
          {!beleg.festgeschrieben && (
            <button
              className="wb-button wb-button--gefahr"
              type="button"
              onClick={() => {
                if (!confirm("Entwurf löschen?")) return;
                void tu(async () => {
                  await belegLoeschen(beleg);
                  navigate("/belege");
                });
              }}
            >
              Löschen
            </button>
          )}
        </div>
      </header>

      {fehler && (
        <p className="wb-fehler" role="alert">
          {fehler}
        </p>
      )}

      {fehlt.length > 0 && (
        <div className="wb-warnkasten">
          <Symbol name="warnung" groesse={18} />
          <div>
            <strong>Für eine Rechnung nach § 11 UStG fehlt noch:</strong>
            <ul className="wb-mangelliste">
              {fehlt.map((f) => (
                <li key={f}>{f}</li>
              ))}
            </ul>
          </div>
        </div>
      )}

      {klein && fehlt.length === 0 && (
        <p className="wb-hinweis">
          Kleinbetragsrechnung bis 400 € brutto — nach § 11 Abs 6 UStG genügen hier die
          vereinfachten Angaben.
        </p>
      )}

      {beleg.steuerfrei !== "keiner" && (
        <p className="wb-hinweis">{STEUERFREI_HINWEIS[beleg.steuerfrei]}</p>
      )}

      <section className="wb-block">
        <h2>Kopfdaten</h2>
        <Kopfmaske
          beleg={beleg}
          beiGespeichert={laden}
          beiFehler={(f) => setFehler(f)}
        />
      </section>

      <section className="wb-block">
        <div className="wb-block__kopf">
          <h2>Positionen</h2>
          <span className="wb-block__summe">{zeilen.length} Zeilen</span>
        </div>
        <div className="wb-tabelle-rahmen">
          <table className="wb-tabelle wb-tabelle--positionen">
            <thead>
              <tr>
                <th scope="col">Pos</th>
                <th scope="col">Bezeichnung</th>
                <th scope="col" className="wb-zelle--rechts">Menge</th>
                <th scope="col">Einheit</th>
                <th scope="col" className="wb-zelle--rechts">Einzel</th>
                <th scope="col" className="wb-zelle--rechts">Rabatt</th>
                <th scope="col" className="wb-zelle--rechts">USt</th>
                <th scope="col" className="wb-zelle--rechts">Betrag</th>
              </tr>
            </thead>
            <tbody>
              {zeilen.map((z) => (
                <tr key={z.id}>
                  <td className="wb-tabelle__kennung">{z.pos}</td>
                  <td>
                    {z.bezeichnung}
                    {z.beschreibung && <small className="wb-unterzeile">{z.beschreibung}</small>}
                  </td>
                  <td className="wb-zelle--rechts wb-tabelle__kennung">{alsMenge(z.menge)}</td>
                  <td className="wb-zelle--gedaempft">{z.einheit}</td>
                  <td className="wb-zelle--rechts wb-tabelle__kennung">{alsGeld(z.einzelpreis)}</td>
                  <td className="wb-zelle--rechts wb-tabelle__kennung">
                    {z.rabatt ? `${z.rabatt} %` : "—"}
                  </td>
                  <td className="wb-zelle--rechts wb-tabelle__kennung">
                    {beleg.steuerfrei === "keiner" ? `${z.ustsatz} %` : "—"}
                  </td>
                  <td className="wb-zelle--rechts wb-tabelle__kennung wb-zelle--betont">
                    {alsGeld(z.betrag)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <dl className="wb-aufstellung">
          {Object.entries(beleg.nettoJeSatz ?? {})
            .sort((a, b) => Number(b[0]) - Number(a[0]))
            .map(([satz, betrag]) => (
              <div key={satz}>
                <dt>Netto {satz} %</dt>
                <dd>{alsEuro(betrag)}</dd>
              </div>
            ))}
          <div>
            <dt>Nettosumme</dt>
            <dd>{alsEuro(beleg.netto)}</dd>
          </div>
          <div>
            <dt>Umsatzsteuer</dt>
            <dd>{alsEuro(beleg.ust)}</dd>
          </div>
          <div className="wb-aufstellung__gesamt">
            <dt>Gesamt</dt>
            <dd>{alsEuro(beleg.brutto)}</dd>
          </div>
          {beleg.skontoProzent ? (
            <div>
              <dt>
                abzüglich {beleg.skontoProzent} % Skonto bis{" "}
                {skontoBis(beleg) && new Date(skontoBis(beleg)!).toLocaleDateString("de-AT")}
              </dt>
              <dd>{alsEuro(beleg.brutto - skontobetrag(beleg))}</dd>
            </div>
          ) : null}
        </dl>
      </section>

      {istRechnung && beleg.festgeschrieben && (
        <section className="wb-block">
          <div className="wb-block__kopf">
            <h2>Zahlungen</h2>
            <span className="wb-block__summe">
              {alsEuro(bezahlt)} von {alsEuro(beleg.brutto)} · offen {alsEuro(offen)}
            </span>
          </div>

          <Zahlungsmaske
            beleg={beleg}
            vorschlag={offen}
            beiGebucht={laden}
            beiFehler={(f) => setFehler(f)}
          />

          {zahlungen.length > 0 && (
            <div className="wb-tabelle-rahmen">
              <table className="wb-tabelle">
                <thead>
                  <tr>
                    <th scope="col">Datum</th>
                    <th scope="col">Art</th>
                    <th scope="col">Notiz</th>
                    <th scope="col" className="wb-zelle--rechts">Betrag</th>
                    <th scope="col" aria-label="Aktionen" />
                  </tr>
                </thead>
                <tbody>
                  {zahlungen.map((z) => (
                    <tr key={z.id}>
                      <td className="wb-tabelle__kennung">
                        {new Date(z.datum).toLocaleDateString("de-AT")}
                      </td>
                      <td>{ZAHLUNGSART_TEXT[z.art]}</td>
                      <td className="wb-zelle--gedaempft">{z.notiz || "—"}</td>
                      <td className="wb-zelle--rechts wb-tabelle__kennung wb-zelle--betont">
                        {alsEuro(z.betrag)}
                      </td>
                      <td className="wb-zelle--rechts">
                        <button
                          type="button"
                          className="wb-zeilenknopf"
                          title="Zahlung entfernen"
                          onClick={() => {
                            if (!confirm("Zahlung entfernen?")) return;
                            void tu(() => zahlungLoeschen(z, beleg));
                          }}
                        >
                          <Symbol name="muell" groesse={16} />
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>
      )}

      {istRechnung && beleg.festgeschrieben && offen > 1 && (
        <Mahnblock beleg={beleg} kunde={kunde} offen={offen} beiAenderung={laden} />
      )}

      {beleg.belegart === "angebot" && beleg.festgeschrieben && beleg.status === "offen" && (
        <section className="wb-block">
          <h2>Ausgang</h2>
          <p className="wb-leer">
            Hat der Kunde zugesagt? Aus einem angenommenen Angebot entsteht die
            Auftragsbestätigung.
          </p>
          <div className="wb-aktionen">
            <button
              className="wb-button"
              type="button"
              onClick={() => void tu(() => statusSetzen(beleg, "angenommen"))}
            >
              Angenommen
            </button>
            <button
              className="wb-button wb-button--sekundaer"
              type="button"
              onClick={() => void tu(() => statusSetzen(beleg, "abgelehnt"))}
            >
              Abgelehnt
            </button>
          </div>
        </section>
      )}
    </article>
  );
}

/** Kopfdaten ändern — nur solange der Beleg nicht festgeschrieben ist. */
function Kopfmaske({
  beleg,
  beiGespeichert,
  beiFehler,
}: {
  beleg: Beleg;
  beiGespeichert: () => void;
  beiFehler: (f: string) => void;
}) {
  const [werte, setWerte] = useState({
    datum: beleg.datum.slice(0, 10),
    leistungVon: beleg.leistungVon?.slice(0, 10) ?? "",
    leistungBis: beleg.leistungBis?.slice(0, 10) ?? "",
    empfaengerName: beleg.empfaengerName,
    empfaengerAnschrift: beleg.empfaengerAnschrift,
    empfaengerUid: beleg.empfaengerUid ?? "",
    steuerfrei: beleg.steuerfrei,
    zahlungszielTage: beleg.zahlungszielTage ?? 14,
    skontoProzent: beleg.skontoProzent ?? 0,
    skontoTage: beleg.skontoTage ?? 0,
    kopftext: beleg.kopftext ?? "",
    fusstext: beleg.fusstext ?? "",
  });
  const [speichert, setSpeichert] = useState(false);

  if (beleg.festgeschrieben) {
    return (
      <>
        <dl className="wb-daten">
          <Fakt begriff="Empfänger" wert={`${beleg.empfaengerName}\n${beleg.empfaengerAnschrift}`} />
          <Fakt begriff="UID des Empfängers" wert={beleg.empfaengerUid} />
          <Fakt
            begriff="Leistungszeitraum"
            wert={
              beleg.leistungVon
                ? `${new Date(beleg.leistungVon).toLocaleDateString("de-AT")} – ${
                    beleg.leistungBis
                      ? new Date(beleg.leistungBis).toLocaleDateString("de-AT")
                      : "offen"
                  }`
                : undefined
            }
          />
          <Fakt begriff="Zahlungsziel" wert={`${beleg.zahlungszielTage} Tage`} />
          <Fakt begriff="Steuer" wert={STEUERFREI_TEXT[beleg.steuerfrei]} />
        </dl>
        <p className="wb-leer wb-notiz">
          Festgeschrieben am {new Date(beleg.festgeschrieben).toLocaleDateString("de-AT")} — ab
          hier ändert sich nichts mehr. Eine Korrektur ist eine Gutschrift, kein Überschreiben.
        </p>
      </>
    );
  }

  async function speichern(e: React.FormEvent) {
    e.preventDefault();
    setSpeichert(true);
    try {
      await belegAendern(beleg, werte);
      beiGespeichert();
    } catch (e: unknown) {
      beiFehler(fehlersatz(e));
    } finally {
      setSpeichert(false);
    }
  }

  return (
    <form className="wb-maske" onSubmit={speichern}>
      <label className="wb-feld wb-feld--schmal">
        <span>Belegdatum *</span>
        <input
          type="date"
          value={werte.datum}
          onChange={(e) => setWerte({ ...werte, datum: e.target.value })}
          required
        />
      </label>

      <label className="wb-feld wb-feld--schmal">
        <span>Leistung von</span>
        <input
          type="date"
          value={werte.leistungVon}
          onChange={(e) => setWerte({ ...werte, leistungVon: e.target.value })}
        />
      </label>

      <label className="wb-feld wb-feld--schmal">
        <span>Leistung bis</span>
        <input
          type="date"
          value={werte.leistungBis}
          onChange={(e) => setWerte({ ...werte, leistungBis: e.target.value })}
        />
      </label>

      <label className="wb-feld wb-feld--breit">
        <span>Empfänger *</span>
        <input
          type="text"
          value={werte.empfaengerName}
          onChange={(e) => setWerte({ ...werte, empfaengerName: e.target.value })}
          required
        />
      </label>

      <label className="wb-feld wb-feld--breit">
        <span>Anschrift</span>
        <textarea
          rows={3}
          value={werte.empfaengerAnschrift}
          onChange={(e) => setWerte({ ...werte, empfaengerAnschrift: e.target.value })}
        />
      </label>

      <label className="wb-feld">
        <span>UID des Empfängers</span>
        <input
          type="text"
          placeholder="ATU………"
          value={werte.empfaengerUid}
          onChange={(e) => setWerte({ ...werte, empfaengerUid: e.target.value })}
        />
      </label>

      <label className="wb-feld wb-feld--breit">
        <span>Umsatzsteuer</span>
        <select
          value={werte.steuerfrei}
          onChange={(e) => setWerte({ ...werte, steuerfrei: e.target.value as SteuerfreiGrund })}
        >
          {STEUERFREI_GRUENDE.map((g) => (
            <option key={g} value={g}>
              {STEUERFREI_TEXT[g]}
            </option>
          ))}
        </select>
        <small className="wb-notiz">
          Bei Übergang der Steuerschuld wird keine Umsatzsteuer ausgewiesen und der Hinweis auf
          den Beleg gedruckt. Ob eine Leistung eine Bauleistung ist, entscheidet nicht das
          Programm.
        </small>
      </label>

      <label className="wb-feld wb-feld--schmal">
        <span>Zahlungsziel (Tage)</span>
        <input
          type="number"
          min={0}
          value={werte.zahlungszielTage}
          onChange={(e) => setWerte({ ...werte, zahlungszielTage: Number(e.target.value) })}
        />
      </label>

      <label className="wb-feld wb-feld--schmal">
        <span>Skonto %</span>
        <input
          type="number"
          min={0}
          max={100}
          step="0.5"
          value={werte.skontoProzent}
          onChange={(e) => setWerte({ ...werte, skontoProzent: Number(e.target.value) })}
        />
      </label>

      <label className="wb-feld wb-feld--schmal">
        <span>Skonto binnen (Tage)</span>
        <input
          type="number"
          min={0}
          value={werte.skontoTage}
          onChange={(e) => setWerte({ ...werte, skontoTage: Number(e.target.value) })}
        />
      </label>

      <label className="wb-feld wb-feld--breit">
        <span>Text über den Positionen</span>
        <textarea
          rows={2}
          value={werte.kopftext}
          onChange={(e) => setWerte({ ...werte, kopftext: e.target.value })}
        />
      </label>

      <label className="wb-feld wb-feld--breit">
        <span>Text unter den Positionen</span>
        <textarea
          rows={2}
          placeholder="Zahlungshinweis, Gewährleistung, Dank"
          value={werte.fusstext}
          onChange={(e) => setWerte({ ...werte, fusstext: e.target.value })}
        />
      </label>

      <div className="wb-aktionen wb-feld--breit">
        <button className="wb-button" type="submit" disabled={speichert}>
          {speichert ? "Speichert …" : "Kopfdaten speichern"}
        </button>
      </div>
    </form>
  );
}

function Zahlungsmaske({
  beleg,
  vorschlag,
  beiGebucht,
  beiFehler,
}: {
  beleg: Beleg;
  vorschlag: number;
  beiGebucht: () => void;
  beiFehler: (f: string) => void;
}) {
  const [datum, setDatum] = useState(heute());
  const [betrag, setBetrag] = useState((vorschlag / 100).toFixed(2).replace(".", ","));
  const [art, setArt] = useState<Zahlungsart>("ueberweisung");
  const [notiz, setNotiz] = useState("");
  const [laeuft, setLaeuft] = useState(false);

  async function buchen(e: React.FormEvent) {
    e.preventDefault();
    const cent = ausGeld(betrag);
    if (Number.isNaN(cent) || cent === 0) {
      beiFehler("Betrag bitte als Zahl angeben, etwa 1.234,56.");
      return;
    }
    setLaeuft(true);
    try {
      await zahlungBuchen(beleg, { datum, betrag: cent, art, notiz });
      setNotiz("");
      beiGebucht();
    } catch (e: unknown) {
      beiFehler(fehlersatz(e));
    } finally {
      setLaeuft(false);
    }
  }

  return (
    <form className="wb-maske" onSubmit={buchen}>
      <label className="wb-feld wb-feld--schmal">
        <span>Datum</span>
        <input type="date" value={datum} onChange={(e) => setDatum(e.target.value)} required />
      </label>
      <label className="wb-feld wb-feld--schmal">
        <span>Betrag</span>
        <input
          type="text"
          inputMode="decimal"
          value={betrag}
          onChange={(e) => setBetrag(e.target.value)}
          required
        />
      </label>
      <label className="wb-feld">
        <span>Art</span>
        <select value={art} onChange={(e) => setArt(e.target.value as Zahlungsart)}>
          {ZAHLUNGSARTEN.map((a) => (
            <option key={a} value={a}>
              {ZAHLUNGSART_TEXT[a]}
            </option>
          ))}
        </select>
      </label>
      <label className="wb-feld">
        <span>Notiz</span>
        <input type="text" value={notiz} onChange={(e) => setNotiz(e.target.value)} />
      </label>
      <div className="wb-aktionen">
        <button className="wb-button" type="submit" disabled={laeuft}>
          Zahlung buchen
        </button>
      </div>
    </form>
  );
}

function Fakt({ begriff, wert }: { begriff: string; wert?: string }) {
  if (!wert) return null;
  return (
    <div>
      <dt>{begriff}</dt>
      <dd style={{ whiteSpace: "pre-line" }}>{wert}</dd>
    </div>
  );
}
