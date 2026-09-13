import React from "react";
import ReactDOM from "react-dom/client";
import "@werkboq/tokens/tokens.css";
import "./app.css";
import { modulRegistrieren, offlineStarten } from "@werkboq/core";
import modulElektro from "@werkboq/modul-elektro";
import { App } from "./App";

/**
 * Module werden hier – und nur hier – registriert.
 * Ein neues Modul (z. B. Holz) bedeutet: eine Zeile hinzufügen, sonst nichts.
 */
async function start() {
  await modulRegistrieren(modulElektro);
  offlineStarten();

  ReactDOM.createRoot(document.getElementById("root")!).render(
    <React.StrictMode>
      <App />
    </React.StrictMode>,
  );
}

void start();
