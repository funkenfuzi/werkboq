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

Die Punkte 1 bis 5 stehen seit September 2026, dazu die Unterschrift und
der Dokumentenversand. 6 und 7 sind offen.

### 1. Baustellendokumentation — Fotos am Auftrag — **steht**

Die Collections `fotos` und `dokumente` liegen seit Scheibe 0 im Schema. Es
gab bis September 2026 keine Oberfläche dafür. Das Programm heißt
„Auftrags- und Baustellendokumentation", und die Baustellendokumentation
fehlte.

Für einen Elektriker ist das Foto der offenen Wand vor dem Verputzen der
wertvollste Datensatz überhaupt: Wo liegt die Leitung. Im Streitfall zählt es
mehr als jede Stundenaufzeichnung, und es kostet fünf Sekunden.

### 2. Die Tagesansicht für den Monteur — **steht**

Die Startseite zeigte „Hallo Julian. Aktive Module: …". Der Mensch, der die
App am häufigsten öffnet, ist der Monteur um sieben Uhr früh — und für den
gab es keine Ansicht.

Das ist der Schlussstein, nicht ein Extra: Öffnet der Monteur die App nicht,
kommen keine Stunden und kein Material herein, und alles Nachgelagerte —
Rechnung, Nachkalkulation, Lohnvorbereitung — rechnet mit Schätzwerten.

### 3. Material, das der Monteur erfasst — **steht**

Positionen wurden bis September 2026 im Büro getippt. Nichts verband „was
verbaut wurde" mit „was auf die Rechnung kommt".

Das ist die klassische Verlustquelle im Handwerk. Nicht vergessene Stunden —
die fallen auf —, sondern vergessenes Material: drei Meter Kabel hier, eine
Dose dort, am Monatsende ein vierstelliger Betrag, den niemand vermisst, weil
ihn niemand je gesehen hat.

**Der Maßstab war ein Tipp.** Ein Monteur steht im Keller, hat eine Hand
frei und schlechtes Licht. Scrollt er durch fünfhundert Artikel, macht er es
beim dritten Mal nicht mehr — und dann ist die Erfassung schlimmer als
nichts, weil sich das Büro darauf verlässt. Deshalb drei Wege in dieser
Reihenfolge:

* **Zuletzt verwendet.** Der beste Vorschlag ist fast immer das, was gerade
  eben schon verbaut wurde: wer eine Steckdose setzt, setzt mehrere. Die
  Liste entsteht aus den Positionen selbst und muss von niemandem gepflegt
  werden. Wer noch nichts erfasst hat, sieht die des Betriebs.
* **Schnellauswahl.** Betriebsweit, nicht je Person — eine Liste, die jeder
  für sich pflegen müsste, pflegt niemand.
* **Suche und Strichcode.** Die Suche nimmt mehrere Wörter in beliebiger
  Reihenfolge: „nym 1,5" findet „NYM-J 3x1,5 mm²", wonach sonst niemand
  suchen könnte. Gesucht wird zuerst im schon Geladenen und erst dann am
  Server, damit es im Keller ohne Netz nicht stehenbleibt.

**Zum Scannen gehört eine unangenehme Wahrheit:** die eingebaute
Schnittstelle dafür (`BarcodeDetector`) hat Chrome auf Android, Safari auf
dem iPhone nicht. Eine Fremdbibliothek würde ein halbes Megabyte kosten, das
über eine Mobilverbindung im Keller niemand lädt. Wo der Leser fehlt,
erscheint deshalb gar kein Kameraknopf, sondern ein Feld zum Eintippen der
EAN und ein Satz, der sagt, warum. Ein Knopf, der beim Draufdrücken nichts
tut, ist schlimmer als kein Knopf.

**Was der Monteur erfasst, ist ein Vorschlag.** Er steht sofort in der Akte,
zählt aber nicht mit und kommt auf keinen Beleg, bis das Büro ihn freigibt.
Der Umweg kostet einen Klick und erspart den Anruf „was ist das für ein
Posten auf Seite zwei". Freigeben darf nur, wer Lager schreiben darf — und
das ist serverseitig durchgesetzt, gegen die API geprüft, nicht bloß in der
Oberfläche ausgeblendet.

Damit dabei nichts verlorengeht, sind zwei Dinge gebaut: die Summe am
Auftrag zählt nur Freigegebenes, und beim Erzeugen einer Rechnung fragt
Werkboq nach, wenn noch etwas offen ist. Eine festgeschriebene Rechnung ohne
das Material ist genau der Verlust, den diese Funktion verhindern soll.

### 4. Auftragsarten statt zehn Phasen für alles — **steht**

Heute hat jeder Auftrag dieselben zehn Phasen: Anfrage, Spezifikation,
Angebot, Termine, Projekt, Errichtung, Abnahme, Wartung, Materialverkauf,
Abgeschlossen. Zwei Probleme:

* „Materialverkauf" ist keine Phase, sondern eine Auftragsart. Er steht in
  derselben Reihe wie „Abnahme", obwohl das eine ein Geschäftsvorfall und das
  andere ein Zustand ist.
* Für eine Störungsbehebung — anrufen, hinfahren, Sicherung tauschen,
  verrechnen — sind sieben der zehn Phasen Lärm.

Gebaut: **Auftragsart** (Störung, Regie, Projekt, Wartung, Materialverkauf)
getrennt von der **Phase**, und die Art entscheidet, welche Phasen es gibt.
Eine Störung hat drei, ein Projekt acht.

Ein Auftrag ohne Art gilt als Projekt — so sehen alte Datensätze aus wie
vorher. Steht ein Auftrag in einer Phase, die seine Art nicht kennt (weil
jemand die Art nachträglich umgestellt hat), wird diese Phase angehängt
statt versteckt: ein Auftrag verschwindet nicht aus seiner eigenen Leiste.

**Zweiter Schritt, September 2026: die Phasen selbst aufgeräumt.** Mit den
Arten allein blieb es unübersichtlich — die zehn Phasen waren darunter
dieselben, und das Phasenbrett war 2.608 px breit. Jetzt:

* Ein festes **Gerüst** aus sieben Stufen: Eingang, Angebot, Beauftragt,
  In Arbeit, Fertig, Verrechnen, Abgeschlossen. Daran hängt Verhalten —
  „Verrechnen" ist rot, weil dort Geld liegen bleibt; „Abgeschlossen" ist im
  Brett eingeklappt.
* Darüber **Phasen je Art**, mit eigenen Namen: Störung = Gemeldet → In
  Arbeit → Verrechnen → Abgeschlossen; Wartung = Geplant → Durchgeführt → …
* **Einstellbar je Betrieb** unter Einstellungen → Phasen: umbenennen und
  ausblenden, aber keine erfundenen Phasen und keine andere Reihenfolge.
  „Verrechnen" und „Abgeschlossen" bleiben immer.
* Jeder Auftrag lässt sich jederzeit in jede seiner Phasen setzen, auch
  zurück — in der Phasenleiste der Akte ist jeder Schritt klickbar.
* Das Phasenbrett filtert nach Art; ohne Filter zeigt es das Gerüst, und
  die Karte trägt Art und eigenen Phasennamen.

Die alten zehn Phasen schlüsselt `npm start` beim ersten Lauf um
(`ALTE_PHASEN` in `phasen.ts` und `einrichten.mjs`, unter Test gegeneinander
abgeglichen). „Wartung" als alte Phase wird „Fertig", nicht „Abgeschlossen":
lieber einmal zu viel prüfen als stillschweigend ablegen.

**Die Auftragsakte in Reitern.** Vorher stand alles untereinander. Jetzt:
Überblick (nächster Schritt mit Prüfliste, Kacheln mit je einer Zahl),
Arbeit (Zeiten, Fahrten, Material), Baustelle (Fotos, Unterschriften,
Dokumente), Abrechnung (Positionen, Belege), Verlauf. Der Monteur landet
auf „Arbeit", das Büro auf „Überblick". Bausteine hängen sich über die
Erweiterungspunkte `auftrag.arbeit`, `auftrag.baustelle`,
`auftrag.abrechnung` und `auftrag.kachel` ein.

**Kilometer am Auftrag.** Der Monteur tippt die einfache Strecke, „hin und
retour" ist vorgewählt, das eigene Fahrzeug aus dem Fuhrpark auch. Wie das
auf die Rechnung kommt, stellt der Betrieb ein: km × Satz, Pauschale je
Fahrt, oder gar nicht (weil es im Stundensatz steckt). Stundensatz und
Fahrtkosten stehen unter Einstellungen → Betrieb → Verrechnung — den
Stundensatz konnte man vorher nirgends eintragen.

### 4a. Unterschrift am Tablet — **steht**

Zum Foto gehört die Unterschrift: Abnahme, Stundennachweis, Zustand vor
Arbeitsbeginn, Übergabe. Der volle Wortlaut der Erklärung wird mitgespeichert
und eingefroren — nicht ein Verweis auf eine Vorlage, die sich nächstes Jahr
ändert. Eine Unterschrift ohne den Text, den sie bestätigt, beweist nichts.

Die Collection kennt kein Ändern; gelöscht werden darf nur von einem
Administrator. Das ist gegen die API geprüft, nicht nur in der Oberfläche
ausgeblendet.

Rechtlich ist das eine *einfache* elektronische Signatur nach eIDAS. Artikel
25 verbietet, ihr die Wirkung allein wegen der elektronischen Form
abzusprechen — die Beweiskraft einer qualifizierten Signatur mit Zertifikat
hat sie damit nicht. Für den Abnahmeschein auf der Baustelle reicht das; für
einen Vertrag mit Schriftformerfordernis nicht.

### 4b. Dokumentenversand mit Nachweis — **steht**

Rechnung, Angebot, Abnahmeschein per Mail oder WhatsApp hinausschicken.

Werkboq verschickt nichts selbst und behauptet es auch nicht. Es öffnet das
Mailprogramm (`mailto:`) oder WhatsApp (`wa.me`) mit fertigem Betreff und
Text; die Datei hängt der Anwender an. **Ein Anhang lässt sich über keinen
der beiden Wege mitgeben** — das erlauben beide Standards nicht, und kein
Programm umgeht das. Ein eigener Mailserver wäre der einzige Ausweg: dann
müsste jeder Betrieb SMTP, SPF und DKIM einrichten, und wenn das schiefgeht,
landen die Rechnungen wortlos im Spam. Das ist ein eigenes Vorhaben mit
eigenem Betrieb, kein Nachmittag.

Der Wert liegt ohnehin nicht im Kanal, sondern im Nachweis: im Streit lautet
die Frage „haben Sie die Rechnung je bekommen?", und darauf muss man ein
Datum nennen können. Deshalb fragt Werkboq hinterher nach, ob wirklich
abgeschickt wurde. Es kann es nicht wissen — ein Versandnachweis, der bloß
sagt „wir haben ein Fenster geöffnet", wäre eine Lüge mit Zeitstempel.

### 5. Fahrzeuge mit Fristen — **steht**

Begutachtung, Service, Reifenwechsel, Versicherung, Leasing-Ende,
Kilometerstand, Zuordnung zum Monteur — als eigener Baustein `fuhrpark`.

Dasselbe Muster wie die Personaldokumente mit Ablaufdatum: etwas läuft ab,
und es fällt niemandem auf, bis es zu spät ist.

**Was Werkboq hier bewusst NICHT tut: gesetzliche Fristen ausrechnen.** Wie
oft ein Fahrzeug vorzuführen ist, hängt von Klasse, Alter und Nutzung ab —
in Österreich anders für einen Pkw als für einen Kastenwagen über 3,5 t, und
überall anders für das erste Mal als danach. Eine Frist, die das Programm
falsch ausrechnet, ist schlimmer als gar keine: der Betrieb verlässt sich
darauf und steht ohne gültige Plakette da. Eingetragen wird das Datum vom
Papier. Der Rechtsraum liefert nur, wie die Prüfung heißt und wo sie steht —
§ 57a KFG, § 29 StVZO, Art. 33 VTS.

Drei Dinge, die den Unterschied machen:

* **Datum ODER Kilometer.** Ein Service ist fällig „in zwölf Monaten oder
  nach 30.000 km, je nachdem was zuerst eintritt". Beides wird geprüft, der
  schlimmere Zustand gewinnt, und die Zeile sagt auch, woran es liegt: neben
  „überfällig" steht dann „1.000 km über 120.000" und nicht „in 190 Tagen".
  Eine Zeile, die sich selbst widerspricht, nimmt der Ampel den Glauben.
* **Erledigen stellt die nächste Frist.** Eine abgehakte Frist ohne
  Nachfolger ist eine, an die im nächsten Jahr niemand denkt. Gerechnet wird
  vom Fälligkeitsdatum, nicht vom Tag der Erledigung — sonst wandert der
  Termin mit jeder Erledigung nach vorne, und beim Pickerl verschenkt der
  Betrieb Zeit, die ihm zusteht. Das Datum steht vor dem Speichern in der
  Maske und lässt sich ändern.
* **Die Erinnerung steht auf der Startseite.** Eine Frist, die nur im
  Fuhrparkmenü steht, sieht man an dem Tag, an dem man ins Fuhrparkmenü
  schaut — und das ist meist der Tag, an dem schon etwas passiert ist. Steht
  nichts an, erscheint die Kachel gar nicht: eine, die dauernd „alles in
  Ordnung" meldet, wird nach einer Woche überlesen.

**Offen bleibt das Fahrzeuglager als Nachfüllliste** — „was fehlt im Bus",
mit Mindestbestand je Sorte, vom Monteur in zehn Sekunden abgehakt. Jetzt,
wo es Fahrzeuge gibt, lässt es sich bauen. Keine Bestandsführung — warum
nicht, steht weiter unten.

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
schließt es die Lücke aus Punkt 3 von der anderen Seite: was bestellt wurde,
taucht beim Monteur als Vorschlag auf, statt dass er es suchen muss.

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
