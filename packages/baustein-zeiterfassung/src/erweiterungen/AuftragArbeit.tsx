import { useEffect, useState } from "react";
import { alsStunden, Auftragskachel, type ErweiterungsProps } from "@werkboq/core";
import { AuftragZeiten } from "./AuftragZeiten";
import { AuftragFahrten } from "./AuftragFahrten";
import { summe, zeitenZuAuftrag } from "../daten/zeiten";
import { fahrtenZuAuftrag, summeKm } from "../daten/fahrten";

/**
 * Reiter „Arbeit": Zeiten und Fahrten.
 *
 * Ein Modul hängt eine Komponente je Erweiterungspunkt ein. Zeiten und
 * Fahrten sind zwei Blöcke, gehören aber beide in denselben Reiter —
 * deshalb dieser Rahmen.
 */
export function AuftragArbeit({ datensatzId }: ErweiterungsProps) {
  if (!datensatzId) return null;
  return (
    <>
      <AuftragZeiten datensatzId={datensatzId} />
      <AuftragFahrten auftragId={datensatzId} />
    </>
  );
}

/** Zwei Kacheln im Überblick: Stunden und Kilometer. */
export function ArbeitKacheln({ datensatzId }: ErweiterungsProps) {
  const [minuten, setMinuten] = useState<number | null>(null);
  const [km, setKm] = useState<{ km: number; fahrten: number } | null>(null);

  useEffect(() => {
    if (!datensatzId) return;
    zeitenZuAuftrag(datensatzId)
      .then((z) => setMinuten(summe(z)))
      .catch(() => setMinuten(0));
    fahrtenZuAuftrag(datensatzId)
      .then((f) => setKm({ km: summeKm(f), fahrten: f.length }))
      .catch(() => setKm({ km: 0, fahrten: 0 }));
  }, [datensatzId]);

  if (!datensatzId || minuten === null || km === null) return null;

  return (
    <>
      <Auftragskachel
        auftragId={datensatzId}
        reiter="arbeit"
        titel="Zeiten"
        wert={`${alsStunden(minuten)} h`}
        zusatz={minuten ? undefined : "noch nichts gebucht"}
      />
      <Auftragskachel
        auftragId={datensatzId}
        reiter="arbeit"
        titel="Kilometer"
        wert={`${km.km.toLocaleString("de-AT")} km`}
        zusatz={km.fahrten ? `${km.fahrten} ${km.fahrten === 1 ? "Fahrt" : "Fahrten"}` : "noch keine Fahrt"}
      />
    </>
  );
}
