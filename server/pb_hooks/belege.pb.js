/// <reference path="../pb_data/types.d.ts" />

/**
 * Ein festgeschriebener Beleg bleibt, wie er ist — geprüft auf dem Server.
 *
 * Die Oberfläche verweigert das Ändern schon lange (belegAendern wirft).
 * Das ist aber kein Schutz: wer die API direkt anspricht, konnte bis
 * September 2026 den Betrag einer verschickten Rechnung umschreiben. Für
 * eine Rechnung mit fortlaufender Nummer, die sieben Jahre aufzubewahren
 * ist (§ 132 BAO, § 147 AO), ist das der eine Fehler, der nicht passieren
 * darf.
 *
 * Nach dem Festschreiben änderbar bleibt nur, was den Beleg nicht ändert,
 * sondern seinen Weg: Status (bezahlt, angenommen, storniert), die
 * Verknüpfung zu Auftrag und Folgebeleg, und was die Angebotsverfolgung
 * braucht. Alles andere — Beträge, Empfänger, Texte, Datum, Nummer — ist
 * eingefroren, samt den Zeilen.
 *
 * Warum ein Hook und keine Regel: PocketBase kennt Regeln je Datensatz,
 * nicht je Feld. Eine Regel kann sagen „wer darf ändern", aber nicht
 * „welche Felder". Siehe docs/rechte.md.
 *
 * Handler laufen in PocketBase jeweils in einem eigenen Kontext und sehen
 * nichts außerhalb ihrer Funktion — deshalb stehen die Listen in jedem
 * Handler selbst.
 */

onRecordBeforeUpdateRequest((e) => {
  const alt = e.record.originalCopy();
  if (!alt.getString("festgeschrieben")) return;

  const frei = ["status", "auftrag", "folgebeleg", "wiedervorlage", "absagegrund", "absagenotiz", "updated"];
  const geaendert = [];
  const felder = e.collection.schema.fields();
  for (let i = 0; i < felder.length; i++) {
    const name = felder[i].name;
    if (frei.indexOf(name) >= 0) continue;
    const vorher = alt.getString(name);
    const nachher = e.record.getString(name);
    if (vorher !== nachher) geaendert.push(name);
  }
  if (geaendert.length) {
    throw new BadRequestError(
      "Der Beleg " + alt.getString("nummer") + " ist festgeschrieben und kann nicht mehr geändert werden " +
        "(" + geaendert.join(", ") + "). Korrektur über eine Gutschrift.",
    );
  }
}, "belege");

onRecordBeforeDeleteRequest((e) => {
  // Der Serveradministrator (nicht ein Betriebsadministrator der App!) darf
  // aufräumen — etwa `npm run beispieldaten -- weg`. Er kann ohnehin alles,
  // direkt in der Datenbank; hier ihn zu sperren, schützte nichts.
  if (e.httpContext && $apis.requestInfo(e.httpContext).admin) return;
  if (e.record.getString("festgeschrieben")) {
    throw new BadRequestError(
      "Festgeschriebene Belege werden nicht gelöscht — das wäre eine Lücke im Nummernkreis. Storno über eine Gutschrift.",
    );
  }
}, "belege");

onRecordBeforeCreateRequest((e) => {
  const beleg = $app.dao().findRecordById("belege", e.record.getString("beleg"));
  if (beleg.getString("festgeschrieben")) {
    throw new BadRequestError("Der Beleg " + beleg.getString("nummer") + " ist festgeschrieben — keine neuen Zeilen mehr.");
  }
}, "belegpositionen");

onRecordBeforeUpdateRequest((e) => {
  const beleg = $app.dao().findRecordById("belege", e.record.originalCopy().getString("beleg"));
  if (beleg.getString("festgeschrieben")) {
    throw new BadRequestError("Der Beleg " + beleg.getString("nummer") + " ist festgeschrieben — seine Zeilen auch.");
  }
}, "belegpositionen");

onRecordBeforeDeleteRequest((e) => {
  if (e.httpContext && $apis.requestInfo(e.httpContext).admin) return;
  let beleg = null;
  try {
    beleg = $app.dao().findRecordById("belege", e.record.getString("beleg"));
  } catch (_) {
    return; // Beleg schon weg (Entwurf samt Zeilen gelöscht) — nichts zu schützen.
  }
  if (beleg.getString("festgeschrieben")) {
    throw new BadRequestError("Der Beleg " + beleg.getString("nummer") + " ist festgeschrieben — seine Zeilen auch.");
  }
}, "belegpositionen");
