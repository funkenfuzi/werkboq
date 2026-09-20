import { useState, type FormEvent } from "react";
import { anmelden } from "@werkboq/core";

export function Anmeldung() {
  const [kennung, setKennung] = useState("");
  const [passwort, setPasswort] = useState("");
  const [fehler, setFehler] = useState<string | null>(null);

  async function absenden(e: FormEvent) {
    e.preventDefault();
    setFehler(null);
    try {
      await anmelden(kennung.trim(), passwort);
      window.location.reload();
    } catch {
      setFehler("Anmeldung fehlgeschlagen. Benutzername oder Passwort prüfen.");
    }
  }

  return (
    <form className="wb-formular" onSubmit={absenden}>
      <h1>Werkboq</h1>
      <label className="wb-feld">
        <span>Benutzername oder E-Mail</span>
        <input
          type="text"
          autoComplete="username"
          autoCapitalize="none"
          autoCorrect="off"
          value={kennung}
          onChange={(e) => setKennung(e.target.value)}
          required
          autoFocus
        />
      </label>
      <label className="wb-feld">
        <span>Passwort</span>
        <input
          type="password"
          autoComplete="current-password"
          value={passwort}
          onChange={(e) => setPasswort(e.target.value)}
          required
        />
      </label>
      {fehler && (
        <p className="wb-fehler" role="alert">
          {fehler}
        </p>
      )}
      <button className="wb-button" type="submit">
        Anmelden
      </button>
    </form>
  );
}
