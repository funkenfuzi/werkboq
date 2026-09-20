import { useEffect, useMemo, useState } from "react";
import { Symbol } from "./Symbol";
import { aktuellerBenutzer, stufeSetzen, STUFE_TEXT, type Bereich, type Stufe } from "../benutzer/rechte";
import {
  bereicheSetzen,
  mindestlaengePasswort,
  passwortSetzen,
  vergebbareBereiche,
  zugangAnlegen,
  zugangEntfernen,
  zugangLaden,
  type Bereichswahl as Bereichsangebot,
  type Zugang,
} from "../benutzer/verwaltung";
import type { Mitarbeiter } from "../daten/mitarbeiter";

/**
 * Der Zugang eines Mitarbeiters.
 *
 * Benutzer und Mitarbeiter werden gemeinsam geführt: hier — und nur hier —
 * entsteht ein Anmeldekonto, immer zu einer Person im Betrieb. Kunden haben
 * bewusst keinen Zugang; ein Kundenportal wäre eine eigene Anmeldung mit
 * eigenen Regeln, kein Mitarbeiterzugang mit weniger Rechten.
 */
export function Zugangsblock({
  mitarbeiter,
  beiAenderung,
}: {
  mitarbeiter: Mitarbeiter;
  /** Wird gerufen, wenn ein Zugang entsteht oder verschwindet — die Liste
   *  dahinter zeigt sonst weiter den alten Stand. */
  beiAenderung?: () => void;
}) {
  const [zugang, setZugang] = useState<Zugang | null>(null);
  const [laedt, setLaedt] = useState(true);
  const [fehler, setFehler] = useState<string | null>(null);
  const [hinweis, setHinweis] = useState<string | null>(null);
  const [laeuft, setLaeuft] = useState(false);
  const [minLaenge, setMinLaenge] = useState(8);

  // Anlegen
  const [email, setEmail] = useState(mitarbeiter.email ?? "");
  const [passwort, setPasswort] = useState("");
  const [neuesPasswort, setNeuesPasswort] = useState("");
  const [bereiche, setBereiche] = useState<Bereich[]>(["technik"]);
  const [lesebereiche, setLesebereiche] = useState<Bereich[]>([]);
  const [admin, setAdmin] = useState(false);

  const moeglich = useMemo(() => vergebbareBereiche(), []);
  const ich = useMemo(() => aktuellerBenutzer(), []);
  const selbst = Boolean(zugang && ich && zugang.id === ich.id);

  useEffect(() => {
    let weg = false;
    setLaedt(true);
    Promise.all([
      mitarbeiter.benutzer ? zugangLaden(mitarbeiter.benutzer) : Promise.resolve(null),
      mindestlaengePasswort(),
    ])
      .then(([z, min]) => {
        if (weg) return;
        setMinLaenge(min);
        setZugang(z);
        if (z) {
          setBereiche(z.bereiche);
          setLesebereiche(z.lesebereiche);
          setAdmin(z.admin);
        }
      })
      .catch((e: unknown) => !weg && setFehler(text(e)))
      .finally(() => !weg && setLaedt(false));
    return () => {
      weg = true;
    };
  }, [mitarbeiter.benutzer]);

  /** Setzt die Stufe eines Bereichs. Beide Listen ändern sich zugleich. */
  function stufeAendern(bereich: Bereich, neu: Stufe) {
    const nachher = stufeSetzen(bereiche, lesebereiche, bereich, neu);
    setBereiche(nachher.bereiche);
    setLesebereiche(nachher.lesebereiche);
  }

  async function fuehreAus(was: () => Promise<void>, erfolg: string) {
    setLaeuft(true);
    setFehler(null);
    setHinweis(null);
    try {
      await was();
      setHinweis(erfolg);
    } catch (e: unknown) {
      setFehler(text(e));
    } finally {
      setLaeuft(false);
    }
  }

  if (!darfVerwalten(ich)) return null;

  if (laedt) {
    return (
      <section className="wb-zugang">
        <h2>Zugang</h2>
        <p className="wb-leer">Wird geladen …</p>
      </section>
    );
  }

  return (
    <section className="wb-zugang">
      <h2>
        <Symbol name="einstellungen" groesse={18} />
        Zugang
      </h2>

      {!zugang ? (
        <>
          <p className="wb-leer wb-zugang__text">
            {mitarbeiter.name} kann sich derzeit nicht anmelden. Wer nur eingeplant wird — etwa
            eine Fremdfirma — braucht keinen Zugang.
          </p>

          <div className="wb-zugang__gitter">
            <label className="wb-feld wb-feld--breit">
              <span>E-Mail *</span>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="name@betrieb.at"
              />
            </label>

            <label className="wb-feld wb-feld--breit">
              <span>Erstes Passwort * (mind. {minLaenge} Zeichen)</span>
              <input
                type="text"
                value={passwort}
                onChange={(e) => setPasswort(e.target.value)}
                autoComplete="new-password"
              />
              <small className="wb-notiz">
                Bewusst im Klartext: du gibst es der Person weiter, sie ändert es danach selbst.
              </small>
            </label>

            <Bereichswahl
              moeglich={moeglich}
              bereiche={bereiche}
              lesebereiche={lesebereiche}
              admin={admin}
              beiStufe={stufeAendern}
              beiAdmin={setAdmin}
            />
          </div>

          <div className="wb-aktionen">
            <button
              type="button"
              className="wb-button"
              disabled={laeuft || !email.trim() || passwort.length < minLaenge}
              onClick={() =>
                void fuehreAus(async () => {
                  const neu = await zugangAnlegen(
                    mitarbeiter,
                    email,
                    passwort,
                    bereiche,
                    admin,
                    lesebereiche,
                  );
                  setZugang(neu);
                  setPasswort("");
                  beiAenderung?.();
                }, "Zugang angelegt.")
              }
            >
              Zugang anlegen
            </button>
          </div>
        </>
      ) : (
        <>
          <p className="wb-leer wb-zugang__text">
            Angemeldet wird mit <strong>{zugang.email}</strong>.
            {selbst && " Das ist dein eigener Zugang."}
          </p>

          <div className="wb-zugang__gitter">
            <Bereichswahl
              moeglich={moeglich}
              bereiche={bereiche}
              lesebereiche={lesebereiche}
              admin={admin}
              selbst={selbst}
              beiStufe={stufeAendern}
              beiAdmin={setAdmin}
            />

            <label className="wb-feld wb-feld--breit">
              <span>Neues Passwort setzen (mind. {minLaenge} Zeichen)</span>
              <input
                type="text"
                value={neuesPasswort}
                onChange={(e) => setNeuesPasswort(e.target.value)}
                autoComplete="new-password"
                placeholder="leer lassen, wenn unverändert"
              />
            </label>
          </div>

          <div className="wb-aktionen">
            <button
              type="button"
              className="wb-button"
              disabled={laeuft}
              onClick={() =>
                void fuehreAus(async () => {
                  await bereicheSetzen(mitarbeiter, zugang.id, bereiche, admin, lesebereiche);
                  setZugang({ ...zugang, bereiche, lesebereiche, admin });
                }, "Berechtigungen gespeichert.")
              }
            >
              Berechtigungen speichern
            </button>

            <button
              type="button"
              className="wb-button wb-button--sekundaer"
              disabled={laeuft || neuesPasswort.length < minLaenge}
              onClick={() =>
                void fuehreAus(async () => {
                  await passwortSetzen(mitarbeiter, zugang.id, neuesPasswort);
                  setNeuesPasswort("");
                }, "Passwort geändert.")
              }
            >
              Passwort setzen
            </button>

            {!selbst && (
              <button
                type="button"
                className="wb-button wb-button--gefahr"
                disabled={laeuft}
                onClick={() => {
                  if (
                    !confirm(
                      `Zugang von ${mitarbeiter.name} entfernen? Der Mitarbeiter bleibt mit allen Zeiten erhalten, kann sich aber nicht mehr anmelden.`,
                    )
                  )
                    return;
                  void fuehreAus(async () => {
                    await zugangEntfernen(mitarbeiter, zugang.id);
                    setZugang(null);
                    setBereiche(["technik"]);
                    setLesebereiche([]);
                    setAdmin(false);
                    beiAenderung?.();
                  }, "Zugang entfernt.");
                }}
              >
                Zugang entfernen
              </button>
            )}
          </div>
        </>
      )}

      {fehler && (
        <p className="wb-fehler" role="alert">
          {fehler}
        </p>
      )}
      {hinweis && (
        <p className="wb-hinweis" role="status">
          {hinweis}
        </p>
      )}
    </section>
  );
}

/**
 * Bereiche mit drei Stufen: kein Zugriff, nur lesen, lesen und ändern.
 *
 * Kästchen genügen hier nicht mehr. Ein Monteur soll die Aufträge sehen, auf
 * die er fährt, ohne einen Preis ändern zu können — und die Personalakte gar
 * nicht. Bei Verwaltung und Entwickler fehlt die mittlere Stufe: wer Zugänge
 * ansehen darf, kann sie auch vergeben, alles andere wäre eine Stufe, die
 * nichts schützt und nur verwirrt.
 */
function Bereichswahl({
  moeglich,
  bereiche,
  lesebereiche,
  admin,
  selbst,
  beiStufe,
  beiAdmin,
}: {
  moeglich: Bereichsangebot[];
  bereiche: Bereich[];
  lesebereiche: Bereich[];
  admin: boolean;
  selbst?: boolean;
  beiStufe: (b: Bereich, s: Stufe) => void;
  beiAdmin: (a: boolean) => void;
}) {
  const stufeVon = (b: Bereich): Stufe =>
    admin || bereiche.includes(b) ? "schreiben" : lesebereiche.includes(b) ? "lesen" : "keine";

  return (
    <fieldset className="wb-bereiche wb-feld--breit">
      <legend>Bereiche</legend>
      <div className="wb-bereiche__liste">
        {moeglich.map((b) => (
          <div key={b.id} className="wb-bereich">
            <span className="wb-bereich__name">
              {b.titel}
              <small>{b.hinweis}</small>
            </span>
            <select
              className="wb-bereich__stufe"
              value={stufeVon(b.id)}
              disabled={admin}
              aria-label={`Zugriff auf ${b.titel}`}
              onChange={(e) => beiStufe(b.id, e.target.value as Stufe)}
            >
              <option value="keine">{STUFE_TEXT.keine}</option>
              {!b.nurGanz && <option value="lesen">{STUFE_TEXT.lesen}</option>}
              <option value="schreiben">{STUFE_TEXT.schreiben}</option>
            </select>
          </div>
        ))}
      </div>

      <p className="wb-notiz wb-bereiche__warnung">
        <strong>Personalwesen ist auch serverseitig gesperrt</strong> — dort kommt niemand ohne
        Recht an die Daten, auch nicht an der Oberfläche vorbei. Bei allen anderen Bereichen
        steuert die Stufe vorerst nur, was angezeigt wird: wer sich auskennt, erreicht sie über
        die Schnittstelle trotzdem. Solange das so ist, gehört ein Zugang nur an Leute, denen der
        Betrieb ohnehin vertraut.
      </p>

      <label className="wb-schalter wb-schalter--eng">
        <input
          type="checkbox"
          checked={admin}
          disabled={selbst}
          onChange={(e) => beiAdmin(e.target.checked)}
        />
        <span>
          Administrator
          <small>
            Darf alles, auch Zugänge vergeben.
            {selbst ? " Den eigenen Adminstatus kann man nicht entziehen." : ""}
          </small>
        </span>
      </label>
    </fieldset>
  );
}

function darfVerwalten(ich: ReturnType<typeof aktuellerBenutzer>): boolean {
  // Zugänge vergeben darf nur ein Administrator: die Regeln der
  // users-Collection lassen nichts anderes zu, also zeigen wir es auch nicht.
  return Boolean(ich?.admin);
}

function text(e: unknown): string {
  if (e && typeof e === "object" && "response" in e) {
    const antwort = (e as { response?: { data?: Record<string, { message?: string }>; message?: string } })
      .response;
    const felder = antwort?.data;
    const erstes = felder ? Object.entries(felder)[0] : undefined;
    if (erstes) {
      const [schluessel, wert] = erstes;
      const name =
        schluessel === "email" ? "E-Mail" : schluessel === "password" ? "Passwort" : schluessel;
      return `${name}: ${wert?.message ?? "ungültig"}`;
    }
    if (antwort?.message) return antwort.message;
  }
  return e instanceof Error ? e.message : String(e);
}
