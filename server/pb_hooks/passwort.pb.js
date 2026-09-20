/// <reference path="../pb_data/types.d.ts" />

/**
 * Passwort eines anderen Benutzers setzen.
 *
 * PocketBase verlangt bei jeder Passwortänderung über die Datensatz-API das
 * alte Passwort — auch dann, wenn ein anderer angemeldeter Benutzer die
 * Änderung vornimmt. Für einen Betrieb ist das untauglich: Der häufigste Fall
 * ist ein Monteur, der sein Passwort vergessen hat und genau deshalb nicht
 * mehr hineinkommt.
 *
 * Dieser Endpunkt schließt die Lücke, ohne die Regeln aufzuweichen:
 *   - nur für angemeldete Benutzer mit admin = true,
 *   - nur für andere Konten (das eigene ändert man im Profil, mit altem
 *     Passwort — sonst wäre ein offener Bildschirm eine Kontoübernahme),
 *   - Mindestlänge wie in der Collection eingestellt.
 *
 * Aufruf: POST /api/werkboq/passwort  { benutzer, passwort }
 */
/**
 * Die eingestellte Mindestlänge, damit die Oberfläche dieselbe Zahl nennt,
 * an der der Server später misst. Die Collection-Einstellungen selbst darf
 * nur der Serveradministrator lesen — diese eine Zahl ist harmlos.
 */
routerAdd(
  "GET",
  "/api/werkboq/passwortregel",
  (c) => {
    let mindestens = 8;
    try {
      const wert = $app.dao().findCollectionByNameOrId("users").authOptions().minPasswordLength;
      if (wert > 0) mindestens = wert;
    } catch (e) {
      // Nicht lesbar: 8 ist strenger als jede zulässige Vorgabe.
    }
    return c.json(200, { mindestens: mindestens });
  },
  $apis.requireRecordAuth("users"),
);

routerAdd(
  "POST",
  "/api/werkboq/passwort",
  (c) => {
    const info = $apis.requestInfo(c);
    const auth = info.authRecord;

    if (!auth || !auth.getBool("admin")) {
      throw new ForbiddenError("Nur Betriebsadministratoren dürfen Passwörter setzen.");
    }

    const benutzerId = String((info.data && info.data.benutzer) || "");
    const passwort = String((info.data && info.data.passwort) || "");

    if (!benutzerId) throw new BadRequestError("Es fehlt die Kennung des Benutzers.");
    if (benutzerId === auth.id) {
      throw new BadRequestError(
        "Das eigene Passwort änderst du im Profil — dort mit dem alten Passwort.",
      );
    }

    const ziel = $app.dao().findRecordById("users", benutzerId);

    let mindestens = 8;
    try {
      const wert = ziel.collection().authOptions().minPasswordLength;
      if (wert > 0) mindestens = wert;
    } catch (e) {
      // Einstellung nicht lesbar: 8 ist strenger als jede zulässige Vorgabe.
    }
    if (passwort.length < mindestens) {
      throw new BadRequestError(`Das Passwort braucht mindestens ${mindestens} Zeichen.`);
    }

    ziel.setPassword(passwort);
    $app.dao().saveRecord(ziel);

    return c.json(200, { erfolg: true });
  },
  $apis.requireRecordAuth("users"),
);
