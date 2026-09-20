# Was gebaut wird — und was nicht

Stand: September 2026. Diese Datei hält fest, warum die Reihenfolge so ist,
wie sie ist. Sie ist nicht der Fahrplan (der steht in
[fahrplan.md](fahrplan.md)), sondern die Begründung dahinter — damit in einem
halben Jahr nachvollziehbar ist, warum etwas fehlt.

## Der Maßstab

Ein Elektrobetrieb mit fünf bis zwanzig Leuten in Österreich, Deutschland
oder der Schweiz. Kein Konzern mit eigener Einkaufsabteilung, kein
Ein-Mann-Betrieb mit Schuhkarton.

Die Frage bei jeder Funktion ist nicht „wäre das schön", sondern: **Was
kostet dem Betrieb heute Geld oder Nerven, und was davon kann Software
abnehmen, ohne neue Pflichten zu schaffen?**

Diese Einschränkung ist wichtig. Jede Funktion, die Disziplin verlangt, die
der Betrieb nicht aufbringt, macht das Programm schlechter, nicht besser:
Zahlen, denen niemand traut, sind schlimmer als keine Zahlen.

## Was zuerst kommt und warum

### 1. Baustellendokumentation — Fotos am Auftrag

Die Collections `fotos` und `dokumente` liegen seit Scheibe 0 im Schema. Es
gab bis September 2026 keine Oberfläche dafür. Das Programm heißt
„Auftrags- und Baustellendokumentation", und die Baustellendokumentation
fehlte.

Für einen Elektriker ist das Foto der offenen Wand vor dem Verputzen der
wertvollste Datensatz überhaupt: Wo liegt die Leitung. Im Streitfall zählt es
mehr als jede Stundenaufzeichnung, und es kostet fünf Sekunden.

### 2. Die Tagesansicht für den Monteur

Die Startseite zeigte „Hallo Julian. Aktive Module: …". Der Mensch, der die
App am häufigsten öffnet, ist der Monteur um sieben Uhr früh — und für den
gab es keine Ansicht.

Das ist der Schlussstein, nicht ein Extra: Öffnet der Monteur die App nicht,
kommen keine Stunden und kein Material herein, und alles Nachgelagerte —
Rechnung, Nachkalkulation, Lohnvorbereitung — rechnet mit Schätzwerten.

### 3. Material, das der Monteur erfasst

Positionen werden heute im Büro getippt. Nichts verbindet „was verbaut wurde"
mit „was auf die Rechnung kommt“.

Das ist die klassische Verlustquelle im Handwerk. Nicht vergessene Stunden —
die fallen auf —, sondern vergessenes Material: drei Meter Kabel hier, eine
Dose dort, am Monatsende ein vierstelliger Betrag, den niemand vermisst, weil
ihn niemand je gesehen hat.

### 4. Auftragsarten statt zehn Phasen für alles

Heute hat jeder Auftrag dieselben zehn Phasen: Anfrage, Spezifikation,
Angebot, Termine, Projekt, Errichtung, Abnahme, Wartung, Materialverkauf,
Abgeschlossen. Zwei Probleme:

* „Materialverkauf" ist keine Phase, sondern eine Auftragsart. Er steht in
  derselben Reihe wie „Abnahme", obwohl das eine ein Geschäftsvorfall und das
  andere ein Zustand ist.
* Für eine Störungsbehebung — anrufen, hinfahren, Sicherung tauschen,
  verrechnen — sind sieben der zehn Phasen Lärm.

Vorschlag: **Auftragsart** (Störung, Regie, Projekt, Wartung, Materialverkauf)
getrennt von der **Phase**, und die Art entscheidet, welche Phasen es gibt.
Eine Störung hat drei, ein Projekt acht. Wenig Arbeit, großer Unterschied im
täglichen Gefühl.

### 5. Fahrzeuge mit Fristen

§ 57a-Pickerl, Service, Reifenwechsel, Versicherung, Leasing-Ende,
Kilometerstand, Zuordnung zum Monteur.

Das ist dasselbe Muster wie die Personaldokumente mit Ablaufdatum: etwas
läuft ab, und es fällt niemandem auf, bis es zu spät ist. Die Maschinerie
dafür steht seit dem Personalwesen, es ist im Wesentlichen eine zweite
Collection.

### 6. Angebotsverfolgung

Welche Angebote sind offen, welche sind kalt geworden, wann wurde nachgefasst.
Wenig Arbeit, unmittelbar Geld — ein Angebot, an das sich niemand erinnert,
ist ein verlorener Auftrag.

### 7. Bestellwesen mit Auftragsbezug

Den Webshop von Sonepar, Rexel oder Schäcke kann Werkboq nicht besser. Der
Wert liegt nicht im Bestellen, sondern in der Kette:

> Bestellung hängt am Auftrag → Ware kommt an → wird verbaut → steht auf der
> Rechnung.

Ohne diese Verknüpfung ist es ein schlechteres Bestellformular. Mit ihr
schließt es die Lücke aus Punkt 3 von der anderen Seite.

Die Großhändler haben IDS- und OCI-Schnittstellen. Das ist die eigentliche
Arbeit und der eigentliche Verkaufsgrund — und ein Brocken, kein Nachmittag.

## Was bewusst nicht gebaut wird

### Keine Bestandsführung im Lager

Echte Lagerverwaltung verlangt, dass jeder Griff ins Regal gebucht wird.
Diese Disziplin hält ein Zehn-Mann-Betrieb nicht durch — nach drei Wochen
stimmt der Bestand nicht mehr.

Und ein falscher Bestand ist schlimmer als gar keiner: die Leute verlassen
sich darauf und stehen ohne Material auf der Baustelle.

**Was stattdessen kommt, wenn es soweit ist:** das Fahrzeuglager als
Nachfüllliste. Mindestbestand je Sorte, „was fehlt im Bus", vom Monteur in
zehn Sekunden abgehakt. Keine buchhalterische Bestandsführung, kein
Wareneingangsbuch, keine Inventur. Ein Zehntel der Arbeit, neunzig Prozent
des Nutzens.

Sollte ein Betrieb echte Bestandsführung brauchen, ist das ein eigenes
Produkt mit eigener Haftung — so wie die Registrierkasse.

### Logistik nicht als eigenes Modul

Bei dieser Betriebsgröße *ist* Logistik der Dispo-Kalender: wer fährt wann
wohin. Den gibt es. Ein zweites Modul daneben würde dieselben Daten anders
anzeigen und beide schlechter machen.

Was fehlt, ist nicht ein Logistikmodul, sondern die Fahrzeugzuordnung im
Dispo — und die kommt mit Punkt 5.

### Keine Lohnverrechnung

Steht schon in [bausteine.md](bausteine.md): Werkboq liefert Soll-, Ist- und
Mehrstunden sowie Abwesenheitstage. Den Lohnzettel macht die
Lohnverrechnung. Ein falsch gerechneter Zuschlag ist ein Fehler, den der
Betrieb nachzahlt.

### Keine Buchhaltung, keine Registrierkasse

Siehe [bausteine.md](bausteine.md) und
[rechtsraeume.md](rechtsraeume.md). Offene Posten und Export für den
Steuerberater ja; Kontenrahmen, UVA und Abschluss nein.

## Die Regel dahinter

Werkboq soll an den Stellen gut sein, an denen ein Handwerksbetrieb heute
Geld verliert: vergessenes Material, nicht nachgefasste Angebote, abgelaufene
Fristen, Rechnungen, die zu spät hinausgehen.

Es soll **nicht** die Stellen abdecken, an denen es einen Haftungsübergang
gäbe (Lohn, Steuer, Kasse) oder an denen es Disziplin verlangt, die im
Alltag nicht aufgebracht wird (Bestandsführung). Dort verweist es auf das
richtige Werkzeug und sagt, warum.

Eine Funktion, die zu neunzig Prozent stimmt, ist in der Buchhaltung
wertlos und auf der Baustelle Gold wert. Diese Unterscheidung entscheidet,
was hier hineinkommt.
