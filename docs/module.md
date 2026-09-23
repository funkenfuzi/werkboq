# Ein Modul schreiben

Ein Fachmodul ist ein eigenes Paket unter `packages/modul-<name>/`, das genau ein
Objekt vom Typ `WerkboqModul` als Default-Export liefert. Der Kern importiert nie aus
einem Modul; die Shell in `apps/web` registriert es.

## Minimalbeispiel

```ts
import type { WerkboqModul } from "@werkboq/core";

export const modulHolz: WerkboqModul = {
  id: "holz",
  name: "Holz",
  version: "0.1.0",
  benoetigtKern: "^0.1.0",
  collections: [/* zusätzliche PocketBase-Collections */],
  navigation: [{ pfad: "/holz/aufmass", titel: "Aufmaß", komponente: Aufmass, bereich: "holz" }],
  erweiterungen: { "auftrag.reiter": AuftragHolzReiter },
};

export default modulHolz;
```

Registrieren in `apps/web/src/main.tsx`:

```ts
import modulHolz from "@werkboq/modul-holz";
await modulRegistrieren(modulHolz);
```

Mehr ist am Kern nicht zu ändern. Das ist die Probe aufs Exempel: Sobald ein neues
Modul eine Änderung in `packages/core` verlangt, fehlt der Schnittstelle etwas – dann
wird die Schnittstelle erweitert, nicht das Modul in den Kern hineingezogen.

## Erweiterungspunkte

| Punkt | Wo es erscheint |
|---|---|
| `auftrag.reiter` | zusätzlicher Reiter in der Auftragsansicht |
| `auftrag.aktionen` | Schaltflächen in der Kopfzeile eines Auftrags |
| `kunde.reiter` | zusätzlicher Reiter in der Kundenansicht |
| `dashboard.kachel` | Kachel auf der Startseite |

Neue Punkte kommen in `packages/core/src/modul/typen.ts` dazu, sobald ein Modul sie
braucht.

## Collections

Ein Modul benennt seine Collections mit seinem Präfix (`elektro_pruefberichte`). Die
Definitionen stehen im Modul in `schema.mjs` (reines JavaScript, damit
`server/einrichten.mjs` sie mit Node laden kann) und nur dort; `server/schema.mjs`
sammelt sie in Anlagereihenfolge ein.

## Rechte

Die Modul-ID ist automatisch ein Rechte-Bereich. Weitere feinere Bereiche kann das
Modul über `bereiche` melden. Sichtbarkeit in der Oberfläche über `darf()`, die
Absicherung selbst über die PocketBase-Regeln der Collections.
