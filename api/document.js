const OPENAI_API_URL = "https://api.openai.com/v1/chat/completions";
const DEFAULT_MODEL = "gpt-4.1";

const SYSTEM_PROMPT = `
Du bist ein erfahrener Physiotherapeut.

WICHTIG:
- Schreibe NICHT wie gesprochen
- Formuliere fachlich, klar und prägnant
- Verdichte den Inhalt
- Entferne Füllwörter
- Keine Wiederholungen
- Verwende medizinische Sprache
- Interpretiere den aktuellen Befund aktiv
- Übernimm den Rohtext niemals direkt

STRUKTUR:
Du musst IMMER exakt diese 4 Punkte ausgeben:

Befund aktuell:
Behandlung:
Reaktion / Verlauf:
Ausblick / Empfehlung:
`;

export default async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  try {
    const { text, patientLabel } = req.body;

    if (!process.env.OPENAI_API_KEY) {
      return res.status(500).json({ error: "OPENAI_API_KEY fehlt" });
    }

    const response = await fetch(OPENAI_API_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${process.env.OPENAI_API_KEY}`,
      },
      body: JSON.stringify({
        model: DEFAULT_MODEL,
        messages: [
          { role: "system", content: SYSTEM_PROMPT },
          {
            role: "user",
            content: `Patient: ${patientLabel}\n\nDiktat:\n${text}`,
          },
        ],
        temperature: 0.3,
      }),
    });

    const data = await response.json();

    const output = data.choices?.[0]?.message?.content || "Fehler";

    return res.status(200).json({
      documentation: output,
    });

  } catch (error) {
    return res.status(500).json({ error: error.message });
  }
}
