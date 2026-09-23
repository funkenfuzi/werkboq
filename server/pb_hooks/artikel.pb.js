/// <reference path="../pb_data/types.d.ts" />

/**
 * Den Einkaufspreis sieht nur, wer Lager- oder Buchhaltungsrecht hat.
 *
 * Der Katalog muss für jeden lesbar sein — der Monteur sucht darin, was er
 * verbaut, und sieht dabei den Verkaufspreis (so entschieden im September
 * 2026). Der Einkaufspreis ist etwas anderes: die Spanne des Betriebs. Eine
 * Regel kann ihn nicht ausblenden, weil PocketBase Regeln je Datensatz
 * kennt, nicht je Feld. Also wird er hier aus der Antwort genommen, bevor
 * sie hinausgeht. In der Datenbank bleibt er unverändert.
 *
 * Handler sehen nichts außerhalb ihrer Funktion — deshalb steht die
 * Prüfung in beiden.
 */
onRecordsListRequest((e) => {
  const info = $apis.requestInfo(e.httpContext);
  if (info.admin) return;
  const auth = info.authRecord;
  const bereiche = auth ? auth.getString("bereiche") + auth.getString("lesebereiche") : "";
  if (auth && (auth.getBool("admin") || bereiche.indexOf('"lager"') >= 0 || bereiche.indexOf('"buchhaltung"') >= 0)) return;
  for (let i = 0; i < e.records.length; i++) e.records[i].set("einkauf", null);
}, "artikel");

onRecordViewRequest((e) => {
  const info = $apis.requestInfo(e.httpContext);
  if (info.admin) return;
  const auth = info.authRecord;
  const bereiche = auth ? auth.getString("bereiche") + auth.getString("lesebereiche") : "";
  if (auth && (auth.getBool("admin") || bereiche.indexOf('"lager"') >= 0 || bereiche.indexOf('"buchhaltung"') >= 0)) return;
  e.record.set("einkauf", null);
}, "artikel");
