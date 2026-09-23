#!/usr/bin/env node
/**
 * Richtet PocketBase für Werkboq ein – idempotent.
 *
 * Legt alle Kern-Collections und alle Modul-Collections an bzw. gleicht sie ab.
 * Mehrfach ausführbar; ersetzt jede Form von Migrationen.
 *
 * Voraussetzung: PocketBase läuft (npm run server) und es gibt einen Admin.
 *   PB_URL, PB_ADMIN_EMAIL, PB_ADMIN_PASSWORD aus .env oder Umgebung.
 *
 * SCHUTZ VOR FREMDEN DATENBANKEN
 * Dieses Skript verändert das Schema der PocketBase unter PB_URL. Läuft dort
 * eine andere Anwendung (etwa eine lokale FD-Book-Instanz), würden deren Daten
 * mit Werkboq-Collections vermischt. Deshalb:
 *   - Werkboq läuft auf Port 8095, nicht auf PocketBase-Standard 8090.
 *   - Beim ersten Lauf wird die Marker-Collection "werkboq_meta" angelegt.
 *   - Findet das Skript eine Datenbank mit fremden Collections und ohne diesen
 *     Marker, bricht es ab, statt hineinzuschreiben.
 * Der Abbruch lässt sich mit WERKBOQ_TROTZDEM=ja übergehen – bewusst umständlich.
 */
import PocketBase from "pocketbase";
import { readFileSync, existsSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { KERN, BAUSTEINE, MODULE } from "./schema.mjs";
import { angemeldet, nurAdmin, standardRegeln } from "@werkboq/core/schema/regeln.mjs";

/**
 * Aufträge von den alten zehn Phasen auf das Gerüst aus sieben Stufen
 * umschlüsseln.
 *
 * Idempotent: gibt es keinen Auftrag mit alter Phase mehr, tut die Funktion
 * nichts. Die Zuordnung ist dieselbe wie ALTE_PHASEN in
 * packages/core/src/daten/phasen.ts; ein Test hält beide beieinander.
 *
 * Der Ablauf hat eine Reihenfolge, die man nicht umdrehen darf: erst das
 * Auswahlfeld um die neuen Werte ERWEITERN, dann die Datensätze
 * umschreiben, und erst danach — im normalen Abgleich — die alten Werte
 * streichen. Andersherum lehnt PocketBase das Umschreiben ab, weil der neue
 * Wert noch nicht erlaubt ist, oder das Streichen, weil noch Datensätze den
 * alten tragen.
 */
const ALTE_PHASEN = {
  anfrage: "eingang",
  spezifikation: "eingang",
  angebot: "angebot",
  termine: "beauftragt",
  projekt: "beauftragt",
  errichtung: "in_arbeit",
  abnahme: "fertig",
  wartung: "fertig",
  materialverkauf: "beauftragt",
  abgeschlossen: "abgeschlossen",
};
const NEUE_PHASEN = ["eingang", "angebot", "beauftragt", "in_arbeit", "fertig", "verrechnen", "abgeschlossen"];

async function phasenUmschluesseln() {
  let c;
  try {
    c = await pb.collections.getOne("auftraege");
  } catch {
    return; // frische Datenbank, nichts umzuschlüsseln
  }
  const feld = c.schema.find((f) => f.name === "phase");
  if (!feld) return;

  const alt = Object.keys(ALTE_PHASEN).filter((p) => !NEUE_PHASEN.includes(p));
  const betroffen = await pb
    .collection("auftraege")
    .getFullList({ filter: alt.map((p) => `phase = "${p}"`).join(" || "), fields: "id,phase,nummer" });
  if (!betroffen.length) return;

  // 1. Feld erweitern, damit beide Welten gleichzeitig gültig sind.
  const vereinigt = [...new Set([...(feld.options?.values ?? []), ...NEUE_PHASEN])];
  await pb.collections.update(c.id, {
    schema: c.schema.map((f) => (f.name === "phase" ? { ...f, options: { ...f.options, values: vereinigt } } : f)),
  });

  // 2. Umschreiben.
  const zaehler = {};
  for (const a of betroffen) {
    const neu = ALTE_PHASEN[a.phase] ?? "eingang";
    await pb.collection("auftraege").update(a.id, { phase: neu });
    zaehler[`${a.phase} → ${neu}`] = (zaehler[`${a.phase} → ${neu}`] ?? 0) + 1;
  }
  console.log(`auftraege: ${betroffen.length} Phasen umgeschlüsselt`);
  for (const [was, n] of Object.entries(zaehler)) console.log(`  ${n} × ${was}`);
  // 3. Das Streichen der alten Werte übernimmt der normale Abgleich.
}

/** Collection -> neu hinzugekommene Feldnamen, für die Schlussmeldung. */
const geaendert = new Map();

const hier = dirname(fileURLToPath(import.meta.url));
ladeEnv(join(hier, "..", ".env"));

const PB_URL = process.env.PB_URL ?? process.env.VITE_PB_URL ?? "http://127.0.0.1:8095";
const EMAIL = process.env.PB_ADMIN_EMAIL;
const PASSWORT = process.env.PB_ADMIN_PASSWORD;

if (!EMAIL || !PASSWORT) {
  console.error("PB_ADMIN_EMAIL und PB_ADMIN_PASSWORD setzen (siehe .env.example).");
  process.exit(1);
}

/** Marker-Collection, die diese Datenbank als Werkboq-Datenbank kennzeichnet. */
const MARKER = "werkboq_meta";

/** Alle Bereiche, die der erste Benutzer bekommt. */
const KERN_BEREICHE_UND_MODULE = [
  "verwaltung",
  "buchhaltung",
  "technik",
  "lager",
  "personal",
  "entwickler",
  "elektro",
];



const pb = new PocketBase(PB_URL);

try {
  await pb.admins.authWithPassword(EMAIL, PASSWORT);
  console.log(`Verbunden mit ${PB_URL}`);

  // Sicherstellen, dass dies wirklich die Werkboq-Datenbank ist
  await datenbankPruefen();

  // users-Collection um Werkboq-Felder ergänzen
  await benutzerErgaenzen();

  // Relationen werden in den Definitionen über den Collection-NAMEN
  // angegeben; PocketBase erwartet die interne Kennung. Die Zuordnung füllt
  // sich beim Anlegen — außer für "users", das es schon gibt.
  const ids = new Map();
  // Alles, was es schon gibt, vorab eintragen. Dann lösen sich Verknüpfungen
  // auf bestehende Collections gleich im ersten Durchgang auf, und eine
  // fertig eingerichtete Datenbank braucht den zweiten gar nicht.
  for (const c of await pb.collections.getFullList()) ids.set(c.name, c.id);

  // Muss VOR dem Abgleich laufen: der schränkt das Phasenfeld auf die
  // neuen Werte ein, und ein Auftrag mit alter Phase wäre danach nicht mehr
  // speicherbar.
  await phasenUmschluesseln();

  const alle = [...KERN, ...BAUSTEINE, ...MODULE];

  /**
   * Zwei Durchgänge.
   *
   * Eine Collection kann auf sich selbst zeigen — "belege.storniert" auf den
   * stornierten Beleg — und PocketBase kennt beim Anlegen deren Kennung noch
   * nicht. Solche Felder bleiben im ersten Durchgang weg; im zweiten stehen
   * alle Kennungen fest und collectionAbgleichen hängt sie an. Idempotent,
   * also kostet der zweite Durchgang bei einer fertigen Datenbank nichts.
   */
  const zurueckgestellt = new Set();
  let angelegt = 0;
  // Was in diesem Lauf neu entstand, zählt nicht zusätzlich als „geändert",
  // auch wenn der zweite Durchgang noch eine Verknüpfung auf sich selbst
  // anhängt. Sonst meldete eine frische Installation „-1 unverändert".
  const neu = new Set();

  for (const durchgang of [1, 2]) {
    for (const c of alle) {
      const schema = [];
      for (const f of c.schema) {
        if (f.type === "relation" && f.options?.collectionId) {
          const kennung = ids.get(f.options.collectionId);
          if (!kennung) {
            // Ziel noch nicht angelegt: im ersten Durchgang überspringen.
            zurueckgestellt.add(`${c.name}.${f.name}`);
            continue;
          }
          schema.push({ ...f, options: { ...f.options, collectionId: kennung } });
          continue;
        }
        schema.push(f);
      }
      // Gemeldet wird im ersten Durchgang. Der zweite hängt nur noch
      // zurückgestellte Verknüpfungen an und schweigt, sonst stünde jede
      // Collection zweimal da.
      const vorher = ids.has(c.name);
      const id = await collectionAbgleichen({ ...standardRegeln, ...c, schema }, durchgang === 2);
      if (!vorher) {
        angelegt++;
        neu.add(c.name);
      }
      ids.set(c.name, id);
    }
    if (zurueckgestellt.size === 0) break;
    if (durchgang === 1) {
      console.log(
        `Verknüpfungen auf sich selbst werden nachgezogen: ${[...zurueckgestellt].join(", ")}`,
      );
    }
  }

  // Immer eine Zeile, auch wenn sich nichts geändert hat. Ein Lauf, der
  // schweigt, ist von einem Lauf, der nichts getan hat, nicht zu
  // unterscheiden — und genau das verunsichert zu Recht.
  const nurGeaendert = [...geaendert.keys()].filter((n) => !neu.has(n)).length;
  console.log(
    `${alle.length} Collections geprüft, ${angelegt} neu angelegt, ` +
      `${nurGeaendert} geändert, ` +
      `${alle.length - angelegt - nurGeaendert} unverändert.`,
  );

  // Ersten Anwendungsbenutzer anlegen, falls gewünscht und noch keiner da ist
  await erstenBenutzerAnlegen();

  // Nächtliche Datensicherung, falls noch keine eingestellt ist
  await sicherungEinrichten();

  // Bequemer Entwicklungszugang adm/adm, nur mit WB_ENTWICKLUNG=ja
  await entwicklungszugangAnlegen();

  // Betriebsstammdaten und Mitarbeiter für alle Benutzer ohne eigenen
  await betriebVorbereiten();
  await mitarbeiterNachziehen();

  console.log("Einrichtung abgeschlossen.");
} catch (e) {
  // Die PocketBase-Bibliothek wirft bei Fehlern ihren gesamten Quelltext aus.
  // Hier stattdessen nur das, was weiterhilft.
  console.error(`\nFehler beim Einrichten: ${lesbarerFehler(e)}\n`);
  process.exit(1);
}

/** Holt aus einem PocketBase-Fehler die Feldmeldungen heraus. */
function lesbarerFehler(e) {
  // Status 0 heißt: die Anfrage kam nie an. Fast immer läuft der Server nicht.
  const ursache = String(e?.originalError?.cause?.code ?? "");
  if (e?.status === 0 || /ECONNREFUSED|ENOTFOUND|ECONNRESET/.test(ursache)) {
    return (
      `PocketBase ist unter ${PB_URL} nicht erreichbar.\n` +
      `  Läuft der Server? In einem zweiten Terminal:  npm run server\n` +
      `  Stimmt die Adresse? Siehe VITE_PB_URL in der .env.`
    );
  }

  if (e?.status === 400 && !e?.response?.data) {
    return (
      `Anmeldung als Admin fehlgeschlagen (${PB_URL}).\n` +
      `  PB_ADMIN_EMAIL und PB_ADMIN_PASSWORD in der .env müssen zu dem Admin\n` +
      `  passen, den der Serverstart angelegt hat.`
    );
  }

  const antwort = e?.response ?? e?.data;
  if (!antwort || Object.keys(antwort).length === 0) {
    return e?.message || `${e?.name ?? "Fehler"} (Status ${e?.status ?? "?"})`;
  }

  const zeilen = [antwort.message || `Status ${antwort.code ?? e?.status ?? "?"}`];
  for (const [feld, angabe] of Object.entries(antwort.data ?? {})) {
    const text = angabe?.message ?? JSON.stringify(angabe);
    zeilen.push(`  ${feld}: ${text}`);
  }
  if (e?.url) zeilen.push(`  Aufruf: ${e.url}`);
  return zeilen.join("\n");
}

// ---------------------------------------------------------------------------

/**
 * Bricht ab, wenn unter PB_URL erkennbar eine fremde Anwendung liegt.
 * Erkennungsmerkmal: es gibt Collections, die weder zu Werkboq gehören noch
 * PocketBase-Systemcollections sind, und der Werkboq-Marker fehlt.
 */
async function datenbankPruefen() {
  const vorhanden = await pb.collections.getFullList({ batch: 200 });
  const hatMarker = vorhanden.some((c) => c.name === MARKER);

  if (!hatMarker) {
    const unsere = new Set([...KERN, ...BAUSTEINE, ...MODULE].map((c) => c.name));
    const fremd = vorhanden
      .filter((c) => !c.system && c.name !== "users" && !unsere.has(c.name))
      .map((c) => c.name);

    if (fremd.length > 0 && process.env.WERKBOQ_TROTZDEM !== "ja") {
      console.error(
        `\nAbbruch: Unter ${PB_URL} liegt offenbar eine fremde Datenbank.\n` +
          `Gefundene fremde Collections: ${fremd.join(", ")}\n\n` +
          `Werkboq erwartet eine eigene PocketBase auf Port 8095 (npm run server).\n` +
          `Läuft dort gerade eine andere Anwendung, beende sie oder setze PB_URL\n` +
          `auf die richtige Adresse. Es wurde nichts verändert.\n`,
      );
      process.exit(1);
    }

    await pb.collections.create({
      type: "base",
      name: MARKER,
      schema: [
        { name: "schluessel", type: "text", required: true },
        { name: "wert", type: "text" },
      ],
      listRule: null,
      viewRule: null,
      createRule: null,
      updateRule: null,
      deleteRule: null,
    });
    console.log(`${MARKER}: angelegt (kennzeichnet diese Datenbank als Werkboq)`);
  }
}

async function benutzerErgaenzen() {
  const users = await pb.collections.getOne("users");
  await benutzerRegelnSetzen(users);
  const vorhanden = new Set(users.schema.map((f) => f.name));
  const neu = [];
  if (!vorhanden.has("name")) neu.push({ name: "name", type: "text" });
  if (!vorhanden.has("bereiche")) neu.push({ name: "bereiche", type: "json", options: { maxSize: 2000000 } });
  // Bereiche, die nur gelesen werden dürfen — der Monteur auf den Aufträgen.
  if (!vorhanden.has("lesebereiche")) neu.push({ name: "lesebereiche", type: "json", options: { maxSize: 2000000 } });
  if (!vorhanden.has("admin")) neu.push({ name: "admin", type: "bool" });
  // Kennzeichnet Konten, die nur zum Entwickeln existieren und später
  // mit "npm run entwicklung-weg" restlos entfernt werden.
  if (!vorhanden.has("entwicklung")) neu.push({ name: "entwicklung", type: "bool" });
  if (neu.length === 0) return;
  await pb.collections.update(users.id, { schema: [...users.schema, ...neu] });
  console.log(`users: ${neu.map((f) => f.name).join(", ")} ergänzt`);
}

/**
 * Regeln der users-Collection.
 *
 * Zugänge werden in Werkboq unter Einstellungen → Mitarbeiter verwaltet, also
 * über die API und nicht im Admin-UI. Dafür müssen Betriebsadministratoren
 * (users.admin = true) Benutzer anlegen und ändern dürfen. Offene
 * Selbstregistrierung bleibt gesperrt — ein Handwerksbetrieb hat keine
 * Anmeldeseite für Fremde.
 */
async function benutzerRegelnSetzen(users) {
  const istAdmin = "@request.auth.admin = true";
  const selbst = "id = @request.auth.id";
  const gewuenscht = {
    listRule: `@request.auth.id != '' && (${istAdmin} || ${selbst})`,
    viewRule: `@request.auth.id != '' && (${istAdmin} || ${selbst})`,
    createRule: istAdmin,
    updateRule: `${istAdmin} || ${selbst}`,
    deleteRule: istAdmin,
  };
  const gleich = Object.entries(gewuenscht).every(([k, v]) => users[k] === v);
  if (gleich) return;
  await pb.collections.update(users.id, gewuenscht);
  console.log("users: Zugriffsregeln gesetzt (Verwaltung über die Anwendung)");
}

/**
 * Legt den bequemen Entwicklungszugang adm/adm an.
 *
 * Nur aktiv mit WB_ENTWICKLUNG=ja und nur gegen eine PocketBase auf dem
 * eigenen Rechner. Das Konto trägt entwicklung=true und lässt sich damit
 * später eindeutig wiederfinden und löschen.
 *
 * Damit ein dreistelliges Passwort überhaupt zulässig ist, wird die
 * Mindestlänge der users-Collection vorübergehend auf 3 gesetzt.
 * "npm run entwicklung-weg" stellt sie wieder auf 8 und löscht die Konten.
 */
async function entwicklungszugangAnlegen() {
  if (process.env.WB_ENTWICKLUNG !== "ja") return;

  if (!/^https?:\/\/(127\.0\.0\.1|localhost)(:|\/|$)/.test(PB_URL)) {
    console.error(
      `Abbruch: WB_ENTWICKLUNG=ja ist nur gegen eine lokale PocketBase erlaubt, ` +
        `nicht gegen ${PB_URL}. Es wurde kein Entwicklungszugang angelegt.`,
    );
    process.exit(1);
  }

  // PocketBase lässt die Mindestlänge nicht unter 5 sinken – deshalb "admadm".
  const passwort = process.env.WB_ENTWICKLUNG_PASSWORT ?? "admadm";
  if (passwort.length < 5) {
    console.error(
      `WB_ENTWICKLUNG_PASSWORT muss mindestens 5 Zeichen haben – ` +
        `PocketBase erlaubt keine kürzeren. Kein Entwicklungszugang angelegt.`,
    );
    return;
  }

  const users = await pb.collections.getOne("users");
  if ((users.options?.minPasswordLength ?? 8) > 5) {
    await pb.collections.update(users.id, {
      options: { ...users.options, minPasswordLength: 5 },
    });
  }

  const schon = await pb
    .collection("users")
    .getFirstListItem('username = "adm"')
    .catch(() => null);
  if (schon) {
    console.log("users: Entwicklungszugang adm besteht bereits");
    return;
  }

  await pb.collection("users").create({
    username: "adm",
    email: "adm@werkboq.invalid",
    password: passwort,
    passwordConfirm: passwort,
    name: "Entwicklung",
    admin: true,
    entwicklung: true,
    bereiche: KERN_BEREICHE_UND_MODULE,
    emailVisibility: false,
    verified: true,
  });

  console.log(
    `\n*** Entwicklungszugang angelegt: Benutzer adm, Passwort ${passwort} ***\n` +
      "    Nur für die Entwicklung. Vor jedem echten Einsatz entfernen mit:\n" +
      "    npm run entwicklung-weg\n",
  );
}

/**
 * Legt den ersten Anwendungsbenutzer an, falls WB_BENUTZER_EMAIL gesetzt ist
 * und noch kein Benutzer existiert. Der PocketBase-Admin aus dem Admin-UI ist
 * NICHT derselbe wie ein Anwendungsbenutzer – in Werkboq meldet man sich mit
 * einem Datensatz aus der users-Collection an.
 */
/**
 * Nächtliche Datensicherung durch PocketBase selbst.
 *
 * Bis September 2026 gab es keine: wer die Datenbank verlor, verlor
 * Rechnungen, die sieben Jahre aufzubewahren sind. PocketBase kann das
 * selbst — eine ZIP mit der ganzen Datenbank samt Dateien, erstellt im
 * laufenden Betrieb und dabei in sich stimmig (anders als eine Kopie von
 * data.db ohne die WAL-Datei daneben). Hier wird es nur eingeschaltet:
 * jede Nacht um 2:30, die letzten 14 behalten.
 *
 * Hat jemand schon etwas eingestellt (etwa einen S3-Speicher), bleibt es
 * dabei. Die Sicherungen liegen in pb_data/backups — auf DEMSELBEN
 * Rechner. Gegen einen kaputten Rechner hilft das nicht; dafür
 * `npm run sicherung`, das eine Kopie an einen anderen Ort legt. Siehe
 * docs/sicherung.md.
 */
async function sicherungEinrichten() {
  try {
    const s = await pb.settings.getAll();
    if (s.backups?.cron) {
      console.log(`sicherung: eingestellt (${s.backups.cron}, behält ${s.backups.cronMaxKeep})`);
      return;
    }
    await pb.settings.update({ backups: { ...s.backups, cron: "30 2 * * *", cronMaxKeep: 14 } });
    console.log("sicherung: nächtlich um 2:30 eingeschaltet, die letzten 14 bleiben (pb_data/backups)");
  } catch (e) {
    console.log(`sicherung: konnte nicht eingestellt werden (${e?.message ?? e}) — bitte im Admin-UI unter Settings → Backups nachholen`);
  }
}

async function erstenBenutzerAnlegen() {
  const email = process.env.WB_BENUTZER_EMAIL;
  const passwort = process.env.WB_BENUTZER_PASSWORT;
  if (!email || !passwort) return;

  const vorhanden = await pb.collection("users").getList(1, 1);
  if (vorhanden.totalItems > 0) {
    console.log("users: Benutzer vorhanden, kein neuer angelegt");
    return;
  }
  if (passwort.length < 8) {
    console.error("WB_BENUTZER_PASSWORT muss mindestens 8 Zeichen haben.");
    return;
  }

  await pb.collection("users").create({
    email,
    password: passwort,
    passwordConfirm: passwort,
    name: process.env.WB_BENUTZER_NAME ?? "Verwalter",
    admin: true,
    bereiche: KERN_BEREICHE_UND_MODULE,
    emailVisibility: true,
    verified: true,
  });
  console.log(`users: ${email} als Verwalter angelegt`);
}

/**
 * Legt den einen Betriebsdatensatz an, falls noch keiner da ist. Die Werte
 * sind Platzhalter — ausgefüllt wird in der Oberfläche unter Einstellungen.
 */
async function betriebVorbereiten() {
  const vorhanden = await pb.collection("betrieb").getList(1, 1);
  if (vorhanden.totalItems > 0) return;
  await pb.collection("betrieb").create({
    name: process.env.WB_BETRIEB_NAME ?? "Mein Betrieb",
    land: "Österreich",
  });
  console.log("betrieb: Stammdatensatz angelegt (bitte in den Einstellungen ausfüllen)");
}

/**
 * Sorgt dafür, dass jeder Anwendungsbenutzer auch als Mitarbeiter existiert.
 * Sonst kann man sich anmelden, aber niemand kann einen einplanen.
 */
async function mitarbeiterNachziehen() {
  const benutzer = await pb.collection("users").getFullList();
  const mitarbeiter = await pb.collection("mitarbeiter").getFullList();
  const schonVerknuepft = new Set(mitarbeiter.map((m) => m.benutzer).filter(Boolean));

  for (const b of benutzer) {
    if (schonVerknuepft.has(b.id)) continue;
    const name = b.name || b.username || b.email;
    await pb.collection("mitarbeiter").create({
      name,
      kurzzeichen: kuerzel(name),
      funktion: b.admin ? "meister" : "monteur",
      benutzer: b.id,
      email: b.email,
      farbe: farbeFuer(name),
      aktiv: true,
    });
    console.log(`mitarbeiter: ${name} angelegt`);
  }
}

function kuerzel(name) {
  return name
    .split(/[\s.@]+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((w) => w[0].toUpperCase())
    .join("");
}

/** Feste Farbe je Name, damit dieselbe Person immer gleich eingefärbt ist. */
function farbeFuer(name) {
  const palette = ["#0058a8", "#1f7a4c", "#9a6a00", "#7a3fa0", "#b0472b", "#2e7d8f", "#5a6b2f"];
  let summe = 0;
  for (const zeichen of name) summe = (summe + zeichen.charCodeAt(0)) % 9973;
  return palette[summe % palette.length];
}

/**
 * Eine Schemaänderung, die PocketBase 0.22 mit einer nackten 400
 * „Failed to update the collection." beantwortet — obwohl sie gespeichert
 * ist.
 *
 * WANN DAS PASSIERT, UND WANN NICHT. Gesehen beim Nachstellen eines Updates
 * auf alten Daten, und zwar nur, wenn PocketBase OHNE `--automigrate=0` lief:
 * dann schreibt es bei jeder Schemaänderung zusätzlich eine
 * Migrationsdatei, und dieser zweite Schritt scheitert gelegentlich (einmal
 * in drei Läufen). Mit `--automigrate=0`, so wie `server/start.mjs`
 * PocketBase startet, trat es in drei von drei Läufen nicht auf.
 *
 * Die Wiederholung bleibt trotzdem, als schmale Absicherung für
 * Installationen, die PocketBase anders starten — ein Hoster, ein eigener
 * Dienst. Wiederholt wird NUR genau dieser Fehler: Status 400 ohne
 * Feldmeldungen. Alles andere kommt sofort durch, damit ein echter Fehler
 * nicht hinter Wartezeit verschwindet.
 */
async function mitWiederholung(name, aufruf) {
  const pausen = [1000, 2000, 4000];
  for (let versuch = 0; ; versuch++) {
    try {
      return await aufruf();
    } catch (e) {
      const nackt =
        e?.status === 400 && (!e?.response?.data || Object.keys(e.response.data).length === 0);
      if (!nackt || versuch >= pausen.length) throw e;
      console.log(`${name}: PocketBase meldet einen Fehler ohne Begründung — neuer Versuch in ${pausen[versuch] / 1000} s`);
      await new Promise((r) => setTimeout(r, pausen[versuch]));
    }
  }
}

async function collectionAbgleichen(def, still = false) {
  let vorhanden = null;
  try {
    vorhanden = await pb.collections.getOne(def.name);
  } catch {
    /* gibt es noch nicht */
  }
  if (!vorhanden) {
    const c = await pb.collections.create({ type: "base", ...def });
    console.log(`${def.name}: angelegt`);
    return c.id;
  }
  // Bestehende Felder behalten (IDs!), neue anhängen, Regeln setzen
  const alteFelder = new Map(vorhanden.schema.map((f) => [f.name, f]));

  // Felder, deren Typ sich geändert hat, müssen neu angelegt werden —
  // PocketBase lehnt einen Typwechsel ab ("Field type cannot be changed").
  const getauscht = await typwechselBehandeln(def, vorhanden, alteFelder);

  // `required` ausdrücklich aus der Definition, nicht aus dem alten Feld:
  // sonst bliebe ein einmal gesetztes „required" für immer stehen, auch
  // wenn die Definition es längst nicht mehr verlangt. Genau so blieb
  // `belege.ust` Pflicht, und PocketBase hält bei Zahlen die Null für
  // „fehlt" — keine Rechnung mit Übergang der Steuerschuld ließ sich
  // speichern.
  const schema = def.schema.map((f) =>
    alteFelder.has(f.name) && !getauscht.has(f.name)
      ? { ...alteFelder.get(f.name), ...f, required: f.required === true, id: alteFelder.get(f.name).id }
      : f,
  );
  const REGELN = ["listRule", "viewRule", "createRule", "updateRule", "deleteRule"];
  const regelnGeaendert = REGELN.filter((r) => (vorhanden[r] ?? null) !== (def[r] ?? null));
  const pflichtGeaendert = def.schema
    .filter((f) => alteFelder.has(f.name) && Boolean(alteFelder.get(f.name).required) !== (f.required === true))
    .map((f) => `${f.name} ${f.required ? "jetzt Pflicht" : "nicht mehr Pflicht"}`);
  for (const [name, f] of alteFelder) {
    if (!def.schema.some((d) => d.name === name)) schema.push(f);
  }
  await mitWiederholung(def.name, () =>
    pb.collections.update(vorhanden.id, {
      schema,
      indexes: def.indexes ?? vorhanden.indexes,
      listRule: def.listRule,
      viewRule: def.viewRule,
      createRule: def.createRule,
      updateRule: def.updateRule,
      deleteRule: def.deleteRule,
    }),
  );

  // Welche Felder sind dazugekommen? Das interessiert beim Nachziehen einer
  // bestehenden Installation — "abgeglichen" allein sagt nicht, ob etwas
  // geschehen ist, und eine Meldung, die immer gleich lautet, liest niemand.
  const neueFelder = def.schema.filter((f) => !alteFelder.has(f.name)).map((f) => f.name);
  if (neueFelder.length) geaendert.set(def.name, neueFelder);
  if (pflichtGeaendert.length) geaendert.set(def.name, [...(geaendert.get(def.name) ?? []), ...pflichtGeaendert]);
  // Auch Regeln melden: eine Regel, die still enger oder weiter wird,
  // ist genau die Änderung, die man beim Update wissen will.
  if (regelnGeaendert.length) {
    geaendert.set(def.name, [...(geaendert.get(def.name) ?? []), `Regeln: ${regelnGeaendert.join(", ")}`]);
  }
  if (!still) {
    const teile = [
      neueFelder.length ? `neu: ${neueFelder.join(", ")}` : "",
      pflichtGeaendert.length ? pflichtGeaendert.join(", ") : "",
      regelnGeaendert.length ? `Regeln neu: ${regelnGeaendert.join(", ")}` : "",
    ].filter(Boolean);
    console.log(teile.length ? `${def.name}: abgeglichen, ${teile.join("; ")}` : `${def.name}: abgeglichen`);
  }
  return vorhanden.id;
}

/**
 * Behandelt Felder, deren Typ sich zwischen zwei Ständen geändert hat.
 *
 * PocketBase kann den Typ einer Spalte nicht ändern und antwortet mit
 * "Field type cannot be changed" — der Abgleich bliebe sonst für immer
 * stecken. Ein Typwechsel heißt immer: alte Spalte weg, neue anlegen. Der
 * Inhalt ist dabei verloren, das lässt sich nicht wegdiskutieren.
 *
 * Deshalb die Unterscheidung:
 *   - Collection leer  → wortlos tauschen, es geht nichts verloren.
 *   - Collection voll  → abbrechen und sagen, was passieren würde.
 *                        Mit WERKBOQ_FELDER_TAUSCHEN=ja wird trotzdem
 *                        getauscht.
 *
 * Gibt die Namen der getauschten Felder zurück; der Aufrufer setzt sie ohne
 * alte Kennung neu ins Schema, damit PocketBase sie als neue Spalte anlegt.
 */
async function typwechselBehandeln(def, vorhanden, alteFelder) {
  const konflikte = def.schema.filter((f) => {
    const alt = alteFelder.get(f.name);
    return alt && alt.type !== f.type;
  });
  if (konflikte.length === 0) return new Set();

  const liste = konflikte
    .map((f) => `${f.name}: ${alteFelder.get(f.name).type} → ${f.type}`)
    .join(", ");

  const anzahl = (await pb.collection(def.name).getList(1, 1)).totalItems;

  if (anzahl > 0 && process.env.WERKBOQ_FELDER_TAUSCHEN !== "ja") {
    console.error(
      `\nAbbruch bei "${def.name}": Der Typ dieser Felder hat sich geändert —\n` +
        `  ${liste}\n` +
        `PocketBase kann den Typ einer Spalte nicht ändern; die Spalte muss neu\n` +
        `angelegt werden und ihr bisheriger Inhalt geht dabei verloren. In\n` +
        `"${def.name}" stehen ${anzahl} Datensätze.\n\n` +
        `Wenn dieser Inhalt entbehrlich ist:\n` +
        `  WERKBOQ_FELDER_TAUSCHEN=ja npm run einrichten\n` +
        `Wenn nicht: vorher sichern (Admin-UI → Export) oder die Werte von Hand\n` +
        `in ein neues Feld übertragen.\n`,
    );
    process.exit(1);
  }

  // Erst entfernen, dann legt der Aufrufer sie als neue Felder wieder an.
  // In einem Zug ginge es nicht: derselbe Name, zwei Typen.
  const rest = vorhanden.schema.filter((f) => !konflikte.some((k) => k.name === f.name));
  // Ein Index auf einer Spalte, die gerade verschwindet, lässt das Entfernen
  // scheitern. Er wird unten ohnehin aus def.indexes neu gesetzt.
  const indexeOhne = (vorhanden.indexes ?? []).filter(
    (i) => !konflikte.some((k) => new RegExp(`[(,\\s\`"]${k.name}[)\\s,\`"]`).test(i)),
  );
  await pb.collections.update(vorhanden.id, { schema: rest, indexes: indexeOhne });

  console.log(
    anzahl > 0
      ? `${def.name}: Felder getauscht, Inhalt verworfen (${liste})`
      : `${def.name}: Felder getauscht, Collection war leer (${liste})`,
  );

  for (const k of konflikte) alteFelder.delete(k.name);
  return new Set(konflikte.map((f) => f.name));
}

function ladeEnv(pfad) {
  if (!existsSync(pfad)) return;
  for (const zeile of readFileSync(pfad, "utf8").split("\n")) {
    const m = zeile.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/);
    if (m && process.env[m[1]] === undefined) process.env[m[1]] = m[2].replace(/^["']|["']$/g, "");
  }
}
