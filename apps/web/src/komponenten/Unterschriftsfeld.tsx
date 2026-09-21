import { useCallback, useEffect, useRef, useState } from "react";

/**
 * Das Feld, in das der Kunde unterschreibt.
 *
 * Pointer-Events statt Maus- und Touch-Ereignissen getrennt: damit
 * funktioniert Finger, Stift und Maus mit demselben Code, und der Stift
 * eines Tablets wird als das erkannt, was er ist.
 *
 * ZWEI DINGE, DIE MAN ERST AUF DEM GERÄT MERKT.
 *
 * Erstens: die Zeichenfläche braucht die echte Pixelzahl des Bildschirms,
 * nicht die CSS-Größe. Auf einem Tablet mit doppelter Auflösung wird eine
 * Unterschrift sonst zu einem verwaschenen Strich. Deshalb wird das Canvas
 * mit devicePixelRatio skaliert.
 *
 * Zweitens: `touch-action: none` im Stil. Ohne das scrollt die Seite,
 * während der Kunde unterschreibt, und heraus kommt ein Zickzack.
 */
export function Unterschriftsfeld({
  beiAenderung,
  hoehe = 180,
}: {
  /** Wird mit true gerufen, sobald etwas gezeichnet ist. */
  beiAenderung?: (hatStriche: boolean) => void;
  hoehe?: number;
}) {
  const canvas = useRef<HTMLCanvasElement>(null);
  const zeichnet = useRef(false);
  const [leer, setLeer] = useState(true);

  /** Setzt die Auflösung auf die des Geräts und stellt den Stift ein. */
  const einrichten = useCallback(() => {
    const c = canvas.current;
    if (!c) return;
    const dichte = window.devicePixelRatio || 1;
    const breite = c.clientWidth;
    // Nur neu aufsetzen, wenn sich wirklich etwas geändert hat — sonst
    // löscht jedes Rendern die Unterschrift.
    if (c.width === Math.round(breite * dichte) && c.height === Math.round(hoehe * dichte)) return;
    c.width = Math.round(breite * dichte);
    c.height = Math.round(hoehe * dichte);
    const s = c.getContext("2d");
    if (!s) return;
    s.scale(dichte, dichte);
    s.lineWidth = 2.2;
    s.lineCap = "round";
    s.lineJoin = "round";
    s.strokeStyle = "#101828";
  }, [hoehe]);

  useEffect(() => {
    einrichten();
    window.addEventListener("resize", einrichten);
    return () => window.removeEventListener("resize", einrichten);
  }, [einrichten]);

  function stelle(e: React.PointerEvent<HTMLCanvasElement>) {
    const r = e.currentTarget.getBoundingClientRect();
    return { x: e.clientX - r.left, y: e.clientY - r.top };
  }

  function beginnen(e: React.PointerEvent<HTMLCanvasElement>) {
    const s = canvas.current?.getContext("2d");
    if (!s) return;
    // Den Zeiger festhalten: fährt der Finger über den Rand hinaus, kommen
    // die Ereignisse weiter hier an, statt den Strich abzuschneiden.
    e.currentTarget.setPointerCapture(e.pointerId);
    zeichnet.current = true;
    const { x, y } = stelle(e);
    s.beginPath();
    s.moveTo(x, y);
    // Ein Punkt ist auch eine Unterschrift — wer nur tippt, bekommt einen.
    s.lineTo(x + 0.1, y);
    s.stroke();
    if (leer) {
      setLeer(false);
      beiAenderung?.(true);
    }
  }

  function ziehen(e: React.PointerEvent<HTMLCanvasElement>) {
    if (!zeichnet.current) return;
    const s = canvas.current?.getContext("2d");
    if (!s) return;
    const { x, y } = stelle(e);
    s.lineTo(x, y);
    s.stroke();
  }

  function beenden() {
    zeichnet.current = false;
  }

  function leeren() {
    const c = canvas.current;
    const s = c?.getContext("2d");
    if (!c || !s) return;
    s.clearRect(0, 0, c.width, c.height);
    setLeer(true);
    beiAenderung?.(false);
  }

  return (
    <div className="wb-unterschriftsfeld">
      <canvas
        ref={canvas}
        style={{ height: `${hoehe}px` }}
        onPointerDown={beginnen}
        onPointerMove={ziehen}
        onPointerUp={beenden}
        onPointerCancel={beenden}
        aria-label="Hier unterschreiben"
        role="img"
      />
      <div className="wb-unterschriftsfeld__linie" aria-hidden="true">
        <span>Hier unterschreiben</span>
      </div>
      <button
        type="button"
        className="wb-button wb-button--sekundaer wb-unterschriftsfeld__leeren"
        onClick={leeren}
        disabled={leer}
      >
        Neu
      </button>
    </div>
  );
}

/**
 * Holt das Gezeichnete als PNG mit weißem Grund.
 *
 * Weißer Grund, weil ein durchsichtiges PNG auf einem dunklen Ausdruck
 * unsichtbar wird — und der Abnahmeschein landet früher oder später auf
 * Papier.
 */
export async function alsPng(c: HTMLCanvasElement): Promise<Blob | null> {
  const flach = document.createElement("canvas");
  flach.width = c.width;
  flach.height = c.height;
  const s = flach.getContext("2d");
  if (!s) return null;
  s.fillStyle = "#ffffff";
  s.fillRect(0, 0, flach.width, flach.height);
  s.drawImage(c, 0, 0);
  return await new Promise((fertig) => flach.toBlob((b) => fertig(b), "image/png"));
}
