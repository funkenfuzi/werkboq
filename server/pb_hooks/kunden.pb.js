/// <reference path="../pb_data/types.d.ts" />

/**
 * Jeder Kunde hat einen Standort.
 *
 * Gearbeitet wird immer an einem Ort — beim Einfamilienhaus ist es die
 * Wohnanschrift, bei der Gemeinde das Amtshaus, der Bauhof und der
 * Kindergarten. Einzige Ausnahme ist, wer nur Ware über den Ladentisch
 * kauft (`nurWare`), und der eigene Betrieb (`intern`).
 *
 * Deshalb legt der Server beim Anlegen eines Kunden den ersten Standort aus
 * dessen Anschrift an — auch wenn der Kunde ohne Netz erfasst und später
 * nachgereicht wurde, und auch, wenn jemand an der Oberfläche vorbei über
 * die Schnittstelle anlegt. Kunden, die es vorher schon gab, zieht
 * `npm run einrichten` einmal nach.
 *
 * Und der letzte Standort lässt sich nicht löschen, ebenso wenig einer, an
 * dem Aufträge hängen: sonst stünde der Auftrag ohne Ort da.
 *
 * Jeder Handler ist in sich geschlossen — PocketBase führt sie in
 * getrennten Umgebungen aus, gemeinsame Hilfsfunktionen sähen sie nicht.
 */

onRecordAfterCreateRequest((e) => {
  const k = e.record;
  if (k.getBool("intern") || k.getBool("nurWare")) return;
  const dao = $app.dao();
  const vorhanden = dao.findRecordsByFilter("standorte", "kunde = {:k}", "", 1, 0, { k: k.id });
  if (vorhanden.length) return;
  const s = new Record(dao.findCollectionByNameOrId("standorte"));
  s.set("kunde", k.id);
  s.set("bezeichnung", k.getString("strasse") || k.getString("ort") || "Hauptstandort");
  s.set("strasse", k.getString("strasse"));
  s.set("plz", k.getString("plz"));
  s.set("ort", k.getString("ort"));
  s.set("land", k.getString("land"));
  dao.saveRecord(s);
}, "kunden");

// Wer „nur Ware" wieder abhakt, ist ab jetzt ein Kunde mit Ort.
onRecordAfterUpdateRequest((e) => {
  const k = e.record;
  if (k.getBool("intern") || k.getBool("nurWare")) return;
  const dao = $app.dao();
  const vorhanden = dao.findRecordsByFilter("standorte", "kunde = {:k}", "", 1, 0, { k: k.id });
  if (vorhanden.length) return;
  const s = new Record(dao.findCollectionByNameOrId("standorte"));
  s.set("kunde", k.id);
  s.set("bezeichnung", k.getString("strasse") || k.getString("ort") || "Hauptstandort");
  s.set("strasse", k.getString("strasse"));
  s.set("plz", k.getString("plz"));
  s.set("ort", k.getString("ort"));
  s.set("land", k.getString("land"));
  dao.saveRecord(s);
}, "kunden");

// Nur Anfragen über die Schnittstelle. Löscht ein Administrator den ganzen
// Kunden, räumt PocketBase die Standorte ohne diesen Hook mit ab. Der
// Serveradministrator (Aufräumskripte, Admin-Oberfläche) darf alles.
onRecordBeforeDeleteRequest((e) => {
  if ($apis.requestInfo(e.httpContext).admin) return;
  const dao = $app.dao();
  const kundeId = e.record.getString("kunde");
  const auftraege = dao.findRecordsByFilter("auftraege", "standort = {:s}", "", 1, 0, { s: e.record.id });
  if (auftraege.length) {
    throw new BadRequestError(
      "An diesem Standort hängen Aufträge (" + auftraege[0].getString("nummer") + " …). Er bleibt, damit sie ihren Ort behalten.",
    );
  }
  const kunde = dao.findRecordById("kunden", kundeId);
  if (kunde.getBool("nurWare") || kunde.getBool("intern")) return;
  const alle = dao.findRecordsByFilter("standorte", "kunde = {:k}", "", 2, 0, { k: kundeId });
  if (alle.length <= 1) {
    throw new BadRequestError("Das ist der einzige Standort dieses Kunden. Ein Kunde ohne Standort geht nur, wenn er nur Ware kauft.");
  }
}, "standorte");
