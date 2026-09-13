# Fahrplan

Entwicklung in Scheiben. Jede Scheibe geht durch Kern **und** Modul Elektro – damit
die Modulschnittstelle laufend an einem echten Konsumenten geprüft wird.

## Scheibe 0 – Gerüst (erledigt)

Monorepo, Modulschnittstelle, Datenmodell, Design-Tokens, Offline-Warteschlange,
`einrichten.mjs`, Startskripte, CI.

## Scheibe 1 – Kunde und Auftrag anlegen

Kunden und Aufträge erfassen, ändern, suchen. Phasenwechsel mit Verlauf. Interner
Kunde als Voreinstellung für eigene Vorhaben. Elektro: der Auftragsreiter zeigt
Anlagendaten.

## Scheibe 2 – Prüfbericht am Tablet

Prüfbericht nach OVE E 8101 als Formular, das offline vollständig ausfüllbar ist;
PDF-Erzeugung; Anhang am Auftrag. Prüft die Offline-Warteschlange unter echten
Bedingungen, inklusive Fotos.

## Scheibe 3 – Benutzerverwaltung

Nutzer anlegen, Bereiche zuteilen, PocketBase-Regeln je Bereich schärfen.

## Scheibe 4 – Angebot und Materialverkauf

Positionen, Preise, Angebots-PDF mit den österreichischen Pflichtangaben
(UID, Firmenbuchnummer).

## Offene Punkte

- Collection-Definitionen an einer Stelle halten statt in Modul und `einrichten.mjs`
  gespiegelt (z. B. `einrichten.mjs` per tsx laufen lassen).
- Datei-Uploads in der Offline-Warteschlange puffern.
- Konfliktbehandlung beim Nachspielen (derzeit: letzter gewinnt).
- Desktop-Verpackung (Tauri) und die Frage, ob das Tablet nativ oder als
  installierbare Web-App läuft.
- Funkenfuzi-Farbwerte in `tokens.css` gegen die Markenvorgabe abgleichen.
