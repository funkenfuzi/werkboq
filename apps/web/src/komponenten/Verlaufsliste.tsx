import type { Protokollzeile } from "@werkboq/core";

/** Änderungsverlauf als Zeitstrahl, neueste Änderung oben. */
export function Verlaufsliste({ zeilen }: { zeilen: Protokollzeile[] }) {
  if (zeilen.length === 0) {
    return <p className="wb-leer">Noch keine Änderungen protokolliert.</p>;
  }
  return (
    <ol className="wb-verlauf">
      {zeilen.map((z) => (
        <li key={z.id}>
          <span className={`wb-punkt wb-punkt--${farbe(z.aktion)}`} aria-hidden="true" />
          <div>
            <p className="wb-verlauf__text">{z.zusammenfassung}</p>
            <p className="wb-verlauf__wer">
              {z.benutzername || "unbekannt"} ·{" "}
              {new Date(z.created).toLocaleString("de-AT", {
                day: "2-digit",
                month: "2-digit",
                year: "numeric",
                hour: "2-digit",
                minute: "2-digit",
              })}
            </p>
          </div>
        </li>
      ))}
    </ol>
  );
}

function farbe(aktion: Protokollzeile["aktion"]): string {
  if (aktion === "anlegen") return "ok";
  if (aktion === "loeschen") return "error";
  return "info";
}
