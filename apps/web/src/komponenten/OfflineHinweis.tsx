import { useEffect, useState } from "react";
import { beiAenderung, beiDateiAenderung, offeneVorgaenge } from "@werkboq/core";

export function OfflineHinweis() {
  const [anzahl, setAnzahl] = useState(offeneVorgaenge());
  const [online, setOnline] = useState(navigator.onLine);
  const [dateien, setDateien] = useState(0);

  useEffect(() => {
    const ab = beiAenderung(setAnzahl);
    const abDateien = beiDateiAenderung(setDateien);
    const on = () => setOnline(true);
    const off = () => setOnline(false);
    window.addEventListener("online", on);
    window.addEventListener("offline", off);
    return () => {
      ab();
      abDateien();
      window.removeEventListener("online", on);
      window.removeEventListener("offline", off);
    };
  }, []);

  if (online && anzahl === 0 && dateien === 0) return null;

  return (
    <div className="wb-offline" role="status">
      {!online && "Keine Verbindung – Änderungen werden zwischengespeichert. "}
      {anzahl > 0 && `${anzahl} Vorgang${anzahl === 1 ? "" : "e"} warten auf Übertragung. `}
      {dateien > 0 && `${dateien} ${dateien === 1 ? "Foto liegt" : "Fotos liegen"} noch auf diesem Gerät.`}
    </div>
  );
}
