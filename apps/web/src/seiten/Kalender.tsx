import { useCallback, useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  alleMitarbeiter,
  alsStunden,
  auftraegeSuchen,
  dauer,
  geplanteDauer,
  kurz,
  PLANBARE_FUNKTIONEN,
  tagePlus,
  terminAendern,
  terminAnlegen,
  terminLoeschen,
  TERMINART_TEXT,
  termineVonBis,
  terminVerschieben,
  wochenbeginn,
  zeitenVonBisAlle,
  type Auftrag,
  type Mitarbeiter,
  type Termin,
  type Terminart,
  type Zeit,
} from "@werkboq/core";
import { Symbol } from "../komponenten/Symbol";

/**
 * Dispo-Kalender.
 *
 * Zeilen sind Mitarbeiter, Spalten sind die Tage der Woche. In jeder Zelle
 * stehen die geplanten Termine und darunter zwei Zahlen: geplant und
 * gebucht. Genau diese Gegenüberstellung ist der Grund, warum Planung und
 * Zeiterfassung zusammengehören — eine Woche, in der überall acht geplant
 * und elf gebucht sind, sieht man auf einen Blick.
 *
 * Termine lassen sich zwischen Tagen und Mitarbeitern ziehen.
 */
export function Kalender() {
  const navigate = useNavigate();
  const [woche, setWoche] = useState(() => wochenbeginn());
  const [mitarbeiter, setMitarbeiter] = useState<Mitarbeiter[]>([]);
  const [termine, setTermine] = useState<Termin[]>([]);
  const [zeiten, setZeiten] = useState<Zeit[]>([]);
  const [auftraege, setAuftraege] = useState<Auftrag[]>([]);
  const [maske, setMaske] = useState<{ tag: string; mitarbeiter: string } | null>(null);
  const [gezogen, setGezogen] = useState<Termin | null>(null);
  const [ueber, setUeber] = useState<string | null>(null);
  const [fehler, setFehler] = useState<string | null>(null);

  const wochenende = useMemo(() => tagePlus(woche, 6), [woche]);
  const tage = useMemo(() => Array.from({ length: 7 }, (_, i) => tagePlus(woche, i)), [woche]);

  const laden = useCallback(() => {
    Promise.all([
      alleMitarbeiter(true),
      termineVonBis(woche, wochenende),
      zeitenVonBisAlle(woche, wochenende).catch(() => [] as Zeit[]),
    ])
      .then(([m, t, z]) => {
        setMitarbeiter(m.filter((x) => PLANBARE_FUNKTIONEN.includes(x.funktion)));
        setTermine(t);
        setZeiten(z);
        setFehler(null);
      })
      .catch((e: unknown) => setFehler(e instanceof Error ? e.message : String(e)));
  }, [woche, wochenende]);

  useEffect(laden, [laden]);

  useEffect(() => {
    auftraegeSuchen("", 300).then(setAuftraege).catch(() => setAuftraege([]));
  }, []);

  /** Termine einer Person an einem Tag. */
  function termineVon(m: string, tag: string): Termin[] {
    return termine.filter(
      (t) => t.datum.slice(0, 10) === tag && (t.mitarbeiter ?? []).includes(m),
    );
  }

  /** Gebuchte Minuten einer Person an einem Tag. */
  function gebucht(m: string, tag: string): number {
    return zeiten
      .filter((z) => z.mitarbeiter === m && z.datum.slice(0, 10) === tag)
      .reduce((s, z) => s + dauer(z), 0);
  }

  async function ablegen(m: string, tag: string) {
    const t = gezogen;
    setGezogen(null);
    setUeber(null);
    if (!t) return;

    const bisher = t.mitarbeiter ?? [];
    const gleicherTag = t.datum.slice(0, 10) === tag;
    if (gleicherTag && bisher.includes(m)) return;

    // Zieht man auf eine andere Person, wechselt die Zuordnung; zieht man auf
    // einen anderen Tag derselben Person, wandert nur das Datum.
    if (!bisher.includes(m)) {
      await terminAendern(t.id, { ...alsEingabe(t), datum: tag, mitarbeiter: [m] });
    } else {
      await terminVerschieben(t, tag);
    }
    laden();
  }

  async function entfernen(t: Termin) {
    if (!confirm(`Termin „${t.titel}" entfernen?`)) return;
    await terminLoeschen(t);
    laden();
  }

  return (
    <section>
      <div className="wb-kopf">
        <div>
          <h1>Planung</h1>
          <p className="wb-kopf__zahl">
            Woche ab {new Date(`${woche}T00:00:00`).toLocaleDateString("de-AT")} ·{" "}
            {mitarbeiter.length} einplanbar
          </p>
        </div>
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
        <p className="wb-leer wb-legende">
          <strong>P</strong> geplant, <strong>I</strong> gebucht. Termine lassen sich auf
          andere Tage und Personen ziehen.
        </p>
      </div>

      {fehler && (
        <p className="wb-fehler" role="alert">
          {fehler}
        </p>
      )}

      {mitarbeiter.length === 0 ? (
        <div className="wb-nichts">
          <p>Keine einplanbaren Mitarbeiter.</p>
          <p className="wb-leer">
            Unter Einstellungen → Mitarbeiter anlegen. Eingeplant werden Meister, Monteure,
            Lehrlinge und Fremdfirmen.
          </p>
          <button className="wb-button" type="button" onClick={() => navigate("/einstellungen")}>
            Zu den Einstellungen
          </button>
        </div>
      ) : (
        <div className="wb-plan-rahmen">
          <table className="wb-plan">
            <thead>
              <tr>
                <th scope="col" className="wb-plan__person">
                  Mitarbeiter
                </th>
                {tage.map((tag) => {
                  const d = new Date(`${tag}T00:00:00`);
                  const we = d.getDay() === 0 || d.getDay() === 6;
                  return (
                    <th key={tag} scope="col" className={we ? "ist-wochenende" : ""}>
                      {d.toLocaleDateString("de-AT", { weekday: "short" })}
                      <span className="wb-plan__datum">
                        {d.toLocaleDateString("de-AT", { day: "2-digit", month: "2-digit" })}
                      </span>
                    </th>
                  );
                })}
              </tr>
            </thead>
            <tbody>
              {mitarbeiter.map((m) => (
                <tr key={m.id}>
                  <th scope="row" className="wb-plan__person">
                    <span
                      className="wb-initialen wb-initialen--klein"
                      style={{ background: m.farbe || undefined }}
                      aria-hidden="true"
                    >
                      {kurz(m)}
                    </span>
                    <span>
                      {m.name}
                      <small>{FUNKTIONSKURZ[m.funktion] ?? m.funktion}</small>
                    </span>
                  </th>

                  {tage.map((tag) => {
                    const eintraege = termineVon(m.id, tag);
                    const geplant = eintraege.reduce((s, t) => s + geplanteDauer(t), 0);
                    const ist = gebucht(m.id, tag);
                    const zelle = `${m.id}|${tag}`;
                    const d = new Date(`${tag}T00:00:00`);
                    const we = d.getDay() === 0 || d.getDay() === 6;

                    return (
                      <td
                        key={tag}
                        className={`wb-plan__zelle${we ? " ist-wochenende" : ""}${
                          ueber === zelle ? " ist-ziel" : ""
                        }`}
                        onDragOver={(e) => {
                          e.preventDefault();
                          setUeber(zelle);
                        }}
                        onDragLeave={() => setUeber((u) => (u === zelle ? null : u))}
                        onDrop={() => void ablegen(m.id, tag)}
                      >
                        {eintraege.map((t) => (
                          <div
                            key={t.id}
                            className={`wb-termin wb-termin--${t.art ?? "sonstiges"}`}
                            draggable
                            onDragStart={() => setGezogen(t)}
                            onDragEnd={() => setGezogen(null)}
                            title={`${t.titel}${t.ort ? ` · ${t.ort}` : ""}`}
                          >
                            <span className="wb-termin__zeit">
                              {t.ganztags ? "ganztags" : `${t.beginn}–${t.ende}`}
                            </span>
                            <span className="wb-termin__titel">{t.titel}</span>
                            <button
                              type="button"
                              className="wb-termin__weg"
                              onClick={() => void entfernen(t)}
                              title="Termin entfernen"
                            >
                              ×
                            </button>
                          </div>
                        ))}

                        <div className="wb-plan__fuss">
                          <span className={vergleich(geplant, ist)}>
                            <abbr title="geplant">P</abbr>
                            {geplant > 0 ? alsStunden(geplant) : "–"}
                          </span>
                          <span className="wb-plan__ist">
                            <abbr title="gebucht">I</abbr>
                            {ist > 0 ? alsStunden(ist) : "–"}
                          </span>
                          <button
                            type="button"
                            className="wb-plan__plus"
                            onClick={() => setMaske({ tag, mitarbeiter: m.id })}
                            title={`Termin für ${m.name} am ${tag}`}
                          >
                            <Symbol name="plus" groesse={14} />
                          </button>
                        </div>
                      </td>
                    );
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {maske && (
        <Terminmaske
          key={`${maske.tag}-${maske.mitarbeiter}`}
          tag={maske.tag}
          mitarbeiterId={maske.mitarbeiter}
          auftraege={auftraege}
          beiGespeichert={() => {
            setMaske(null);
            laden();
          }}
          beiAbbruch={() => setMaske(null)}
        />
      )}
    </section>
  );
}

const FUNKTIONSKURZ: Record<string, string> = {
  meister: "Meister",
  monteur: "Monteur",
  lehrling: "Lehrling",
  extern: "Fremdfirma",
};

/** Färbt die geplante Zahl, wenn gebucht deutlich darüber oder darunter liegt. */
function vergleich(geplant: number, ist: number): string {
  if (geplant === 0 || ist === 0) return "wb-plan__soll";
  const abweichung = Math.abs(ist - geplant) / geplant;
  if (abweichung > 0.25) return "wb-plan__soll ist-abweichung";
  return "wb-plan__soll";
}

function alsEingabe(t: Termin) {
  return {
    auftrag: t.auftrag ?? "",
    mitarbeiter: t.mitarbeiter ?? [],
    titel: t.titel,
    datum: t.datum.slice(0, 10),
    beginn: t.beginn ?? "",
    ende: t.ende ?? "",
    ganztags: t.ganztags ?? false,
    art: t.art,
    ort: t.ort ?? "",
    notizen: t.notizen ?? "",
  };
}

/** Kleine Maske zum Einplanen, erscheint unter dem Plan. */
function Terminmaske({
  tag,
  mitarbeiterId,
  auftraege,
  beiGespeichert,
  beiAbbruch,
}: {
  tag: string;
  mitarbeiterId: string;
  auftraege: Auftrag[];
  beiGespeichert: () => void;
  beiAbbruch: () => void;
}) {
  const [titel, setTitel] = useState("");
  const [auftrag, setAuftrag] = useState("");
  const [art, setArt] = useState<Terminart>("baustelle");
  const [beginn, setBeginn] = useState("07:00");
  const [ende, setEnde] = useState("16:00");
  const [ganztags, setGanztags] = useState(false);
  const [ort, setOrt] = useState("");
  const [fehler, setFehler] = useState<string | null>(null);

  async function absenden(e: React.FormEvent) {
    e.preventDefault();
    const gewaehlt = auftraege.find((a) => a.id === auftrag);
    const endgueltigerTitel = titel.trim() || gewaehlt?.titel || "";
    if (!endgueltigerTitel) {
      setFehler("Titel angeben oder einen Auftrag wählen.");
      return;
    }
    try {
      await terminAnlegen({
        auftrag,
        mitarbeiter: [mitarbeiterId],
        titel: endgueltigerTitel,
        datum: tag,
        beginn,
        ende,
        ganztags,
        art,
        ort,
        notizen: "",
      });
      beiGespeichert();
    } catch (e: unknown) {
      setFehler(e instanceof Error ? e.message : String(e));
    }
  }

  return (
    <form className="wb-maske" onSubmit={absenden}>
      <label className="wb-feld wb-feld--breit">
        <span>Auftrag</span>
        <select value={auftrag} onChange={(e) => setAuftrag(e.target.value)}>
          <option value="">— kein Auftrag (innerbetrieblich) —</option>
          {auftraege.map((a) => (
            <option key={a.id} value={a.id}>
              {a.nummer} · {a.titel}
            </option>
          ))}
        </select>
      </label>

      <label className="wb-feld wb-feld--breit">
        <span>Titel</span>
        <input
          type="text"
          placeholder="Bleibt leer, wird der Auftragstitel genommen"
          value={titel}
          onChange={(e) => setTitel(e.target.value)}
        />
      </label>

      <label className="wb-feld">
        <span>Art</span>
        <select value={art} onChange={(e) => setArt(e.target.value as Terminart)}>
          {Object.entries(TERMINART_TEXT).map(([wert, text]) => (
            <option key={wert} value={wert}>
              {text}
            </option>
          ))}
        </select>
      </label>

      <label className="wb-feld wb-feld--schmal">
        <span>Von</span>
        <input
          type="time"
          value={beginn}
          onChange={(e) => setBeginn(e.target.value)}
          disabled={ganztags}
        />
      </label>

      <label className="wb-feld wb-feld--schmal">
        <span>Bis</span>
        <input
          type="time"
          value={ende}
          onChange={(e) => setEnde(e.target.value)}
          disabled={ganztags}
        />
      </label>

      <label className="wb-schalter">
        <input
          type="checkbox"
          checked={ganztags}
          onChange={(e) => setGanztags(e.target.checked)}
        />
        <span>Ganztags</span>
      </label>

      <label className="wb-feld wb-feld--breit">
        <span>Ort</span>
        <input type="text" value={ort} onChange={(e) => setOrt(e.target.value)} />
      </label>

      {fehler && (
        <p className="wb-fehler wb-feld--breit" role="alert">
          {fehler}
        </p>
      )}

      <div className="wb-aktionen wb-feld--breit">
        <button className="wb-button" type="submit">
          Einplanen
        </button>
        <button className="wb-button wb-button--sekundaer" type="button" onClick={beiAbbruch}>
          Abbrechen
        </button>
      </div>
    </form>
  );
}
