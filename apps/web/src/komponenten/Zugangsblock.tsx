import { useEffect, useMemo, useState } from "react";
import {
  Symbol,
  aktuellerBenutzer,
  bereicheSetzen,
  mindestlaengePasswort,
  passwortSetzen,
  vergebbareBereiche,
  zugangAnlegen,
  zugangEntfernen,
  zugangLaden,
  type Bereich,
  type Bereichswahl as Bereichsangebot,
  type Mitarbeiter,
  type Zugang,
} from "@werkboq/core";

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
          setAdmin(z.admin);
        }
      })
      .catch((e: unknown) => !weg && setFehler(text(e)))
      .finally(() => !weg && setLaedt(false));
    return () => {
      weg = true;
    };
  }, [mitarbeiter.benutzer]);

  function umschalten(b: Bereich) {
    setBereiche((v) => (v.includes(b) ? v.filter((x) => x !== b) : [...v, b]));
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
              gewaehlt={bereiche}
              admin={admin}
              beiUmschalten={umschalten}
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
                  const neu = await zugangAnlegen(mitarbeiter, email, passwort, bereiche, admin);
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
              gewaehlt={bereiche}
              admin={admin}
              selbst={selbst}
              beiUmschalten={umschalten}
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
                  await bereicheSetzen(mitarbeiter, zugang.id, bereiche, admin);
                  setZugang({ ...zugang, bereiche, admin });
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

function Bereichswahl({
  moeglich,
  gewaehlt,
  admin,
  selbst,
  beiUmschalten,
  beiAdmin,
}: {
  moeglich: Bereichsangebot[];
  gewaehlt: Bereich[];
  admin: boolean;
  selbst?: boolean;
  beiUmschalten: (b: Bereich) => void;
  beiAdmin: (a: boolean) => void;
}) {
  return (
    <fieldset className="wb-bereiche wb-feld--breit">
      <legend>Bereiche</legend>
      <div className="wb-bereiche__liste">
        {moeglich.map((b) => (
          <label key={b.id} className="wb-schalter wb-schalter--eng">
            <input
              type="checkbox"
              checked={admin || gewaehlt.includes(b.id)}
              disabled={admin}
              onChange={() => beiUmschalten(b.id)}
            />
            <span>
              {b.titel}
              <small>{b.hinweis}</small>
            </span>
          </label>
        ))}
      </div>

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
