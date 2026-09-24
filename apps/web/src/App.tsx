import { BrowserRouter, NavLink, Route, Routes } from "react-router-dom";
import {
  alleNavEintraege,
  darf,
  istAngemeldet,
  Symbol,
  type NavEintrag,
  type SymbolName,
} from "@werkboq/core";
import { Anmeldung } from "./seiten/Anmeldung";
import { Start } from "./seiten/Start";
import { Kunden } from "./seiten/Kunden";
import { KundeAkte } from "./seiten/KundeAkte";
import { KundeBearbeiten } from "./seiten/KundeBearbeiten";
import { Auftraege } from "./seiten/Auftraege";
import { AuftragAkte } from "./seiten/AuftragAkte";
import { AuftragBearbeiten } from "./seiten/AuftragBearbeiten";
import { KeinZugriff, Unbekannt } from "./seiten/KeinZugriff";
import { Einstellungen } from "./seiten/Einstellungen";
import { OfflineHinweis } from "./komponenten/OfflineHinweis";
import { Kopfleiste } from "./komponenten/Kopfleiste";

/**
 * Hülle der Bürofassung.
 *
 * Bewusst auf den Schreibtisch ausgelegt: feste Seitenleiste, Kopfleiste mit
 * globaler Suche, breiter Arbeitsbereich. Für Monteure entsteht später eine
 * eigene Fassung — eine geschrumpfte Bürooberfläche ist keine Baustellen-App.
 */

/** Symbole, die Module über ihr symbol-Feld anfordern können. */
const MODULSYMBOLE: Record<string, SymbolName> = {
  pruefung: "pruefung",
  uhr: "uhr",
  kalender: "kalender",
  katalog: "katalog",
  beleg: "beleg",
  geld: "geld",
  vertrag: "vertrag",
  wiederholung: "wiederholung",
};

export function App() {
  if (!istAngemeldet()) return <Anmeldung />;

  // Die Seitenleiste kennt keinen Baustein namentlich. Sie fragt das Registry,
  // was freigegeben ist und wofür der Angemeldete Rechte hat — mehr nicht.
  const erlaubt = (n: NavEintrag) => !n.bereich || darf(n.bereich);
  // Routen und Seitenleiste sind nicht dasselbe: Unterseiten wie /belege/:id
  // brauchen eine Route, haben aber in der Leiste nichts verloren.
  const alleEintraege = [...alleNavEintraege("baustein"), ...alleNavEintraege("fachmodul")];
  const alleRouten = alleEintraege.filter(erlaubt);
  // Ohne Recht nicht einfach keine Route (das gab eine leere Seite), sondern
  // eine, die sagt, warum. Titel von der Hauptseite des Bereichs, damit
  // bei /belege/abc123 nicht „Beleg" steht, sondern etwas Verständliches.
  const gesperrt = alleEintraege.filter((n) => !erlaubt(n));
  const bausteinNav = alleNavEintraege("baustein").filter((n) => erlaubt(n) && !n.versteckt);
  const modulNav = alleNavEintraege("fachmodul").filter((n) => erlaubt(n) && !n.versteckt);

  return (
    <BrowserRouter>
      <div className="wb-huelle">
        <nav className="wb-seitenleiste">
          <div className="wb-marke">
            Werkboq
            <small>Auftragsdokumentation</small>
          </div>

          <div className="wb-seitenleiste__gruppe">
            <NavLink to="/" end>
              <Symbol name="start" />
              Start
            </NavLink>
            {darf("technik") && (
              <NavLink to="/kunden">
                <Symbol name="kunden" />
                Kunden
              </NavLink>
            )}
            {darf("technik") && (
              <NavLink to="/auftraege">
                <Symbol name="auftraege" />
                Aufträge
              </NavLink>
            )}
            {bausteinNav.map((n) => (
              <NavLink key={n.pfad} to={n.pfad}>
                <Symbol name={MODULSYMBOLE[n.symbol ?? ""] ?? "auftraege"} />
                {n.titel}
              </NavLink>
            ))}
          </div>

          {modulNav.length > 0 && (
            <div className="wb-seitenleiste__gruppe">
              <span className="wb-seitenleiste__titel">Fachmodule</span>
              {modulNav.map((n) => (
                <NavLink key={n.pfad} to={n.pfad}>
                  <Symbol name={MODULSYMBOLE[n.symbol ?? ""] ?? "auftraege"} />
                  {n.titel}
                </NavLink>
              ))}
            </div>
          )}

          {darf("verwaltung") && (
            <div className="wb-seitenleiste__gruppe wb-seitenleiste__gruppe--unten">
              <NavLink to="/einstellungen">
                <Symbol name="einstellungen" />
                Einstellungen
              </NavLink>
            </div>
          )}
        </nav>

        <Kopfleiste />

        <main className="wb-arbeitsbereich">
          <OfflineHinweis />
          <Routes>
            <Route path="/" element={<Start />} />
            <Route path="/kunden" element={<Kunden />} />
            <Route path="/kunden/neu" element={<KundeBearbeiten />} />
            <Route path="/kunden/:id" element={<KundeAkte />} />
            <Route path="/kunden/:id/bearbeiten" element={<KundeBearbeiten />} />
            <Route path="/auftraege" element={<Auftraege />} />
            <Route path="/auftraege/neu" element={<AuftragBearbeiten />} />
            <Route path="/auftraege/:id" element={<AuftragAkte />} />
            <Route path="/auftraege/:id/bearbeiten" element={<AuftragBearbeiten />} />
            {/* Reiter der Akte. "bearbeiten" darüber gewinnt, weil ein fester
                Pfadteil in React Router vor einem Platzhalter kommt. */}
            <Route path="/auftraege/:id/:reiter" element={<AuftragAkte />} />
            <Route path="/einstellungen" element={<Einstellungen />} />
            {alleRouten.map((n) => (
              <Route key={n.pfad} path={n.pfad} element={<n.komponente />} />
            ))}
            {gesperrt.map((n) => (
              <Route
                key={n.pfad}
                path={n.pfad}
                element={<KeinZugriff bereich={n.bereich ?? ""} titel={n.titel} />}
              />
            ))}
            <Route path="*" element={<Unbekannt />} />
          </Routes>
        </main>
      </div>
    </BrowserRouter>
  );
}
