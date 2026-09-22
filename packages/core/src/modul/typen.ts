import type { ComponentType } from "react";
import type { Bereich } from "../benutzer/rechte";

/**
 * Vertrag zwischen Werkboq Basic und einem Fachmodul.
 *
 * Grundsatz: Der Kern kennt keine Fachmodule. Ein Modul liefert eine
 * Beschreibung (dieses Objekt) und wird in apps/web registriert.
 * Alles, was ein Modul im Kern sichtbar machen will, geht über diese
 * Schnittstelle – nicht über Änderungen am Kern. Ein zweites Modul
 * (z. B. Holz) muss ohne Umbau des Kerns anschließbar sein.
 */
export type Modulart =
  /** Grundfunktion, einzeln verkaufbar: Zeiterfassung, Planung, Verrechnung. */
  | "baustein"
  /** Fachliche Erweiterung für ein Gewerk: Elektro, später Holz, Sanitär. */
  | "fachmodul";

export interface WerkboqModul {
  /** Eindeutige Kennung, z. B. "elektro". Wird auch als Rechte-Bereich verwendet. */
  id: string;
  /** Anzeigename in der Oberfläche. */
  name: string;
  /** Wofür der Baustein da ist — steht in den Einstellungen unter Bausteine. */
  beschreibung?: string;
  /**
   * Baustein oder Fachmodul. Entscheidet nur, wie die Oberfläche gruppiert
   * und was in den Einstellungen als eigener Posten erscheint.
   */
  art?: Modulart;
  /**
   * Andere Module, die dieses hier bereichert, wenn sie vorhanden sind.
   * Nur zur Anzeige und Dokumentation: eine harte Abhängigkeit zwischen
   * Modulen gibt es nicht und darf es nicht geben. Wer einen Nachbarn
   * braucht, holt ihn über einen Dienst und kommt ohne ihn aus.
   */
  ergaenzt?: string[];
  /** Semver, unabhängig vom Kern. */
  version: string;
  /** Mindestversion des Kerns, die dieses Modul voraussetzt. */
  benoetigtKern: string;

  /** Zusätzliche PocketBase-Collections, die das Modul braucht (Name → Felder). */
  collections?: ModulCollection[];

  /** Einträge in der Hauptnavigation. */
  navigation?: NavEintrag[];

  /**
   * Erweiterungspunkte im Kern: Das Modul kann an definierten Stellen
   * eigene Komponenten einhängen, z. B. einen Reiter in der Auftragsansicht.
   */
  erweiterungen?: Partial<Record<Erweiterungspunkt, ComponentType<ErweiterungsProps>>>;

  /** Rechte-Bereiche, die das Modul zusätzlich definiert. */
  bereiche?: Bereich[];

  /** Wird einmal beim Start aufgerufen (z. B. um Offline-Handler zu registrieren). */
  initialisieren?: (kontext: ModulKontext) => void | Promise<void>;
}

export interface ModulCollection {
  name: string;
  schema: Record<string, unknown>[];
  indexes?: string[];
  listRule?: string | null;
  viewRule?: string | null;
  createRule?: string | null;
  updateRule?: string | null;
  deleteRule?: string | null;
}

export interface NavEintrag {
  pfad: string;
  titel: string;
  /** Symbolname aus dem Kern-Iconset. */
  symbol?: string;
  komponente: ComponentType;
  /** Nur sichtbar, wenn der Nutzer diesen Bereich hat. */
  bereich?: Bereich;
  /**
   * Route ja, Eintrag in der Seitenleiste nein.
   * Für Unterseiten wie /belege/:id, die über eine Liste erreicht werden.
   */
  versteckt?: boolean;
  /** Setzt das Registry beim Ausliefern; Module geben das nicht selbst an. */
  modulId?: string;
}

/** Stellen im Kern, an denen Module Oberfläche beisteuern können. */
export type Erweiterungspunkt =
  // Die Auftragsakte ist in Reiter geteilt (seit September 2026). Ein Modul
  // hängt seinen Block in den Reiter, in den er fachlich gehört — nicht
  // alles untereinander, wie es vorher war: das waren am Handy sieben
  // Bildschirmhöhen.
  | "auftrag.arbeit"        // Reiter Arbeit: was auf der Baustelle erfasst wird
  | "auftrag.baustelle"     // Reiter Baustelle: Dokumentation, Nachweise
  | "auftrag.abrechnung"    // Reiter Abrechnung: Positionen, Belege
  | "auftrag.kachel"        // Kachel im Überblick, mit einer Zahl — siehe ui/Auftragskachel
  | "auftrag.abschnitt"     // ALT: landet im Reiter Arbeit, damit nichts verschwindet
  | "auftrag.aktionen"      // Schaltflächen in der Kopfzeile eines Auftrags
  | "kunde.reiter"          // zusätzlicher Reiter in der Kundenansicht
  | "dashboard.kachel";     // Kachel auf der Startseite

export interface ErweiterungsProps {
  /** ID des Datensatzes, an dem die Erweiterung hängt (Auftrag, Kunde, …). */
  datensatzId?: string;
}

export interface ModulKontext {
  kernVersion: string;
}
