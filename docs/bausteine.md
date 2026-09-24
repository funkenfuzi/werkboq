# Kern und Bausteine

Werkboq besteht aus einem Kern und aus Modulen, die einzeln verkauft werden.
Dieses Dokument hält fest, wo die Grenze liegt und welche Regeln dabei gelten —
damit die nächste Funktion gleich am richtigen Platz entsteht.

## Was im Kern bleibt

Kunde, Standort, Ansprechpartner, Auftrag, Dokument, Foto, Unterschrift,
Versandnachweis, Mitarbeiter, Zugänge, Betriebsstammdaten, Änderungsverlauf,
Suche, Offline-Warteschlange, Modulschnittstelle, Symbolsatz, Zeitrechnung.

Foto, Unterschrift und Versandnachweis gehören in den Kern und nicht in
einen Baustein: das Programm heißt Auftrags- **und
Baustellendokumentation**, und ein Betrieb, der Aufträge führt, macht Fotos
und lässt unterschreiben. Der Versandnachweis hängt an keinem Belegtyp — er
gilt für Rechnung, Angebot und Abnahmeschein gleichermaßen —, deshalb steht
er über der Verrechnung, nicht in ihr.

Der Kern ist die Auftragsverwaltung. Ein Handwerksbetrieb ohne Aufträge ist
kein Kunde für Werkboq, und Kunde und Auftrag sind die Wurzel, an der alles
andere hängt. Sie herauszulösen kostet viel und brächte einen Baustein, den
ohnehin jeder kauft.

## Bausteine

Grundfunktionen, die einzeln verkauft werden. `art: "baustein"`.

| Baustein | Collections | hängt ab von | bereichert |
|---|---|---|---|
| Zeiterfassung | `zeiten` | Mitarbeiter (Kern) | Planung, Verrechnung |
| Planung | `termine` | Mitarbeiter (Kern) | — |
| Material | `artikel`, `positionen` | Auftrag (Kern) | Verrechnung |
| Verrechnung | `belege`, `belegpositionen`, `zahlungen`, `mahnungen` | Kunde, Auftrag (Kern) | — |
| Personalwesen | `personaldaten`, `abwesenheiten`, `personaldokumente` | Mitarbeiter (Kern) | Planung |
| Fuhrpark | `fahrzeuge`, `fahrzeugfristen` | Mitarbeiter (Kern) | — |

Der Fuhrpark hängt nur am Mitarbeiter und an sonst nichts: ein Betrieb
kann ihn kaufen, ohne Material oder Verrechnung zu haben. Er rechnet
bewusst keine gesetzliche Prüffrist aus — siehe produkt.md, Punkt 5.

Der Baustein Material enthält seit September 2026 auch die Erfassung auf
der Baustelle: der Monteur trägt ein, was er verbaut hat, das Büro gibt es
frei. Der Dienst `auftragspositionen` liefert deshalb nur Freigegebenes und
meldet die Zahl der offenen Vorschläge mit — damit die Verrechnung warnen
kann, ohne den Baustein Material zu kennen.

Die Zeiterfassung ist allein verkaufbar: eine Arbeitszeitaufzeichnung nach
§ 26 AZG braucht jeder Betrieb. Ein Zeiteintrag ohne Auftrag ist allgemeine
Arbeitszeit — deshalb ist der Auftrag dort optional.

## Fachmodule

Erweiterungen für ein Gewerk. `art: "fachmodul"`. Derzeit: Elektro
(Prüfberichte nach OVE E 8101, DIN VDE bzw. NIN — je nach
Rechtsraum). Später Holz, Sanitär.

## Die drei Regeln

**1. Kein Modul kennt ein anderes.**
Weder als npm-Abhängigkeit noch als Import. Geprüft wird das nicht durch
Disziplin, sondern durch die Paketgrenzen: `@werkboq/baustein-planung` hat
`@werkboq/baustein-zeiterfassung` nicht in seiner `package.json`, also findet
der Compiler den Import gar nicht erst.

**2. Abhängigkeiten zeigen nur nach unten.**
Jedes Modul darf den Kern verwenden. Der Kern verwendet kein Modul. Steht in
`packages/core` das Wort `zeiten` oder `termine`, ist etwas schiefgegangen.

**3. Was Module voneinander brauchen, läuft über zwei Sockel im Kern.**

*Erweiterungspunkte* reichen Oberfläche durch
(`packages/core/src/modul/typen.ts`). Ein Modul hängt eine Komponente an einen
benannten Punkt, der Kern rendert sie, ohne zu wissen, was sie tut. Der
Zeiten-Block in der Auftragsakte ist so gebaut. Die Akte hat Reiter, und
jeder Reiter einen eigenen Punkt: `auftrag.arbeit`, `auftrag.baustelle`,
`auftrag.abrechnung`; dazu `auftrag.kachel` für die kleinen Kacheln im
Überblick (Komponente `Auftragskachel` aus dem Kern, damit alle gleich
aussehen). `auftrag.abschnitt` gibt es noch für ältere Module; es landet im
Reiter Arbeit. Weitere Punkte: `kunde.reiter` (Block in der Übersicht der
Kundenakte), `lieferant.reiter` (Block in der Lieferantenakte, seit
September 2026 — Verträge hängt dort die eigenen Verträge ein) und
`dashboard.kachel`.

Auch die Seitenleiste ist so gebaut: ein Navigationseintrag sagt mit
`gruppe`, unter welche Überschrift er gehört (`kunden`, `auftraege`,
`verkauf`, `betrieb`; Fachmodule stehen immer unter „Fachmodule"). Die
Leiste kennt keinen Baustein beim Namen, siehe
`packages/core/src/modul/navgruppen.ts`.

*Dienste* reichen Daten durch (`packages/core/src/modul/dienste.ts`). Ein
Modul bietet eine Funktion unter einem Namen an, ein anderes fragt danach.
Die Planung fragt `tagesstunden`; ist die Zeiterfassung dabei, antwortet sie,
sonst niemand. Bisher vergeben:

| Dienst | Anbieter | Nutzer |
|---|---|---|
| `tagesstunden` | Zeiterfassung | Planung |
| `auftragsstunden` | Zeiterfassung | Verrechnung |
| `auftragspositionen` | Material | Verrechnung |
| `abwesend` | Personalwesen | Planung |
| `rechtsraumSperre` | Verrechnung | Kern (Einstellungen) |
| `tagestermine` | Planung | Kern (Startseite) |
| `auftragsfahrten` | Zeiterfassung | Verrechnung |
| `fahrzeuge` | Fuhrpark | Zeiterfassung (Fahrten) |
| `belegentwurf` | Verrechnung | Verträge (Pauschale verrechnen) |

Der Kern kennt die *Namen und Formen* beider — so wie eine Steckdose die Form
des Steckers kennt, aber kein Gerät. Anbieter kennt er keine.

**Kein Modul darf einen anderen zwingend brauchen.** Fehlt der Nachbar, fehlt
seine Zutat, und der Rest funktioniert weiter. Im Dispo-Kalender verschwindet
ohne Zeiterfassung die Spalte mit den gebuchten Stunden — die Planung selbst
bleibt vollständig. Was ein Modul bereichert, steht in `ergaenzt` und ist
reine Beschreibung, keine Bedingung.

## Wie ein Modul angeschlossen wird

Anmelden und Starten sind getrennt:

```
modulRegistrieren(m)   alle mitgelieferten Module, immer
bausteineLaden()       was dieser Betrieb hat, aus den Betriebsstammdaten
moduleStarten()        initialisieren(), nur für die freigegebenen
```

Angemeldet werden immer alle — sonst könnte die Einstellungsseite gar nicht
anbieten, einen Baustein einzuschalten. Gestartet wird nur, was freigegeben
ist: ein nicht gekaufter Baustein darf nicht einmal seine Dienste anmelden,
sonst zeigt die Planung gebuchte Stunden aus einer Zeiterfassung, die es für
diesen Betrieb nicht gibt.

Alles in `apps/web/src/main.tsx`, und nur dort. Ein neues Modul ist dort eine
Zeile.

## Verkauf und Freigabe

`betrieb.bausteine` hält die Kennungen der Module, die dieser Betrieb hat.
Leer heißt „alle" — ein Bestand, der noch nie einen Schalter gesehen hat, soll
nicht plötzlich dunkel werden. Gepflegt wird die Liste unter Einstellungen →
Bausteine.

**Das ist kein Kopierschutz und soll keiner werden.** Werkboq läuft auf der
PocketBase des Kunden; wer dort Hand anlegt, schaltet jeden Schalter um. Eine
Sperre im Browser wäre in fünf Minuten ausgehebelt und würde nur ehrliche
Anwender behindern. Verkauft wird über den Vertrag. Der Schalter räumt die
Oberfläche auf und sagt, was zu diesem Betrieb gehört — mehr nicht. Die
Collections werden immer angelegt: eine leere Tabelle kostet nichts, ein
fehlendes Schema dagegen einen Ausfall, sobald jemand dazukauft. Abgeschaltete
Bausteine verlieren keine Daten.

## Wo was liegt

```
packages/core                     Kern
packages/baustein-zeiterfassung   Baustein
packages/baustein-planung         Baustein
packages/baustein-material        Baustein
packages/baustein-verrechnung     Baustein
packages/baustein-personal        Baustein
packages/baustein-fuhrpark        Baustein
packages/baustein-vertraege       Baustein
packages/modul-elektro            Fachmodul
apps/web                          Hülle: Seitenleiste, Routen, Kernseiten
packages/*/schema.mjs             Collections des Pakets — die einzige Stelle
packages/core/schema/             kern.mjs (Kern-Collections), regeln.mjs
server/schema.mjs                 sammelt alle ein, in Anlagereihenfolge
server/einrichten.mjs             legt an bzw. gleicht ab
```

Jede Collection steht in genau einer Datei: bei dem Paket, dem sie gehört,
als reines JavaScript (`schema.mjs`), damit `einrichten.mjs` sie mit Node
lesen kann. Bis September 2026 standen sie doppelt — im Modul als
TypeScript und gespiegelt in `einrichten.mjs` —, und die beiden Stände
liefen zweimal still auseinander.

## Was die Verrechnung bewusst nicht tut

**Keine Buchhaltung.** Kein Kontenrahmen, keine UVA, kein Jahresabschluss.
Werkboq hält fest, was fakturiert und was bezahlt wurde, und liefert einen
Export. Gebucht wird beim Steuerberater. Alles andere hieße, als
Softwareanbieter für fremde Buchführung zu haften.

**Keine Registrierkasse.** Die Registrierkassenpflicht greift ab 15.000 €
Jahresumsatz netto und zugleich 7.500 € Barumsatz netto und verlangt
RKSV-Signatureinheit, Datenerfassungsprotokoll und Zertifizierung. Wer das
braucht, braucht ein zertifiziertes Kassensystem — und Werkboq soll das sagen
statt es vorzutäuschen.

**Kein Löschen von Belegen.** Weder in der Oberfläche noch über die API:
`belege` und `belegpositionen` haben `deleteRule: null`. Eine fortlaufende
Rechnungsnummer ist nur dann eine, wenn dazwischen nichts verschwindet, und
§ 132 BAO verlangt sieben Jahre Aufbewahrung. Ein Entwurf lässt sich
wegräumen, solange er nicht festgeschrieben ist; danach ist die Korrektur
eine Gutschrift.

## Was das Personalwesen bewusst nicht tut

* **Keine Lohnverrechnung.** Kein Lohnzettel, keine Sozialversicherung, keine
  Zuschlagsstufen. Werkboq liefert Soll-, Ist- und Mehrstunden sowie die
  Abwesenheitstage als CSV; daraus macht die Lohnverrechnung einen
  Lohnzettel. Ein falsch gerechneter Zuschlag ist ein Fehler, den der Betrieb
  nachzahlt und verantwortet, und die Regeln stehen im Kollektivvertrag.
* **Keine Feiertage.** Sie unterscheiden sich je Bundesland. Ein falsch
  geratener Feiertag verfälscht Sollzeit und Urlaubstage still — lieber
  fehlt er und man korrigiert die Zahl von Hand.
* **Keine automatische Urlaubsstufe.** Ab 25 Dienstjahren gebühren sechs
  Wochen, aber ob Vordienstzeiten anzurechnen sind, steht im Vertrag.
* **Der Mitarbeiterdatensatz bleibt im Kern.** Aufträge, Zeiten und Termine
  verweisen darauf. Wer das Personalwesen nicht gekauft hat, muss trotzdem
  jemanden einplanen können.

Zu den Rechten — was serverseitig durchgesetzt ist und was noch nicht —
siehe [rechte.md](rechte.md).

## Beim nächsten Baustein

1. `packages/baustein-<name>` anlegen, `package.json` mit `@werkboq/core` als
   einziger Werkboq-Abhängigkeit.
2. Collections in `schema.mjs` im Paket (Regeln aus
   `@werkboq/core/schema/regeln.mjs`), den Export `"./schema.mjs"` in die
   `package.json`, und das Paket in `server/schema.mjs` eintragen.
3. `src/index.ts` mit `art: "baustein"`, `beschreibung` (steht in den
   Einstellungen) und der Navigation.
4. Braucht er etwas von einem Nachbarn: Dienst in `dienste.ts` benennen und
   über `dienst()` holen — nie importieren. Ohne Antwort muss es gehen.
5. Eine Zeile in `apps/web/src/main.tsx`.
6. Im Browsertest ab- und wieder anschalten: bleibt alles heil?
