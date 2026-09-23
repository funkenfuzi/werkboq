/**
 * Regelbausteine für PocketBase — geteilt von allen Schemadateien.
 *
 * Reines JavaScript und keine TypeScript-Datei, weil `server/einrichten.mjs`
 * sie mit Node lädt, ohne Übersetzer dazwischen.
 */

export const angemeldet = "@request.auth.id != ''";
export const nurAdmin = "@request.auth.admin = true";

/**
 * Regelbausteine für die Bereichsrechte.
 *
 * `bereiche` und `lesebereiche` sind JSON-Arrays. PocketBase kann darauf
 * keinen echten Mengenvergleich, also wird auf den Text gefiltert — mit
 * Anführungszeichen, damit "lager" nicht in "lagerleitung" trifft.
 *
 * DAS HIER IST DER ECHTE SCHUTZ, nicht die Oberfläche. Was in der App
 * ausgeblendet ist, liegt trotzdem hinter der API bereit, solange keine
 * Regel danebensteht.
 */
export const schreibt = (bereich) => `${nurAdmin} || @request.auth.bereiche ~ '"${bereich}"'`;
export const liest = (bereich) =>
  `${nurAdmin} || @request.auth.bereiche ~ '"${bereich}"' || @request.auth.lesebereiche ~ '"${bereich}"'`;

/**
 * Regeln für eine Collection, die einem Bereich gehört.
 * `eigene` ist ein zusätzlicher Ausdruck, unter dem jemand seinen eigenen
 * Datensatz trotzdem sehen darf — ein Mitarbeiter etwa seinen Resturlaub.
 */
export function bereichsregeln(bereich, eigene = null) {
  const mitEigenen = (regel) => (eigene ? `(${regel}) || (${eigene})` : regel);
  return {
    listRule: mitEigenen(liest(bereich)),
    viewRule: mitEigenen(liest(bereich)),
    createRule: schreibt(bereich),
    updateRule: schreibt(bereich),
    deleteRule: nurAdmin,
  };
}

/** Was eine Collection ohne eigene Regeln bekommt. */
export const standardRegeln = {
  listRule: angemeldet,
  viewRule: angemeldet,
  createRule: angemeldet,
  updateRule: angemeldet,
  deleteRule: nurAdmin,
};
