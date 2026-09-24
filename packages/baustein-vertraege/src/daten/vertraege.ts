import {
  auftragAnlegen,
  dienst,
  LEERER_AUFTRAG,
  naechsteNummer,
  pb,
  protokollieren,
  sicher,
  type Basisdatensatz,
} from "@werkboq/core";
import {
  folgewartung,
  istEigener,
  type Kategorie,
  type Richtung,
  kuendigungWirktZum,
  pauschalzeitraum,
  RHYTHMUS_TEXT,
  type Rhythmus,
  type Verrechnungsart,
  type Vertragsdaten,
  type Vertragsstatus,
} from "./rechnen";

export interface Vertrag extends Basisdatensatz, Vertragsdaten {
  nummer: string;
  /** Bei Kundenverträgen gesetzt. */
  kunde?: string;
  /** Bei eigenen Verträgen gesetzt. */
  lieferant?: string;
  kategorie?: Kategorie | "";
  fremdnummer?: string;
  standort?: string;
  titel: string;
  leistungen?: string;
  notiz?: string;
  expand?: { kunde?: { id: string; name: string }; lieferant?: { id: string; name: string } };
}

/** Der Name der Gegenseite, gleich in welche Richtung. */
export function partnerName(v: Vertrag): string {
  return (istEigener(v) ? v.expand?.lieferant?.name : v.expand?.kunde?.name) ?? "—";
}

export function partnerPfad(v: Vertrag): string | null {
  if (istEigener(v)) return v.lieferant ? `/lieferanten/${v.lieferant}` : null;
  return v.kunde ? `/kunden/${v.kunde}` : null;
}

export type VertragEingabe = Omit<Vertrag, keyof Basisdatensatz | "expand">;

export interface Vertragsereignis extends Basisdatensatz {
  vertrag: string;
  art: "wartung" | "rechnung" | "kuendigung" | "preis" | "termin";
  faellig?: string;
  auftrag?: string;
  beleg?: string;
  text?: string;
}

/** 2026-12-31 → 31.12.2026 */
export function tagText(t: string): string {
  return new Date(`${t.slice(0, 10)}T00:00:00`).toLocaleDateString("de-AT");
}

export function heute(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

export function leererVertrag(richtung: Richtung = "kunde"): VertragEingabe {
  const h = heute();
  const eigen = richtung === "lieferant";
  return {
    richtung,
    lieferant: "",
    kategorie: eigen ? "pruefung" : "wartung",
    fremdnummer: "",
    nummer: "",
    kunde: "",
    standort: "",
    titel: "",
    leistungen: "",
    notiz: "",
    status: "aktiv" as Vertragsstatus,
    intervallMonate: 12,
    naechsteWartung: "",
    vorlaufTage: 30,
    verrechnung: (eigen ? "" : "aufwand") as Verrechnungsart,
    pauschale: 0,
    rhythmus: "jahr" as Rhythmus,
    naechsteRechnung: h,
    preisStand: h,
    beginn: h,
    laufzeitMonate: 12,
    verlaengerungMonate: 12,
    kuendigungsfristMonate: 3,
    gekuendigtZum: "",
  };
}

/** Datumsfelder kommen als „2026-10-15 00:00:00.000Z" — gerechnet wird mit JJJJ-MM-TT. */
function tagesgenau<T extends Partial<Vertragsdaten>>(v: T): T {
  const felder = ["naechsteWartung", "naechsteRechnung", "preisStand", "beginn", "gekuendigtZum"] as const;
  const heraus = { ...v } as Record<string, unknown>;
  for (const f of felder) if (typeof heraus[f] === "string") heraus[f] = (heraus[f] as string).slice(0, 10);
  return heraus as T;
}

export async function alleVertraege(): Promise<Vertrag[]> {
  const liste = await pb().collection("vertraege").getFullList<Vertrag>({ sort: "nummer", expand: "kunde,lieferant" });
  return liste.map(tagesgenau);
}

export async function vertraegeZuKunde(kunde: string): Promise<Vertrag[]> {
  const liste = await pb()
    .collection("vertraege")
    .getFullList<Vertrag>({ filter: `kunde = "${sicher(kunde)}"`, sort: "nummer" });
  return liste.map(tagesgenau);
}

export async function vertraegeZuLieferant(lieferant: string): Promise<Vertrag[]> {
  const liste = await pb()
    .collection("vertraege")
    .getFullList<Vertrag>({ filter: `lieferant = "${sicher(lieferant)}"`, sort: "nummer" });
  return liste.map(tagesgenau);
}

export async function vertragLaden(id: string): Promise<Vertrag> {
  return tagesgenau(await pb().collection("vertraege").getOne<Vertrag>(id, { expand: "kunde,lieferant" }));
}

export async function ereignisse(vertrag: string): Promise<Vertragsereignis[]> {
  return await pb()
    .collection("vertragsereignisse")
    .getFullList<Vertragsereignis>({ filter: `vertrag = "${sicher(vertrag)}"`, sort: "-created" });
}

/**
 * WV-2026-001 für Kundenverträge, EV-2026-001 für eigene — fortlaufend je
 * Jahr und Richtung.
 */
export async function naechsteVertragsnummer(
  jahr = new Date().getFullYear(),
  richtung: Richtung = "kunde",
): Promise<string> {
  const praefix = `${richtung === "lieferant" ? "EV" : "WV"}-${jahr}-`;
  const letzte = await pb()
    .collection("vertraege")
    .getList<Vertrag>(1, 1, { filter: `nummer ~ "${praefix}"`, sort: "-nummer" })
    .catch(() => null);
  const zahl = Number((letzte?.items[0]?.nummer ?? "").slice(praefix.length)) || 0;
  return `${praefix}${String(zahl + 1).padStart(3, "0")}`;
}

function bereinigen(e: Partial<VertragEingabe>): Record<string, unknown> {
  const d: Record<string, unknown> = {};
  for (const [k, w] of Object.entries(e)) {
    if (w === undefined) continue;
    d[k] = typeof w === "string" ? w.trim() || (["standort", "kunde", "lieferant", "gekuendigtZum", "naechsteWartung", "naechsteRechnung"].includes(k) ? null : "") : w;
  }
  return d;
}

export async function vertragSpeichern(vorher: Vertrag | null, e: VertragEingabe): Promise<Vertrag> {
  if (vorher) {
    // Ändert sich die Pauschale, gilt der Preis ab heute als geprüft.
    const preisGeaendert = e.pauschale !== vorher.pauschale;
    const daten = bereinigen({ ...e, preisStand: preisGeaendert ? heute() : e.preisStand });
    const neu = await pb().collection("vertraege").update<Vertrag>(vorher.id, daten);
    await protokollieren("vertraege", vorher.id, "aendern", `Vertrag ${e.nummer} geändert`);
    if (preisGeaendert) {
      await pb().collection("vertragsereignisse").create({
        vertrag: vorher.id,
        art: "preis",
        faellig: heute(),
        text: `${istEigener(vorher) ? "Kosten" : "Pauschale"} von ${(vorher.pauschale ?? 0) / 100} auf ${(e.pauschale ?? 0) / 100} geändert`,
      });
    }
    return tagesgenau(neu);
  }
  const neu = await pb().collection("vertraege").create<Vertrag>(bereinigen(e));
  await protokollieren("vertraege", neu.id, "anlegen", `Vertrag ${e.nummer} „${e.titel}" angelegt`);
  return tagesgenau(neu);
}

/**
 * Die fällige Wartung als Auftrag anlegen und die nächste fortschreiben.
 *
 * Der Auftrag bekommt die Art Wartung und die Phase „Geplant"
 * (beauftragt) — ein Termin muss noch her, aber zugesagt ist er, der
 * Vertrag sagt es.
 */
export async function wartungAnlegen(v: Vertrag): Promise<{ auftragId: string }> {
  if (!v.kunde) throw new Error("Ein Wartungsauftrag braucht einen Kunden — das ist ein eigener Vertrag.");
  if (!v.naechsteWartung) throw new Error("Für diesen Vertrag ist keine nächste Wartung eingetragen.");
  const auftrag = await auftragAnlegen({
    ...LEERER_AUFTRAG,
    kunde: v.kunde,
    standort: v.standort || "",
    nummer: await naechsteNummer(),
    titel: `Wartung: ${v.titel}`,
    art: "wartung",
    phase: "beauftragt",
    beginn: v.naechsteWartung,
    beschreibung: `Laut Wartungsvertrag ${v.nummer}, fällig am ${new Date(`${v.naechsteWartung}T00:00:00`).toLocaleDateString("de-AT")}.${
      v.leistungen ? `\n\n${v.leistungen}` : ""
    }`,
  });
  if (!auftrag) throw new Error("Ohne Verbindung lässt sich kein Wartungsauftrag anlegen — bitte später noch einmal.");
  const folge = folgewartung(v);
  await pb().collection("vertraege").update(v.id, { naechsteWartung: folge });
  await pb().collection("vertragsereignisse").create({
    vertrag: v.id,
    art: "wartung",
    faellig: v.naechsteWartung,
    auftrag: auftrag.id,
    text: `Wartungsauftrag ${auftrag.nummer} angelegt${folge ? `, nächste Wartung ${tagText(folge)}` : ""}`,
  });
  await protokollieren("vertraege", v.id, "aendern", `Wartungsauftrag ${auftrag.nummer} angelegt`);
  return { auftragId: auftrag.id };
}

/**
 * Die fällige Pauschale als Rechnungsentwurf — über den Dienst der
 * Verrechnung, die dieser Baustein nicht kennt. Ohne Verrechnung gibt es
 * den Knopf nicht.
 */
export async function pauschaleVerrechnen(v: Vertrag): Promise<{ belegId: string; nummer: string }> {
  const anlegen = dienst("belegentwurf");
  if (!anlegen) throw new Error("Der Baustein Verrechnung ist nicht freigeschaltet.");
  if (!v.kunde) throw new Error("Verrechnet wird nur an Kunden — das ist ein eigener Vertrag.");
  const kunde = v.kunde;
  const z = pauschalzeitraum(v, heute());
  if (!z) throw new Error("Für diesen Vertrag ist keine Pauschale fällig.");
  const d = (t: string) => new Date(`${t}T00:00:00`).toLocaleDateString("de-AT");
  const beleg = await anlegen({
    kunde,
    kopftext: `Wartungsvertrag ${v.nummer} — ${v.titel}`,
    leistungVon: z.von,
    leistungBis: z.bis,
    zeilen: [
      {
        bezeichnung: `Wartungspauschale ${RHYTHMUS_TEXT[v.rhythmus ?? "jahr"]}`,
        beschreibung: `Zeitraum ${d(z.von)} bis ${d(z.bis)}${z.betrag !== v.pauschale ? " (anteilig bis Vertragsende)" : ""}`,
        menge: 1,
        einheit: "Pausch.",
        einzelpreis: z.betrag,
      },
    ],
  });
  await pb().collection("vertraege").update(v.id, { naechsteRechnung: z.folgeRechnung });
  await pb().collection("vertragsereignisse").create({
    vertrag: v.id,
    art: "rechnung",
    faellig: z.von,
    beleg: beleg.nummer,
    text: `Rechnungsentwurf ${beleg.nummer} für ${d(z.von)}–${d(z.bis)}`,
  });
  await protokollieren("vertraege", v.id, "aendern", `Pauschale verrechnet: Entwurf ${beleg.nummer}`);
  return { belegId: beleg.id, nummer: beleg.nummer };
}

/**
 * Eigener Vertrag: der Dienstleister war da (Feuerlöscher geprüft, Anlage
 * gewartet). Der nächste Termin rückt vom Fälligkeitstag aus weiter — wie
 * bei Kundenverträgen, damit aus „jährlich" nicht „alle 13 Monate" wird.
 */
export async function terminErledigt(v: Vertrag, notiz = ""): Promise<string | null> {
  if (!v.naechsteWartung) throw new Error("Für diesen Vertrag ist kein Termin eingetragen.");
  const folge = folgewartung(v);
  await pb().collection("vertraege").update(v.id, { naechsteWartung: folge });
  await pb().collection("vertragsereignisse").create({
    vertrag: v.id,
    art: "termin",
    faellig: v.naechsteWartung,
    text: `Termin vom ${tagText(v.naechsteWartung)} erledigt${notiz.trim() ? ` — ${notiz.trim()}` : ""}${folge ? `, nächster ${tagText(folge)}` : ""}`,
  });
  await protokollieren("vertraege", v.id, "aendern", `Termin erledigt, nächster ${folge ? tagText(folge) : "keiner"}`);
  return folge;
}

/** Kündigung erfassen — sie wirkt zu dem Tag, den Laufzeit und Frist ergeben. */
export async function kuendigen(v: Vertrag, eingang: string, notiz: string): Promise<string> {
  const zum = kuendigungWirktZum(v, eingang);
  await pb().collection("vertraege").update(v.id, { status: "gekuendigt", gekuendigtZum: zum });
  await pb().collection("vertragsereignisse").create({
    vertrag: v.id,
    art: "kuendigung",
    faellig: zum,
    text: `Kündigung eingegangen am ${tagText(eingang)}, wirkt zum ${tagText(zum)}${notiz.trim() ? ` — ${notiz.trim()}` : ""}`,
  });
  await protokollieren("vertraege", v.id, "aendern", `Vertrag ${v.nummer} gekündigt zum ${tagText(zum)}`);
  return zum;
}

export async function beenden(v: Vertrag): Promise<void> {
  await pb().collection("vertraege").update(v.id, { status: "beendet" });
  await protokollieren("vertraege", v.id, "aendern", `Vertrag ${v.nummer} beendet`);
}

export async function standorteZuKunde(kunde: string): Promise<{ id: string; bezeichnung: string }[]> {
  if (!kunde) return [];
  return await pb()
    .collection("standorte")
    .getFullList<{ id: string; bezeichnung: string } & Basisdatensatz>({ filter: `kunde = "${sicher(kunde)}"`, sort: "bezeichnung" })
    .catch(() => []);
}
