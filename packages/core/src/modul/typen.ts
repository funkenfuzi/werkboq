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
export interface WerkboqModul {
  /** Eindeutige Kennung, z. B. "elektro". Wird auch als Rechte-Bereich verwendet. */
  id: string;
  /** Anzeigename in der Oberfläche. */
  name: string;
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
}

/** Stellen im Kern, an denen Module Oberfläche beisteuern können. */
export type Erweiterungspunkt =
  | "auftrag.reiter"        // zusätzlicher Reiter in der Auftragsansicht
  | "auftrag.aktionen"      // Buttons in der Kopfzeile eines Auftrags
  | "kunde.reiter"          // zusätzlicher Reiter in der Kundenansicht
  | "dashboard.kachel";     // Kachel auf der Startseite

export interface ErweiterungsProps {
  /** ID des Datensatzes, an dem die Erweiterung hängt (Auftrag, Kunde, …). */
  datensatzId?: string;
}

export interface ModulKontext {
  kernVersion: string;
}
