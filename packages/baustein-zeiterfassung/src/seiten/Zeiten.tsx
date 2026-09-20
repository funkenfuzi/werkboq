import { useCallback, useEffect, useMemo, useState } from "react";
import {
  aktuellerBenutzer,
  alsStunden,
  auftraegeSuchen,
  Symbol,
  tagePlus,
  wochenbeginn,
  type Auftrag,
} from "@werkboq/core";
import {
  dauer,
  nachTag,
  summe,
  TAGESWARNUNG_STUNDEN,
  zeitenVonBis,
  zeitLoeschen,
  ZEITART_TEXT,
  type Zeit,
} from "../daten/zeiten";
import { Zeitmaske } from "../erweiterungen/Zeitmaske";

/**
 * Wochenansicht der eigenen Zeiten.
 *
 * Zeigt Arbeitszeit und auftragsbezogene Zeit in einer Liste — es ist
 * dieselbe Zeit, nur unterschiedlich zugeordnet. Die Tagessumme wird
 * hervorgehoben, sobald sie zehn Stunden überschreitet; das ist kein Verbot,
 * sondern ein Hinweis, damit niemand versehentlich über die Grenzen des
 * Arbeitszeitgesetzes hinaus aufzeichnet, ohne es zu bemerken.
 */
export function Zeiten() {
  // aktuellerBenutzer() baut bei jedem Durchlauf ein neues Objekt. Als
  // Abhängigkeit eines useCallback würde das den Ladevorgang bei jedem
  // Zustandswechsel neu auslösen — eine Schleife, die nie zur Ruhe kommt.
  // Deshalb hängt unten nur die unveränderliche Kennung daran.
  const benutzer = useMemo(() => aktuellerBenutzer(), []);
  const benutzerId = benutzer?.id;

  const [woche, setWoche] = useState(() => wochenbeginn());
  const [eintraege, setEintraege] = useState<Zeit[]>([]);
  const [auftraege, setAuftraege] = useState<Auftrag[]>([]);
  const [maske, setMaske] = useState<string | null>(null);
  const [laedt, setLaedt] = useState(true);
  const [fehler, setFehler] = useState<string | null>(null);

  const wochenende = useMemo(() => tagePlus(woche, 6), [woche]);

  const laden = useCallback(() => {
    if (!benutzerId) return;
    setLaedt(true);
    zeitenVonBis(benutzerId, woche, wochenende)
      .then((z) => {
        setEintraege(z);
        setFehler(null);
      })
      .catch((e: unknown) => setFehler(e instanceof Error ? e.message : String(e)))
      .finally(() => setLaedt(false));
  }, [benutzerId, woche, wochenende]);

  useEffect(laden, [laden]);

  useEffect(() => {
    auftraegeSuchen("", 300).then(setAuftraege).catch(() => setAuftraege([]));
  }, []);

  const jeTag = useMemo(() => nachTag(eintraege), [eintraege]);
  const wochensumme = useMemo(() => summe(eintraege), [eintraege]);
  const aufAuftraege = useMemo(
    () => summe(eintraege.filter((z) => z.auftrag)),
    [eintraege],
  );

  async function entfernen(z: Zeit) {
    if (!confirm(`Eintrag vom ${z.datum.slice(0, 10)} entfernen?`)) return;
    await zeitLoeschen(z);
    laden();
  }

  const tage = Array.from({ length: 7 }, (_, i) => tagePlus(woche, i));

  return (
    <section>
      <div className="wb-kopf">
        <div>
          <h1>Meine Zeiten</h1>
          <p className="wb-kopf__zahl">
            {benutzer?.name || benutzer?.email} · Woche ab{" "}
            {new Date(`${woche}T00:00:00`).toLocaleDateString("de-AT")}
          </p>
        </div>
        <button className="wb-button" type="button" onClick={() => setMaske(tage[0] ?? woche)}>
          <Symbol name="plus" groesse={18} />
          Zeit eintragen
        </button>
      </div>

      <div className="wb-werkzeugleiste">
        <div className="wb-umschalter">
          <button type="button" onClick={() => setWoche(tagePlus(woche, -7))}>
            ← Vorwoche
          </button>
          <button type="button" onClick={() => setWoche(wochenbeginn())}>
            Diese Woche
          </button>
          <button type="button" onClick={() => setWoche(tagePlus(woche, 7))}>
            Folgewoche →
          </button>
        </div>
        <div className="wb-summen">
          <span>
            Woche gesamt <strong>{alsStunden(wochensumme)} h</strong>
          </span>
          <span>
            davon auf Aufträge <strong>{alsStunden(aufAuftraege)} h</strong>
          </span>
        </div>
      </div>

      {fehler && (
        <p className="wb-fehler" role="alert">
          {fehler}
        </p>
      )}

      {maske && (
        <Zeitmaske
          // Der Schlüssel erzwingt einen Neuaufbau, wenn man bei offener
          // Maske das Plus eines anderen Tages drückt — sonst bliebe das
          // zuerst gewählte Datum stehen.
          key={maske}
          auftraege={auftraege}
          vorgabeDatum={maske}
          beiGespeichert={() => {
            setMaske(null);
            laden();
          }}
          beiAbbruch={() => setMaske(null)}
        />
      )}

      <div className="wb-woche">
        {tage.map((tag) => {
          const zeilen = jeTag.get(tag) ?? [];
          const tagessumme = summe(zeilen);
          const zuViel = tagessumme > TAGESWARNUNG_STUNDEN * 60;
          const datum = new Date(`${tag}T00:00:00`);
          const wochenendtag = datum.getDay() === 0 || datum.getDay() === 6;

          return (
            <div key={tag} className={`wb-tag${wochenendtag ? " ist-wochenende" : ""}`}>
              <div className="wb-tag__kopf">
                <span className="wb-tag__name">
                  {datum.toLocaleDateString("de-AT", { weekday: "short", day: "2-digit", month: "2-digit" })}
                </span>
                {tagessumme > 0 && (
                  <span className={`wb-tag__summe${zuViel ? " ist-warnung" : ""}`}>
                    {alsStunden(tagessumme)} h
                    {zuViel && (
                      <Symbol name="warnung" groesse={14} />
                    )}
                  </span>
                )}
                <button
                  type="button"
                  className="wb-zeilenknopf wb-zeilenknopf--neutral"
                  onClick={() => setMaske(tag)}
                  title={`Zeit am ${tag} eintragen`}
                >
                  <Symbol name="plus" groesse={16} />
                </button>
              </div>

              {zeilen.length === 0 ? (
                <p className="wb-tag__leer">{laedt ? "…" : "—"}</p>
              ) : (
                <ul className="wb-tag__liste">
                  {zeilen.map((z) => {
                    const auftrag = (z as Zeit & { expand?: { auftrag?: Auftrag } }).expand?.auftrag;
                    return (
                      <li key={z.id}>
                        <span className="wb-zeit__spanne">
                          {z.beginn}–{z.ende ?? "offen"}
                        </span>
                        <span className="wb-zeit__dauer">{alsStunden(dauer(z))} h</span>
                        <span className="wb-zeit__was">
                          {auftrag ? (
                            <>
                              <strong>{auftrag.nummer}</strong> {auftrag.titel}
                            </>
                          ) : (
                            <em>{ZEITART_TEXT[z.art]}</em>
                          )}
                          {z.taetigkeit && <span className="wb-zeit__notiz"> · {z.taetigkeit}</span>}
                        </span>
                        {!z.verrechenbar && (
                          <span className="wb-plakette">nicht verrechenbar</span>
                        )}
                        <button
                          type="button"
                          className="wb-zeilenknopf"
                          onClick={() => void entfernen(z)}
                          title="Eintrag entfernen"
                        >
                          <Symbol name="muell" groesse={16} />
                        </button>
                      </li>
                    );
                  })}
                </ul>
              )}
            </div>
          );
        })}
      </div>

      <p className="wb-leer wb-fussnote">
        Aufzeichnungen über Beginn, Ende und Pausen sind nach § 26
        Arbeitszeitgesetz zu führen und ein Jahr aufzubewahren, bei
        Fahrzeuglenkern zwei Jahre. Werkboq löscht nichts von selbst.
      </p>
    </section>
  );
}
