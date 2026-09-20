import { useEffect, useMemo, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { kundenSuchen, type Kunde } from "@werkboq/core";
import { Symbol } from "../komponenten/Symbol";

/**
 * Kundenliste als Arbeitstabelle.
 *
 * Sortierung passiert im Browser, nicht am Server: die Liste ist auf 200
 * Einträge begrenzt und wird ohnehin über die Suche eingegrenzt. Sobald
 * Betriebe mit tausenden Kunden dazukommen, wandert beides auf den Server —
 * dann aber gemeinsam mit Seitenweise-Blättern, sonst bringt es nichts.
 */

type Spalte = "name" | "ort" | "telefon" | "email";
type Richtung = "auf" | "ab";

const SPALTEN: { id: Spalte; titel: string; breite?: string }[] = [
  { id: "name", titel: "Name" },
  { id: "ort", titel: "Ort", breite: "22%" },
  { id: "telefon", titel: "Telefon", breite: "18%" },
  { id: "email", titel: "E-Mail", breite: "24%" },
];

export function Kunden() {
  const navigate = useNavigate();
  const [suche, setSuche] = useState("");
  const [liste, setListe] = useState<Kunde[]>([]);
  const [spalte, setSpalte] = useState<Spalte>("name");
  const [richtung, setRichtung] = useState<Richtung>("auf");
  const [laedt, setLaedt] = useState(true);
  const [fehler, setFehler] = useState<string | null>(null);

  useEffect(() => {
    let abgebrochen = false;
    const zeitgeber = setTimeout(() => {
      setLaedt(true);
      kundenSuchen(suche)
        .then((k) => {
          if (abgebrochen) return;
          setListe(k);
          setFehler(null);
        })
        .catch((e: unknown) => {
          if (!abgebrochen) setFehler(e instanceof Error ? e.message : String(e));
        })
        .finally(() => {
          if (!abgebrochen) setLaedt(false);
        });
    }, 200);
    return () => {
      abgebrochen = true;
      clearTimeout(zeitgeber);
    };
  }, [suche]);

  const sortiert = useMemo(() => {
    const kopie = [...liste];
    kopie.sort((a, b) => {
      const links = (a[spalte] ?? "").toLocaleLowerCase("de-AT");
      const rechts = (b[spalte] ?? "").toLocaleLowerCase("de-AT");
      // Leere Werte immer ans Ende, egal in welche Richtung sortiert wird.
      if (!links && rechts) return 1;
      if (links && !rechts) return -1;
      const v = links.localeCompare(rechts, "de-AT");
      return richtung === "auf" ? v : -v;
    });
    return kopie;
  }, [liste, spalte, richtung]);

  function sortiere(s: Spalte) {
    if (s === spalte) setRichtung((r) => (r === "auf" ? "ab" : "auf"));
    else {
      setSpalte(s);
      setRichtung("auf");
    }
  }

  return (
    <section>
      <div className="wb-kopf">
        <div>
          <h1>Kunden</h1>
          <p className="wb-kopf__zahl">
            {laedt ? "…" : `${sortiert.length} ${sortiert.length === 1 ? "Eintrag" : "Einträge"}`}
            {suche && ` für „${suche}"`}
          </p>
        </div>
        <Link className="wb-button" to="/kunden/neu">
          <Symbol name="plus" groesse={18} />
          Neuer Kunde
        </Link>
      </div>

      <div className="wb-werkzeugleiste">
        <div className="wb-suchfeld">
          <Symbol name="suche" groesse={18} />
          <input
            type="search"
            placeholder="Nach Name, Ort oder E-Mail filtern"
            value={suche}
            onChange={(e) => setSuche(e.target.value)}
            autoCapitalize="none"
          />
        </div>
      </div>

      {fehler && (
        <p className="wb-fehler" role="alert">
          Kunden konnten nicht geladen werden: {fehler}
        </p>
      )}

      {laedt && liste.length === 0 && <TabellenSkelett />}

      {!laedt && sortiert.length === 0 && !fehler && (
        <div className="wb-nichts">
          <p>
            {suche
              ? `Kein Kunde passt zu „${suche}".`
              : "Noch keine Kunden angelegt."}
          </p>
          <p className="wb-leer">
            Der Kunde ist die Wurzel: jeder Auftrag, jeder Prüfbericht und jedes Foto hängt
            an einem. Auch eigene Vorhaben laufen über einen internen Kunden.
          </p>
          {!suche && (
            <Link className="wb-button" to="/kunden/neu">
              <Symbol name="plus" groesse={18} />
              Ersten Kunden anlegen
            </Link>
          )}
        </div>
      )}

      {sortiert.length > 0 && (
        <div className="wb-tabelle-rahmen">
          <table className="wb-tabelle wb-tabelle--klickbar">
            <thead>
              <tr>
                {SPALTEN.map((s) => (
                  <th
                    key={s.id}
                    scope="col"
                    style={s.breite ? { width: s.breite } : undefined}
                    aria-sort={
                      spalte === s.id ? (richtung === "auf" ? "ascending" : "descending") : "none"
                    }
                  >
                    <button type="button" className="wb-sortknopf" onClick={() => sortiere(s.id)}>
                      {s.titel}
                      {spalte === s.id && (
                        <Symbol name="sortierung" groesse={14} className={richtung === "ab" ? "ist-umgedreht" : ""} />
                      )}
                    </button>
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {sortiert.map((k) => (
                <tr
                  key={k.id}
                  tabIndex={0}
                  onClick={() => navigate(`/kunden/${k.id}`)}
                  onKeyDown={(e) => e.key === "Enter" && navigate(`/kunden/${k.id}`)}
                >
                  <td>
                    <span className="wb-zellname">
                      <span className="wb-initialen wb-initialen--klein" aria-hidden="true">
                        {initialen(k.name)}
                      </span>
                      {k.name}
                      {k.intern && <span className="wb-plakette wb-plakette--info">intern</span>}
                    </span>
                  </td>
                  <td>{[k.plz, k.ort].filter(Boolean).join(" ") || "—"}</td>
                  <td>{k.telefon || "—"}</td>
                  <td className="wb-zelle--gedaempft">{k.email || "—"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}

function TabellenSkelett() {
  return (
    <div className="wb-tabelle-rahmen" aria-busy="true">
      <div className="wb-skelett">
        {[0, 1, 2, 3, 4].map((i) => (
          <div key={i} className="wb-skelett__balken" />
        ))}
      </div>
    </div>
  );
}

function initialen(name: string): string {
  return name
    .split(/\s+/)
    .filter((w) => /[A-Za-zÄÖÜäöü]/.test(w))
    .slice(0, 2)
    .map((w) => w[0]?.toUpperCase() ?? "")
    .join("");
}
