import { useCallback, useEffect, useState } from "react";
import { Link } from "react-router-dom";
import {
  aktuellerBenutzer,
  alleMitarbeiter,
  auftragLaden,
  darf,
  dienst,
  eigenerMitarbeiter,
  erweiterungen,
  fehlersatz,
  kurz,
  Symbol,
  type Auftrag,
  type Mitarbeiter,
  type Tagestermin,
} from "@werkboq/core";

/**
 * Die Startseite ist die Tagesansicht.
 *
 * WER DIESE SEITE AM HÄUFIGSTEN ÖFFNET, IST DER MONTEUR UM SIEBEN UHR FRÜH.
 *
 * Er will drei Dinge wissen: wo muss ich hin, mit wem, und auf welchen
 * Auftrag buche ich. Vorher stand hier „Hallo Julian. Aktive Module:
 * Zeiterfassung 0.1.0, …" — eine Auskunft, die niemanden interessiert, der
 * zu einer Baustelle fährt.
 *
 * Das ist kein Schönheitsproblem. Öffnet der Monteur die App nicht, kommen
 * keine Stunden und kein Material herein, und alles Nachgelagerte —
 * Rechnung, Nachkalkulation, Lohnvorbereitung — rechnet mit Schätzwerten.
 *
 * Die Termine kommen über den Dienst `tagestermine`. Ist die Planung nicht
 * gekauft, antwortet niemand, und die Seite sagt das, statt einen leeren
 * Tag zu zeigen — ein leerer Tag hieße „heute nichts zu tun", und das wäre
 * gelogen.
 */
export function Start() {
  const benutzer = aktuellerBenutzer();
  const kacheln = erweiterungen("dashboard.kachel");
  const termineDienst = dienst("tagestermine");

  const [ich, setIch] = useState<Mitarbeiter | null>(null);
  const [termine, setTermine] = useState<Tagestermin[]>([]);
  const [auftraege, setAuftraege] = useState<Record<string, Auftrag>>({});
  const [leute, setLeute] = useState<Record<string, Mitarbeiter>>({});
  const [laedt, setLaedt] = useState(true);
  const [fehler, setFehler] = useState<string | null>(null);

  const tag = heute();

  const laden = useCallback(() => {
    if (!termineDienst) {
      setLaedt(false);
      return;
    }
    setLaedt(true);

    eigenerMitarbeiter()
      .catch(() => null)
      .then(async (mitarbeiter) => {
        setIch(mitarbeiter);

        // Ohne verknüpften Mitarbeiterdatensatz — reiner Bürozugang — zeigen
        // wir den ganzen Tag statt gar nichts.
        const liste = await termineDienst(tag, mitarbeiter?.id);
        setTermine(liste);

        const kennungen = [...new Set(liste.map((t) => t.auftrag).filter(Boolean))] as string[];
        const geladen = await Promise.all(
          kennungen.map((id) => auftragLaden(id).catch(() => null)),
        );
        setAuftraege(
          Object.fromEntries(geladen.filter(Boolean).map((a) => [a!.id, a!])) as Record<string, Auftrag>,
        );

        const alle = await alleMitarbeiter(true).catch((): Mitarbeiter[] => []);
        setLeute(Object.fromEntries(alle.map((m) => [m.id, m])));
      })
      .catch((e: unknown) => setFehler(fehlersatz(e)))
      .finally(() => setLaedt(false));
  }, [termineDienst, tag]);

  useEffect(laden, [laden]);

  return (
    <section className="wb-seite">
      <header className="wb-tageskopf">
        <p className="wb-tageskopf__datum">{langesDatum()}</p>
        <h1>{gruss()}, {ich?.name?.split(" ")[0] || benutzer?.name || benutzer?.email}</h1>
      </header>

      {fehler && (
        <p className="wb-fehler" role="alert">
          {fehler}
        </p>
      )}

      <section className="wb-block">
        <div className="wb-block__kopf">
          <h2>Heute</h2>
          {termine.length > 0 && <span className="wb-block__summe">{termine.length}</span>}
          {darf("technik") && (
            <Link className="wb-button wb-button--sekundaer" to="/planung">
              <Symbol name="kalender" groesse={18} />
              Ganze Woche
            </Link>
          )}
        </div>

        {!termineDienst && (
          <p className="wb-leer">
            Der Baustein Planung ist nicht freigeschaltet — ohne ihn gibt es keine Termine. Deine
            Aufträge stehen unter <Link to="/auftraege">Aufträge</Link>.
          </p>
        )}

        {termineDienst && laedt && <p className="wb-leer">Wird geladen …</p>}

        {termineDienst && !laedt && termine.length === 0 && (
          <p className="wb-leer">
            {ich
              ? "Für heute ist nichts eingeteilt."
              : "Für heute ist nichts eingeteilt. Dein Zugang ist mit keinem Mitarbeiter verknüpft — deshalb steht hier der ganze Betrieb, sobald etwas geplant ist."}
          </p>
        )}

        {termine.length > 0 && (
          <ol className="wb-tagesliste">
            {termine.map((t) => {
              const auftrag = t.auftrag ? auftraege[t.auftrag] : undefined;
              const kollegen = t.mitarbeiter
                .filter((m) => m !== ich?.id)
                .map((m) => leute[m])
                .filter(Boolean) as Mitarbeiter[];

              return (
                <li key={t.id} className="wb-tageszeile">
                  <span className="wb-tageszeile__zeit">
                    {t.ganztags ? "ganztags" : `${t.beginn}–${t.ende}`}
                  </span>

                  <span className="wb-tageszeile__mitte">
                    <strong>{t.titel}</strong>
                    {t.ort && (
                      <span className="wb-tageszeile__ort">
                        <Symbol name="ort" groesse={14} />
                        {t.ort}
                      </span>
                    )}
                    {auftrag && (
                      <Link to={`/auftraege/${auftrag.id}`} className="wb-tageszeile__auftrag">
                        {auftrag.nummer} · {auftrag.titel}
                      </Link>
                    )}
                    {kollegen.length > 0 && (
                      <span className="wb-tageszeile__leute">
                        {kollegen.map((k) => (
                          <span
                            key={k.id}
                            className="wb-initialen wb-initialen--klein"
                            style={{ background: k.farbe || undefined }}
                            title={k.name}
                          >
                            {kurz(k)}
                          </span>
                        ))}
                      </span>
                    )}
                  </span>

                  {auftrag && (
                    <Link
                      className="wb-button wb-button--sekundaer wb-tageszeile__knopf"
                      to={`/auftraege/${auftrag.id}`}
                    >
                      Öffnen
                    </Link>
                  )}
                </li>
              );
            })}
          </ol>
        )}
      </section>

      <nav className="wb-schnellzugriff" aria-label="Schnellzugriff">
        {dienst("tagesstunden") && (
          <Link className="wb-kachel" to="/zeiten">
            <Symbol name="uhr" groesse={22} />
            <span>
              Zeit buchen
              <small>Stunden auf den Auftrag</small>
            </span>
          </Link>
        )}
        <Link className="wb-kachel" to="/auftraege">
          <Symbol name="auftraege" groesse={22} />
          <span>
            Aufträge
            <small>alles, was offen ist</small>
          </span>
        </Link>
        <Link className="wb-kachel" to="/kunden">
          <Symbol name="kunden" groesse={22} />
          <span>
            Kunden
            <small>Anschrift und Ansprechpartner</small>
          </span>
        </Link>
      </nav>

      {kacheln.map(({ modulId, Komponente }) => (
        <Komponente key={modulId} />
      ))}
    </section>
  );
}

function heute(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

function langesDatum(): string {
  return new Date().toLocaleDateString("de-AT", {
    weekday: "long",
    day: "numeric",
    month: "long",
  });
}

/**
 * Tageszeit statt immer „Hallo".
 * Kleinigkeit, aber sie sagt dem Anwender, dass das Programm weiß, wann es
 * ist — und um sechs Uhr früh liest sich „Guten Morgen" richtiger.
 */
function gruss(): string {
  const stunde = new Date().getHours();
  if (stunde < 11) return "Guten Morgen";
  if (stunde < 18) return "Servus";
  return "Guten Abend";
}
