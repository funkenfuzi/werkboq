import { useCallback, useEffect, useMemo, useState, type FormEvent } from "react";
import {
  aktuellerRechtsraum,
  alsEuro,
  betriebLaden,
  betriebSpeichern,
  darfSchreiben,
  fehlersatz,
  schreibweiseVon,
  Symbol,
  type Betrieb,
} from "@werkboq/core";
import type { Beleg } from "../daten/belege";
import type { Zahlung } from "../daten/zahlungen";
import {
  alsWindows1252,
  bmdCsv,
  exportdatenLaden,
  exportkontenAus,
  fehlendeKonten,
  journal,
  journalCsv,
  zahlungenCsv,
  type Exportkonten,
} from "../daten/export";

/**
 * Export für den Steuerberater.
 *
 * Ein Zeitraum, drei Dateien. Oben steht, was drin ist — Anzahl, Netto,
 * Steuer je Satz —, damit man vor dem Herunterladen sieht, ob das der
 * Monat ist, den man meint. Eine leere Datei an die Kanzlei zu schicken
 * fällt erst beim Anruf auf.
 */

function tag(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

/** Vormonat, Vorquartal, laufendes Jahr — die drei, nach denen gefragt wird. */
function zeitraeume(heute = new Date()): { name: string; von: string; bis: string }[] {
  const j = heute.getFullYear();
  const m = heute.getMonth();
  const vm = new Date(j, m - 1, 1);
  const q = Math.floor(m / 3);
  const vq = new Date(j, (q - 1) * 3, 1);
  return [
    { name: "Voriger Monat", von: tag(vm), bis: tag(new Date(vm.getFullYear(), vm.getMonth() + 1, 0)) },
    { name: "Dieser Monat", von: tag(new Date(j, m, 1)), bis: tag(new Date(j, m + 1, 0)) },
    { name: "Voriges Quartal", von: tag(vq), bis: tag(new Date(vq.getFullYear(), vq.getMonth() + 3, 0)) },
    { name: "Dieses Jahr", von: `${j}-01-01`, bis: `${j}-12-31` },
  ];
}

function herunterladen(name: string, inhalt: BlobPart, typ: string) {
  const url = URL.createObjectURL(new Blob([inhalt], { type: typ }));
  const a = document.createElement("a");
  a.href = url;
  a.download = name;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

export function Export() {
  const vorschlaege = useMemo(() => zeitraeume(), []);
  const [von, setVon] = useState(vorschlaege[0]!.von);
  const [bis, setBis] = useState(vorschlaege[0]!.bis);
  const [daten, setDaten] = useState<{ belege: Beleg[]; alleBelege: Map<string, Beleg>; zahlungen: Zahlung[] } | null>(null);
  const [betrieb, setBetrieb] = useState<Betrieb | null>(null);
  const [fehler, setFehler] = useState<string | null>(null);
  const [kontenOffen, setKontenOffen] = useState(false);
  const sw = schreibweiseVon(aktuellerRechtsraum().id);

  const laden = useCallback(() => {
    if (!von || !bis || von > bis) return;
    setDaten(null);
    exportdatenLaden(von, bis)
      .then((d) => {
        setDaten(d);
        setFehler(null);
      })
      .catch((e: unknown) => setFehler(fehlersatz(e)));
  }, [von, bis]);

  useEffect(laden, [laden]);
  useEffect(() => {
    betriebLaden()
      .then(setBetrieb)
      .catch(() => setBetrieb(null));
  }, []);

  const zeilen = useMemo(
    () => (daten ? journal(daten.belege, new Map([...daten.alleBelege].map(([id, b]) => [id, b.nummer]))) : []),
    [daten],
  );
  const konten = exportkontenAus(betrieb?.exportKonten);
  const fehlt = fehlendeKonten(konten, zeilen);

  const jeSatz = useMemo(() => {
    const m = new Map<string, { netto: number; steuer: number }>();
    for (const z of zeilen) {
      const k = z.steuerfrei === "keiner" ? `${z.steuersatz} %` : "steuerfrei / Übergang";
      const s = m.get(k) ?? { netto: 0, steuer: 0 };
      s.netto += z.netto;
      s.steuer += z.steuer;
      m.set(k, s);
    }
    return [...m];
  }, [zeilen]);

  const endung = `${von}_${bis}`;
  const summe = (f: (z: (typeof zeilen)[number]) => number) => zeilen.reduce((s, z) => s + f(z), 0);

  return (
    <section>
      <div className="wb-kopf">
        <div>
          <h1>Export für den Steuerberater</h1>
          <p className="wb-kopf__zahl">Rechnungen, Gutschriften und Zahlungen eines Zeitraums als Datei</p>
        </div>
      </div>

      <div className="wb-block wb-export">
        <div className="wb-werkzeugleiste">
          <div className="wb-umschalter" role="group" aria-label="Zeitraum">
            {vorschlaege.map((z) => (
              <button
                key={z.name}
                type="button"
                className={von === z.von && bis === z.bis ? "ist-aktiv" : ""}
                onClick={() => {
                  setVon(z.von);
                  setBis(z.bis);
                }}
              >
                {z.name}
              </button>
            ))}
          </div>
          <label className="wb-export__datum">
            <span>von</span>
            <input type="date" value={von} onChange={(e) => setVon(e.target.value)} />
          </label>
          <label className="wb-export__datum">
            <span>bis</span>
            <input type="date" value={bis} onChange={(e) => setBis(e.target.value)} />
          </label>
        </div>

        {fehler && <p className="wb-fehler" role="alert">{fehler}</p>}
        {von > bis && <p className="wb-fehler">„von" liegt nach „bis".</p>}

        {!daten ? (
          <p className="wb-leer">Wird geladen …</p>
        ) : (
          <>
            <dl className="wb-schnellzahlen">
              <div>
                <dt>Belege</dt>
                <dd>{daten.belege.length}</dd>
              </div>
              <div>
                <dt>Netto</dt>
                <dd>{alsEuro(summe((z) => z.netto), sw)}</dd>
              </div>
              <div>
                <dt>Steuer</dt>
                <dd>{alsEuro(summe((z) => z.steuer), sw)}</dd>
              </div>
              <div>
                <dt>Zahlungseingänge</dt>
                <dd>
                  {daten.zahlungen.length} · {alsEuro(daten.zahlungen.reduce((s, z) => s + z.betrag, 0), sw)}
                </dd>
              </div>
            </dl>

            {jeSatz.length > 0 && (
              <ul className="wb-exportsaetze">
                {jeSatz.map(([satz, s]) => (
                  <li key={satz}>
                    <span>{satz}</span>
                    <span>{alsEuro(s.netto, sw)}</span>
                    <span>{alsEuro(s.steuer, sw)} Steuer</span>
                  </li>
                ))}
              </ul>
            )}

            {daten.belege.length === 0 && (
              <p className="wb-leer">
                In diesem Zeitraum ist keine Rechnung festgeschrieben. Entwürfe, Angebote und
                Auftragsbestätigungen sind kein Umsatz und stehen nicht im Export.
              </p>
            )}

            <div className="wb-exportdateien">
              <div>
                <button
                  type="button"
                  className="wb-button"
                  disabled={!daten.belege.length}
                  onClick={() =>
                    herunterladen(`rechnungsausgangsbuch_${endung}.csv`, "﻿" + journalCsv(zeilen), "text/csv;charset=utf-8")
                  }
                >
                  <Symbol name="beleg" groesse={18} />
                  Rechnungsausgangsbuch
                </button>
                <small className="wb-notiz">
                  Eine Zeile je Beleg und Steuersatz. Öffnet sich in Excel; jede Kanzlei kann es
                  einlesen.
                </small>
              </div>
              <div>
                <button
                  type="button"
                  className="wb-button wb-button--sekundaer"
                  disabled={!daten.zahlungen.length}
                  onClick={() =>
                    herunterladen(
                      `zahlungseingaenge_${endung}.csv`,
                      "﻿" + zahlungenCsv(daten.zahlungen, daten.alleBelege, von, bis),
                      "text/csv;charset=utf-8",
                    )
                  }
                >
                  <Symbol name="geld" groesse={18} />
                  Zahlungseingänge
                </button>
                <small className="wb-notiz">Was an welchem Tag auf welche Rechnung einging.</small>
              </div>
              <div>
                <button
                  type="button"
                  className="wb-button wb-button--sekundaer"
                  disabled={!daten.belege.length || fehlt.length > 0}
                  onClick={() =>
                    herunterladen(`bmd_buchungen_${endung}.csv`, alsWindows1252(bmdCsv(zeilen, konten)) as Uint8Array<ArrayBuffer>, "text/csv;charset=windows-1252")
                  }
                >
                  BMD-Buchungsimport
                </button>
                <small className="wb-notiz">
                  {fehlt.length
                    ? `Es fehlt noch: ${fehlt.join(", ")} — unten eintragen.`
                    : "Buchungszeilen im BMD-Importaufbau. Vor dem ersten Einsatz einmal mit der Kanzlei an einer Testdatei abstimmen."}
                </small>
              </div>
            </div>
          </>
        )}
      </div>

      <section className="wb-block">
        <div className="wb-block__kopf">
          <h2>Konten für den BMD-Export</h2>
          <button type="button" className="wb-button wb-button--sekundaer wb-button--klein" onClick={() => setKontenOffen((o) => !o)}>
            {kontenOffen ? "Schließen" : "Konten eintragen"}
          </button>
        </div>
        <p className="wb-leer">
          Die Kontonummern kommen vom Steuerberater — Werkboq rät sie nicht. Für das
          Rechnungsausgangsbuch braucht es keine.
        </p>
        {kontenOffen && betrieb && (
          <Kontenmaske
            vorher={konten}
            darf={darfSchreiben("verwaltung") || darfSchreiben("buchhaltung")}
            beiSpeichern={async (k) => {
              await betriebSpeichern(betrieb.id, { exportKonten: k }, "Konten für den Steuerberater-Export geändert");
              setBetrieb({ ...betrieb, exportKonten: k });
              setKontenOffen(false);
            }}
          />
        )}
      </section>
    </section>
  );
}

function Kontenmaske({
  vorher,
  darf,
  beiSpeichern,
}: {
  vorher: Exportkonten;
  darf: boolean;
  beiSpeichern: (k: Exportkonten) => Promise<void>;
}) {
  const saetze = [...new Set(aktuellerRechtsraum().steuersaetze.map((s) => String(s.satz)))].filter((s) => s !== "0");
  const [k, setK] = useState<Exportkonten>({ ...vorher, erloese: { ...(vorher.erloese ?? {}) } });
  const [fehler, setFehler] = useState<string | null>(null);
  const [laeuft, setLaeuft] = useState(false);

  async function absenden(e: FormEvent) {
    e.preventDefault();
    setLaeuft(true);
    try {
      await beiSpeichern(k);
    } catch (x: unknown) {
      setFehler(fehlersatz(x));
    } finally {
      setLaeuft(false);
    }
  }

  const eingabe = (wert: string | undefined, setzen: (v: string) => void, platz: string) => (
    <input type="text" inputMode="numeric" value={wert ?? ""} placeholder={platz} disabled={!darf} onChange={(e) => setzen(e.target.value)} />
  );

  return (
    <form className="wb-maske" onSubmit={absenden}>
      <label className="wb-feld">
        <span>Debitorenkonto (Sammelkonto Kunden)</span>
        {eingabe(k.debitor, (v) => setK({ ...k, debitor: v }), "z. B. 200000")}
      </label>
      {saetze.map((s) => (
        <label className="wb-feld" key={s}>
          <span>Erlöskonto {s} %</span>
          {eingabe(k.erloese?.[s], (v) => setK({ ...k, erloese: { ...k.erloese, [s]: v } }), "vom Steuerberater")}
        </label>
      ))}
      <label className="wb-feld">
        <span>Erlöskonto Bauleistung (Übergang der Steuerschuld)</span>
        {eingabe(k.bauleistung, (v) => setK({ ...k, bauleistung: v }), "vom Steuerberater")}
      </label>
      <label className="wb-feld">
        <span>Erlöskonto sonst steuerfrei</span>
        {eingabe(k.steuerfrei, (v) => setK({ ...k, steuerfrei: v }), "vom Steuerberater")}
      </label>
      {fehler && <p className="wb-fehler wb-feld--breit" role="alert">{fehler}</p>}
      {darf ? (
        <div className="wb-aktionen wb-feld--breit">
          <button className="wb-button" type="submit" disabled={laeuft}>
            Konten speichern
          </button>
        </div>
      ) : (
        <p className="wb-leer wb-feld--breit">Ändern darf, wer Schreibrecht in Buchhaltung oder Verwaltung hat.</p>
      )}
    </form>
  );
}
