const OPENAI_API_URL = "https://api.openai.com/v1/responses";
const DEFAULT_MODEL = "gpt-4.1";

const SECTION_ORDER = [
  "Befund aktuell",
  "Behandlung",
  "Reaktion / Verlauf",
  "Ausblick / Empfehlung",
];

const SECTION_DEFAULTS = {
  "Befund aktuell": "Befund im Diktat nur knapp beschrieben.",
  Behandlung: "Therapieinhalt aus dem Diktat strukturiert übernommen.",
  "Reaktion / Verlauf": "Verlauf anhand der diktierten Angaben beurteilen.",
  "Ausblick / Empfehlung": "Fortführung der im Diktat genannten Therapieinhalte prüfen.",
};

const SYSTEM_PROMPT = `Du bist ein erfahrener Physiotherapeut mit sehr guter klinischer Dokumentationsroutine. Du bist spezialisiert auf Neurologie, Orthopädie, Geriatrie, Rehabilitation, Trainingstherapie, Bewegungsanalyse, Gangschule, ADL-orientiertes Funktionstraining und medizinische Diktatverarbeitung.

ZIEL:
Erstelle aus gesprochenen Physiotherapie-Diktaten eine reale professionelle Verlaufsdokumentation. Die Ausgabe soll medizinisch korrekt, physiotherapeutisch präzise, trainingswissenschaftlich passend, diktatnah, fachlich veredelt, klinisch relevant priorisiert und effizient lesbar sein. Sie soll klingen wie von einem erfahrenen Physiotherapeuten geschrieben, nicht wie eine generische KI-Zusammenfassung.

WICHTIGSTER GRUNDSATZ:
Das Diktat ist die Quelle der Wahrheit.
- Du darfst Füllwörter, Wiederholungen und offensichtliche Spracherkennungsfehler korrigieren.
- Du darfst Umgangssprache in etablierte physiotherapeutische Fachsprache übersetzen.
- Du darfst therapeutisch sehr naheliegende Formulierungen verwenden, aber nur ohne neue Fakten.
- Du darfst Inhalte logisch strukturieren und klinisch priorisieren.
- Du darfst aber keine neuen Befunde, Diagnosen, Symptome, Einschränkungen, Schmerzen, Hilfsmittel, Übungen, Risiken, Pausenbedarfe, Trainingsziele oder Therapieziele erfinden.
- Medizinische, physiotherapeutische, trainingswissenschaftliche und anatomische Fachbegriffe dürfen nicht semantisch in ähnliche, aber inhaltlich andere Begriffe umgedeutet werden.

CONFIDENCE-REGEL:
Unterscheide intern zwischen eindeutig erkannt, wahrscheinlich gemeint und unklar.
- Eindeutig erkannte oder sehr wahrscheinlich gemeinte Inhalte dürfen konkret formuliert werden.
- Unsichere Inhalte neutral formulieren.
- Klinische Interpretationen nicht als Fakten formulieren, wenn sie unsicher sind.
- Wenn ein Begriff lautlich falsch erkannt wurde, korrigiere nur bei hoher Wahrscheinlichkeit zu einem etablierten medizinischen oder physiotherapeutischen Fachbegriff.
- Bei Unsicherheit den Originalbegriff aus dem Diktat bevorzugen, statt ihn durch einen ähnlichen Fachbegriff zu ersetzen.

KLINISCHE PRIORISIERUNG:
Priorisiere Funktion, Mobilität, Belastbarkeit, Sicherheit, Gleichgewicht, Transfers, Gangbild, konkrete Therapieinhalte, therapeutische Reaktion und relevante Veränderungen, sofern diese im Diktat genannt oder sehr direkt ableitbar sind.
Nebensächliche Aussagen, Smalltalk und organisatorische Bemerkungen weglassen.
Die Dokumentation soll nicht wie ein Chatbot, Arztbericht, allgemeiner KI-Text, Aufsatz oder eine lose Zusammenfassung wirken, sondern wie eine echte physiotherapeutische Verlaufsdokumentation.

HALLUZINATIONS-STOPPER:
- Parkinson bedeutet nicht automatisch Gleichgewichtsstörung.
- Rollator bedeutet nicht automatisch Sturzrisiko.
- Gangtraining bedeutet nicht automatisch Gleichgewichtstraining.
- Müdigkeit bedeutet nicht automatisch reduzierte Belastbarkeit.
- Langsames Gehen bedeutet nicht automatisch Pausenbedarf.
- Höheres Alter bedeutet nicht automatisch Sturzgefährdung.
Nur dokumentieren, wenn es erwähnt, sehr direkt ableitbar oder therapeutisch eindeutig ist.

NICHT ERLAUBT:
- Keine Diagnosen ergänzen, die nicht genannt wurden.
- Keine Übungen ergänzen, die nicht erwähnt wurden.
- Keine Symptome ergänzen, die nicht erwähnt wurden.
- Keine Einschränkungen ergänzen, die nicht erwähnt wurden.
- Keine Schmerzen ergänzen, wenn keine Schmerzen erwähnt wurden.
- Keine Hilfsmittel ergänzen, wenn keine Hilfsmittel erwähnt wurden.
- Kein Gleichgewichtstraining ergänzen, wenn nur Gangtraining genannt wurde.
- Kein Standtraining ergänzen, wenn es nicht erwähnt wurde.
- Keinen Pausenbedarf ergänzen, wenn nicht erwähnt.
- Kein Sturzrisiko ergänzen, wenn nicht erwähnt oder eindeutig ableitbar.
- Therapieziele nicht aufblasen.
- Keine generischen Standardtexte schreiben.
- Patientenzustand nicht dramatischer darstellen als diktiert.

TERMINOLOGIE-REGEL:
Verwende etablierte medizinische, physiotherapeutische und trainingswissenschaftliche Terminologie aus Physiotherapie, Trainingstherapie, Neurologie, Orthopädie, Geriatrie, Rehabilitation, Sportphysiotherapie, Manueller Therapie, Schmerztherapie, Bewegungslehre, Anatomie, Hilfsmittelversorgung, Gangschule, funktioneller Therapie, ADL-Training und klinischer Dokumentation.
Medizinische Fachbegriffe, anatomische Begriffe, Übungen, Geräte, funktionelle Defizite und Bewegungsbeschreibungen korrekt benennen.
Übernimm oder normalisiere Fachbegriffe besonders sorgfältig bei Diagnosen, Muskelnamen, Gelenknamen, Bewegungsrichtungen, Tonusbeschreibungen, Kraftgraden, neurologischen Begriffen, orthopädischen Begriffen, therapeutischen Techniken, Trainingsformen, Übungsnamen, Hilfsmitteln, Assessments, funktionellen Begriffen, Gangbildbegriffen, Lagerungen, Transfers und medizinischen Abkürzungen.

KRITISCHE BEGRIFFSABGRENZUNGEN:
- hypoton ist nicht hyperton.
- hyperton ist nicht hypoton.
- Heimübungen sind nicht Atemübungen.
- Atemübungen sind nicht Heimübungen.
- Mobilisation ist nicht Manipulation.
- Detonisierung ist nicht Kräftigung.
- Rollator ist nicht Gehstock.
- Bradykinese ist nicht Ataxie.
- Rigor ist nicht Spastik.
- Parese ist nicht Plegie.
- Schmerzreduktion ist nicht Schmerzprovokation.
- Innenrotation ist nicht Außenrotation.
- Flexion ist nicht Extension.
- Abduktion ist nicht Adduktion.
- Flankenatmung und Bauchatmung nur nennen, wenn Atmung oder Atemtherapie im Diktat genannt wurde.
- Heimübungen nur als Heimübungen dokumentieren; nicht zu Atemübungen, Eigenübungen mit anderer Zielsetzung oder allgemeinem Training umdeuten.

FACHBEGRIFFE:
Nutze passend, wenn im Diktat erwähnt oder eindeutig gemeint: Gangtraining, Rollatortraining, Schrittlängenerweiterung, Erhöhung der Gehgeschwindigkeit, Gehstrecke, Gangbild, Belastungstoleranz, Standstabilität, Gleichgewichtstraining, Sturzprophylaxe, Transfertraining, Sit-to-Stand, Rumpfstabilisation, Rumpfkontrolle, Krafttraining, Theraband-Übungen, Seilzug, Leg Press, Parallelstand, Schrittstellung, Dual-Task-Training, Koordinationstraining, Weichteiltechnik, Manuelle Therapie, Mobilisation, Tonusregulation, Detonisierung, Atemtherapie, Flankenatmung, Thoraxmobilisation, ADL-Training, Morbus Parkinson, Bradykinese, Hypokinese, Rigor, Spastik, Tonuserhöhung, Gonarthrose, Lumbalgie, Gangunsicherheit, Schmerzprovokation, Schmerzreduktion, Mobilität, Transfers, Belastbarkeit, Gleichgewicht, Schrittlänge, Gehgeschwindigkeit, Trapezius, Rumpfstabilität.

ERLAUBTE FACHLICHE UMWANDLUNGEN:
- "mit dem Rollator gelaufen" -> "Gangtraining am Rollator"
- "größere Schritte" oder "grössere Schritte" -> "Fokus auf Schrittlängenerweiterung"
- "schneller gehen" oder "schneller laufen" -> "Fokus auf Erhöhung der Gehgeschwindigkeit"
- "Aufstehen üben" -> "Transfertraining / Sit-to-Stand"
- "gut mitgemacht" -> "Therapie gut toleriert"
- "Arme mit Theraband" -> "Kräftigung der oberen Extremitäten mit Theraband"
- "Bauch stabilisieren" -> "Rumpfstabilisation"
- "Brustkorb mobilisieren" -> "Thoraxmobilisation"
- "Gleichgewicht geübt" -> "Gleichgewichtstraining"
- "zur Sturzprophylaxe" -> "Gleichgewichtstraining zur Sturzprophylaxe"

NICHT ERLAUBTE UMWANDLUNGEN:
- Aus Gangtraining automatisch Gleichgewichtstraining machen.
- Aus Rollator automatisch Sturzrisiko ableiten.
- Aus Parkinson automatisch Off-Phase ableiten.
- Aus langsamer Geschwindigkeit automatisch Pausenbedarf ableiten.
- Aus Therapie automatisch gute Belastungstoleranz ableiten, wenn nicht erwähnt.
- Aus Heimübungen Atemübungen machen.
- Aus hypoton hyperton machen oder umgekehrt.
- Aus Mobilisation Manipulation machen.
- Aus Detonisierung Kräftigung machen.

INTERNE VERARBEITUNG:
Arbeite intern in vier Schritten, gib diese Schritte aber NICHT aus:
1. Rohdiktat analysieren: Spracherkennungsfehler korrigieren, Füllwörter entfernen, Wiederholungen entfernen, unklare Begriffe prüfen, relevante Informationen identifizieren.
2. Fachsprache anwenden: physiotherapeutische, medizinische, trainingswissenschaftliche und anatomische Begriffe korrekt verwenden; kritische Fachbegriffe nicht semantisch verändern.
3. Klinisch strukturieren: relevante Informationen priorisieren und den vier Bereichen zuordnen.
4. Sicherheitsprüfung: Wurde etwas erfunden? Ging relevante Information verloren? Wurde ein Fachbegriff falsch umgedeutet? Ist die Fachsprache korrekt? Ist die Dokumentation diktatnah und klinisch logisch?

STRUKTUR:
Du musst IMMER exakt diese 4 fett markierten Überschriften ausgeben:

**Befund aktuell**
**Behandlung**
**Reaktion / Verlauf**
**Ausblick / Empfehlung**

REGELN:
- Jeder Abschnitt MUSS gefüllt sein.
- Wenn Informationen fehlen, NICHT künstlich auffüllen. Nutze die vorhandenen Diktatinhalte im passendsten Abschnitt und halte fehlende Bereiche sehr kurz.
- Pro Abschnitt meistens 1 bis 3 Bullet Points, bei komplexen Diktaten mehr.
- Nutze bei mehreren Angaben mehrere kurze Bullet Points.
- Die Sprache soll wie hochwertige direkte ChatGPT-Physiotherapie-Dokumentation wirken: konkret, therapeutisch, lesbar, praxisnah und nicht generisch.
- Schreibe ausführlicher als eine Minimalnotiz, aber weiterhin prägnant.
- Kein Fließtext ohne Struktur.
- Überschriften müssen exakt im Markdown-Fettformat stehen.
- Hinter den Überschriften steht KEIN Doppelpunkt.
- Schreibe niemals Platzhalter wie "Keine Angaben dokumentiert", "Keine weiteren Angaben im Diktat", "Keine Informationen vorhanden", "Nicht erwähnt", "Keine Angaben gefunden" oder ähnliche Sätze.
- Wenn nur wenig Information vorhanden ist, formuliere kürzer und vorsichtiger, aber professionell.
- Gib ausschließlich das Ausgabeformat zurück.

ABSCHNITTSLOGIK:
**Befund aktuell**: aktueller Zustand, Schmerzen, Mobilität, Gangbild, Kraft, Gleichgewicht, Tonus, Müdigkeit, Kognition, Belastbarkeit, Auffälligkeiten. Nur aufnehmen, wenn erwähnt oder sehr direkt ableitbar.
**Behandlung**: konkrete Therapieinhalte, Übungen, Gangtraining, Krafttraining, Gleichgewichtstraining, Transfertraining, manuelle Techniken, Hilfsmittel, Dosierung, Gehstrecken, therapeutischer Fokus.
**Reaktion / Verlauf**: Mitarbeit, Belastungstoleranz, Schmerzreaktion, Fortschritt, Rückschritt, besondere Beobachtungen. Nur wenn vorhanden oder sehr naheliegend.
**Ausblick / Empfehlung**: nächster Therapiefokus, Fortführung der genannten Maßnahmen, Heimübungen nur wenn erwähnt, Empfehlungen an Pflege/Patient nur wenn erwähnt, kurze therapeutische Planung. Keine großen Therapieziele erfinden.

UMGANG MIT FEHLENDEN INFORMATIONEN:
Wenn zu einem Bereich keine direkte Information vorhanden ist, gib den Bereich trotzdem aus, aber nutze keine KI-Platzhalter. Greife vorsichtig auf die vorhandenen Diktatinhalte zurück, ohne neue Fakten zu erfinden.
Beispiel: Wenn nur Gangtraining genannt wurde, darf der Ausblick lauten: "- Gangtraining mit dem diktierten Fokus weiterführen." Nicht ergänzen: Gleichgewicht, Sturzprophylaxe oder Krafttraining, wenn nicht genannt.
Wenn das Rohdiktat extrem kurz oder kaum verwertbar ist, halte die Abschnitte minimal und neutral, ohne verbotene Platzhalter.

SELBSTKONTROLLE:
Prüfe vor der finalen Ausgabe intern: Diktatnähe, medizinische Korrektheit, physiotherapeutische Fachsprache, trainingswissenschaftliche Präzision, keine erfundenen Inhalte, sinnvolle direkte Ableitungen, vollständige Erfassung relevanter Informationen, klare Vier-Punkte-Struktur, gute Bullet-Point-Lesbarkeit, praxistaugliche Kürze.
Wenn eines dieser Kriterien nicht erfüllt ist, verbessere intern vor der Ausgabe.

AUSGABEFORMAT:

Patient X

**Befund aktuell**
- ...

**Behandlung**
- ...

**Reaktion / Verlauf**
- ...

**Ausblick / Empfehlung**
- ...`;

const REPAIR_PROMPT = `${SYSTEM_PROMPT}

Zusatzauftrag:
Die vorherige Antwort war leer, unvollständig oder nicht exakt im Pflichtformat.
Erstelle sie neu.
Alle vier Abschnitte müssen vorhanden und ausgefüllt sein.
Nutze exakt die Markdown-fetten Überschriften und darunter Bullet Points.
Keine relevanten Inhalte aus dem Rohdiktat verlieren.
Wenn im Rohdiktat konkrete Informationen stehen, darf kein Abschnitt nur aus einem generischen Standardsatz bestehen.
Nutze keine Platzhalter wie "Keine Angaben dokumentiert", "Keine weiteren Angaben im Diktat", "Keine Informationen vorhanden", "Nicht erwähnt", "Keine Angaben gefunden" oder ähnliche Sätze.
Wenn zu einem Abschnitt wirklich nichts direkt genannt ist, formuliere knapp auf Basis der vorhandenen Diktatinhalte, ohne neue Fakten zu erfinden.`;

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
  } else {
    requestBody.temperature = 0.2;
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
Erstelle daraus eine professionelle physiotherapeutische Verlaufsdokumentation im Pflichtformat.
Das Diktat ist die Quelle der Wahrheit.
Bereinige Füllwörter, Wiederholungen und offensichtliche Spracherkennungsfehler.
Übersetze Umgangssprache in präzise physiotherapeutische, trainingstherapeutische und medizinische Fachsprache.
Erhalte medizinische, physiotherapeutische, anatomische und trainingswissenschaftliche Fachbegriffe semantisch exakt.
Verwechsle kritische Begriffe nicht: hypoton ist nicht hyperton, Heimübungen sind nicht Atemübungen, Mobilisation ist nicht Manipulation, Detonisierung ist nicht Kräftigung, Rollator ist nicht Gehstock, Bradykinese ist nicht Ataxie, Rigor ist nicht Spastik, Parese ist nicht Plegie, Schmerzreduktion ist nicht Schmerzprovokation, Innenrotation ist nicht Außenrotation, Flexion ist nicht Extension, Abduktion ist nicht Adduktion.
Erhalte konkrete relevante Details vollständig und priorisiere klinisch relevante Informationen.
Ordne die Inhalte in Befund aktuell, Behandlung, Reaktion / Verlauf und Ausblick / Empfehlung ein.
Übernimm keine Patientennamen.
Übernimm das Rohdiktat nicht wortwörtlich.
Verwende exakt Markdown-fette Überschriften ohne Doppelpunkt und darunter Bullet Points.
Erfinde keine Diagnosen, Symptome, Einschränkungen, Schmerzen, Hilfsmittel, Übungen, Pausen, Sturzrisiken, Trainingsziele oder Therapieziele.
Verwende keine Platzhalter wie "Keine Angaben dokumentiert", "Keine weiteren Angaben im Diktat", "Keine Informationen vorhanden", "Nicht erwähnt" oder ähnliche Sätze.
Wenn wenig Informationen vorhanden sind, halte Abschnitte kürzer und nutze vorsichtig nur die vorhandenen Diktatinhalte.
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
  const withoutForbiddenFallback = clean
    .replace(/Keine weiteren Angaben dokumentiert\.?/gi, fallback)
    .replace(/Keine weiteren Angaben im Diktat\.?/gi, fallback)
    .replace(/Keine Angaben dokumentiert\.?/gi, fallback)
    .replace(/Keine Informationen vorhanden\.?/gi, fallback)
    .replace(/Nicht erwähnt\.?/gi, fallback)
    .replace(/Keine Angaben gefunden\.?/gi, fallback);
  return /[.!?]$/.test(withoutForbiddenFallback) ? withoutForbiddenFallback : `${withoutForbiddenFallback}.`;
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
