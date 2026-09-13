import PocketBase from "pocketbase";

let instanz: PocketBase | undefined;

/** Adresse des PocketBase-Servers (Vite: VITE_PB_URL). */
export function pbUrl(): string {
  const env = (import.meta as unknown as { env?: Record<string, string | undefined> }).env;
  return env?.VITE_PB_URL ?? "http://127.0.0.1:8090";
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

export async function anmelden(email: string, passwort: string): Promise<void> {
  await pb().collection("users").authWithPassword(email, passwort);
}

export function abmelden(): void {
  pb().authStore.clear();
}
