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

    if (isNearlyEmptyText(text)) {
      return sendJson(response, 400, {
        error: "KI-Verarbeitung fehlgeschlagen – bitte erneut versuchen.",
        details: "Das Rohdiktat ist zu kurz für eine fachlich saubere Dokumentation.",
      });
    }

    const redactedText = redactPiiFromTranscript(text);

    const documentation = await createDocumentation({
      apiKey,
      text: redactedText,
      patientLabel: `Patient ${patientNumber}`,
      patientNumber,
    });

    return sendJson(response, 200, { documentation });
  } catch (error) {
    console.error("DocuVox AI processing failed:", {
      name: error?.name || "Error",
    });
    return sendJson(response, 500, {
      error: "KI-Verarbeitung fehlgeschlagen – bitte erneut versuchen.",
      details: "OpenAI-Anfrage fehlgeschlagen.",
    });
  }
};

module.exports.redactPiiFromTranscript = redactPiiFromTranscript;

function redactPiiFromTranscript(value) {
  if (typeof value !== "string") {
    throw new TypeError("Transcript must be a string");
  }

  let text = value;

  text = text.replace(
    /\b[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}\b/gi,
    "[EMAIL ENTFERNT]"
  );

  text = text.replace(
    /\b(?:AHV(?:-?(?:Nummer|Nr\.))?\s*[:#-]?\s*)?756(?:[.\s-]?\d{4}){2}[.\s-]?\d{2}\b/gi,
    "[AHV ENTFERNT]"
  );

  text = redactContextualReferenceNumbers(text);
  text = redactAddresses(text);

  text = text.replace(
    /(?<!\d)(?:(?:\+|00)41(?:\s*\(0\))?[\s.-]*\d{2}|0(?:2[1-9]|3[1-4]|4[1-4]|5[1-8]|6[1-2]|7[5-9]|8[1-4]|9[1]))(?:[\s.-]*\d){7}(?!\d)/g,
    "[TELEFON ENTFERNT]"
  );

  text = redactBirthDates(text);

  text = text
    .replace(
      /\b(?:Alter\s*[:=]?\s*)\d{1,3}\b/gi,
      "[ALTER ENTFERNT]"
    )
    .replace(
      /\b\d{1,3}\s*(?:Jahre?(?:\s*alt)?|[-\s]?jährig(?:e|er|en|es)?)\b/gi,
      "[ALTER ENTFERNT]"
    )
    .replace(
      /\b((?:Patient|Patientin)\s+ist\s+)\d{1,3}\b(?!\s*(?:kg|m|cm|mm|Grad|°|Minuten?|Stunden?|Tage?|Wochen?|Wiederholungen?|Stufen?|Serien?))/gi,
      "$1[ALTER ENTFERNT]"
    );

  text = text.replace(
    /\b(?:Herr|Frau)\s+(?:(?:Dr\.?|Prof\.?)\s+)?[A-ZÄÖÜ][A-Za-zÄÖÜäöüß'’-]*(?:\s+[A-ZÄÖÜ][A-Za-zÄÖÜäöüß'’-]*)?\b/g,
    "[NAME ENTFERNT]"
  );

  return text
    .replace(/[ \t]{2,}/g, " ")
    .replace(/\s+([,.;:!?])/g, "$1")
    .replace(/\n[ \t]+/g, "\n")
    .trim();
}

function redactContextualReferenceNumbers(text) {
  const references = [
    {
      label: "PATIENTENNUMMER",
      pattern: /\b(?:Patientennummer|Patienten(?:-|\s)?Nr\.?|Patienten(?:-|\s)?ID)\s*[:#-]?\s*[A-Z0-9][A-Z0-9./_-]{2,}\b/gi,
    },
    {
      label: "AKTENNUMMER",
      pattern: /\b(?:Aktennummer|Akten(?:-|\s)?Nr\.?)\s*[:#-]?\s*[A-Z0-9][A-Z0-9./_-]{2,}\b/gi,
    },
    {
      label: "FALLNUMMER",
      pattern: /\b(?:Fallnummer|Fall(?:-|\s)?Nr\.?|Fall(?:-|\s)?ID)\s*[:#-]?\s*[A-Z0-9][A-Z0-9./_-]{2,}\b/gi,
    },
    {
      label: "DOSSIERNUMMER",
      pattern: /\b(?:Dossiernummer|Dossier(?:-|\s)?Nr\.?)\s*[:#-]?\s*[A-Z0-9][A-Z0-9./_-]{2,}\b/gi,
    },
    {
      label: "VERSICHERTENNUMMER",
      pattern: /\b(?:Versichertennummer|Versicherten(?:-|\s)?Nr\.?|Versicherungsnummer|Versicherungs(?:-|\s)?Nr\.?|Policennummer|Policen(?:-|\s)?Nr\.?)\s*[:#-]?\s*[A-Z0-9][A-Z0-9./_-]{2,}\b/gi,
    },
  ];

  return references.reduce(
    (result, { label, pattern }) => result.replace(pattern, `[${label} ENTFERNT]`),
    text
  );
}

function redactAddresses(text) {
  const streetName = String.raw`[A-ZÄÖÜ][A-Za-zÄÖÜäöüß'’-]*(?:[ -][A-ZÄÖÜ][A-Za-zÄÖÜäöüß'’-]*){0,2}`;
  const streetType = String.raw`(?:straße|strasse|weg|gasse|platz)`;
  const houseNumber = String.raw`\d{1,4}[a-zA-Z]?`;
  const postalCity = String.raw`(?:\s*,?\s*\d{4}\s+[A-ZÄÖÜ][A-Za-zÄÖÜäöüß'’.-]*(?:\s+[A-ZÄÖÜ][A-Za-zÄÖÜäöüß'’.-]*){0,2})?`;
  const addressPattern = new RegExp(
    String.raw`\b${streetName}${streetType}\s+${houseNumber}${postalCity}`,
    "gi"
  );

  return text
    .replace(
      /\bAdresse\s*[:#-]?\s*[^,;\n.]{3,80}(?:,\s*\d{4}\s+[A-ZÄÖÜ][A-Za-zÄÖÜäöüß'’.-]*(?:\s+[A-ZÄÖÜ][A-Za-zÄÖÜäöüß'’.-]*){0,2})?/gi,
      "[ADRESSE ENTFERNT]"
    )
    .replace(addressPattern, "[ADRESSE ENTFERNT]");
}

function redactBirthDates(text) {
  const numericDate = /\b(?:0?[1-9]|[12]\d|3[01])[.\/-](?:0?[1-9]|1[0-2])[.\/-](?:19|20)\d{2}\b/g;
  const writtenDate = /\b(?:0?[1-9]|[12]\d|3[01])\.?\s+(?:Januar|Februar|März|Maerz|April|Mai|Juni|Juli|August|September|Oktober|November|Dezember)\s+(?:19|20)\d{2}\b/gi;

  return text
    .replace(numericDate, (match, offset, source) =>
      shouldKeepClinicalDate(source, offset) ? match : "[GEBURTSDATUM ENTFERNT]"
    )
    .replace(writtenDate, (match, offset, source) =>
      shouldKeepClinicalDate(source, offset) ? match : "[GEBURTSDATUM ENTFERNT]"
    );
}

function shouldKeepClinicalDate(source, offset) {
  const context = source.slice(Math.max(0, offset - 45), offset).toLowerCase();
  const birthContext = /(?:geboren(?:\s+am)?|geburtsdatum|geburtsdaten|jahrgang)\s*[:#-]?\s*$/.test(
    context
  );
  if (birthContext) return false;

  return /(?:operation|op|behandlung|therapie|termin|kontrolle|untersuchung|unfall|eintritt|austritt)\s*(?:war|ist|am|vom|seit|:|-)?\s*$/.test(
    context
  );
}

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

function ensureBullets(value, fallback) {
  const clean = sanitizeSection(value);
  const source = !clean || clean === "..." || clean.length < 4 ? fallback : clean;
  const lines = source
    .split(/\n+/)
    .map((line) => line.replace(/^[-•*]\s*/, "").trim())
    .filter(Boolean);

  if (lines.length) {
    return lines.map((line) => `- ${ensureText(line, fallback)}`).join("\n");
  }

  return `- ${ensureText(source, fallback)}`;
}

function isNearlyEmptyText(text) {
  const clean = String(text || "")
    .replace(/[.,;:!?()\-[\]{}]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
  return clean.length < 8 || clean.split(" ").filter(Boolean).length < 2;
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
