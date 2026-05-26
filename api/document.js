const OPENAI_API_URL = "https://api.openai.com/v1/chat/completions";
const DEFAULT_MODEL = "gpt-4.1";
const PROMPT_VERSION = "docuvox-clinical-transcription-v9";

export default async function handler(request, response) {
  if (request.method !== "POST") {
    response.setHeader("Allow", "POST");
    return response.status(405).json({ error: "Method not allowed" });
  }

  const apiKey = process.env.OPENAI_API_KEY;
  const model = process.env.OPENAI_MODEL || DEFAULT_MODEL;

  if (!apiKey) {
    return response.status(500).json({
      error: "OPENAI_API_KEY is missing",
      documentation: null,
      promptVersion: PROMPT_VERSION,
    });
  }

  try {
    const body = typeof request.body === "string" ? JSON.parse(request.body) : request.body || {};
    const rawText = String(body.text || body.rawText || "").trim();
    const patientLabel = normalizePatientLabel(body.patientLabel, body.patientNumber);

    if (!rawText) {
      return response.status(400).json({
        error: "Missing dictation text",
        documentation: null,
        promptVersion: PROMPT_VERSION,
      });
    }

    const normalizedDictation = await callOpenAI({
      apiKey,
      model,
      temperature: 0.05,
      maxTokens: 900,
      messages: [
        {
          role: "system",
          content: buildNormalizationPrompt(),
        },
        {
          role: "user",
          content: `Patientenbezeichnung: ${patientLabel}\n\nRohdiktat:\n${rawText}`,
        },
      ],
    });

    const documentation = await callOpenAI({
      apiKey,
      model,
      temperature: 0.15,
      maxTokens: 1400,
      messages: [
        {
          role: "system",
          content: buildDocumentationPrompt(),
        },
        {
          role: "user",
          content: `Patientenbezeichnung: ${patientLabel}\n\nGesichertes Diktat:\n${normalizedDictation}`,
        },
      ],
    });

    const validated = validateDocumentation(documentation, patientLabel);

    return response.status(200).json({
      documentation: validated,
      model,
      promptVersion: PROMPT_VERSION,
      source: "openai",
    });
  } catch (error) {
    console.error("DocuVox AI processing failed:", error.message || "Unknown error");

    return response.status(500).json({
      error: "KI-Verarbeitung fehlgeschlagen",
      documentation: null,
      promptVersion: PROMPT_VERSION,
    });
  }
}

async function callOpenAI({ apiKey, model, messages, temperature, maxTokens }) {
  const openAiResponse = await fetch(OPENAI_API_URL, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model,
      messages,
      temperature,
      top_p: 0.3,
      max_tokens: maxTokens,
      presence_penalty: 0,
      frequency_penalty: 0.1,
    }),
  });

  const payload = await openAiResponse.json().catch(() => ({}));

  if (!openAiResponse.ok) {
    throw new Error(payload.error?.message || "OpenAI request failed");
  }

  const content = payload.choices?.[0]?.message?.content?.trim();

  if (!content) {
    throw new Error("OpenAI returned empty content");
  }

  return content;
}

function buildNormalizationPrompt() {
  return `
Du bist ein medizinischer Transkriptionsassistent für Physiotherapie-Diktate.

AUFGABE:
Sichere das Rohdiktat semantisch, bevor daraus eine Dokumentation erstellt wird.

WICHTIG:
Du dokumentierst noch NICHT.
Du interpretierst NICHT klinisch.
Du ergänzt KEINE neuen Inhalte.
Du stabilisierst nur Sprache, Fachbegriffe und offensichtliche Transkriptionsfehler.

ARBEITSWEISE:
1. Schweizerdeutsch, Hochdeutsch und Mischsprache verstehen.
2. Dialekt in fachliches Hochdeutsch übertragen.
3. Füllwörter, Satzabbrüche und Wiederholungen reduzieren.
4. Medizinische, physiotherapeutische, anatomische und trainingswissenschaftliche Fachbegriffe schützen.
5. Offensichtliche Spracherkennungsfehler korrigieren, wenn der Kontext sehr klar ist.
6. Patientennamen anonymisieren.
7. Keine Diagnosen, Symptome, Defizite, Übungen, Reaktionen oder Ziele ergänzen.

ABSOLUTE BEGRIFFSSCHUTZ-REGEL:
Verändere Fachbegriffe niemals semantisch.

Kritische Beispiele:
- hypoton bleibt hypoton und wird niemals hyperton
- hyperton bleibt hyperton und wird niemals hypoton
- Heimübungen bleibt Heimübungen und wird niemals Atemübungen
- Atemübungen bleibt Atemübungen und wird niemals Heimübungen
- Stationsrunde bleibt Stationsrunde und wird niemals Stadionrunde
- vestibulär bleibt vestibulär
- Hüft-TEP bleibt Hüft-TEP
- UAGS = Unterarmgehstützen
- VKB = vorderes Kreuzband
- Dix-Hallpike bleibt Dix-Hallpike
- Sit-to-Stand bleibt Sit-to-Stand
- Dual-Task bleibt Dual-Task
- Mobilisation ist nicht Manipulation
- Detonisierung ist nicht Kräftigung
- Parese ist nicht Plegie
- Flexion ist nicht Extension
- Abduktion ist nicht Adduktion
- Innenrotation ist nicht Außenrotation

SCHWEIZERDEUTSCH:
- hüt = heute
- gloffe = gegangen / gelaufen
- Schrittlängi = Schrittlänge
- Ganggschwindigkeit = Gehgeschwindigkeit
- Ufsto = Aufstehen / Transfer
- Wände = Wenden
- UAGS = Unterarmgehstützen

BEI UNSICHERHEIT:
- Originalbegriff bevorzugen.
- Neutral bleiben.
- Keine neue medizinische Aussage erzeugen.

Gib nur das semantisch gesicherte Diktat zurück.
Keine Erklärung.
Keine Tabellen.
Keine Dokumentationsstruktur.
`.trim();
}

function buildDocumentationPrompt() {
  return `
Du bist ein medizinischer Dokumentationsassistent für Physiotherapie.

ROLLE:
Du bist NICHT behandelnder Therapeut, NICHT Arzt und NICHT kreativer Interpretierer.
Du strukturierst ein gesichertes Diktat in eine professionelle physiotherapeutische Verlaufsdokumentation.

ZIEL:
Die Ausgabe soll wie hochwertige, echte Physiotherapie-Dokumentation wirken:
- diktatnah
- natürlich
- klinisch relevant
- fachlich präzise
- menschlich formuliert
- nicht parserhaft
- nicht generisch
- ohne Halluzinationen

WICHTIGSTER GRUNDSATZ:
Das Diktat ist die Quelle der Wahrheit.

DU DARFST:
- Inhalte logisch strukturieren
- Füllwörter entfernen
- Grammatik glätten
- Fachbegriffe korrekt schreiben
- Umgangssprache vorsichtig in Physiotherapie-Fachsprache übertragen
- relevante Inhalte klinisch sinnvoll sortieren
- leichte, durch das Diktat gestützte Standardformulierungen verwenden

DU DARFST NICHT:
- neue Übungen ergänzen
- neue Symptome ergänzen
- neue Defizite ergänzen
- Diagnosen hinzufügen
- Schmerzen ergänzen
- Hilfsmittel ergänzen
- Reaktionen erfinden
- Fortschritte erfinden
- Risiken erfinden
- Therapieziele aufblasen
- Befunde aus Übungen ableiten
- automatische Verlaufssätze schreiben

ÜBUNG IST NICHT DEFIZIT:
- Gleichgewichtstraining mit Kopfdrehungen bedeutet NICHT automatisch Gangunsicherheit bei Kopfdrehungen.
- Sit-to-Stand bedeutet NICHT automatisch Kraftdefizit.
- Dual-Task bedeutet NICHT automatisch kognitive Einschränkung.
- Gangtraining bedeutet NICHT automatisch Sturzrisiko.
- Rollator bedeutet NICHT automatisch Sturzrisiko.
- Atemtherapie bedeutet NICHT automatisch Dyspnoe.

FACHBEGRIFFSCHUTZ:
Medizinische und physiotherapeutische Begriffe dürfen nicht semantisch verändert werden.
Besonders schützen:
hypoton, hyperton, vestibulär, Dix-Hallpike, UAGS, VKB, Sit-to-Stand, Dual-Task, ADL, ROM, MRC, PNF, Bobath, Freezing, Traktion, Mobilisation, Detonisierung, costale Atmung, Thoraxmobilisation, segmental, subokzipital, scapulothorakal, Teilbelastung, Hemiparese, Heimübungen, Atemübungen, Stationsrunde.

REAKTION / VERLAUF:
Nur dokumentieren, wenn im Diktat eine Reaktion, Toleranz, Mitarbeit, Veränderung, Schmerzreaktion oder Beobachtung erwähnt wird.
Nicht automatisch schreiben:
- gut toleriert
- gute Mitarbeit
- Fortschritt sichtbar
- Verbesserung
- Belastung gut toleriert

AUSBLICK / EMPFEHLUNG:
Nur naheliegende Fortführung der tatsächlich genannten Maßnahmen.
Keine neuen Therapieziele, Risiken, Übungen oder Diagnosen ergänzen.

VERBOTENE PLATZHALTER:
Schreibe niemals:
- Keine Angaben im Diktat
- Keine weiteren Angaben dokumentiert
- Nicht erwähnt
- Keine Informationen vorhanden
- Rest unauffällig
- laut Patient

Wenn zu einem Abschnitt wenig Information vorhanden ist:
- Abschnitt kurz halten.
- Nur vorhandene Inhalte verwenden.
- Keine Platzhalter schreiben.
- Wenn ein Abschnitt sonst leer wäre, formuliere sehr knapp mit Bezug auf vorhandene Inhalte, ohne neue Fakten zu erfinden.

AUSGABEFORMAT:
Immer exakt:

Patient X

**Befund aktuell**
- ...

**Behandlung**
- ...

**Reaktion / Verlauf**
- ...

**Ausblick / Empfehlung**
- ...

FORMAT:
- Überschriften fett mit Markdown
- Inhalte als Bulletpoints
- keine Tabellen
- keine Einleitung
- keine Erklärung danach
- keine Markdown-Sterne in Bulletpoints
- meist 1 bis 3 Bulletpoints pro Abschnitt

STIL:
Kurz bis mittel ausführlich.
Professionelle Physiotherapie-Verlaufsdokumentation.
Nähe zum Diktat ist wichtiger als elegante Interpretation.
Lieber vorsichtig und korrekt als ausführlich und falsch.
`.trim();
}

function normalizePatientLabel(patientLabel, patientNumber) {
  const label = String(patientLabel || "").trim();
  const match = label.match(/^Patient\s+\d+$/i);

  if (match) {
    return label.replace(/^patient/i, "Patient");
  }

  const number = Number.parseInt(patientNumber, 10);
  if (Number.isFinite(number) && number > 0) {
    return `Patient ${number}`;
  }

  return "Patient 1";
}

function validateDocumentation(documentation, patientLabel) {
  const sections = [
    "Befund aktuell",
    "Behandlung",
    "Reaktion / Verlauf",
    "Ausblick / Empfehlung",
  ];

  const cleaned = String(documentation || "")
    .replace(/\r/g, "")
    .replace(/\*\*(Befund aktuell|Behandlung|Reaktion \/ Verlauf|Ausblick \/ Empfehlung):\*\*/g, "**$1**")
    .trim();

  const withoutPatient = cleaned.replace(/^Patient\s+\d+\s*/i, "").trim();
  const parsed = {};
  let currentSection = null;

  withoutPatient.split("\n").forEach((line) => {
    const trimmed = line.trim();
    if (!trimmed) return;

    const heading = sections.find((section) => {
      const headingPattern = new RegExp(`^\\*\\*${escapeRegExp(section)}:?\\*\\*$|^${escapeRegExp(section)}:?$`, "i");
      return headingPattern.test(trimmed);
    });

    if (heading) {
      currentSection = heading;
      parsed[currentSection] = parsed[currentSection] || [];
      return;
    }

    if (currentSection) {
      const bullet = trimmed.replace(/^[-•]\s*/, "").trim();
      if (bullet && !isForbiddenPlaceholder(bullet)) {
        parsed[currentSection].push(bullet);
      }
    }
  });

  let output = `${patientLabel}\n\n`;

  sections.forEach((section, index) => {
    const bullets = (parsed[section] || []).filter(Boolean);

    output += `**${section}**\n`;

    if (bullets.length > 0) {
      output += bullets.map((item) => `- ${item}`).join("\n");
    } else {
      output += "- Inhalt aus dem Diktat knapp strukturiert; keine zusätzliche Interpretation ergänzt.";
    }

    if (index < sections.length - 1) {
      output += "\n\n";
    }
  });

  return output.trim();
}

function isForbiddenPlaceholder(text) {
  const normalized = text.toLowerCase();
  return [
    "keine angaben",
    "keine weiteren angaben",
    "nicht erwähnt",
    "keine informationen",
    "rest unauffällig",
    "keine angaben im diktat",
    "keine weiteren angaben dokumentiert",
  ].some((phrase) => normalized.includes(phrase));
}

function escapeRegExp(value) {
  return String(value).replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}
