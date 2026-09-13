import { aktuellerBenutzer, alleModule, erweiterungen } from "@werkboq/core";

export function Start() {
  const b = aktuellerBenutzer();
  const kacheln = erweiterungen("dashboard.kachel");

  return (
    <section>
      <h1>Hallo {b?.name || b?.email}</h1>
      <p>
        Aktive Module: {alleModule().map((m) => `${m.name} ${m.version}`).join(", ") || "keine"}
      </p>
      {kacheln.map(({ modulId, Komponente }) => (
        <Komponente key={modulId} />
      ))}
    </section>
  );
}
