import { BrowserRouter, Link, Route, Routes } from "react-router-dom";
import { alleNavEintraege, darf, istAngemeldet } from "@werkboq/core";
import { Anmeldung } from "./seiten/Anmeldung";
import { Start } from "./seiten/Start";
import { Kunden } from "./seiten/Kunden";
import { Auftraege } from "./seiten/Auftraege";
import { OfflineHinweis } from "./komponenten/OfflineHinweis";

export function App() {
  if (!istAngemeldet()) return <Anmeldung />;

  const modulNav = alleNavEintraege().filter((n) => !n.bereich || darf(n.bereich));

  return (
    <BrowserRouter>
      <div className="wb-layout">
        <nav className="wb-nav">
          <div className="wb-nav__marke">Werkboq</div>
          <Link to="/">Start</Link>
          {darf("technik") && <Link to="/kunden">Kunden</Link>}
          {darf("technik") && <Link to="/auftraege">Aufträge</Link>}
          {modulNav.map((n) => (
            <Link key={n.pfad} to={n.pfad}>
              {n.titel}
            </Link>
          ))}
        </nav>
        <main className="wb-inhalt">
          <OfflineHinweis />
          <Routes>
            <Route path="/" element={<Start />} />
            <Route path="/kunden" element={<Kunden />} />
            <Route path="/auftraege" element={<Auftraege />} />
            {modulNav.map((n) => (
              <Route key={n.pfad} path={n.pfad} element={<n.komponente />} />
            ))}
          </Routes>
        </main>
      </div>
    </BrowserRouter>
  );
}
