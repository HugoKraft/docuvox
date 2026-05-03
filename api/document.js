const OPENAI_API_URL = "https://api.openai.com/v1/responses";
const DEFAULT_MODEL = "gpt-4.1";
const SECTION_ORDER = [
  "Befund aktuell",
  "Behandlung",
  "Reaktion / Verlauf",
  "Ausblick / Empfehlung",
];
const SECTION_DEFAULTS = {
  "Befund aktuell": "Aktueller Befund aus Diktat nicht eindeutig ableitbar.",
  Behandlung: "Therapeutische Behandlung gemäss Diktat durchgeführt.",
  "Reaktion / Verlauf": "Behandlung wurde toleriert, weiterer Verlauf beobachten.",
  "Ausblick / Empfehlung": "Weiterführung der Therapie mit Fokus auf Funktion, Sicherheit und Selbstständigkeit.",
};

const SYSTEM_PROMPT = `Du bist ein erfahrener Physiotherapeut und erstellst aus einem gesprochenen Diktat eine professionelle, kurze Dokumentation.

WICHTIG:
- Schreibe NICHT wie gesprochen.
- Formuliere fachlich, klar und prägnant.
- Verdichte den Inhalt.
- Entferne Füllwörter.
- Keine Wiederholungen.
- Verwende medizinische Sprache.
- Interpretiere den aktuellen Befund aktiv aus dem Diktat.
- Übernimm den Rohtext niemals direkt.

STRUKTUR:
Du musst IMMER exakt diese 4 Punkte ausgeben:

• Befund aktuell:
• Behandlung:
• Reaktion / Verlauf:
• Ausblick / Empfehlung:

INHALTLICHE VORGABEN:
• Befund aktuell:
- Beschreibe den aktuellen Zustand, Diagnose, Einschränkungen und Symptome.
- Leite den Befund aktiv aus dem Diktat ab.

• Behandlung:
- Beschreibe konkret die durchgeführten Massnahmen.
- Nenne Training, Gehen, Übungen, Hilfsmittel, Wiederholungen oder relevante Parameter.

• Reaktion / Verlauf:
- Beurteile, wie der Patient reagiert hat.
- Nenne Toleranz, Unsicherheit, Fortschritt, Probleme oder Belastbarkeit.

• Ausblick / Empfehlung:
- Formuliere nächste Schritte.
- Nenne Weiterführung, Fokus und therapeutisches Ziel.

REGELN:
- Jeder Abschnitt MUSS gefüllt sein.
- Wenn Infos fehlen, ergänze medizinisch sinnvoll.
- Maximal 2 bis 3 kurze Sätze pro Abschnitt.
- KEIN Rohtext übernehmen.
- Patientennamen anonymisieren.
- Schreibe sachlich, kurz und therapiebezogen.

AUSGABEFORMAT:
Gib ausschließlich dieses Format zurück:

Patient X

• Befund aktuell: ...
• Behandlung: ...
• Reaktion / Verlauf: ...
• Ausblick / Empfehlung: ...

BEISPIEL:
Eingabe:
"Patient mit Parkinson, wir sind am Rollator gegangen, Fokus auf Schrittgrösse, er war unsicher aber ging"

Ausgabe:

Patient X

• Befund aktuell: Patient mit Parkinson, Gangbild reduziert mit verminderter Schrittlänge und Unsicherheiten.
• Behandlung: Gangtraining am Rollator mit Fokus auf Schrittlängenvergrösserung und Stabilität.
• Reaktion / Verlauf: Belastung toleriert, jedoch weiterhin Unsicherheiten im Gangbild.
• Ausblick / Empfehlung: Weiterführung des Gangtrainings mit Fokus auf Schrittlänge, Sicherheit und Gleichgewicht.`;

const REPAIR_PROMPT = `${SYSTEM_PROMPT}

Zusatzauftrag:
Die vorherige Antwort war leer, unvollständig oder nicht im Pflichtformat. Erstelle sie jetzt neu.
Alle vier Abschnitte müssen vorhanden und ausgefüllt sein.
Falls Informationen fehlen, ergänze fachlich kurz und plausibel.
Gib ausschließlich das Pflichtformat aus.`;

module.exports = async function documentHandler(request, response) {
  if (request.method !== "POST") {
    sendJson(response, 405, { error: "Method not allowed" });
    return;
  }

  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) {
    sendJson(response, 500, {
      error: "KI-Verarbeitung fehlgeschlagen. Bitte erneut versuchen.",
      details: "OPENAI_API_KEY ist nicht gesetzt.",
    });
    return;
  }

  try {
    const body = await readJsonBody(request);
    const rawText = String(body.rawText || "").trim();
    const patientNumber = Number(body.patientNumber);

    if (!rawText || !Number.isInteger(patientNumber) || patientNumber < 1) {
      sendJson(response, 400, {
        error: "KI-Verarbeitung fehlgeschlagen. Bitte erneut versuchen.",
        details: "Rohdiktat oder Patientennummer fehlt.",
      });
      return;
    }

    const documentation = await createDocumentation({
      apiKey,
      rawText,
      patientNumber,
    });

    sendJson(response, 200, { documentation });
  } catch (error) {
    console.error("DocuVox AI processing failed:", error);
    sendJson(response, 500, {
      error: "KI-Verarbeitung fehlgeschlagen. Bitte erneut versuchen.",
      details: error.message || "OpenAI-Anfrage fehlgeschlagen.",
    });
  }
};

async function createDocumentation({ apiKey, rawText, patientNumber }) {
  const model = process.env.OPENAI_MODEL || DEFAULT_MODEL;
  const first = await requestOpenAi({
    apiKey,
    model,
    instructions: SYSTEM_PROMPT.replaceAll("Patient X", `Patient ${patientNumber}`),
    input: createUserInput(rawText, patientNumber),
  });

  if (hasCompleteSections(first)) {
    return normalizeDocumentation(first, patientNumber);
  }

  const repaired = await requestOpenAi({
    apiKey,
    model,
    instructions: REPAIR_PROMPT.replaceAll("Patient X", `Patient ${patientNumber}`),
    input: `${createUserInput(rawText, patientNumber)}\n\nUnvollständige vorherige Antwort:\n${first}`,
  });

  return normalizeDocumentation(repaired, patientNumber);
}

async function requestOpenAi({ apiKey, model, instructions, input }) {
  const requestBody = {
    model,
    instructions,
    input,
    max_output_tokens: 700,
  };

  if (model.startsWith("gpt-5")) {
    requestBody.reasoning = { effort: "low" };
  }

  const response = await fetch(OPENAI_API_URL, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(requestBody),
  });

  const data = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new Error(data.error?.message || `OpenAI request failed with ${response.status}`);
  }

  const text = extractOutputText(data).trim();
  if (!text) {
    throw new Error("OpenAI returned an empty documentation");
  }

  return text;
}

function createUserInput(rawText, patientNumber) {
  return `Patient: Patient ${patientNumber}

Rohdiktat:
${rawText}

Aufgabe:
Erstelle daraus eine professionelle, kurze Physiotherapie-Dokumentation im Pflichtformat.
Schreibe nicht wie gesprochen.
Verdichte den Inhalt fachlich.
Leite Befund, Reaktion und Ausblick therapeutisch sinnvoll ab.
Übernimm keine Patientennamen.
Übernimm das Rohdiktat nicht wortwörtlich und nicht im Satzbau des Diktats.
Fülle alle vier Abschnitte aus.`;
}

function extractOutputText(data) {
  if (typeof data.output_text === "string") return data.output_text;

  return (data.output || [])
    .flatMap((item) => item.content || [])
    .map((content) => content.text || "")
    .join("\n");
}

function normalizeDocumentation(text, patientNumber) {
  let clean = text
    .replace(/\r\n/g, "\n")
    .replace(/[ \t]+/g, " ")
    .trim();

  const sections = Object.fromEntries(
    SECTION_ORDER.map((section) => [section, extractSection(clean, section)])
  );

  return formatDocumentation(sections, patientNumber);
}

function extractSection(text, sectionName) {
  const escaped = sectionName.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const nextSections = SECTION_ORDER
    .filter((name) => name !== sectionName)
    .map((name) => name.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"))
    .join("|");

  const pattern = new RegExp(`(?:•\\s*)?${escaped}\\s*:\\s*([\\s\\S]*?)(?=\\n\\s*(?:•\\s*)?(?:${nextSections})\\s*:|$)`, "i");
  const match = text.match(pattern);
  return sanitizeSection(match?.[1] || "");
}

function sanitizeSection(value) {
  return value
    .replace(/^[-•\s]+/, "")
    .replace(/\s+/g, " ")
    .replace(/\b(wir haben dann|also|eben|eigentlich|quasi|sozusagen)\b/gi, "")
    .replace(/\s+/g, " ")
    .trim();
}

function formatDocumentation(sections, patientNumber) {
  return `Patient ${patientNumber}

• Befund aktuell: ${ensureUseful(sections["Befund aktuell"], SECTION_DEFAULTS["Befund aktuell"])}
• Behandlung: ${ensureUseful(sections.Behandlung, SECTION_DEFAULTS.Behandlung)}
• Reaktion / Verlauf: ${ensureUseful(sections["Reaktion / Verlauf"], SECTION_DEFAULTS["Reaktion / Verlauf"])}
• Ausblick / Empfehlung: ${ensureUseful(sections["Ausblick / Empfehlung"], SECTION_DEFAULTS["Ausblick / Empfehlung"])}`;
}

function ensureUseful(value, fallback) {
  const clean = sanitizeSection(value);
  if (!clean || clean.length < 4 || clean === "...") return fallback;
  return /[.!?]$/.test(clean) ? clean : `${clean}.`;
}

function hasCompleteSections(text) {
  return SECTION_ORDER.every((section) => {
    const value = extractSection(text, section);
    return value.length >= 8 && value !== "...";
  });
}

function readJsonBody(request) {
  if (request.body && typeof request.body === "object") {
    return Promise.resolve(request.body);
  }

  if (typeof request.body === "string") {
    return Promise.resolve(JSON.parse(request.body || "{}"));
  }

  return new Promise((resolve, reject) => {
    let raw = "";
    request.on("data", (chunk) => {
      raw += chunk;
      if (raw.length > 50_000) {
        reject(new Error("Request body too large"));
        request.destroy();
      }
    });
    request.on("end", () => {
      try {
        resolve(JSON.parse(raw || "{}"));
      } catch (error) {
        reject(error);
      }
    });
    request.on("error", reject);
  });
}

function sendJson(response, statusCode, body) {
  response.writeHead(statusCode, {
    "Content-Type": "application/json;charset=utf-8",
    "Cache-Control": "no-store",
  });
  response.end(JSON.stringify(body));
}

module.exports._test = {
  normalizeDocumentation,
};
