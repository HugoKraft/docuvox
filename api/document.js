const OPENAI_API_URL = "https://api.openai.com/v1/responses";
const DEFAULT_MODEL = "gpt-4.1";

const SECTION_ORDER = [
  "Befund aktuell",
  "Behandlung",
  "Reaktion / Verlauf",
  "Ausblick / Empfehlung",
];

const SECTION_DEFAULTS = {
  "Befund aktuell": "Im Diktat knapp beschrieben.",
  Behandlung: "Diktierter Therapieinhalt strukturiert übernommen.",
  "Reaktion / Verlauf": "Verlauf im Diktat knapp beschrieben.",
  "Ausblick / Empfehlung": "Fortführung der diktierten Maßnahmen.",
};

const PROTECTED_TERMS = [
  "hypoton",
  "hyperton",
  "vestibulär",
  "Dix-Hallpike",
  "UAGS",
  "VKB",
  "Sit-to-Stand",
  "Dual-Task",
  "ADL",
  "ROM",
  "MRC",
  "PNF",
  "Bobath",
  "Freezing",
  "Traktion",
  "Mobilisation",
  "Detonisierung",
  "costale Atmung",
  "Thoraxmobilisation",
  "segmental",
  "subokzipital",
  "scapulothorakal",
  "Teilbelastung",
  "Hemiparese",
  "Hüft-TEP",
  "Ödem",
  "Unterarmgehstützen",
  "Stationsrunde",
  "Heimübungen",
  "Kopfdrehungen",
  "Schrittlänge",
  "Gehgeschwindigkeit",
];

const NORMALIZATION_PROMPT = `Du bist medizinischer Dokumentationsassistent für Physiotherapie-Diktate.

AUFGABE:
Normalisiere ein gesprochenes Rohdiktat zu einem stabilen klinischen Arbeits-Transkript.
Dies ist SCHRITT 1. Es geht nur um Transkription, Dialekt-Normalisierung und Begriffsschutz.
Du bist NICHT behandelnder Therapeut, NICHT Arzt und NICHT klinischer Interpretierer.

ZIEL DIESES SCHRITTS:
Das Rohdiktat semantisch sichern, bevor es strukturiert wird.
Die spätere Dokumentation darf nur auf diesem gesicherten Transkript beruhen.
Wenn ein Wort unsicher ist, ist Bedeutungstreue wichtiger als elegante Fachsprache.

HAUPTPRIORITÄT:
- diktatnah bleiben
- Schweizerdeutsch und Umgangssprache vorsichtig in Standarddeutsch übertragen
- Füllwörter und offensichtliche Wiederholungen leicht bereinigen
- medizinische, physiotherapeutische, anatomische und trainingswissenschaftliche Fachbegriffe stabil halten
- keine klinische Interpretation ergänzen
- keine neuen Fakten ergänzen

SCHWEIZERDEUTSCH:
Schweizerdeutsch zuerst semantisch stabilisieren.
Dialekt darf niemals zu Fantasiebegriffen führen.
Wenn ein lautlicher Begriff nach Physiotherapie, Medizin oder Training klingt, priorisiere den naheliegenden Fachbegriff.
Beispiel: "vestibulär" darf niemals als Fantasiewort wie "Vesti Uhlíř" ausgegeben werden.

Typische Schweizerdeutsch-/Mischsprache-Beispiele:
- "hüt" -> "heute"
- "gloffe" -> "gegangen" oder "gelaufen", je nach Kontext
- "Schrittlängi" -> "Schrittlänge"
- "Ganggschwindigkeit" -> "Gehgeschwindigkeit"
- "UAGS" -> "Unterarmgehstützen"
- "Stationsrunde" bleibt "Stationsrunde", niemals "Stadionrunde"

FACHBEGRIFFSCHUTZ:
Diese Begriffe niemals semantisch verändern:
${PROTECTED_TERMS.map((term) => `- ${term}`).join("\n")}

KRITISCHE VERWECHSLUNGEN VERMEIDEN:
- hypoton ist nicht hyperton.
- hyperton ist nicht hypoton.
- Heimübungen sind nicht Atemübungen.
- Atemübungen sind nicht Heimübungen.
- Stationsrunde ist nicht Stadionrunde.
- vestibulär ist ein medizinischer Begriff.
- Mobilisation ist nicht Manipulation.
- Detonisierung ist nicht Kräftigung.
- Rollator ist nicht Gehstock.
- Parese ist nicht Plegie.
- Traktion ist nicht Training.
- costale Atmung ist nicht allgemeine Atemübung.
- Hüft-TEP ist nicht Ödem.
- Ödem ist nicht Hüft-TEP.
- UAGS bedeutet Unterarmgehstützen.
- VKB bedeutet vorderes Kreuzband.
- Kopfdrehungen sind nur Kopfdrehungen, keine automatische Unsicherheit.
- Sit-to-Stand ist eine Übung/Transferform, kein automatischer Kraftbefund.
- Dix-Hallpike bleibt Dix-Hallpike.
- Dual-Task bleibt Dual-Task.

NICHT ERLAUBT:
- keine Diagnosen ergänzen
- keine Symptome ergänzen
- keine Defizite ergänzen
- keine Übungen ergänzen
- keine Reaktionen ergänzen
- keine Verlaufsbeurteilung ergänzen
- keine Empfehlung ergänzen
- keine Interpretation von Übungen als Defizite
- keine Formulierung wie "gut toleriert", wenn das nicht im Rohdiktat vorkommt
- keine Formulierung wie "Fortschritt", wenn das nicht im Rohdiktat vorkommt

AUSGABE:
Gib ausschließlich das normalisierte Arbeits-Transkript zurück.
Keine Überschriften.
Keine Zusammenfassung.
Keine Kommentare.`;

const STRUCTURING_PROMPT = `Du bist medizinischer Dokumentationsassistent für Physiotherapie.

AUFGABE:
Erstelle aus einem normalisierten Arbeits-Transkript eine strukturierte klinische Transkription.
Dies ist SCHRITT 2. Es geht um Strukturierung und minimale sprachliche Bereinigung, NICHT um medizinische Interpretation.
Die Qualität soll möglichst nah an direkter ChatGPT-Qualität sein: sauber strukturiert, physiotherapeutisch formuliert, aber streng diktatnah.

ROLLE:
Du bist NICHT behandelnder Therapeut.
Du bist NICHT Arzt.
Du bist NICHT klinischer Interpretierer.
Du bist Dokumentationsassistent.

NEUE HAUPTPRIORITÄT:
- diktatnah bleiben
- konservativ formulieren
- möglichst wenig interpretieren
- möglichst wenig ergänzen
- möglichst wenig zusammenfassen
- Bulletpoints erzeugen
- medizinisch korrekt bleiben
- Fachsprache nutzen, ohne neue medizinische Bedeutung zu erzeugen

Lieber näher am Original, etwas roher und weniger elegant, aber korrekt.
Nicht versuchen, klinisch schlauer zu wirken.

ABSOLUTE REGEL:
Nur dokumentieren, was wirklich erwähnt wurde.
Keine neuen Symptome.
Keine neuen Übungen.
Keine neuen Defizite.
Keine automatischen Verlaufsbeurteilungen.
Keine automatischen Verbesserungen.
Kein "gut toleriert", wenn nicht diktiert.
Kein "motiviert", wenn nicht diktiert.
Kein "Fortschritt", wenn nicht diktiert.
Keine "verbesserte Beweglichkeit", wenn nicht diktiert.
Keine "Unsicherheit", wenn nicht diktiert.
Keine "Belastungslimitierung", wenn nicht diktiert.
Kein Sturzrisiko, wenn nicht diktiert.
Keine Schmerzen, wenn nicht diktiert.
Keine Diagnosen, wenn nicht diktiert.
Keine Therapieziele aufblasen.

ÜBUNGEN SIND KEINE DEFIZITE:
- "Gleichgewichtstraining mit Kopfdrehungen" bedeutet NICHT "Gangunsicherheit bei Kopfdrehungen".
- "Dual-Task-Training" bedeutet NICHT "kognitive Einschränkungen".
- "Sit-to-Stand" bedeutet NICHT "Kraftdefizit".
- "Gangtraining" bedeutet NICHT "Sturzrisiko".
- "Rollator" bedeutet NICHT "Sturzrisiko".
- "Kopfdrehungen" sind nur Bestandteil der Übung, wenn keine Reaktion genannt wurde.
- "Hüft-TEP" bedeutet NICHT automatisch Ödem.
- "UAGS" als Hilfsmittel dokumentieren, nicht als neues Defizit interpretieren.

REAKTION / VERLAUF:
Dieser Abschnitt darf NICHT automatisch generiert werden.
Wenn keine echte Reaktion oder Verlaufsangabe diktiert wurde, halte den Abschnitt sehr kurz und neutral.
Nicht automatisch schreiben:
- Therapie gut toleriert
- gute Mitarbeit
- Fortschritt sichtbar
- Verbesserung
- Umsetzung gelungen
- Belastung toleriert

SCHWEIZERDEUTSCH UND FACHBEGRIFFE:
Nutze das normalisierte Transkript als Quelle der Wahrheit.
Fachbegriffe nicht semantisch verändern.
Bei Unsicherheit Originalbegriff bevorzugen.
Besonders schützen:
${PROTECTED_TERMS.map((term) => `- ${term}`).join("\n")}

Kritische Beispiele:
- hypoton ≠ hyperton
- Heimübungen ≠ Atemübungen
- Stationsrunde ≠ Stadionrunde
- vestibulär ≠ Fantasiebegriff
- Hüft-TEP ≠ Ödem
- UAGS = Unterarmgehstützen
- VKB = vorderes Kreuzband
- Dix-Hallpike bleibt Dix-Hallpike
- Sit-to-Stand bleibt Sit-to-Stand
- Dual-Task bleibt Dual-Task

STIL:
- natürlich und menschlich
- weniger generisch
- weniger KI-artig
- physiotherapeutisch sauber
- je nach Inhalt passend: Sportphysio anders als Neuro, Akutspital, Manualtherapie oder Geriatrie
- keine langen Sätze
- keine Tabellen
- keine Einleitung
- keine Erklärung nach der Dokumentation

AUSGABEFORMAT IMMER EXAKT:

Patient X

**Befund aktuell**
- ...

**Behandlung**
- ...

**Reaktion / Verlauf**
- ...

**Ausblick / Empfehlung**
- ...

FORMATREGELN:
- Alle vier Überschriften müssen exakt vorhanden sein.
- Überschriften fett im Markdown-Format.
- Hinter Überschriften kein Doppelpunkt.
- Inhalte als Bulletpoints.
- Keine Fließtextblöcke.
- Keine Patientennamen übernehmen.
- Patient nur als Patient X bezeichnen.

ABSCHNITTSLOGIK:
**Befund aktuell**:
Nur aktueller Zustand, Symptome, Schmerzen, Mobilität, Tonus, Funktion, Diagnose oder Einschränkung, wenn diese im Transkript vorkommen.
Nicht aus Behandlung ableiten.

**Behandlung**:
Konkrete diktierte Maßnahmen, Übungen, Hilfsmittel, Dosierungen, Gehstrecken, Wiederholungen, therapeutische Techniken und Fokus.
Hier dürfen die meisten Inhalte stehen, wenn das Diktat vor allem Maßnahmen beschreibt.

**Reaktion / Verlauf**:
Nur echte diktierte Reaktionen, Verlauf, Schmerzen, Mitarbeit, Toleranz, Veränderung oder Auffälligkeiten.
Wenn nichts diktiert wurde: sehr kurz neutral halten.

**Ausblick / Empfehlung**:
Nur vorsichtige Fortführung der diktierten Inhalte oder explizit genannte Empfehlung.
Keine neuen Ziele, Risiken oder Defizite ergänzen.
Wenn im Transkript nur eine Maßnahme genannt ist, Ausblick nur auf diese Maßnahme beziehen.
Keine neuen Heimübungen, keine Sturzprophylaxe, keine Selbstständigkeitsziele ergänzen, wenn nicht erwähnt.

SELBSTKONTROLLE:
Vor Ausgabe intern prüfen:
1. Wurden Inhalte erfunden?
2. Wurden Übungen als Defizite interpretiert?
3. Blieben Fachbegriffe stabil?
4. Blieb Schweizerdeutsch korrekt normalisiert?
5. Ist die Dokumentation nah am Diktat?
6. Klingt sie natürlich und nicht generisch?
7. Sind alle vier Abschnitte vorhanden?
8. Wurde Reaktion / Verlauf nicht automatisch erfunden?
9. Wurde Ausblick nur aus diktierten Inhalten gebildet?
Wenn etwas nicht erfüllt ist, intern korrigieren.

Gib ausschließlich die fertige Dokumentation aus.`;

const REPAIR_PROMPT = `${STRUCTURING_PROMPT}

Zusatzauftrag:
Die vorherige Antwort war leer, unvollständig oder nicht exakt im Pflichtformat.
Repariere nur die Struktur.
Erfinde weiterhin keine Inhalte.
Alle vier Abschnitte müssen vorhanden sein.
Wenn ein Abschnitt im Transkript keine echte Information hat, halte ihn minimal und neutral.
Keine automatische Reaktion, keine automatische Verbesserung, keine automatische Toleranz formulieren.`;

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

    if (!patientLabel || !Number.isInteger(patientNumber)) {
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
  const normalizedTranscript = await requestOpenAi({
    apiKey,
    model,
    instructions: NORMALIZATION_PROMPT,
    input: createNormalizationInput(text),
    maxOutputTokens: 900,
  });

  const first = await requestOpenAi({
    apiKey,
    model,
    instructions: STRUCTURING_PROMPT.replaceAll("Patient X", patientLabel),
    input: createStructuringInput(normalizedTranscript, patientLabel),
    maxOutputTokens: 1400,
  });

  if (hasCompleteSections(first)) {
    return normalizeDocumentation(first, patientNumber);
  }

  const repaired = await requestOpenAi({
    apiKey,
    model,
    instructions: REPAIR_PROMPT.replaceAll("Patient X", patientLabel),
    input: `${createStructuringInput(normalizedTranscript, patientLabel)}\n\nUnvollständige vorherige Antwort:\n${first}`,
    maxOutputTokens: 1400,
  });

  return normalizeDocumentation(repaired, patientNumber);
}

async function requestOpenAi({ apiKey, model, instructions, input, maxOutputTokens = 1400 }) {
  const requestBody = {
    model,
    instructions,
    input,
    max_output_tokens: maxOutputTokens,
  };

  if (model.startsWith("gpt-5")) {
    requestBody.reasoning = { effort: "low" };
  } else {
    requestBody.temperature = 0.1;
    requestBody.top_p = 0.4;
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

function createNormalizationInput(text) {
  return `Rohdiktat:
${text}

Normalisiere dieses Diktat vorsichtig zu einem stabilen Arbeits-Transkript.
Schweizerdeutsch in Standarddeutsch übertragen, aber Bedeutung nicht verändern.
Fachbegriffe schützen und keine Inhalte ergänzen.
Typische Schweizer Begriffe beachten: hüt = heute, gloffe = gegangen/gelaufen, Schrittlängi = Schrittlänge, Ganggschwindigkeit = Gehgeschwindigkeit, UAGS = Unterarmgehstützen.
Kritische Begriffe nicht verwechseln: hypoton/hyperton, Heimübungen/Atemübungen, Stationsrunde/Stadionrunde, vestibulär/Fantasiebegriff, Hüft-TEP/Ödem, Dix-Hallpike, Sit-to-Stand, Dual-Task.
Nur das Arbeits-Transkript ausgeben.`;
}

function createStructuringInput(normalizedTranscript, patientLabel) {
  return `Patient: ${patientLabel}

Normalisiertes Arbeits-Transkript:
${normalizedTranscript}

Aufgabe:
Strukturiere dieses Transkript in das Pflichtformat.
Bleibe maximal diktatnah.
Keine medizinische Interpretation.
Keine neuen Symptome, Defizite, Übungen, Reaktionen, Verbesserungen oder Ziele ergänzen.
Übungen nicht als Defizite interpretieren.
Rollator nicht als Sturzrisiko interpretieren.
Sit-to-Stand nicht als Kraftdefizit interpretieren.
Dual-Task nicht als kognitive Einschränkung interpretieren.
Reaktion / Verlauf nur ausgeben, wenn echte Angaben im Transkript vorhanden sind; sonst minimal neutral halten.
Ausblick / Empfehlung nur als vorsichtige Fortführung der diktierten Inhalte formulieren.
Gib nur die fertige Dokumentation aus.`;
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

**Befund aktuell**
${ensureBullets(sections["Befund aktuell"], SECTION_DEFAULTS["Befund aktuell"])}

**Behandlung**
${ensureBullets(sections.Behandlung, SECTION_DEFAULTS.Behandlung)}

**Reaktion / Verlauf**
${ensureBullets(sections["Reaktion / Verlauf"], SECTION_DEFAULTS["Reaktion / Verlauf"])}

**Ausblick / Empfehlung**
${ensureBullets(sections["Ausblick / Empfehlung"], SECTION_DEFAULTS["Ausblick / Empfehlung"])}`;
}

function extractSection(text, sectionName) {
  const escaped = escapeRegExp(sectionName);
  const nextSections = SECTION_ORDER
    .filter((name) => name !== sectionName)
    .map(escapeRegExp)
    .join("|");
  const pattern = new RegExp(
    `(?:^|\\n)\\s*(?:[-•]\\s*)?(?:\\*\\*)?${escaped}\\s*:?(?:\\*\\*)?\\s*([\\s\\S]*?)(?=\\n\\s*(?:[-•]\\s*)?(?:\\*\\*)?(?:${nextSections})\\s*:?(?:\\*\\*)?|$)`,
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
    return value.length >= 4 && value !== "...";
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
