import { useState } from "react";
import { NavLink, useLocation } from "react-router-dom";
import {
  aktiveGruppe,
  navGruppieren,
  Symbol,
  type Navblock,
  type NavEintrag,
  type Navgruppe,
  type SymbolName,
} from "@werkboq/core";

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
  personal: "personal",
  fahrzeug: "fahrzeug",
  kunden: "kunden",
  auftraege: "auftraege",
  kiste: "kiste",
  gebaeude: "gebaeude",
};

const GRUPPENSYMBOL: Record<Navgruppe, SymbolName> = {
  kunden: "kunden",
  auftraege: "auftraege",
  verkauf: "beleg",
  betrieb: "gebaeude",
  fachmodule: "pruefung",
};

const SPEICHER = "werkboq.seitenleiste.offen";

/** Was jemand aufgeklappt hat, bleibt über das Neuladen hinweg — nur bequem, nicht wichtig. */
function gemerkt(): Navgruppe[] {
  try {
    const w = JSON.parse(localStorage.getItem(SPEICHER) ?? "[]");
    return Array.isArray(w) ? w : [];
  } catch {
    return [];
  }
}

function merken(offen: Navgruppe[]) {
  try {
    localStorage.setItem(SPEICHER, JSON.stringify(offen));
  } catch {
    // privates Fenster o. Ä. — dann eben nicht gemerkt
  }
}

function Eintrag({ n }: { n: NavEintrag }) {
  return (
    <NavLink to={n.pfad} title={n.titel}>
      <Symbol name={MODULSYMBOLE[n.symbol ?? ""] ?? "auftraege"} />
      <span>{n.titel}</span>
    </NavLink>
  );
}

/**
 * Die Hauptgruppen der Seitenleiste, aufklappbar.
 *
 * Die Gruppe der geöffneten Seite ist immer offen. Auf schmalen Bildschirmen
 * (nur Symbole) gibt es keine Überschriften — dort stehen alle Einträge
 * untereinander, siehe huelle.css.
 */
export function Seitenleiste({ eintraege }: { eintraege: (NavEintrag & { fachmodul?: boolean })[] }) {
  const ort = useLocation();
  const [offen, setOffen] = useState<Navgruppe[]>(gemerkt);
  const bloecke: Navblock[] = navGruppieren(eintraege);
  const aktiv = aktiveGruppe(bloecke, ort.pathname);

  const umschalten = (g: Navgruppe) => {
    const neu = offen.includes(g) ? offen.filter((x) => x !== g) : [...offen, g];
    setOffen(neu);
    merken(neu);
  };

  return (
    <>
      {bloecke.map((b) => {
        const einziger = b.eintraege.length === 1 ? b.eintraege[0] : undefined;
        if (einziger) {
          return (
            <div key={b.id} className="wb-navgruppe wb-navgruppe--einzeln">
              <Eintrag n={einziger} />
            </div>
          );
        }
        const istOffen = b.id === aktiv || offen.includes(b.id);
        return (
          <div key={b.id} className={`wb-navgruppe${istOffen ? " ist-offen" : ""}${b.id === aktiv ? " ist-aktiv" : ""}`}>
            <button
              type="button"
              className="wb-navgruppe__kopf"
              aria-expanded={istOffen}
              // Die Gruppe der aktuellen Seite lässt sich nicht zuklappen —
              // der markierte Eintrag verschwände sonst.
              onClick={() => b.id !== aktiv && umschalten(b.id)}
            >
              <Symbol name={GRUPPENSYMBOL[b.id]} />
              <span>{b.titel}</span>
              <span className="wb-navgruppe__pfeil" aria-hidden="true">
                <Symbol name="pfeil" />
              </span>
            </button>
            <div className="wb-navgruppe__inhalt">
              {b.eintraege.map((n) => (
                <Eintrag key={n.pfad} n={n} />
              ))}
            </div>
          </div>
        );
      })}
    </>
  );
}
