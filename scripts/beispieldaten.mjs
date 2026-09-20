#!/usr/bin/env node
/**
 * Beispieldaten zum Ausprobieren.
 *
 *   npm run beispieldaten        anlegen
 *   npm run beispieldaten -- weg  wieder entfernen
 *
 * Ein Betrieb, drei Kunden, drei Aufträge in verschiedenen Phasen, ein
 * Katalog, Positionen, Mitarbeiter, gebuchte Zeiten, Termine in dieser
 * Woche und zwei Rechnungen — eine bezahlt, eine überfällig, damit sich
 * auch das Mahnwesen ansehen lässt.
 *
 * ALLES IM 900er-BEREICH.
 * Aufträge heißen 2026-901 bis 2026-903, Artikel M-9001 aufwärts. Damit
 * sind die Beispieldaten auf einen Blick als solche erkennbar, kollidieren
 * nicht mit echten Nummern und lassen sich eindeutig wieder entfernen.
 * Belege bekommen die normale fortlaufende Nummer — alles andere hieße,
 * den Nummernkreis zu verbiegen, und genau das darf er nicht.
 *
 * Idempotent: was schon da ist, wird übersprungen.
 */
import PocketBase from "pocketbase";
import { readFileSync, existsSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const hier = dirname(fileURLToPath(import.meta.url));
ladeEnv(join(hier, "..", ".env"));

const PB_URL = process.env.PB_URL ?? process.env.VITE_PB_URL ?? "http://127.0.0.1:8095";
const EMAIL = process.env.PB_ADMIN_EMAIL;
const PASSWORT = process.env.PB_ADMIN_PASSWORD;
const WEG = process.argv.slice(2).includes("weg");

if (!EMAIL || !PASSWORT) {
  console.error("PB_ADMIN_EMAIL und PB_ADMIN_PASSWORD setzen (siehe .env.example).");
  process.exit(1);
}

const pb = new PocketBase(PB_URL);
pb.autoCancellation(false);

// ------------------------------------------------------------------ Daten

const KUNDEN = [
  {
    name: "Musterbau GmbH",
    unternehmer: true,
    strasse: "Baugasse 14",
    plz: "2700",
    ort: "Wiener Neustadt",
    telefon: "02622 / 12345",
    email: "office@musterbau.example",
    uid: "ATU98765432",
    notizen: "Generalunternehmer. Bauleistungen — Übergang der Steuerschuld beachten.",
  },
  {
    name: "Familie Gruber",
    unternehmer: false,
    strasse: "Ahornweg 8",
    plz: "2620",
    ort: "Neunkirchen",
    telefon: "0664 / 1234567",
    email: "gruber@example.at",
    notizen: "Privat. Einfamilienhaus, Sanierung in Etappen.",
  },
  {
    name: "Hausverwaltung Föhrenwald",
    unternehmer: true,
    strasse: "Hauptstraße 102",
    plz: "2751",
    ort: "Steinabrückl",
    telefon: "02622 / 98765",
    email: "technik@hv-foehrenwald.example",
    uid: "ATU11223344",
    notizen: "Betreut vier Wohnhäuser. Wiederkehrende Prüfungen.",
  },
];

const STANDORTE = [
  { kunde: "Musterbau GmbH", bezeichnung: "Wohnbau Süd, Bauteil B", strasse: "Feldgasse 3", plz: "2700", ort: "Wiener Neustadt" },
  { kunde: "Hausverwaltung Föhrenwald", bezeichnung: "Objekt Lindenhof", strasse: "Lindenweg 12", plz: "2751", ort: "Steinabrückl" },
];

const ANSPRECHPARTNER = [
  { kunde: "Musterbau GmbH", name: "Ing. Peter Novak", funktion: "Bauleiter", telefon: "0664 / 3334455", email: "novak@musterbau.example" },
  { kunde: "Hausverwaltung Föhrenwald", name: "Sabine Wolf", funktion: "Objektbetreuung", telefon: "0676 / 7778899", email: "wolf@hv-foehrenwald.example" },
];

const MITARBEITER = [
  { name: "Franz Bauer", kurzzeichen: "FB", funktion: "monteur", telefon: "0664 / 1111111", farbe: "#0058a8", wochenstunden: 38.5 },
  { name: "Lukas Steiner", kurzzeichen: "LS", funktion: "lehrling", telefon: "0664 / 2222222", farbe: "#f74c00", wochenstunden: 38.5 },
  { name: "Andrea Hofer", kurzzeichen: "AH", funktion: "buero", telefon: "02622 / 3333", farbe: "#1f7a4c", wochenstunden: 20 },
];

/** Katalog. Preise netto in Cent, wie überall im Programm. */
const ARTIKEL = [
  { nummer: "M-9001", bezeichnung: "NYM-J 3x1,5 mm²", art: "material", einheit: "m", preis: 145, einkauf: 92, ustsatz: 20 },
  { nummer: "M-9002", bezeichnung: "NYM-J 5x2,5 mm²", art: "material", einheit: "m", preis: 389, einkauf: 251, ustsatz: 20 },
  { nummer: "M-9003", bezeichnung: "Schalterdose UP, tief", art: "material", einheit: "Stk", preis: 68, einkauf: 39, ustsatz: 20 },
  { nummer: "M-9004", bezeichnung: "Steckdose UP, weiß", art: "material", einheit: "Stk", preis: 690, einkauf: 420, ustsatz: 20 },
  { nummer: "M-9005", bezeichnung: "Wechselschalter UP, weiß", art: "material", einheit: "Stk", preis: 750, einkauf: 455, ustsatz: 20 },
  { nummer: "M-9006", bezeichnung: "FI-Schutzschalter 40 A / 30 mA, 4-polig", art: "material", einheit: "Stk", preis: 6890, einkauf: 4120, ustsatz: 20 },
  { nummer: "M-9007", bezeichnung: "Leitungsschutzschalter B16, 1-polig", art: "material", einheit: "Stk", preis: 640, einkauf: 372, ustsatz: 20 },
  { nummer: "M-9008", bezeichnung: "Verteiler UP, 3-reihig, 36 TE", art: "material", einheit: "Stk", preis: 12400, einkauf: 7850, ustsatz: 20 },
  { nummer: "M-9009", bezeichnung: "LED-Einbauleuchte 8 W, 3000 K", art: "material", einheit: "Stk", preis: 1890, einkauf: 1090, ustsatz: 20 },
  { nummer: "M-9010", bezeichnung: "Kabelkanal 40x40, grau", art: "material", einheit: "lfm", preis: 420, einkauf: 260, ustsatz: 20 },
  { nummer: "L-9001", bezeichnung: "Montagestunde Geselle", art: "leistung", einheit: "h", preis: 6500, einkauf: 0, ustsatz: 20 },
  { nummer: "L-9002", bezeichnung: "Montagestunde Meister", art: "leistung", einheit: "h", preis: 8200, einkauf: 0, ustsatz: 20 },
  { nummer: "L-9003", bezeichnung: "Anfahrtspauschale Umkreis 30 km", art: "leistung", einheit: "Pauschale", preis: 3500, einkauf: 0, ustsatz: 20 },
  { nummer: "L-9004", bezeichnung: "Erstprüfung nach OVE E 8101 inkl. Protokoll", art: "leistung", einheit: "Pauschale", preis: 24000, einkauf: 0, ustsatz: 20 },
  { nummer: "F-9001", bezeichnung: "Kernbohrung durch Stahlbeton, Fremdleistung", art: "fremdleistung", einheit: "Stk", preis: 8500, einkauf: 6200, ustsatz: 20 },
];

const AUFTRAEGE = [
  {
    nummer: "2026-901",
    titel: "Wohnbau Süd — Elektroinstallation Bauteil B",
    kunde: "Musterbau GmbH",
    standort: "Wohnbau Süd, Bauteil B",
    phase: "errichtung",
    modul: "elektro",
    beschreibung:
      "<p>Komplette Elektroinstallation für zwölf Wohneinheiten. Leistung an einen Bauunternehmer — <strong>Übergang der Steuerschuld nach § 19 Abs 1a UStG</strong> prüfen.</p>",
    vorTagen: 45,
    dauerTage: 90,
    positionen: [
      { artikel: "M-9002", menge: 340 },
      { artikel: "M-9001", menge: 1250 },
      { artikel: "M-9008", menge: 12 },
      { artikel: "M-9006", menge: 12 },
      { artikel: "M-9007", menge: 96 },
      { artikel: "M-9004", menge: 168 },
      { artikel: "L-9001", menge: 210 },
      { artikel: "L-9002", menge: 24 },
    ],
  },
  {
    nummer: "2026-902",
    titel: "Sanierung Einfamilienhaus Gruber",
    kunde: "Familie Gruber",
    phase: "abnahme",
    modul: "elektro",
    beschreibung:
      "<p>Erneuerung der Verteilung, neue Leitungen im Obergeschoß, Beleuchtung Wohnraum. Altbestand teilweise ohne Schutzleiter.</p>",
    vorTagen: 70,
    dauerTage: 21,
    positionen: [
      { artikel: "M-9008", menge: 1 },
      { artikel: "M-9006", menge: 1 },
      { artikel: "M-9007", menge: 9 },
      { artikel: "M-9001", menge: 180 },
      { artikel: "M-9003", menge: 22 },
      { artikel: "M-9004", menge: 14 },
      { artikel: "M-9005", menge: 8 },
      { artikel: "M-9009", menge: 11 },
      { artikel: "L-9001", menge: 46 },
      { artikel: "L-9004", menge: 1 },
      { artikel: "L-9003", menge: 4 },
    ],
  },
  {
    nummer: "2026-903",
    titel: "Lindenhof — wiederkehrende Prüfung Allgemeinteile",
    kunde: "Hausverwaltung Föhrenwald",
    standort: "Objekt Lindenhof",
    phase: "angebot",
    modul: "elektro",
    beschreibung:
      "<p>Wiederkehrende Überprüfung der Allgemeinteile: Stiegenhaus, Keller, Garage, Waschküche. Angebot liegt beim Kunden.</p>",
    vorTagen: 5,
    dauerTage: 14,
    positionen: [
      { artikel: "L-9004", menge: 4 },
      { artikel: "L-9001", menge: 12 },
      { artikel: "L-9003", menge: 2 },
    ],
  },
];

// ------------------------------------------------------------------ Ablauf

try {
  await pb.admins.authWithPassword(EMAIL, PASSWORT);
  console.log(`Verbunden mit ${PB_URL}`);

  if (WEG) {
    await entfernen();
  } else {
    await anlegen();
  }
} catch (e) {
  console.error(`\nFehler: ${lesbarerFehler(e)}\n`);
  process.exit(1);
}

// ----------------------------------------------------------------- anlegen

async function anlegen() {
  await betriebFuellen();

  const kunden = new Map();
  for (const k of KUNDEN) {
    kunden.set(k.name, await einmalig("kunden", `name = "${k.name}"`, { ...k, intern: false }));
  }
  console.log(`Kunden: ${kunden.size}`);

  const standorte = new Map();
  for (const s of STANDORTE) {
    const d = await einmalig("standorte", `bezeichnung = "${s.bezeichnung}"`, {
      ...s,
      kunde: kunden.get(s.kunde).id,
    });
    standorte.set(s.bezeichnung, d);
  }

  for (const a of ANSPRECHPARTNER) {
    await einmalig("ansprechpartner", `name = "${a.name}"`, { ...a, kunde: kunden.get(a.kunde).id });
  }
  console.log(`Standorte: ${standorte.size}, Ansprechpartner: ${ANSPRECHPARTNER.length}`);

  const mitarbeiter = new Map();
  for (const m of MITARBEITER) {
    mitarbeiter.set(m.name, await einmalig("mitarbeiter", `name = "${m.name}"`, { ...m, aktiv: true }));
  }
  console.log(`Mitarbeiter: ${mitarbeiter.size}`);

  const artikel = new Map();
  for (const a of ARTIKEL) {
    artikel.set(a.nummer, await einmalig("artikel", `nummer = "${a.nummer}"`, { ...a, aktiv: true }));
  }
  console.log(`Artikel: ${artikel.size}`);

  const auftraege = new Map();
  for (const a of AUFTRAEGE) {
    const datensatz = await einmalig("auftraege", `nummer = "${a.nummer}"`, {
      nummer: a.nummer,
      titel: a.titel,
      kunde: kunden.get(a.kunde).id,
      standort: a.standort ? standorte.get(a.standort).id : null,
      phase: a.phase,
      modul: a.modul,
      beschreibung: a.beschreibung,
      beginn: tagVor(a.vorTagen),
      ende: tagVor(a.vorTagen - a.dauerTage),
    });
    auftraege.set(a.nummer, datensatz);

    // Positionen — Preis und Steuersatz aus dem Katalog kopiert, so wie es
    // die Oberfläche auch macht.
    const schon = await pb
      .collection("positionen")
      .getList(1, 1, { filter: `auftrag = "${datensatz.id}"` });
    if (schon.totalItems === 0) {
      let pos = 10;
      for (const p of a.positionen) {
        const art = artikel.get(p.artikel);
        await pb.collection("positionen").create({
          auftrag: datensatz.id,
          pos,
          artikel: art.id,
          art: art.art,
          bezeichnung: art.bezeichnung,
          beschreibung: "",
          menge: p.menge,
          einheit: art.einheit,
          einzelpreis: art.preis,
          rabatt: 0,
          ustsatz: art.ustsatz,
          verrechnet: false,
        });
        pos += 10;
      }
    }
  }
  console.log(`Aufträge: ${auftraege.size} samt Positionen`);

  await zeitenAnlegen(auftraege, mitarbeiter);
  await termineAnlegen(auftraege, mitarbeiter);
  await belegeAnlegen(auftraege, kunden);

  console.log("\nFertig. Zum Aufräumen: npm run beispieldaten -- weg");
}

/**
 * Betriebsstammdaten, aber nur die Felder, die noch leer sind.
 *
 * Ohne Anschrift und UID sperrt Werkboq das Festschreiben jeder Rechnung —
 * zu Recht, aber zum Ausprobieren unbrauchbar. Was schon ausgefüllt ist,
 * bleibt unberührt: wer seinen echten Betrieb eingetragen hat, soll ihn
 * nicht durch "Elektro Musterbetrieb" ersetzt bekommen.
 */
async function betriebFuellen() {
  const b = (await pb.collection("betrieb").getList(1, 1)).items[0];
  if (!b) {
    console.log("Betrieb: kein Datensatz vorhanden, übersprungen");
    return;
  }
  const vorschlag = {
    name: "Elektro Musterbetrieb GmbH",
    inhaber: "Ing. Maria Muster",
    strasse: "Gewerbepark 7",
    plz: "2700",
    ort: "Wiener Neustadt",
    land: "Österreich",
    telefon: "02622 / 55 66 77",
    email: "office@elektro-muster.example",
    uid: "ATU55667788",
    firmenbuch: "123456a",
    gericht: "Landesgericht Wiener Neustadt",
    iban: "AT02 3456 7890 1234 5678",
    bic: "RLNWATWWXXX",
    bank: "Raiffeisenbank Wiener Neustadt",
    stundensatz: 6500,
  };
  const aenderung = {};
  for (const [feld, wert] of Object.entries(vorschlag)) {
    const jetzt = b[feld];
    if (jetzt === "" || jetzt === null || jetzt === undefined || jetzt === 0) {
      aenderung[feld] = wert;
    }
  }
  if (Object.keys(aenderung).length === 0) {
    console.log("Betrieb: schon ausgefüllt, unberührt");
    return;
  }
  await pb.collection("betrieb").update(b.id, aenderung);
  console.log(`Betrieb: ${Object.keys(aenderung).length} leere Felder gefüllt`);
}

/**
 * Gebuchte Zeiten der letzten zwei Wochen.
 *
 * Der Erfasser ist der erste Benutzer, der gearbeitet hat ein Mitarbeiter —
 * genau der Fall, für den es beide Felder gibt: das Büro bucht für einen
 * Monteur ohne eigenen Zugang.
 */
async function zeitenAnlegen(auftraege, mitarbeiter) {
  const vorhanden = await pb.collection("zeiten").getList(1, 1);
  if (vorhanden.totalItems > 0) {
    console.log("Zeiten: schon welche vorhanden, übersprungen");
    return;
  }
  const benutzer = (await pb.collection("users").getList(1, 1)).items[0];
  if (!benutzer) {
    console.log("Zeiten: kein Benutzer vorhanden, übersprungen");
    return;
  }

  /**
   * Ein Tag, ein Mensch, eine Baustelle. Niemand bucht sechzehn Stunden,
   * und der Lehrling ist dienstags und mittwochs in der Berufsschule —
   * Beispieldaten, die das ignorieren, führen beim Ausprobieren in die Irre
   * und lösen obendrein die Zehn-Stunden-Warnung aus.
   */
  function tagesplan(wochentag) {
    // 1 = Montag … 5 = Freitag
    const plan = [];
    plan.push(
      wochentag === 5
        ? { ma: "Franz Bauer", auftrag: "2026-902", beginn: "07:30", ende: "15:30", pause: 30, taetigkeit: "Verteiler getauscht, Leitungen OG" }
        : { ma: "Franz Bauer", auftrag: "2026-901", beginn: "07:00", ende: "16:00", pause: 30, taetigkeit: "Leitungen Bauteil B, Stiege 2" },
    );
    if (wochentag !== 2 && wochentag !== 3) {
      plan.push({ ma: "Lukas Steiner", auftrag: "2026-901", beginn: "07:00", ende: "16:00", pause: 45, taetigkeit: "Dosen setzen, Kabel einziehen" });
    }
    return plan;
  }

  let angelegt = 0;
  for (let versatz = 11; versatz >= 0; versatz--) {
    const tag = tagVor(versatz);
    const wochentag = new Date(`${tag}T00:00:00`).getDay();
    if (wochentag === 0 || wochentag === 6) continue;
    for (const m of tagesplan(wochentag)) {
      await pb.collection("zeiten").create({
        benutzer: benutzer.id,
        benutzername: mitarbeiter.get(m.ma).name,
        mitarbeiter: mitarbeiter.get(m.ma).id,
        datum: tag,
        beginn: m.beginn,
        ende: m.ende,
        pause: m.pause,
        auftrag: auftraege.get(m.auftrag).id,
        art: "arbeit",
        taetigkeit: m.taetigkeit,
        verrechenbar: true,
      });
      angelegt++;
    }
  }
  console.log(`Zeiten: ${angelegt} Buchungen über zwei Wochen`);
}

/** Termine dieser und nächster Woche, damit der Dispo-Kalender etwas zeigt. */
async function termineAnlegen(auftraege, mitarbeiter) {
  const vorhanden = await pb.collection("termine").getList(1, 1);
  if (vorhanden.totalItems > 0) {
    console.log("Termine: schon welche vorhanden, übersprungen");
    return;
  }

  const montag = wochenbeginn();
  const plan = [
    { tag: 0, ma: "Franz Bauer", auftrag: "2026-901", titel: "Wohnbau Süd, Stiege 3", art: "baustelle", ort: "Feldgasse 3" },
    { tag: 1, ma: "Franz Bauer", auftrag: "2026-901", titel: "Wohnbau Süd, Stiege 3", art: "baustelle", ort: "Feldgasse 3" },
    { tag: 2, ma: "Franz Bauer", auftrag: "2026-902", titel: "Abnahme Gruber", art: "kundentermin", ort: "Ahornweg 8" },
    { tag: 0, ma: "Lukas Steiner", auftrag: "2026-901", titel: "Wohnbau Süd, Dosen", art: "baustelle", ort: "Feldgasse 3" },
    { tag: 1, ma: "Lukas Steiner", auftrag: null, titel: "Berufsschule", art: "schulung", ganztags: true },
    { tag: 2, ma: "Lukas Steiner", auftrag: null, titel: "Berufsschule", art: "schulung", ganztags: true },
    { tag: 3, ma: "Franz Bauer", auftrag: "2026-903", titel: "Prüfung Lindenhof", art: "baustelle", ort: "Lindenweg 12" },
    { tag: 7, ma: "Franz Bauer", auftrag: "2026-901", titel: "Wohnbau Süd, Verteiler", art: "baustelle", ort: "Feldgasse 3" },
    { tag: 8, ma: "Lukas Steiner", auftrag: null, titel: "Urlaub", art: "urlaub", ganztags: true },
  ];

  for (const t of plan) {
    await pb.collection("termine").create({
      auftrag: t.auftrag ? auftraege.get(t.auftrag).id : null,
      mitarbeiter: [mitarbeiter.get(t.ma).id],
      titel: t.titel,
      datum: tagePlus(montag, t.tag),
      beginn: t.ganztags ? "" : "07:00",
      ende: t.ganztags ? "" : "16:00",
      ganztags: Boolean(t.ganztags),
      art: t.art,
      ort: t.ort ?? "",
      notizen: "",
    });
  }
  console.log(`Termine: ${plan.length} in dieser und nächster Woche`);
}

/**
 * Zwei Rechnungen: eine bezahlte und eine überfällige.
 *
 * Die überfällige ist zurückdatiert und teilbezahlt — damit lässt sich das
 * Mahnwesen samt Zinsen ansehen, ohne sechzig Tage zu warten. Nummern aus
 * dem normalen Kreis; alles andere hieße, ihn zu verbiegen.
 */
async function belegeAnlegen(auftraege, kunden) {
  const vorhanden = await pb.collection("belege").getList(1, 1);
  if (vorhanden.totalItems > 0) {
    console.log("Belege: schon welche vorhanden, übersprungen");
    return;
  }

  // Bezahlte Rechnung an die Familie Gruber, Auftrag 902.
  const gruber = await rechnungAus(auftraege.get("2026-902"), kunden.get("Familie Gruber"), {
    datum: tagVor(30),
    leistungVon: tagVor(70),
    leistungBis: tagVor(49),
    zahlungszielTage: 14,
    skontoProzent: 2,
    skontoTage: 7,
    kopftext: "Für die Sanierung Ihrer Elektroinstallation erlauben wir uns zu verrechnen:",
    fusstext: "Vielen Dank für Ihren Auftrag. Die Prüfprotokolle liegen bei.",
  });
  await pb.collection("zahlungen").create({
    beleg: gruber.id,
    datum: tagVor(24),
    betrag: gruber.brutto,
    art: "ueberweisung",
    notiz: "vollständig, innerhalb Skontofrist",
  });
  await pb.collection("belege").update(gruber.id, { status: "bezahlt" });

  // Überfällige Rechnung an die Hausverwaltung, teilbezahlt.
  const hv = await rechnungAus(auftraege.get("2026-903"), kunden.get("Hausverwaltung Föhrenwald"), {
    datum: tagVor(62),
    leistungVon: tagVor(75),
    leistungBis: tagVor(63),
    zahlungszielTage: 14,
    kopftext: "Wiederkehrende Überprüfung der Allgemeinteile, Objekt Lindenhof:",
    fusstext: "Die Prüfbefunde wurden Ihnen gesondert übermittelt.",
  });
  await pb.collection("zahlungen").create({
    beleg: hv.id,
    datum: tagVor(40),
    betrag: Math.round(hv.brutto / 3),
    art: "ueberweisung",
    notiz: "Teilzahlung",
  });

  console.log(
    `Belege: ${gruber.nummer} (bezahlt), ${hv.nummer} (überfällig und teilbezahlt)`,
  );
}

/** Erzeugt eine festgeschriebene Rechnung aus den Positionen eines Auftrags. */
async function rechnungAus(auftrag, kunde, kopf) {
  const positionen = await pb
    .collection("positionen")
    .getFullList({ filter: `auftrag = "${auftrag.id}"`, sort: "pos" });

  const nummer = await naechsteBelegnummer("RE");
  const nettoJeSatz = {};
  for (const p of positionen) {
    const wert = Math.round(p.menge * p.einzelpreis * (1 - (p.rabatt ?? 0) / 100));
    nettoJeSatz[String(p.ustsatz)] = (nettoJeSatz[String(p.ustsatz)] ?? 0) + wert;
  }
  let netto = 0;
  let ust = 0;
  for (const [satz, betrag] of Object.entries(nettoJeSatz)) {
    netto += betrag;
    ust += Math.round((betrag * Number(satz)) / 100);
  }

  const beleg = await pb.collection("belege").create({
    belegart: "rechnung",
    nummer,
    kunde: kunde.id,
    auftrag: auftrag.id,
    status: "offen",
    festgeschrieben: new Date().toISOString(),
    empfaengerName: kunde.name,
    empfaengerAnschrift: [kunde.strasse, `${kunde.plz} ${kunde.ort}`].filter(Boolean).join("\n"),
    empfaengerUid: kunde.uid ?? "",
    steuerfrei: "keiner",
    netto,
    ust,
    brutto: netto + ust,
    nettoJeSatz,
    ...kopf,
  });

  for (const p of positionen) {
    await pb.collection("belegpositionen").create({
      beleg: beleg.id,
      pos: p.pos,
      art: p.art,
      bezeichnung: p.bezeichnung,
      beschreibung: p.beschreibung ?? "",
      menge: p.menge,
      einheit: p.einheit,
      einzelpreis: p.einzelpreis,
      rabatt: p.rabatt ?? 0,
      ustsatz: p.ustsatz,
      betrag: Math.round(p.menge * p.einzelpreis * (1 - (p.rabatt ?? 0) / 100)),
      quelle: p.id,
    });
    await pb.collection("positionen").update(p.id, { verrechnet: true });
  }

  return { ...beleg, brutto: netto + ust, nummer };
}

// ---------------------------------------------------------------- entfernen

async function entfernen() {
  let weg = 0;

  // Reihenfolge von innen nach außen, sonst hängen Verknüpfungen in der Luft.
  const kunden = await gefunden("kunden", KUNDEN.map((k) => `name = "${k.name}"`).join(" || "));
  const auftraege = await gefunden("auftraege", AUFTRAEGE.map((a) => `nummer = "${a.nummer}"`).join(" || "));
  const personal = await gefunden("mitarbeiter", MITARBEITER.map((m) => `name = "${m.name}"`).join(" || "));

  for (const a of auftraege) {
    weg += await loescheAlle("positionen", `auftrag = "${a.id}"`);
    weg += await loescheAlle("zeiten", `auftrag = "${a.id}"`);
    weg += await loescheAlle("termine", `auftrag = "${a.id}"`);
  }

  // Berufsschule und Urlaub hängen an keinem Auftrag — sie blieben sonst
  // stehen und der zweite Lauf hielte die Termine für schon vorhanden.
  for (const m of personal) {
    weg += await loescheAlle("termine", `mitarbeiter ~ "${m.id}"`);
    weg += await loescheAlle("zeiten", `mitarbeiter = "${m.id}"`);
  }

  for (const k of kunden) {
    for (const b of await gefunden("belege", `kunde = "${k.id}"`)) {
      weg += await loescheAlle("mahnungen", `beleg = "${b.id}"`);
      weg += await loescheAlle("zahlungen", `beleg = "${b.id}"`);
      weg += await loescheAlle("belegpositionen", `beleg = "${b.id}"`);
      await pb.collection("belege").delete(b.id);
      weg++;
    }
    weg += await loescheAlle("ansprechpartner", `kunde = "${k.id}"`);
    weg += await loescheAlle("standorte", `kunde = "${k.id}"`);
  }

  for (const a of auftraege) {
    await pb.collection("auftraege").delete(a.id);
    weg++;
  }
  for (const k of kunden) {
    await pb.collection("kunden").delete(k.id);
    weg++;
  }

  weg += await loescheAlle("artikel", ARTIKEL.map((a) => `nummer = "${a.nummer}"`).join(" || "));
  for (const m of personal) {
    await pb.collection("mitarbeiter").delete(m.id);
    weg++;
  }

  console.log(`${weg} Datensätze entfernt.`);
  console.log(
    "Hinweis: die Rechnungsnummern der Beispielbelege sind damit aus dem Kreis\n" +
      "gefallen. In einer Testinstallation ist das gleichgültig; vor dem echten\n" +
      "Einsatz gehört die Datenbank ohnehin einmal frisch aufgesetzt.",
  );
}

// ------------------------------------------------------------------ Helfer

/** Legt an, wenn es den Datensatz noch nicht gibt; sonst gibt es den vorhandenen. */
async function einmalig(collection, filter, daten) {
  const da = await pb.collection(collection).getFirstListItem(filter).catch(() => null);
  if (da) return da;
  return await pb.collection(collection).create(daten);
}

async function gefunden(collection, filter) {
  if (!filter) return [];
  return await pb.collection(collection).getFullList({ filter }).catch(() => []);
}

async function loescheAlle(collection, filter) {
  const liste = await gefunden(collection, filter);
  for (const d of liste) await pb.collection(collection).delete(d.id);
  return liste.length;
}

async function naechsteBelegnummer(kuerzel) {
  const jahr = new Date().getFullYear();
  const praefix = `${kuerzel}-${jahr}-`;
  const liste = await pb
    .collection("belege")
    .getList(1, 1, { filter: `nummer ~ "${praefix}"`, sort: "-nummer" })
    .catch(() => null);
  const letzte = liste?.items[0]?.nummer ?? "";
  const zahl = Number(letzte.slice(praefix.length));
  return `${praefix}${String((Number.isFinite(zahl) ? zahl : 0) + 1).padStart(4, "0")}`;
}

function alsDatum(d) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

function tagVor(tage) {
  const d = new Date();
  d.setDate(d.getDate() - tage);
  return alsDatum(d);
}

function tagePlus(datum, tage) {
  const d = new Date(`${datum}T00:00:00`);
  d.setDate(d.getDate() + tage);
  return alsDatum(d);
}

function wochenbeginn() {
  const d = new Date();
  d.setDate(d.getDate() - ((d.getDay() + 6) % 7));
  return alsDatum(d);
}

function lesbarerFehler(e) {
  const ursache = String(e?.originalError?.cause?.code ?? "");
  if (e?.status === 0 || ursache === "ECONNREFUSED") {
    return (
      `PocketBase ist unter ${PB_URL} nicht erreichbar.\n` +
      "  Läuft der Server? Einmal  npm start  in einem eigenen Fenster."
    );
  }
  const daten = e?.response?.data;
  if (daten && Object.keys(daten).length > 0) {
    return Object.entries(daten)
      .map(([feld, angabe]) => `${feld}: ${angabe?.message ?? "ungültig"}`)
      .join("; ");
  }
  return e?.message ?? String(e);
}

function ladeEnv(pfad) {
  if (!existsSync(pfad)) return;
  for (const zeile of readFileSync(pfad, "utf8").split("\n")) {
    const m = zeile.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/);
    if (m && process.env[m[1]] === undefined) process.env[m[1]] = m[2].replace(/^["']|["']$/g, "");
  }
}
