import { useCallback, useEffect, useRef, useState } from "react";
import { Symbol } from "@werkboq/core";

/**
 * Strichcode mit der Kamera lesen — wo der Browser das kann.
 *
 * WAS HIER GEHT UND WAS NICHT, ohne Beschönigung:
 *
 * Es gibt eine eingebaute Schnittstelle dafür, `BarcodeDetector`. Chrome
 * auf Android hat sie. Safari auf dem iPhone hat sie nicht — und iPhones
 * stehen auf vielen Baustellen. Eine Fremdbibliothek nachzuladen wäre
 * möglich, kostet aber ein halbes Megabyte, das über eine Mobilverbindung
 * im Keller niemand herunterlädt.
 *
 * Also: Wo es den Leser gibt, erscheint der Kameraknopf. Wo nicht,
 * erscheint er gar nicht erst, sondern ein Feld zum Eintippen. Ein Knopf,
 * der beim Draufdrücken nichts tut, ist schlimmer als kein Knopf — der
 * Monteur drückt dreimal, flucht und erfasst dann gar nichts.
 */

/** Die Schnittstelle, so viel davon, wie hier gebraucht wird. */
interface Strichcodeleser {
  detect(quelle: CanvasImageSource): Promise<{ rawValue: string }[]>;
}
interface MitLeser {
  BarcodeDetector?: {
    new (einstellungen?: { formats?: string[] }): Strichcodeleser;
    getSupportedFormats?: () => Promise<string[]>;
  };
}

/** Die Formate, die auf Elektromaterial tatsächlich kleben. */
const FORMATE = ["ean_13", "ean_8", "upc_a", "upc_e", "code_128", "code_39"];

export function leserVorhanden(): boolean {
  return typeof window !== "undefined" && Boolean((window as unknown as MitLeser).BarcodeDetector);
}

export function Scanfeld({
  beiCode,
  beiAbbruch,
}: {
  beiCode: (code: string) => void;
  beiAbbruch: () => void;
}) {
  const video = useRef<HTMLVideoElement>(null);
  const [fehler, setFehler] = useState<string | null>(null);
  const [laeuft, setLaeuft] = useState(false);
  const gefunden = useRef(false);

  const aufhoeren = useCallback(() => {
    const strom = video.current?.srcObject as MediaStream | null;
    strom?.getTracks().forEach((s) => s.stop());
    if (video.current) video.current.srcObject = null;
  }, []);

  useEffect(() => {
    let abbruch = false;
    let zeitgeber: number | undefined;

    async function starten() {
      const fenster = window as unknown as MitLeser;
      if (!fenster.BarcodeDetector) {
        setFehler("Dieser Browser kann keine Strichcodes lesen.");
        return;
      }
      try {
        const strom = await navigator.mediaDevices.getUserMedia({
          // Die Kamera auf der Rückseite, nicht die für Selbstbildnisse.
          video: { facingMode: { ideal: "environment" } },
        });
        if (abbruch) {
          strom.getTracks().forEach((s) => s.stop());
          return;
        }
        if (video.current) {
          video.current.srcObject = strom;
          await video.current.play().catch(() => undefined);
        }
        setLaeuft(true);

        const leser = new fenster.BarcodeDetector({ formats: FORMATE });
        const leinwand = document.createElement("canvas");

        // Alle 400 ms ein Bild prüfen. Häufiger hieße, den Akku auf einer
        // Baustelle für nichts zu verheizen; seltener fühlt sich träge an.
        zeitgeber = window.setInterval(() => {
          void (async () => {
            const v = video.current;
            if (!v || gefunden.current || !v.videoWidth) return;
            leinwand.width = v.videoWidth;
            leinwand.height = v.videoHeight;
            leinwand.getContext("2d")?.drawImage(v, 0, 0);
            try {
              const treffer = await leser.detect(leinwand);
              const code = treffer[0]?.rawValue?.trim();
              if (code) {
                gefunden.current = true;
                beiCode(code);
              }
            } catch {
              /* ein unlesbares Einzelbild ist kein Fehler */
            }
          })();
        }, 400);
      } catch {
        // Kein Zugriff heißt fast immer: der Anwender hat abgelehnt, oder
        // die Seite läuft ohne HTTPS. Beides lässt sich hier nicht lösen.
        setFehler(
          "Kein Zugriff auf die Kamera. Entweder wurde er abgelehnt, oder die Seite läuft nicht über HTTPS — ohne das gibt kein Browser die Kamera frei.",
        );
      }
    }

    void starten();
    return () => {
      abbruch = true;
      if (zeitgeber) window.clearInterval(zeitgeber);
      aufhoeren();
    };
  }, [beiCode, aufhoeren]);

  return (
    <div className="wb-scanfeld">
      <video ref={video} playsInline muted aria-label="Kamerabild zum Scannen" />
      {laeuft && <div className="wb-scanfeld__marke" aria-hidden="true" />}
      {fehler && (
        <p className="wb-fehler" role="alert">
          {fehler}
        </p>
      )}
      <div className="wb-aktionen">
        <button className="wb-button wb-button--sekundaer" type="button" onClick={beiAbbruch}>
          <Symbol name="kreuz" groesse={18} />
          Scannen beenden
        </button>
      </div>
    </div>
  );
}
