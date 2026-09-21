# Rechte

## Zwei Stufen je Bereich

Ein Zugang hat je Bereich eine von drei Stufen: **kein Zugriff**, **nur
lesen**, **lesen und ändern**. Technisch sind das zwei Listen am
Benutzerdatensatz — `bereiche` für Schreibrecht, `lesebereiche` für
Leserecht. Wer in der Schreibliste steht, darf auch lesen.

Die Aufteilung ist rückwärtsverträglich: bestehende Zugänge haben nur
`bereiche` und behalten genau das, was sie vorher hatten.

Bei **Verwaltung** und **Entwickler** fehlt die mittlere Stufe. Wer Zugänge
ansehen darf, kann sie auch vergeben — ein Betrachter wäre eine Stufe, die
nichts schützt und nur verwirrt.

Ein **Administrator** darf alles, unabhängig von beiden Listen.

## Was wirklich geschützt ist — und was nicht

Das ist der wichtigste Absatz dieser Datei.

**Die Oberfläche ist kein Schutz.** Ein Monteur hat die App am Tablet. Wer
die Entwicklerkonsole öffnet oder die API direkt anspricht, sieht alles, was
die Collection-Regeln hergeben — gleichgültig, welcher Menüpunkt ausgeblendet
ist. `darf()` und `darfSchreiben()` entscheiden, was angezeigt wird, sonst
nichts.

**Serverseitig durchgesetzt sind derzeit das Personalwesen, die
Unterschriften und die Freigabe von Positionen:**

| Collection | lesen | ändern |
|---|---|---|
| `personaldaten` | Bereich `personal`, oder der Betroffene selbst | Bereich `personal` |
| `personaldokumente` | Bereich `personal`, oder der Betroffene selbst | Bereich `personal` |
| `abwesenheiten` | Bereich `personal`, oder der Betroffene selbst | Bereich `personal`; jeder darf für sich selbst einen Antrag im Status `beantragt` anlegen |

| `unterschriften` | jeder Angemeldete | **niemand** — keine `updateRule`; löschen nur Administrator |
| `positionen` | jeder Angemeldete | anlegen und ändern jeder Angemeldete, **aber freigeben nur mit Schreibrecht `lager`** |

Dass der Betroffene die eigene Akte lesen darf, ist kein Entgegenkommen,
sondern sein Auskunftsrecht. Ändern darf er sie nicht, und den eigenen
Urlaubsantrag kann er nicht selbst genehmigen — die Regel lässt beim Anlegen
nur `status = "beantragt"` zu.

**Alles andere steht noch auf `angemeldet`.** Wer sich anmelden kann, kann
über die API Aufträge ändern, Artikelpreise ändern und Rechnungen lesen. Die
Stufe in der Oberfläche blendet das aus, mehr nicht. Solange das so ist,
gehört ein Zugang nur an Leute, denen der Betrieb ohnehin vertraut.

Das ist bekannter Rückstand, kein Versehen: die Regeln für Aufträge, Material
und Verrechnung sind der zweite Durchgang.

## Nachprüfen statt glauben

Ob eine Regel greift, sieht man nicht im Code und nicht am Bildschirm — man
muss es versuchen:

```
npm run rechte-pruefen
```

Das Skript legt drei Zugänge an (Monteur mit Leserecht auf Technik, ein
Betroffener ohne Personalrecht, eine Personalstelle), versucht damit rund
zwanzig Zugriffe direkt gegen die API und räumt hinterher auf. Es läuft nur
gegen eine PocketBase auf dem eigenen Rechner.

Am Ende steht ein eigener Abschnitt „Noch nicht serverseitig durchgesetzt“.
Der schrumpft mit jedem Durchgang — und solange dort etwas steht, ist es
wahr.

## Warum die Personaldaten in einer eigenen Tabelle liegen

PocketBase kennt Zugriffsregeln je Datensatz, nicht je Feld. Stünde die
Sozialversicherungsnummer am Mitarbeiterdatensatz, käme sie bei jedem Zugriff
mit, den die Planung, der Auftrag oder die Zeiterfassung ohnehin machen.

Deshalb drei Tabellen:

* `mitarbeiter` bleibt im **Kern** — Name, Funktion, Farbe, Wochenstunden.
  Das liest jeder, der jemanden einplant. Wer kein Personalwesen gekauft hat,
  muss trotzdem jemanden einteilen können.
* `personaldaten` liegt im **Baustein Personalwesen** — Geburtsdatum, SVNR,
  Lohn, Kollektivvertrag.
* `abwesenheiten` und `personaldokumente` ebenso.

## Eine Grenze, die bleibt

Die Disposition müsste wissen, **dass** jemand fehlt, ohne zu erfahren,
**warum**. Das geht in PocketBase nicht: mit dem Datensatz käme auch
`art = "krankenstand"` mit. Deshalb liest `abwesenheiten` nur, wer
Personalwesen lesen darf. Wer die Dispo macht, braucht also Leserecht auf
Personalwesen und sieht damit auch den Grund.

Soll die Planung wirklich grundblind sein, braucht es eine eigene, schmale
Collection nur mit Tagen. Das ist bewusst noch nicht gebaut — der Dienst
`abwesend` liefert immerhin schon nur Tage ohne Grund, aber das ist die
zweite Hürde, nicht die erste.

## Ein Feld einzeln absichern, ohne Feldrechte

PocketBase kennt Regeln je Datensatz, nicht je Feld. Für die Freigabe von
Positionen brauchte es aber genau das: der Monteur soll Menge und
Bezeichnung ändern dürfen, den Zustand aber nicht auf „freigegeben" setzen.

Das geht trotzdem, weil eine Regel zwei Dinge sehen kann — was hereinkommt
(`@request.data.feld`) und was gespeichert ist (der Feldname allein):

```js
createRule: `${angemeldet} && (@request.data.zustand = "vorschlag" || ${schreibt("lager")})`
updateRule: `${angemeldet} && (zustand != "vorschlag" || @request.data.zustand = "vorschlag" || ${schreibt("lager")})`
```

Zwei Feinheiten, die beim ersten Anlauf gefehlt haben und die man nur beim
Prüfen gegen die API bemerkt:

* Beim Anlegen steht bewusst `= "vorschlag"` und nicht `!= "freigegeben"`.
  Sonst legt man die Position ganz **ohne** Zustandsfeld an, und weil leer
  als freigegeben gilt, ist die Freigabe umgangen.
* Beim Ändern muss auch das **Leerräumen** des Feldes gesperrt sein, sonst
  führt derselbe Weg über einen zweiten Aufruf zum Ziel.

Geprüft wird das mit einem Zugang, der nur `technik` hat, gegen die echte
API — nicht in der Oberfläche. Die sieben Fälle: Vorschlag anlegen (geht),
eigene Menge ändern (geht), eigenen Vorschlag freigeben (404), gleich
freigegeben anlegen (400), ohne Zustandsfeld anlegen (400), Zustand
leerräumen (404), Büro gibt frei (geht).

## Für Entwickler

```ts
import { darf, darfSchreiben, stufe } from "@werkboq/core";

darf("personal")           // sichtbar?
darfSchreiben("personal")  // änderbar?
stufe("technik")           // "keine" | "lesen" | "schreiben"
```

Serverseitig, in `server/einrichten.mjs`:

```js
bereichsregeln("personal", "mitarbeiter.benutzer = @request.auth.id")
```

Gefiltert wird auf den JSON-Text mit Anführungszeichen (`~ '"personal"'`),
damit `lager` nicht in `lagerleitung` trifft.

**Eine neue Collection mit vertraulichen Daten bekommt ihre Regel im selben
Commit wie ihr Schema.** Nachgereichte Rechte werden vergessen, und niemandem
fällt es auf, weil in der Oberfläche alles richtig aussieht.
