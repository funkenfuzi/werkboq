import type { ComponentType } from "react";
import type { Erweiterungspunkt, ErweiterungsProps, NavEintrag, WerkboqModul } from "./typen";
import type { Bereich } from "../benutzer/rechte";

export const KERN_VERSION = "0.1.0";

const module = new Map<string, WerkboqModul>();

/** Registriert ein Modul. Wird von apps/web beim Start aufgerufen. */
export async function modulRegistrieren(modul: WerkboqModul): Promise<void> {
  if (module.has(modul.id)) {
    throw new Error(`Modul "${modul.id}" ist bereits registriert.`);
  }
  if (!kernVersionPasst(modul.benoetigtKern, KERN_VERSION)) {
    throw new Error(
      `Modul "${modul.id}" benötigt Kern ${modul.benoetigtKern}, vorhanden ist ${KERN_VERSION}.`,
    );
  }
  module.set(modul.id, modul);
  await modul.initialisieren?.({ kernVersion: KERN_VERSION });
}

export function alleModule(): WerkboqModul[] {
  return [...module.values()];
}

export function modul(id: string): WerkboqModul | undefined {
  return module.get(id);
}

/** Alle Navigationseinträge aller Module, in Registrierungsreihenfolge. */
export function alleNavEintraege(): NavEintrag[] {
  return alleModule().flatMap((m) => m.navigation ?? []);
}

/** Alle Komponenten, die an einem Erweiterungspunkt hängen. */
export function erweiterungen(
  punkt: Erweiterungspunkt,
): { modulId: string; Komponente: ComponentType<ErweiterungsProps> }[] {
  return alleModule().flatMap((m) => {
    const k = m.erweiterungen?.[punkt];
    return k ? [{ modulId: m.id, Komponente: k }] : [];
  });
}

/** Rechte-Bereiche: Kernbereiche plus alle von Modulen definierten. */
export function alleBereiche(kernBereiche: Bereich[]): Bereich[] {
  const set = new Set<Bereich>(kernBereiche);
  for (const m of alleModule()) {
    set.add(m.id);
    for (const b of m.bereiche ?? []) set.add(b);
  }
  return [...set];
}

/** Einfacher Semver-Vergleich: benötigt "^major.minor.patch" oder exakt. */
function kernVersionPasst(benoetigt: string, vorhanden: string): boolean {
  const caret = benoetigt.startsWith("^");
  const b = benoetigt.replace(/^\^/, "").split(".").map(Number);
  const v = vorhanden.split(".").map(Number);
  const [bMaj = 0, bMin = 0, bPat = 0] = b;
  const [vMaj = 0, vMin = 0, vPat = 0] = v;
  if (!caret) return bMaj === vMaj && bMin === vMin && bPat === vPat;
  if (bMaj !== vMaj) return false;
  if (vMin !== bMin) return vMin > bMin;
  return vPat >= bPat;
}

/** Nur für Tests. */
export function _registryZuruecksetzen(): void {
  module.clear();
}
