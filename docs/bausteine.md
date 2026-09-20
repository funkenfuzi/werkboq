# Kern und Bausteine

Werkboq besteht aus einem Kern und aus Modulen, die einzeln verkauft werden.
Dieses Dokument hält fest, wo die Grenze liegt und welche Regeln dabei gelten —
damit die nächste Funktion gleich am richtigen Platz entsteht.

## Was im Kern bleibt

Kunde, Standort, Ansprechpartner, Auftrag, Dokument, Foto, Mitarbeiter,
Zugänge, Betriebsstammdaten, Änderungsverlauf, Suche, Offline-Warteschlange,
Modulschnittstelle, Symbolsatz, Zeitrechnung.

Der Kern ist die Auftragsverwaltung. Ein Handwerksbetrieb ohne Aufträge ist
kein Kunde für Werkboq, und Kunde und Auftrag sind die Wurzel, an der alles
andere hängt. Sie herauszulösen kostet viel und brächte einen Baustein, den
ohnehin jeder kauft.

## Bausteine

Grundfunktionen, die einzeln verkauft werden. `art: "baustein"`.

| Baustein | Collections | hängt ab von | bereichert |
|---|---|---|---|
| Zeiterfassung | `zeiten` | Mitarbeiter (Kern) | Planung, später Verrechnung |
| Planung | `termine` | Mitarbeiter (Kern) | — |
| Material und Positionen (Scheibe 4) | offen | Auftrag (Kern) | Verrechnung |
| Verrechnung (Scheibe 7) | offen | Auftrag (Kern) | — |

Die Zeiterfassung ist allein verkaufbar: eine Arbeitszeitaufzeichnung nach
§ 26 AZG braucht jeder Betrieb. Ein Zeiteintrag ohne Auftrag ist allgemeine
Arbeitszeit — deshalb ist der Auftrag dort optional.

## Fachmodule

Erweiterungen für ein Gewerk. `art: "fachmodul"`. Derzeit: Elektro
(Prüfberichte nach OVE E 8101). Später Holz, Sanitär.

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
Zeiten-Block in der Auftragsakte ist so gebaut: `auftrag.abschnitt`.

*Dienste* reichen Daten durch (`packages/core/src/modul/dienste.ts`). Ein
Modul bietet eine Funktion unter einem Namen an, ein anderes fragt danach.
Die Planung fragt `tagesstunden`; ist die Zeiterfassung dabei, antwortet sie,
sonst niemand.

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
packages/modul-elektro            Fachmodul
apps/web                          Hülle: Seitenleiste, Routen, Kernseiten
server/einrichten.mjs             Schema: KERN, BAUSTEINE, MODULE
```

`einrichten.mjs` spiegelt die Collection-Definitionen der Module, weil Node
die TypeScript-Dateien nicht direkt laden kann. Das bleibt ein offener Punkt
(siehe `fahrplan.md`): eine Definition an zwei Stellen ist eine Stelle zu
viel.

## Beim nächsten Baustein

1. `packages/baustein-<name>` anlegen, `package.json` mit `@werkboq/core` als
   einziger Werkboq-Abhängigkeit.
2. Collections in `src/daten/collections.ts` und gespiegelt in `BAUSTEINE` in
   `einrichten.mjs`.
3. `src/index.ts` mit `art: "baustein"`, `beschreibung` (steht in den
   Einstellungen) und der Navigation.
4. Braucht er etwas von einem Nachbarn: Dienst in `dienste.ts` benennen und
   über `dienst()` holen — nie importieren. Ohne Antwort muss es gehen.
5. Eine Zeile in `apps/web/src/main.tsx`.
6. Im Browsertest ab- und wieder anschalten: bleibt alles heil?
