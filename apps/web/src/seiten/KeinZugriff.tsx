import { Link } from "react-router-dom";
import { Symbol } from "@werkboq/core";

/**
 * Statt einer leeren Seite.
 *
 * Bis September 2026 bekam, wer eine Adresse ohne das nötige Recht aufrief
 * (ein Monteur tippt /angebote, ein alter Lesezeichen-Link), eine leere
 * Fläche — keine Route, kein Hinweis. Das sieht aus wie ein Absturz. Hier
 * steht stattdessen, warum nichts kommt und an wen man sich wendet.
 */
export function KeinZugriff({ bereich, titel }: { bereich: string; titel: string }) {
  return (
    <div className="wb-nichts">
      <Symbol name="warnung" groesse={28} />
      <p>
        <strong>{titel}</strong> ist für diesen Zugang nicht freigegeben.
      </p>
      <p className="wb-leer">
        Dafür braucht es den Bereich „{bereich.charAt(0).toUpperCase() + bereich.slice(1)}". Wer Zugänge vergibt, steht unter
        Einstellungen — meist der Betriebsinhaber.
      </p>
      <Link className="wb-button wb-button--sekundaer" to="/">
        Zur Startseite
      </Link>
    </div>
  );
}

/** Für Adressen, die es nicht gibt — oder deren Baustein nicht freigeschaltet ist. */
export function Unbekannt() {
  return (
    <div className="wb-nichts">
      <p>Diese Seite gibt es nicht.</p>
      <p className="wb-leer">
        Vielleicht ein alter Link, oder der Baustein dahinter ist in diesem Betrieb nicht
        freigeschaltet (Einstellungen → Bausteine).
      </p>
      <Link className="wb-button wb-button--sekundaer" to="/">
        Zur Startseite
      </Link>
    </div>
  );
}
