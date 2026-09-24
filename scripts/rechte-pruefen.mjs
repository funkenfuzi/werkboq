#!/usr/bin/env node
/**
 * Prüft die Zugriffsregeln so, wie ein Angreifer es täte: direkt gegen die
 * API, mit echten Zugängen, ohne die Oberfläche.
 *
 * WARUM ES DIESES SKRIPT GIBT.
 *
 * Rechte, die nur in der Oberfläche sitzen, sind kein Schutz. Ein Monteur
 * hat die App am Tablet; wer die Entwicklerkonsole öffnet oder die API
 * direkt anspricht, sieht alles, was die Collection-Regeln hergeben. Ob eine
 * Regel wirklich greift, sieht man nicht im Code und nicht am Bildschirm —
 * man muss es versuchen. Genau das tut dieses Skript.
 *
 * Es legt drei Prüfzugänge an, versucht damit rund zwanzig Zugriffe und
 * räumt hinterher wieder auf. Läuft nur gegen eine PocketBase auf dem
 * eigenen Rechner.
 *
 *   npm run rechte-pruefen
 */
import PocketBase from "pocketbase";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const hier = dirname(fileURLToPath(import.meta.url));
ladeEnv(join(hier, "..", ".env"));

const PB_URL = process.env.PB_URL ?? process.env.VITE_PB_URL ?? "http://127.0.0.1:8095";
const EMAIL = process.env.PB_ADMIN_EMAIL;
const PASSWORT = process.env.PB_ADMIN_PASSWORD;

if (!EMAIL || !PASSWORT) {
  console.error("PB_ADMIN_EMAIL und PB_ADMIN_PASSWORD setzen (siehe .env.example).");
  process.exit(1);
}
if (!/^https?:\/\/(127\.0\.0\.1|localhost)(:|\/|$)/.test(PB_URL)) {
  console.error(`${PB_URL} ist nicht der eigene Rechner. Dieses Skript legt Testzugänge an und läuft deshalb nur lokal.`);
  process.exit(1);
}

const KENNZEICHEN = "wb-rechtepruefung";
const PRUEFPASSWORT = "pruefung-1234";

const admin = new PocketBase(PB_URL);
await admin.admins.authWithPassword(EMAIL, PASSWORT);

const mitarbeiter = await admin.collection("mitarbeiter").getFullList();
if (mitarbeiter.length < 2) {
  console.error("Zu wenig Mitarbeiter. Erst 'npm run beispieldaten' laufen lassen.");
  process.exit(1);
}
const [einer, anderer] = mitarbeiter;
const kundeId = (await admin.collection("kunden").getList(1, 1)).items[0]?.id;
if (!kundeId) {
  console.error("Kein Kunde da. Erst 'npm run beispieldaten' laufen lassen.");
  process.exit(1);
}

let bestanden = 0;
let durchgefallen = 0;
const aufraeumen = [];

try {
  // --------------------------------------------------------------------
  // Prüfdaten: eine Personalakte und eine Abwesenheit.
  // --------------------------------------------------------------------
  const akte = await vorhandenOderNeu("personaldaten", `mitarbeiter = "${einer.id}"`, {
    mitarbeiter: einer.id,
    svnr: "1237010180",
    lohn: 320000,
    lohnart: "monat",
    urlaubsanspruch: 25,
  });
  const abwesenheit = await vorhandenOderNeu(
    "abwesenheiten",
    `mitarbeiter = "${einer.id}" && von >= "2026-09-07 00:00:00" && von <= "2026-09-07 23:59:59"`,
    {
      mitarbeiter: einer.id,
      art: "krankenstand",
      von: "2026-09-07",
      bis: "2026-09-11",
      status: "genehmigt",
      tage: 5,
    },
  );

  // --------------------------------------------------------------------
  // Drei Zugänge mit verschiedenen Rechten.
  // --------------------------------------------------------------------
  const monteur = await pruefzugang("pruef-monteur", [], ["technik"], anderer.id);
  const betroffener = await pruefzugang("pruef-betroffener", [], ["technik"], einer.id);
  const personal = await pruefzugang("pruef-personal", ["personal"], [], null);
  const buero = await pruefzugang("pruef-buero", ["buchhaltung"], ["technik"], null);

  const alsMonteur = await anmelden(monteur.email);
  const alsBetroffener = await anmelden(betroffener.email);
  const alsPersonal = await anmelden(personal.email);
  const alsBuero = await anmelden(buero.email);

  abschnitt("Monteur — nur Technik, und das nur lesend");
  await pruefe("Personaldaten aller lesen", () => alsMonteur.collection("personaldaten").getFullList(), false);
  await pruefe("Personalakte direkt öffnen", () => alsMonteur.collection("personaldaten").getOne(akte.id), false);
  await pruefe("Abwesenheiten lesen", () => alsMonteur.collection("abwesenheiten").getFullList(), false);
  await pruefe("Personaldokumente lesen", () => alsMonteur.collection("personaldokumente").getFullList(), false);
  await pruefe("sich selbst eine Akte anlegen", () => alsMonteur.collection("personaldaten").create({ mitarbeiter: anderer.id, lohn: 999999 }), false);
  await pruefe("fremde Akte ändern", () => alsMonteur.collection("personaldaten").update(akte.id, { lohn: 1 }), false);
  await pruefe("Aufträge lesen", () => alsMonteur.collection("auftraege").getFullList(), true);
  await pruefe("Rechnungen und Angebote lesen", () => alsMonteur.collection("belege").getFullList(), false);
  await pruefe("Belegzeilen lesen", () => alsMonteur.collection("belegpositionen").getFullList(), false);
  await pruefe("Zahlungen lesen", () => alsMonteur.collection("zahlungen").getFullList(), false);
  await pruefe("Nachfassnotizen lesen", () => alsMonteur.collection("angebotskontakte").getFullList(), false);
  await pruefe("Wartungsverträge lesen", () => alsMonteur.collection("vertraege").getFullList(), false);
  await pruefe("einen Auftrag ändern", async () => {
    const a = (await alsMonteur.collection("auftraege").getFullList())[0];
    return await alsMonteur.collection("auftraege").update(a.id, { titel: a.titel });
  }, false);
  await pruefe("einen Kunden ändern", async () => {
    const k = (await alsMonteur.collection("kunden").getFullList())[0];
    return await alsMonteur.collection("kunden").update(k.id, { name: k.name });
  }, false);
  await pruefe("einen Artikelpreis ändern", async () => {
    const a = (await alsMonteur.collection("artikel").getFullList())[0];
    return await alsMonteur.collection("artikel").update(a.id, { preis: a.preis });
  }, false);
  await pruefe("Artikel lesen (für die Materialsuche)", () => alsMonteur.collection("artikel").getFullList(), true);
  await pruefe("Einkaufspreise sehen", async () => {
    const liste = await alsMonteur.collection("artikel").getFullList();
    return liste.filter((a) => a.einkauf > 0);
  }, false);
  await pruefe("eine freigegebene Position ändern", async () => {
    const p = (await alsMonteur.collection("positionen").getFullList({ filter: 'zustand = "freigegeben"' }))[0];
    return await alsMonteur.collection("positionen").update(p.id, { menge: p.menge });
  }, false);
  await pruefe("einen Beleg anlegen", () => alsMonteur.collection("belege").create({ belegart: "rechnung", nummer: "PRUEF-MONTEUR", kunde: kundeId, status: "entwurf", datum: "2026-09-23", empfaengerName: "x", steuerfrei: "keiner" }), false, aufraeumenAls("belege"));

  abschnitt("Der Betroffene selbst — ohne Personalrecht");
  await pruefe("eigene Akte lesen (Auskunftsrecht)", () => alsBetroffener.collection("personaldaten").getFullList(), true);
  await pruefe("eigene Abwesenheiten lesen", () => alsBetroffener.collection("abwesenheiten").getFullList(), true);
  await pruefe("eigene Akte ändern", () => alsBetroffener.collection("personaldaten").update(akte.id, { lohn: 9999999 }), false);
  await pruefe("Urlaub beantragen", () => alsBetroffener.collection("abwesenheiten").create({ mitarbeiter: einer.id, art: "urlaub", von: "2026-11-02", bis: "2026-11-06", status: "beantragt", tage: 5 }), true, aufraeumenAls("abwesenheiten"));
  await pruefe("eigenen Urlaub gleich selbst genehmigen", () => alsBetroffener.collection("abwesenheiten").create({ mitarbeiter: einer.id, art: "urlaub", von: "2026-12-01", bis: "2026-12-05", status: "genehmigt", tage: 5 }), false);
  await pruefe("den eigenen Krankenstand nachträglich genehmigen", () => alsBetroffener.collection("abwesenheiten").update(abwesenheit.id, { status: "genehmigt" }), false);

  abschnitt("Personalstelle");
  await pruefe("Personaldaten lesen", () => alsPersonal.collection("personaldaten").getFullList(), true);
  await pruefe("Abwesenheiten lesen", () => alsPersonal.collection("abwesenheiten").getFullList(), true);
  await pruefe("Akte ändern", () => alsPersonal.collection("personaldaten").update(akte.id, { notizen: "geprüft" }), true);
  await pruefe("Urlaub genehmigen", () => alsPersonal.collection("abwesenheiten").update(abwesenheit.id, { status: "genehmigt" }), true);

  // --------------------------------------------------------------------
  // Büro mit Buchhaltung: darf alles rund um Belege — außer an einem
  // festgeschriebenen Beleg etwas ändern. Das schützt ein Hook
  // (server/pb_hooks/belege.pb.js), nicht die Regel.
  // --------------------------------------------------------------------
  abschnitt("Büro — Buchhaltung");
  await pruefe("Belege lesen", () => alsBuero.collection("belege").getFullList(), true);
  await pruefe("Wartungsverträge lesen", () => alsBuero.collection("vertraege").getFullList(), true);
  await pruefe("Einkaufspreise sehen", async () => {
    const liste = await alsBuero.collection("artikel").getFullList();
    return liste.filter((a) => a.einkauf > 0);
  }, true);
  await pruefe("einen Auftrag ändern (Phase, Verrechnen)", async () => {
    const a = (await alsBuero.collection("auftraege").getFullList())[0];
    return await alsBuero.collection("auftraege").update(a.id, { titel: a.titel });
  }, true);
  const entwurf = await alsBuero.collection("belege").create({ belegart: "rechnung", nummer: "PRUEF-BUERO-1", kunde: kundeId, status: "entwurf", datum: "2026-09-23", empfaengerName: "Prüfung", steuerfrei: "keiner", netto: 10000, ust: 2000, brutto: 12000 });
  aufraeumen.push(() => admin.collection("belege").delete(entwurf.id));
  await pruefe("Zeile an einen Entwurf", () => alsBuero.collection("belegpositionen").create({ beleg: entwurf.id, pos: 10, bezeichnung: "Prüfzeile", menge: 1, einzelpreis: 10000, ustsatz: 20, betrag: 10000 }), true);
  await pruefe("Entwurf ändern", () => alsBuero.collection("belege").update(entwurf.id, { kopftext: "geändert" }), true);
  await admin.collection("belege").update(entwurf.id, { festgeschrieben: new Date().toISOString(), status: "offen" });
  await pruefe("festgeschriebenen Betrag ändern", () => alsBuero.collection("belege").update(entwurf.id, { netto: 1 }), false);
  await pruefe("festgeschriebenen Empfänger ändern", () => alsBuero.collection("belege").update(entwurf.id, { empfaengerName: "jemand anderer" }), false);
  await pruefe("Zeile anhängen an festgeschriebenen Beleg", () => alsBuero.collection("belegpositionen").create({ beleg: entwurf.id, pos: 20, bezeichnung: "nachträglich", menge: 1, einzelpreis: 1, ustsatz: 20, betrag: 1 }), false);
  await pruefe("festgeschriebenen Beleg löschen", () => alsBuero.collection("belege").delete(entwurf.id), false);
  await pruefe("Status auf bezahlt setzen", () => alsBuero.collection("belege").update(entwurf.id, { status: "bezahlt" }), true);

  // Nachfasseinträge sind der Nachweis, dass nachgefasst wurde — keine
  // updateRule, kein Löschen. Geprüft mit dem Büro, das sie lesen darf —
  // sonst hieße „gesperrt" nur „nicht gefunden".
  const kontakt = await alsBuero.collection("angebotskontakte").getList(1, 1).catch(() => null);
  if (kontakt?.items[0]) {
    await pruefe(
      "Nachfasseintrag nachträglich ändern",
      () => alsBuero.collection("angebotskontakte").update(kontakt.items[0].id, { notiz: "geändert" }),
      false,
    );
    await pruefe(
      "Nachfasseintrag löschen",
      () => alsBuero.collection("angebotskontakte").delete(kontakt.items[0].id),
      false,
    );
  }

  // Versandnachweis: nur die Bestätigung darf sich nachträglich ändern.
  abschnitt("Versandnachweis");
  const nachweis = await admin.collection("versand").create({ bereich: "belege", datensatz: "pruefung", bezeichnung: "Prüfnachweis", weg: "mail", empfaenger: "kunde@beispiel.invalid", bestaetigt: false });
  aufraeumen.push(() => admin.collection("versand").delete(nachweis.id));
  await pruefe("Empfänger nachträglich umschreiben", () => alsBuero.collection("versand").update(nachweis.id, { empfaenger: "jemand@anderer.invalid" }), false);
  await pruefe("Versand bestätigen", () => alsMonteur.collection("versand").update(nachweis.id, { bestaetigt: true }), true);
  await pruefe("Bestätigung zurücknehmen", () => alsBuero.collection("versand").update(nachweis.id, { bestaetigt: false }), false);
  const zweiter = await admin.collection("versand").create({ bereich: "belege", datensatz: "pruefung", bezeichnung: "Prüfnachweis 2", weg: "mail", empfaenger: "kunde@beispiel.invalid", bestaetigt: false });
  aufraeumen.push(() => admin.collection("versand").delete(zweiter.id));
  await pruefe("„nicht erfolgt“ vermerken", () => alsBuero.collection("versand").update(zweiter.id, { nichtErfolgt: true }), true);
  await pruefe("danach doch bestätigen", () => alsBuero.collection("versand").update(zweiter.id, { bestaetigt: true }), false);

  // --------------------------------------------------------------------
  // Was noch offen ist. Kein Fehler, sondern der ehrliche Stand.
  // --------------------------------------------------------------------
  abschnitt("Noch nicht serverseitig durchgesetzt");
  const offen = [];
  // Derzeit nichts. Kommt eine neue Collection mit lockeren Regeln dazu,
  // gehört sie hier hinein — bis sie nachgezogen ist.
  console.log(
    `\n${bestanden} von ${bestanden + durchgefallen} Prüfungen wie erwartet.` +
      (offen.length > 0
        ? `\n${offen.length} Bereiche sind vorerst nur in der Oberfläche geschützt — siehe oben.`
        : ""),
  );
} finally {
  for (const weg of aufraeumen.reverse()) await weg().catch(() => undefined);
  const konten = await admin
    .collection("users")
    .getFullList({ filter: `name = "${KENNZEICHEN}"` })
    .catch(() => []);
  for (const k of konten) await admin.collection("users").delete(k.id).catch(() => undefined);
  if (konten.length > 0) console.log(`${konten.length} Prüfzugänge wieder entfernt.`);
}

process.exit(durchgefallen > 0 ? 1 : 0);

// ------------------------------------------------------------------------

function abschnitt(titel) {
  console.log(`\n=== ${titel} ===`);
}

/**
 * Führt einen Zugriff aus und vergleicht mit der Erwartung.
 *
 * Wichtig: bei einer Liste wirft PocketBase kein 403, sondern gibt eine
 * leere Liste zurück — die Regel filtert, statt zu verweigern. Leer zählt
 * deshalb als gesperrt.
 */
async function pruefe(beschreibung, was, sollGehen, danach) {
  let durch = false;
  let hinweis;
  try {
    const r = await was();
    const anzahl = Array.isArray(r) ? r.length : r ? 1 : 0;
    durch = anzahl > 0;
    hinweis = durch ? `${anzahl}` : "leer";
    if (durch && danach && r && !Array.isArray(r)) danach(r);
  } catch (e) {
    hinweis = `HTTP ${e.status ?? "?"}`;
  }
  const richtig = durch === sollGehen;
  if (richtig) bestanden += 1;
  else durchgefallen += 1;
  console.log(
    `  ${richtig ? "ok    " : "FEHLER"} ${beschreibung.padEnd(48)} ${String(hinweis).padEnd(8)} erwartet: ${sollGehen ? "erlaubt" : "gesperrt"}`,
  );
}

/** Nur feststellen und sagen, ohne zu werten — das ist bekannter Rückstand. */
async function nurBerichten(sammlung, beschreibung, was) {
  try {
    if (await was()) {
      sammlung.push(beschreibung);
      console.log(`  offen  ${beschreibung}`);
      return;
    }
  } catch {
    /* gesperrt — dann ist der Rückstand schon aufgeholt */
  }
  console.log(`  ok     ${beschreibung}: inzwischen gesperrt`);
}

function aufraeumenAls(collection) {
  return (datensatz) =>
    aufraeumen.push(() => admin.collection(collection).delete(datensatz.id));
}

async function vorhandenOderNeu(collection, filter, daten) {
  const da = await admin.collection(collection).getFirstListItem(filter).catch(() => null);
  if (da) return da;
  const neu = await admin.collection(collection).create(daten);
  aufraeumen.push(() => admin.collection(collection).delete(neu.id));
  return neu;
}

async function pruefzugang(kennung, bereiche, lesebereiche, mitarbeiterId) {
  const email = `${kennung}@rechtepruefung.invalid`;
  for (const alt of await admin.collection("users").getFullList({ filter: `email = "${email}"` })) {
    await admin.collection("users").delete(alt.id);
  }
  const u = await admin.collection("users").create({
    email,
    password: PRUEFPASSWORT,
    passwordConfirm: PRUEFPASSWORT,
    name: KENNZEICHEN,
    bereiche,
    lesebereiche,
    admin: false,
  });
  if (mitarbeiterId) {
    const vorher = (await admin.collection("mitarbeiter").getOne(mitarbeiterId)).benutzer;
    await admin.collection("mitarbeiter").update(mitarbeiterId, { benutzer: u.id });
    aufraeumen.push(() =>
      admin.collection("mitarbeiter").update(mitarbeiterId, { benutzer: vorher || null }),
    );
  }
  aufraeumen.push(() => admin.collection("users").delete(u.id));
  return u;
}

async function anmelden(email) {
  const c = new PocketBase(PB_URL);
  await c.collection("users").authWithPassword(email, PRUEFPASSWORT);
  return c;
}

/** Minimaler .env-Leser — dieselbe Handvoll Zeilen wie in einrichten.mjs. */
function ladeEnv(pfad) {
  let text;
  try {
    text = readFileSync(pfad, "utf8");
  } catch {
    return;
  }
  for (const zeile of text.split("\n")) {
    const treffer = zeile.match(/^\s*([A-Z_][A-Z0-9_]*)\s*=\s*(.*)\s*$/i);
    if (!treffer) continue;
    const [, name, wert] = treffer;
    if (process.env[name] === undefined) {
      process.env[name] = wert.replace(/^["']|["']$/g, "");
    }
  }
}
