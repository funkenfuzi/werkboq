import { useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  Symbol,
  abmelden,
  aktuellerBenutzer,
  KERN_COLLECTIONS,
  kundenSuchen,
  pb,
  type Auftrag,
  type Kunde,
} from "@werkboq/core";

/**
 * Kopfleiste mit globaler Suche.
 *
 * Wer im Büro telefoniert, tippt einen Namen und will sofort dort sein —
 * ohne vorher zu entscheiden, ob es ein Kunde oder ein Auftrag ist. Deshalb
 * sucht dieses Feld über beides zugleich. Strg+K bzw. Cmd+K springt hinein.
 */

type Treffer =
  | { art: "kunde"; id: string; titel: string; neben: string }
  | { art: "auftrag"; id: string; titel: string; neben: string };

export function Kopfleiste() {
  const navigate = useNavigate();
  const benutzer = aktuellerBenutzer();
  const [suche, setSuche] = useState("");
  const [treffer, setTreffer] = useState<Treffer[]>([]);
  const [offen, setOffen] = useState(false);
  const [markiert, setMarkiert] = useState(0);
  const feld = useRef<HTMLInputElement>(null);
  const huelle = useRef<HTMLDivElement>(null);

  // Tastenkürzel zum Sprung ins Suchfeld
  useEffect(() => {
    function taste(e: KeyboardEvent) {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        feld.current?.focus();
        feld.current?.select();
      }
      if (e.key === "Escape") setOffen(false);
    }
    window.addEventListener("keydown", taste);
    return () => window.removeEventListener("keydown", taste);
  }, []);

  // Klick außerhalb schließt die Trefferliste
  useEffect(() => {
    function klick(e: MouseEvent) {
      if (huelle.current && !huelle.current.contains(e.target as Node)) setOffen(false);
    }
    document.addEventListener("mousedown", klick);
    return () => document.removeEventListener("mousedown", klick);
  }, []);

  useEffect(() => {
    const text = suche.trim();
    if (text.length < 2) {
      setTreffer([]);
      return;
    }
    let abgebrochen = false;
    const zeitgeber = setTimeout(async () => {
      const sauber = text.replace(/["\\]/g, "");
      const [kunden, auftraege] = await Promise.all([
        kundenSuchen(text, 6).catch(() => [] as Kunde[]),
        pb()
          .collection(KERN_COLLECTIONS.auftraege)
          .getList<Auftrag>(1, 6, {
            filter: `titel ~ "${sauber}" || nummer ~ "${sauber}"`,
            sort: "-created",
          })
          .then((r) => r.items)
          .catch(() => [] as Auftrag[]),
      ]);
      if (abgebrochen) return;
      setTreffer([
        ...kunden.map((k): Treffer => ({
          art: "kunde",
          id: k.id,
          titel: k.name,
          neben: [k.plz, k.ort].filter(Boolean).join(" ") || "Kunde",
        })),
        ...auftraege.map((a): Treffer => ({
          art: "auftrag",
          id: a.id,
          titel: a.titel,
          neben: `Auftrag ${a.nummer}`,
        })),
      ]);
      setMarkiert(0);
      setOffen(true);
    }, 200);
    return () => {
      abgebrochen = true;
      clearTimeout(zeitgeber);
    };
  }, [suche]);

  function oeffne(t: Treffer) {
    setOffen(false);
    setSuche("");
    navigate(t.art === "kunde" ? `/kunden/${t.id}` : `/auftraege/${t.id}`);
  }

  function tasten(e: React.KeyboardEvent) {
    if (!offen || treffer.length === 0) return;
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setMarkiert((m) => (m + 1) % treffer.length);
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setMarkiert((m) => (m - 1 + treffer.length) % treffer.length);
    } else if (e.key === "Enter") {
      e.preventDefault();
      const t = treffer[markiert];
      if (t) oeffne(t);
    }
  }

  return (
    <header className="wb-kopfleiste">
      <div className="wb-kopfleiste__suche" ref={huelle}>
        <Symbol name="suche" groesse={18} className="wb-kopfleiste__lupe" />
        <input
          ref={feld}
          type="text"
          placeholder="Kunden und Aufträge durchsuchen"
          value={suche}
          onChange={(e) => setSuche(e.target.value)}
          onFocus={() => treffer.length > 0 && setOffen(true)}
          onKeyDown={tasten}
          autoCapitalize="none"
          aria-label="Globale Suche"
        />
        <kbd className="wb-kuerzel">⌘K</kbd>

        {offen && (
          <ul className="wb-treffer" role="listbox">
            {treffer.length === 0 ? (
              <li className="wb-treffer__leer">Nichts gefunden.</li>
            ) : (
              treffer.map((t, i) => (
                <li key={`${t.art}-${t.id}`}>
                  <button
                    type="button"
                    role="option"
                    aria-selected={i === markiert}
                    className={`wb-treffer__eintrag${i === markiert ? " ist-markiert" : ""}`}
                    onMouseEnter={() => setMarkiert(i)}
                    onClick={() => oeffne(t)}
                  >
                    <Symbol name={t.art === "kunde" ? "kunden" : "auftraege"} groesse={16} />
                    <span className="wb-treffer__titel">{t.titel}</span>
                    <span className="wb-treffer__neben">{t.neben}</span>
                  </button>
                </li>
              ))
            )}
          </ul>
        )}
      </div>

      <div className="wb-kopfleiste__rechts">
        <span className="wb-kopfleiste__benutzer" title={benutzer?.email}>
          {benutzer?.name || benutzer?.email}
        </span>
        <button
          type="button"
          className="wb-kopfleiste__knopf"
          onClick={() => {
            abmelden();
            window.location.reload();
          }}
          title="Abmelden"
        >
          <Symbol name="abmelden" groesse={18} />
          <span>Abmelden</span>
        </button>
      </div>
    </header>
  );
}
