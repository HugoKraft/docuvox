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
- Anonymisiere Patientennamen.

STRUKTUR:
Du musst IMMER exakt diese 4 Punkte ausgeben:

• Befund aktuell:
• Behandlung:
• Reaktion / Verlauf:
• Ausblick / Empfehlung:

REGELN:
- Jeder Abschnitt MUSS gefüllt sein.
- Wenn Informationen fehlen, ergänze medizinisch sinnvoll.
- Maximal 2 bis 3 kurze Sätze pro Abschnitt.
- Kein Fließtext ohne Struktur.
- Gib ausschließlich das Ausgabeformat zurück.

AUSGABEFORMAT:

Patient X

• Befund aktuell: ...
• Behandlung: ...
• Reaktion / Verlauf: ...
• Ausblick / Empfehlung: ...`;

const REPAIR_PROMPT = `${SYSTEM_PROMPT}

Zusatzauftrag:
Die vorherige Antwort war leer, unvollständig oder nicht exakt im Pflichtformat.
Erstelle sie neu.
Alle vier Abschnitte müssen vorhanden und ausgefüllt sein.`;

module.exports = async function handler(request, response) {
  if (request.method !== "POST") {
    return sendJson(response, 405, { error: "Method not allowed" });
  }

  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) {
    return sendJson(response, 500, {
      error: "KI-Verarbeitung fehlgeschlagen – bitte erneut versuchen.",
      details: "OPENAI_API_KEY ist nicht gesetzt.",
    });
  }

  try {
    const body = await readJsonBody(request);
    const text = String(body.text || "").trim();
    const patientLabel = String(body.patientLabel || "").trim();
    const patientNumber = extractPatientNumber(patientLabel);

    if (!text || !patientLabel || !Number.isInteger(patientNumber)) {
      return sendJson(response, 400, {
        error: "KI-Verarbeitung fehlgeschlagen – bitte erneut versuchen.",
        details: "Body muss text und patientLabel enthalten.",
      });
    }

    const documentation = await createDocumentation({
      apiKey,
      text,
      patientLabel: `Patient ${patientNumber}`,
      patientNumber,
    });

    return sendJson(response, 200, { documentation });
  } catch (error) {
    console.error("DocuVox AI processing failed:", error);
    return sendJson(response, 500, {
      error: "KI-Verarbeitung fehlgeschlagen – bitte erneut versuchen.",
      details: error.message || "OpenAI-Anfrage fehlgeschlagen.",
    });
  }
};

async function createDocumentation({ apiKey, text, patientLabel, patientNumber }) {
  const model = process.env.OPENAI_MODEL || DEFAULT_MODEL;
  const first = await requestOpenAi({
    apiKey,
    model,
    instructions: SYSTEM_PROMPT.replaceAll("Patient X", patientLabel),
    input: createUserInput(text, patientLabel),
  });

  if (hasCompleteSections(first)) {
    return normalizeDocumentation(first, patientNumber);
  }

  const repaired = await requestOpenAi({
    apiKey,
    model,
    instructions: REPAIR_PROMPT.replaceAll("Patient X", patientLabel),
    input: `${createUserInput(text, patientLabel)}\n\nUnvollständige vorherige Antwort:\n${first}`,
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

  const openAiResponse = await fetch(OPENAI_API_URL, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(requestBody),
  });

  const data = await openAiResponse.json().catch(() => ({}));
  if (!openAiResponse.ok) {
    throw new Error(data.error?.message || `OpenAI request failed with ${openAiResponse.status}`);
  }

  const outputText = extractOutputText(data).trim();
  if (!outputText) {
    throw new Error("OpenAI returned an empty documentation");
  }

  return outputText;
}

function createUserInput(text, patientLabel) {
  return `Patient: ${patientLabel}

Rohdiktat:
${text}

Aufgabe:
Erstelle daraus eine professionelle, kurze Physiotherapie-Dokumentation im Pflichtformat.
Schreibe nicht wie gesprochen.
Verdichte den Inhalt fachlich.
Leite Befund, Reaktion und Ausblick therapeutisch sinnvoll ab.
Übernimm keine Patientennamen.
Übernimm das Rohdiktat nicht wortwörtlich.
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
  const sections = Object.fromEntries(
    SECTION_ORDER.map((section) => [section, extractSection(text, section)])
  );

  return `Patient ${patientNumber}

• Befund aktuell: ${ensureText(sections["Befund aktuell"], SECTION_DEFAULTS["Befund aktuell"])}
• Behandlung: ${ensureText(sections.Behandlung, SECTION_DEFAULTS.Behandlung)}
• Reaktion / Verlauf: ${ensureText(sections["Reaktion / Verlauf"], SECTION_DEFAULTS["Reaktion / Verlauf"])}
• Ausblick / Empfehlung: ${ensureText(sections["Ausblick / Empfehlung"], SECTION_DEFAULTS["Ausblick / Empfehlung"])}`;
}

function extractSection(text, sectionName) {
  const escaped = escapeRegExp(sectionName);
  const nextSections = SECTION_ORDER
    .filter((name) => name !== sectionName)
    .map(escapeRegExp)
    .join("|");
  const pattern = new RegExp(`(?:•\\s*)?${escaped}\\s*:\\s*([\\s\\S]*?)(?=\\n\\s*(?:•\\s*)?(?:${nextSections})\\s*:|$)`, "i");
  const match = String(text || "").match(pattern);

  return sanitizeSection(match?.[1] || "");
}

function sanitizeSection(value) {
  return String(value || "")
    .replace(/^[-•\s]+/, "")
    .replace(/\b(wir haben dann|also|eben|eigentlich|quasi|sozusagen)\b/gi, "")
    .replace(/\s+/g, " ")
    .trim();
}

function ensureText(value, fallback) {
  const clean = sanitizeSection(value);
  if (!clean || clean === "..." || clean.length < 4) return fallback;
  return /[.!?]$/.test(clean) ? clean : `${clean}.`;
}

function hasCompleteSections(text) {
  return SECTION_ORDER.every((section) => {
    const value = extractSection(text, section);
    return value.length >= 8 && value !== "...";
  });
}

function extractPatientNumber(patientLabel) {
  const match = String(patientLabel || "").match(/\d+/);
  return match ? Number(match[0]) : NaN;
}

function escapeRegExp(value) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

async function readJsonBody(request) {
  if (request.body && typeof request.body === "object") return request.body;
  if (typeof request.body === "string") return JSON.parse(request.body || "{}");

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
