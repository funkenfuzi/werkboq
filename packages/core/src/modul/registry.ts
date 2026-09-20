import type { ComponentType } from "react";
import type { Erweiterungspunkt, ErweiterungsProps, Modulart, NavEintrag, WerkboqModul } from "./typen";
import type { Bereich } from "../benutzer/rechte";
import { bausteinAktiv } from "./bausteine";

export const KERN_VERSION = "0.1.0";

const module = new Map<string, WerkboqModul>();

/**
 * Meldet ein Modul an. Wird von apps/web beim Start aufgerufen.
 *
 * Angemeldet werden immer alle mitgelieferten Module — sonst könnte die
 * Einstellungsseite gar nicht anbieten, einen Baustein einzuschalten.
 * Ob eines tatsächlich läuft, entscheidet erst moduleStarten().
 */
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
}

let gestartet = false;

/**
 * Startet die freigegebenen Module: erst hier melden sie ihre Dienste an.
 *
 * Getrennt vom Anmelden, weil beim Anmelden noch nicht feststeht, was dieser
 * Betrieb gekauft hat — das steht in den Betriebsstammdaten und kommt über
 * das Netz. Ein nicht freigegebener Baustein darf keinen Dienst anbieten,
 * sonst zeigt die Planung gebuchte Stunden aus einer Zeiterfassung, die es
 * für diesen Betrieb gar nicht gibt.
 */
export async function moduleStarten(): Promise<void> {
  if (gestartet) return;
  gestartet = true;
  for (const m of aktiveModule()) {
    await m.initialisieren?.({ kernVersion: KERN_VERSION });
  }
}

export function alleModule(): WerkboqModul[] {
  return [...module.values()];
}

/** Nur die Module, die dieser Betrieb gekauft hat. */
export function aktiveModule(art?: Modulart): WerkboqModul[] {
  return alleModule().filter(
    (m) => bausteinAktiv(m.id) && (!art || (m.art ?? "fachmodul") === art),
  );
}

export function modul(id: string): WerkboqModul | undefined {
  return module.get(id);
}

/**
 * Navigationseinträge der freigegebenen Module, in Registrierungsreihenfolge.
 * Ein nicht gekaufter Baustein taucht gar nicht erst auf — weder in der
 * Seitenleiste noch als Route.
 */
export function alleNavEintraege(art?: Modulart): NavEintrag[] {
  return aktiveModule(art).flatMap((m) =>
    (m.navigation ?? []).map((n) => ({ ...n, modulId: m.id })),
  );
}

/** Alle Komponenten, die an einem Erweiterungspunkt hängen. */
export function erweiterungen(
  punkt: Erweiterungspunkt,
): { modulId: string; Komponente: ComponentType<ErweiterungsProps> }[] {
  return aktiveModule().flatMap((m) => {
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
  gestartet = false;
}
