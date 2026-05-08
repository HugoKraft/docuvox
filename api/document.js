const OPENAI_API_URL = "https://api.openai.com/v1/responses";
const DEFAULT_MODEL = "gpt-4.1";

const SECTION_ORDER = [
  "Befund aktuell",
  "Behandlung",
  "Reaktion / Verlauf",
  "Ausblick / Empfehlung",
];

const SECTION_DEFAULTS = {
  "Befund aktuell": "Aktueller Befund im Diktat nicht eindeutig beschrieben; funktionelle Ausgangslage weiter beobachten.",
  Behandlung: "Therapeutische Behandlung entsprechend dem dokumentierten Therapieziel durchgeführt.",
  "Reaktion / Verlauf": "Reaktion auf die Behandlung im Diktat nicht eindeutig beschrieben; Belastbarkeit und Verlauf weiter beobachten.",
  "Ausblick / Empfehlung": "Weiterführung der Therapie mit Fokus auf Funktion, Sicherheit, Belastbarkeit und Selbstständigkeit.",
};

const SYSTEM_PROMPT = `Du bist ein erfahrener Physiotherapeut mit sehr guter Dokumentationsroutine. Du erstellst aus gesprochenen Behandlungsdiktaten professionelle, natürliche und fachlich präzise Physiotherapie-Dokumentationen.

WICHTIG:
- Schreibe NICHT wie gesprochen.
- Formuliere fachlich, klar, natürlich, praxisnah und therapiebezogen.
- Verdichte den Inhalt sinnvoll, aber kürze NICHT zu stark.
- Erhalte konkrete relevante Inhalte aus dem Diktat möglichst vollständig.
- Keine relevanten Angaben verlieren, insbesondere Mobilität, Gehstrecke, Hilfsmittel, Gangbild, Transfers, Treppen, Kraft, Gleichgewicht, Koordination, Schmerzen, NRS, Lokalisation, Übungen, Wiederholungen, Theraband, Geräte, Tonus, Spastik, ROM, Reaktion, Fortschritt, Rückschritt, Heimübungen, Sturzprophylaxe, Gangsicherheit und Selbstständigkeit.
- Entferne Füllwörter.
- Keine Wiederholungen.
- Verwende medizinisch saubere Sprache, aber nicht künstlich oder übertrieben.
- Leite den aktuellen Befund aktiv aus dem Diktat ab.
- Vermeide generische Standardsätze, wenn konkrete Inhalte vorhanden sind.
- Übernimm den Rohtext niemals direkt.
- Patientennamen niemals übernehmen.
- Volle Namen automatisch anonymisieren: entweder Initialen verwenden oder neutral als Patient X formulieren.
- Keine Diagnosen frei erfinden. Wenn Angaben fehlen, fachlich vorsichtig ableiten oder neutral dokumentieren.

STRUKTUR:
Du musst IMMER exakt diese 4 fett markierten Überschriften ausgeben:

**Befund aktuell:**
**Behandlung:**
**Reaktion / Verlauf:**
**Ausblick / Empfehlung:**

REGELN:
- Jeder Abschnitt MUSS gefüllt sein.
- Wenn Informationen fehlen, ergänze fachlich vorsichtig, aber erfinde keine konkreten Werte.
- Pro Abschnitt 1 bis 4 übersichtliche Bullet Points.
- Nutze bei mehreren Angaben mehrere kurze Bullet Points.
- Die Sprache soll wie eine hochwertige ChatGPT-Physio-Dokumentation wirken: konkret, therapeutisch, lesbar und praxisnah.
- Schreibe ausführlicher als eine Minimalnotiz, aber weiterhin prägnant.
- Kein Fließtext ohne Struktur.
- Überschriften müssen exakt im Markdown-Fettformat stehen.
- Gib ausschließlich das Ausgabeformat zurück.

AUSGABEFORMAT:

Patient X

**Befund aktuell:**
- ...

**Behandlung:**
- ...

**Reaktion / Verlauf:**
- ...

**Ausblick / Empfehlung:**
- ...`;

const REPAIR_PROMPT = `${SYSTEM_PROMPT}

Zusatzauftrag:
Die vorherige Antwort war leer, unvollständig oder nicht exakt im Pflichtformat.
Erstelle sie neu.
Alle vier Abschnitte müssen vorhanden und ausgefüllt sein.
Nutze exakt die Markdown-fetten Überschriften und darunter Bullet Points.
Keine relevanten Inhalte aus dem Rohdiktat verlieren.`;

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
    max_output_tokens: 1600,
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
Erstelle daraus eine professionelle Physiotherapie-Dokumentation im Pflichtformat.
Schreibe nicht wie gesprochen.
Verdichte den Inhalt fachlich, aber erhalte konkrete relevante Details vollständig.
Leite Befund, Reaktion und Ausblick therapeutisch sinnvoll ab.
Übernimm keine Patientennamen.
Übernimm das Rohdiktat nicht wortwörtlich.
Fülle alle vier Abschnitte aus.
Verwende innerhalb der Abschnitte saubere Bullet Points.
Verwende exakt Markdown-fette Überschriften.
Vermeide generische Standardsätze, wenn konkrete Angaben aus dem Diktat vorhanden sind.
Wenn Informationen fehlen, vorsichtig ableiten oder neutral dokumentieren, aber keine konkreten Werte erfinden.`;
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

**Befund aktuell:**
${ensureBullets(sections["Befund aktuell"], SECTION_DEFAULTS["Befund aktuell"])}

**Behandlung:**
${ensureBullets(sections.Behandlung, SECTION_DEFAULTS.Behandlung)}

**Reaktion / Verlauf:**
${ensureBullets(sections["Reaktion / Verlauf"], SECTION_DEFAULTS["Reaktion / Verlauf"])}

**Ausblick / Empfehlung:**
${ensureBullets(sections["Ausblick / Empfehlung"], SECTION_DEFAULTS["Ausblick / Empfehlung"])}`;
}

function extractSection(text, sectionName) {
  const escaped = escapeRegExp(sectionName);
  const nextSections = SECTION_ORDER
    .filter((name) => name !== sectionName)
    .map(escapeRegExp)
    .join("|");
  const pattern = new RegExp(
    `(?:^|\\n)\\s*(?:[-•]\\s*)?(?:\\*\\*)?${escaped}\\s*:(?:\\*\\*)?\\s*([\\s\\S]*?)(?=\\n\\s*(?:[-•]\\s*)?(?:\\*\\*)?(?:${nextSections})\\s*:(?:\\*\\*)?|$)`,
    "i"
  );
  const match = String(text || "").match(pattern);

  return sanitizeSection(match?.[1] || "");
}

function sanitizeSection(value) {
  return String(value || "")
    .replace(/\b(wir haben dann|also|eben|eigentlich|quasi|sozusagen)\b/gi, "")
    .replace(/\b(Herr|Frau)\s+[A-ZÄÖÜ][a-zäöüß]+(?:\s+[A-ZÄÖÜ][a-zäöüß]+)+/g, "Patient")
    .replace(/\r/g, "")
    .replace(/[ \t]+/g, " ")
    .replace(/\n{3,}/g, "\n\n")
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
    .map((line) => line.replace(/^[-•]\s*/, "").trim())
    .filter(Boolean);

  if (lines.length) {
    return lines.map((line) => `- ${ensureText(line, fallback)}`).join("\n");
  }

  return `- ${ensureText(source, fallback)}`;
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
