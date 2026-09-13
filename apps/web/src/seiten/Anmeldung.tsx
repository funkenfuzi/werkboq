import { useState, type FormEvent } from "react";
import { anmelden } from "@werkboq/core";

export function Anmeldung() {
  const [email, setEmail] = useState("");
  const [passwort, setPasswort] = useState("");
  const [fehler, setFehler] = useState<string | null>(null);

  async function absenden(e: FormEvent) {
    e.preventDefault();
    setFehler(null);
    try {
      await anmelden(email, passwort);
      window.location.reload();
    } catch {
      setFehler("Anmeldung fehlgeschlagen. E-Mail oder Passwort prüfen.");
    }
  }

  return (
    <form className="wb-formular" onSubmit={absenden}>
      <h1>Werkboq</h1>
      <input
        type="email"
        placeholder="E-Mail"
        autoComplete="username"
        value={email}
        onChange={(e) => setEmail(e.target.value)}
        required
      />
      <input
        type="password"
        placeholder="Passwort"
        autoComplete="current-password"
        value={passwort}
        onChange={(e) => setPasswort(e.target.value)}
        required
      />
      {fehler && <p role="alert">{fehler}</p>}
      <button className="wb-button" type="submit">
        Anmelden
      </button>
    </form>
  );
}
