/// <reference path="../pb_data/types.d.ts" />

/**
 * Ein Versandnachweis ist ein Nachweis — nachträglich änderbar ist nur,
 * ob er bestätigt wurde.
 *
 * Die Rückfrage „wirklich hinausgegangen?" muss `bestaetigt` umlegen
 * dürfen, deshalb darf jeder Angemeldete den Datensatz ändern. Ohne diesen
 * Hook hätte man damit auch Empfänger, Weg oder Zeitpunkt umschreiben
 * können — bis September 2026 war das so und in docs/fahrplan.md als
 * bekannte Lücke vermerkt. Regeln gelten je Datensatz, nicht je Feld;
 * darum ein Hook.
 *
 * Und bestätigt bleibt bestätigt, verneint bleibt verneint: zurücknehmen
 * würde den Nachweis genauso entwerten wie umschreiben.
 */
onRecordBeforeUpdateRequest((e) => {
  const alt = e.record.originalCopy();
  const geaendert = [];
  const felder = e.collection.schema.fields();
  for (let i = 0; i < felder.length; i++) {
    const name = felder[i].name;
    if (name === "bestaetigt" || name === "nichtErfolgt") continue;
    if (alt.getString(name) !== e.record.getString(name)) geaendert.push(name);
  }
  if (geaendert.length) {
    throw new BadRequestError(
      "Ein Versandnachweis wird nicht umgeschrieben (" + geaendert.join(", ") + "). Nur die Bestätigung lässt sich nachtragen.",
    );
  }
  if (alt.getBool("bestaetigt") && !e.record.getBool("bestaetigt")) {
    throw new BadRequestError("Eine Bestätigung lässt sich nicht zurücknehmen.");
  }
  if (alt.getBool("nichtErfolgt") && !e.record.getBool("nichtErfolgt")) {
    throw new BadRequestError("Ein „nicht erfolgt“ lässt sich nicht zurücknehmen — dann bitte neu versenden.");
  }
  if (e.record.getBool("bestaetigt") && e.record.getBool("nichtErfolgt")) {
    throw new BadRequestError("Bestätigt und nicht erfolgt zugleich geht nicht.");
  }
}, "versand");
