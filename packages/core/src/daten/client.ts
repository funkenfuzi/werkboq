import PocketBase from "pocketbase";

let instanz: PocketBase | undefined;

/** Adresse des PocketBase-Servers (Vite: VITE_PB_URL). */
export function pbUrl(): string {
  const env = (import.meta as unknown as { env?: Record<string, string | undefined> }).env;
  // 8095, nicht PocketBase-Standard 8090 — siehe .env.example
  return env?.VITE_PB_URL ?? "http://127.0.0.1:8095";
}

/** Gemeinsamer PocketBase-Client für Kern und Module. */
export function pb(): PocketBase {
  if (!instanz) {
    instanz = new PocketBase(pbUrl());
    instanz.autoCancellation(false);
  }
  return instanz;
}

export function istAngemeldet(): boolean {
  return pb().authStore.isValid;
}

/** `kennung` ist E-Mail oder Benutzername — PocketBase akzeptiert beides. */
export async function anmelden(kennung: string, passwort: string): Promise<void> {
  await pb().collection("users").authWithPassword(kennung, passwort);
}

export function abmelden(): void {
  pb().authStore.clear();
}
