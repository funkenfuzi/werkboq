import { pb } from "../daten/client";
import { protokollieren } from "../daten/protokoll";
import { KERN_BEREICHE, type Bereich, type Stufe } from "./rechte";
import { alleModule } from "../modul/registry";
import type { Mitarbeiter } from "../daten/mitarbeiter";

/**
 * Zugänge verwalten.
 *
 * Benutzer und Mitarbeiter werden gemeinsam geführt: ein Zugang gehört immer
 * zu einem Mitarbeiter, nie für sich allein. Wer keinen Zugang braucht —
 * Lehrlinge, die nur eingeplant werden — hat eben keinen.
 *
 * Kunden bekommen hier bewusst nichts. Ein Kundenportal wäre eine eigene
 * Anmeldung mit eigenen Regeln, kein Mitarbeiterzugang mit weniger Rechten.
 *
 * Geschrieben wird direkt gegen PocketBase statt über die Offline-
 * Warteschlange: Zugänge legt man am Schreibtisch an, nicht im Keller, und
 * ein halb angelegter Zugang in einer Warteschlange wäre gefährlicher als
 * eine ehrliche Fehlermeldung.
 */

export interface Zugang {
  id: string;
  email: string;
  name: string;
  /** Bereiche mit Schreibrecht. */
  bereiche: Bereich[];
  /** Bereiche, die nur gelesen werden dürfen. */
  lesebereiche: Bereich[];
  admin: boolean;
}

export interface Bereichswahl {
  id: Bereich;
  titel: string;
  hinweis: string;
  /**
   * Bereiche, in denen ein reines Leserecht keinen Sinn ergibt.
   * Wer Zugänge vergeben darf, kann sie auch ändern — ein Betrachter der
   * Verwaltung wäre eine Stufe, die nichts schützt und nur verwirrt.
   */
  nurGanz?: boolean;
}

/** Alle Bereiche, die vergeben werden können — Kern plus angemeldete Module. */
export function vergebbareBereiche(): Bereichswahl[] {
  const kern: Bereichswahl[] = [
    { id: "verwaltung", titel: "Verwaltung", hinweis: "Stammdaten und Zugänge", nurGanz: true },
    { id: "buchhaltung", titel: "Buchhaltung", hinweis: "Angebote und Rechnungen" },
    { id: "technik", titel: "Technik", hinweis: "Kunden, Aufträge, Planung" },
    { id: "lager", titel: "Lager", hinweis: "Material" },
    {
      id: "personal",
      titel: "Personalwesen",
      hinweis: "Personalakte, Abwesenheiten, Lohnvorbereitung",
    },
    { id: "entwickler", titel: "Entwickler", hinweis: "Diagnose und Rohdaten", nurGanz: true },
  ];
  const kernBereiche = kern.filter((b) => KERN_BEREICHE.includes(b.id as never));

  // Ein Modul, das denselben Namen trägt wie ein Kernbereich, bekommt keinen
  // zweiten Eintrag: der Baustein Personalwesen heißt "personal", und genau
  // so heißt der Bereich, den seine Collection-Regeln prüfen. Zwei Zeilen
  // dafür wären zwei Schalter für dieselbe Sache — und React beschwert sich
  // zu Recht über den doppelten Schlüssel.
  const belegt = new Set(kernBereiche.map((b) => b.id));
  const module = alleModule()
    .filter((m) => !belegt.has(m.id))
    .map((m) => ({
      id: m.id,
      titel: m.name,
      hinweis: m.art === "fachmodul" ? "Fachmodul" : "Baustein",
    }));

  return [...kernBereiche, ...module];
}

export async function zugangLaden(benutzerId: string): Promise<Zugang | null> {
  const datensatz = await pb()
    .collection("users")
    .getOne(benutzerId)
    .catch(() => null);
  if (!datensatz) return null;
  const roh = datensatz as unknown as Record<string, unknown>;
  return {
    id: String(roh.id),
    email: String(roh.email ?? ""),
    name: String(roh.name ?? ""),
    bereiche: Array.isArray(roh.bereiche) ? (roh.bereiche as Bereich[]) : [],
    lesebereiche: Array.isArray(roh.lesebereiche) ? (roh.lesebereiche as Bereich[]) : [],
    admin: Boolean(roh.admin),
  };
}

/**
 * Legt einen Zugang an und verknüpft ihn mit dem Mitarbeiter.
 * Das Passwort vergibt der Administrator; der Mitarbeiter ändert es später
 * selbst — dafür genügt die Selbst-Änderungsregel der users-Collection.
 */
export async function zugangAnlegen(
  m: Mitarbeiter,
  email: string,
  passwort: string,
  bereiche: Bereich[],
  admin = false,
  lesebereiche: Bereich[] = [],
): Promise<Zugang> {
  const neu = await pb().collection("users").create({
    email: email.trim(),
    password: passwort,
    passwordConfirm: passwort,
    name: m.name,
    bereiche,
    lesebereiche,
    admin,
    emailVisibility: false,
    // "verified" darf laut PocketBase nur der Serveradministrator setzen —
    // über die API abgelehnt ("Must be a valid value"). Für die Anmeldung
    // spielt es keine Rolle: Werkboq verschickt keine Bestätigungsmails,
    // Zugänge entstehen im Betrieb und nicht durch Selbstregistrierung.
  });

  await pb().collection("mitarbeiter").update(m.id, { benutzer: neu.id });
  await protokollieren("mitarbeiter", m.id, "aendern", `Zugang ${email.trim()} angelegt`);

  return {
    id: neu.id,
    email: email.trim(),
    name: m.name,
    bereiche,
    lesebereiche,
    admin,
  };
}

export async function bereicheSetzen(
  m: Mitarbeiter,
  benutzerId: string,
  bereiche: Bereich[],
  admin: boolean,
  lesebereiche: Bereich[] = [],
): Promise<void> {
  await pb().collection("users").update(benutzerId, { bereiche, lesebereiche, admin });
  await protokollieren("mitarbeiter", m.id, "aendern", `Berechtigungen geändert: ${rechteText(bereiche, lesebereiche, admin)}`);
}

/** Was im Änderungsverlauf steht — lesbar, nicht als Feldsalat. */
export function rechteText(bereiche: Bereich[], lesebereiche: Bereich[], admin: boolean): string {
  if (admin) return "Administrator";
  const teile: string[] = [];
  if (bereiche.length > 0) teile.push(`ändern: ${bereiche.join(", ")}`);
  if (lesebereiche.length > 0) teile.push(`lesen: ${lesebereiche.join(", ")}`);
  return teile.join(" · ") || "keine Bereiche";
}

/** Die Stufe je Bereich für einen Zugang — für die Oberfläche. */
export function stufenVon(z: Pick<Zugang, "bereiche" | "lesebereiche" | "admin">): Record<Bereich, Stufe> {
  const stufen: Record<Bereich, Stufe> = {};
  for (const b of vergebbareBereiche()) {
    stufen[b.id] = z.admin
      ? "schreiben"
      : z.bereiche.includes(b.id)
        ? "schreiben"
        : z.lesebereiche.includes(b.id)
          ? "lesen"
          : "keine";
  }
  return stufen;
}

/**
 * Setzt das Passwort eines anderen Mitarbeiters.
 *
 * Nicht über die Datensatz-API: PocketBase verlangt dort immer das alte
 * Passwort — ausgerechnet im häufigsten Fall, dem vergessenen. Dafür gibt es
 * server/pb_hooks/passwort.pb.js; die Prüfung, wer das darf, steht dort.
 */
export async function passwortSetzen(
  m: Mitarbeiter,
  benutzerId: string,
  passwort: string,
): Promise<void> {
  await pb().send("/api/werkboq/passwort", {
    method: "POST",
    body: { benutzer: benutzerId, passwort },
  });
  await protokollieren("mitarbeiter", m.id, "aendern", "Passwort zurückgesetzt");
}

/**
 * Entfernt den Zugang, behält den Mitarbeiter.
 *
 * Der Benutzerdatensatz wird wirklich gelöscht — ein stillgelegter Zugang,
 * der sich weiter anmelden kann, wäre trügerisch. Zeiten bleiben erhalten:
 * sie tragen den Namen des Erfassers als Text und hängen fachlich am
 * Mitarbeiter, nicht am Konto.
 */
export async function zugangEntfernen(m: Mitarbeiter, benutzerId: string): Promise<void> {
  await pb().collection("mitarbeiter").update(m.id, { benutzer: null });
  await pb().collection("users").delete(benutzerId);
  await protokollieren("mitarbeiter", m.id, "aendern", "Zugang entfernt");
}

/**
 * Mindestlänge, die PocketBase für Passwörter verlangt.
 *
 * Die Collection-Einstellungen darf nur der Serveradministrator lesen, ein
 * angemeldeter Betriebsadministrator nicht — deshalb nennt der Server diese
 * eine Zahl über einen eigenen Endpunkt. Antwortet er nicht, gilt 8: strenger
 * als jede zulässige Einstellung und damit nie zu wenig.
 */
export async function mindestlaengePasswort(): Promise<number> {
  try {
    const antwort = (await pb().send("/api/werkboq/passwortregel", { method: "GET" })) as {
      mindestens?: number;
    };
    return antwort?.mindestens && antwort.mindestens > 0 ? antwort.mindestens : 8;
  } catch {
    return 8;
  }
}
