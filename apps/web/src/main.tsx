import React from "react";
import ReactDOM from "react-dom/client";
import "@werkboq/tokens/tokens.css";
import "./app.css";
import "./gestaltung/huelle.css";
import "./gestaltung/akte.css";
import { bausteineLaden, modulRegistrieren, moduleStarten, offlineStarten } from "@werkboq/core";
import bausteinZeiterfassung from "@werkboq/baustein-zeiterfassung";
import bausteinPlanung from "@werkboq/baustein-planung";
import modulElektro from "@werkboq/modul-elektro";
import { App } from "./App";

/**
 * Module werden hier – und nur hier – registriert.
 * Ein neuer Baustein oder ein neues Fachmodul (z. B. Holz) bedeutet: eine
 * Zeile hinzufügen, sonst nichts. Der Kern kennt keinen von ihnen.
 *
 * Registriert werden immer alle mitgelieferten; was davon dieser Betrieb
 * gekauft hat, entscheidet bausteineLaden() aus den Betriebsstammdaten.
 */
async function start() {
  await modulRegistrieren(bausteinZeiterfassung);
  await modulRegistrieren(bausteinPlanung);
  await modulRegistrieren(modulElektro);

  // Erst wissen, was freigegeben ist, dann starten: ein nicht gekaufter
  // Baustein soll nicht einmal seine Dienste anmelden.
  await bausteineLaden().catch(() => []);
  await moduleStarten();
  offlineStarten();

  ReactDOM.createRoot(document.getElementById("root")!).render(
    <React.StrictMode>
      <App />
    </React.StrictMode>,
  );
}

void start();
