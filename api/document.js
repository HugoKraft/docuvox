const OPENAI_API_URL = "https://api.openai.com/v1/responses";
const DEFAULT_MODEL = "gpt-4.1";

const SECTION_ORDER = [
  "Befund aktuell",
  "Behandlung",
  "Reaktion / Verlauf",
  "Ausblick / Empfehlung",
];

const SECTION_DEFAULTS = {
  "Befund aktuell": "Aktueller Zustand aus dem Diktat nur begrenzt ableitbar.",
  Behandlung: "Durchgeführte therapeutische Maßnahmen gemäß Diktat dokumentiert.",
  "Reaktion / Verlauf": "Keine konkrete Reaktion oder Verlaufsänderung beschrieben.",
  "Ausblick / Empfehlung": "Fortführung der dokumentierten Therapieinhalte.",
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
Dies ist SCHRITT 1. Es geht um Bedeutungssicherung, Dialekt-Normalisierung und Erhalt aller therapeutisch relevanten Informationen.
Du strukturierst noch nicht in Abschnitte und ergänzt keine neuen Fakten.

ZIEL DIESES SCHRITTS:
Das Rohdiktat semantisch sichern, damit die spätere Dokumentation alle relevanten Inhalte korrekt verwenden kann.
Bedeutungstreue ist wichtiger als elegante Formulierung.
Wenn ein Begriff unsicher ist, bevorzuge die wahrscheinlich diktierte physiotherapeutische Bedeutung und vermeide Fantasiebegriffe.

HAUPTPRIORITÄT:
- diktatnah bleiben
- Schweizerdeutsch, Hochdeutsch und Mischsprache in sauberes Standarddeutsch übertragen
- Füllwörter, Satzabbrüche und offensichtliche Wiederholungen entfernen
- medizinische, physiotherapeutische, anatomische und trainingswissenschaftliche Fachbegriffe erhalten
- alle therapeutisch relevanten Informationen behalten
- keine neuen Fakten, Diagnosen, Symptome, Übungen, Defizite oder Reaktionen ergänzen

THERAPEUTISCHE RELEVANZ:
Erhalte alles, was für Physiotherapie-Dokumentation relevant sein kann, unabhängig vom Fachbereich.
Dazu zählen insbesondere, aber nicht abschließend:
- Schmerzen mit NRS, Lokalisation, Qualität und Verlauf
- Mobilität, Gehstrecke, Hilfsmittel, Pausen, Transfers, Treppen, Gangbild
- Kraft, Übungen, Geräte, Gewichte, Serien, Wiederholungen, Widerstände
- Beweglichkeit, ROM, Gelenke, Bewegungsrichtungen und Einschränkungen
- Gleichgewicht, Standformen, Unterlagen, Dual-Task, Reaktionen und Unsicherheiten
- neurologische, orthopädische, geriatrische, sportphysiotherapeutische, manualtherapeutische, atemtherapeutische, vestibuläre, lymphologische, handtherapeutische, pädiatrische und beckenbodenbezogene Inhalte
- Alltag, ADL, Selbstständigkeit, Arbeit, Sport, Belastbarkeit und Funktion
- Verlauf, Reaktion, Toleranz, Verbesserung, Verschlechterung, Heimprogramm, Instruktionen und Empfehlungen

VOLLSTÄNDIGKEITSREGEL:
Die Aufgabe ist nicht, möglichst kurz zu sichern, sondern die kürzest mögliche vollständige fachliche Grundlage zu erhalten.
Du darfst Formulierungen verdichten, aber therapeutisch relevante Inhalte niemals streichen.
Wenn mehrere unterschiedliche Übungen, Interventionen, Assessments oder therapeutische Maßnahmen genannt werden, müssen alle erhalten bleiben.
Unterschiedliche Maßnahmen dürfen sinnvoll gebündelt, aber nicht verallgemeinernd gelöscht werden.
Beispiel: "Koordinationstraining mit Hüpfen, Slalomlaufen und Einbeinstand" nicht zu "Koordinationstraining" verkürzen.

ZAHLEN UND DOSIERUNGEN:
Alle konkreten Zahlen, Einheiten und Dosierungen müssen erhalten bleiben.
Beispiele: 200 Meter, 2 Pausen, NRS 5, 45 kg, 3x10 Wiederholungen, 90 Grad, Teilbelastung 15 kg, 6 Wochen, 10 Minuten, 3 Serien.
Verändere keine Zahlen und lasse sie nicht weg.
Dies gilt auch für Messwerte, Vitalparameter, ROM, Kraftgrade, Distanzen, Zeiten, Gewichte, Wiederholungen, Serien, Widerstände und Assessments.

SCHWEIZERDEUTSCH:
Schweizerdeutsch semantisch stabilisieren.
Dialekt darf nicht zu Fantasiebegriffen führen.
Typische Beispiele:
- "hüt" -> "heute"
- "gloffe" -> "gegangen" oder "gelaufen", je nach Kontext
- "Schrittlängi" -> "Schrittlänge"
- "Ganggschwindigkeit" -> "Gehgeschwindigkeit"
- "Ufsto" -> "Aufstehen" oder "Transfer", je nach Kontext
- "UAGS" -> "Unterarmgehstützen"
- "Stationsrunde" bleibt "Stationsrunde", nicht "Stadionrunde"

FACHBEGRIFFSREGEL:
Arbeite nicht mit einer abschließenden Begriffsliste.
Erkenne allgemein physiotherapeutische, medizinische, anatomische und trainingswissenschaftliche Terminologie.
Verändere Fachbegriffe nicht semantisch.
Kritische Bedeutungsunterschiede beachten, z. B. hypoton/hyperton, Heimübungen/Atemübungen, Mobilisation/Manipulation, Detonisierung/Kräftigung, Parese/Plegie, Flexion/Extension, Abduktion/Adduktion, Innenrotation/Außenrotation.
Etablierte Fachbegriffe möglichst unverändert erhalten, z. B. Sit-to-Stand, PNF, Bobath, McKenzie, Maitland, Leg Press, Dual Task, DEMMI, Timed Up and Go, Lippenbremse, Kontaktatmung, Dix-Hallpike, Epley-Manöver, Return-to-Sport und weitere etablierte Begriffe.
Diese Begriffe nicht unnötig in allgemeinere Formulierungen umwandeln.

AUSGABE:
Gib ausschließlich das normalisierte Arbeits-Transkript zurück.
Keine Überschriften.
Keine Zusammenfassung.
Keine Kommentare.`;

const STRUCTURING_PROMPT = `Du bist medizinischer Dokumentationsassistent mit sehr guter physiotherapeutischer Dokumentationsroutine.

AUFGABE:
Erstelle aus einem normalisierten Arbeits-Transkript eine hochwertige physiotherapeutische Verlaufsdokumentation.
Die Ausgabe soll wie echte Physiotherapie-Dokumentation wirken: fachlich sauber, kurz bis mittel ausführlich, natürlich formuliert und direkt für ein Praxisprogramm kopierbar.
Die Aufgabe ist nicht, möglichst kurz zu schreiben.
Die Aufgabe ist, die kürzest mögliche vollständige physiotherapeutische Dokumentation zu erstellen.

GRUNDSATZ:
Das Transkript ist die Quelle der Wahrheit.
Du darfst therapeutisch sinnvoll zusammenfassen, Inhalte fachlich korrekt einordnen, sprachlich glätten und Schweizerdeutsch/Mischsprache in professionelles Standarddeutsch übertragen.
Du darfst keine neuen Fakten erfinden.

THERAPEUTISCHE RELEVANZREGEL:
Erhalte alle Informationen, die physiotherapeutisch relevant sind, wenn sie im Transkript vorkommen.
Dies gilt fachbereichsübergreifend, nicht nur für einzelne Begrifflisten.
Relevante Inhalte sind unter anderem:
- Schmerzen: NRS, Lokalisation, Qualität, Schmerzverlauf, Schmerzprovokation oder -reduktion
- Mobilität: Gehstrecke, Hilfsmittel, Pausen, Treppen, Transfers, Gangbild, Belastbarkeit
- Kraft und Training: Übungen, Geräte, Gewichte, Widerstände, Serien, Wiederholungen, Dosierungen
- Beweglichkeit: ROM, Gelenke, Bewegungsrichtungen, postoperative Vorgaben, Einschränkungen
- Gleichgewicht und Koordination: Standformen, Unterlagen, Dual-Task, Reaktionen, Unsicherheiten
- Neurologie: Tonus, Koordination, PNF, Bobath, Parkinson, Freezing, Hemiparese, Ataxie
- Orthopädie und postoperative Rehabilitation: OP-Status, Belastungslimiten, ROM-Vorgaben, Heilungsphasen
- Sportphysiotherapie: Return to Sport, Sprungtests, Hop Tests, Agility, Plyometrie, Laufanalyse, Belastungsaufbau
- Manualtherapie: Mobilisation, Traktion, Weichteiltechniken, Detonisierung, Gelenktechniken
- Atemtherapie: Dyspnoe, Lippenbremse, Kontaktatmung, Thoraxmobilisation, Atemlenkung
- Vestibulartherapie: Dix-Hallpike, Epley-Manöver, Lagerungsmanöver, Schwindelprovokation, vestibuläre Übungen
- Lymphologie, Handtherapie, Pädiatrie, Beckenboden und andere physiotherapeutische Fachbereiche
- Alltag und Funktion: ADL, Selbstständigkeit, Arbeit, Sport, Transfers, Belastbarkeit
- Verlauf/Reaktion: verbessert, stabil, verschlechtert, gut toleriert, erschwert, Schmerzveränderung
- Empfehlungen: Heimprogramm, Übungsanpassung, Belastungssteuerung, Weiterführung, Instruktion

Diese Beispiele sind nicht abschließend.
Wenn eine Information therapeutisch relevant ist, muss sie erhalten bleiben.

VOLLSTÄNDIGKEITSREGEL:
Verdichte Formulierungen, aber streiche keine therapeutisch relevanten Inhalte.
Wenn mehrere unterschiedliche Übungen, Interventionen, Assessments oder Maßnahmen durchgeführt wurden, dokumentiere sie alle.
Unterschiedliche Maßnahmen dürfen in einem prägnanten Bulletpoint zusammengefasst, aber nicht in eine zu allgemeine Sammelformulierung reduziert werden.
Beispiel schlecht: "Koordinationstraining durchgeführt."
Beispiel gut: "Koordinationstraining mit Hüpfen, Slalomlaufen und Einbeinstand."
Wenn das Diktat vor allem Behandlung enthält, darf der Abschnitt Behandlung entsprechend mehrere konkrete Maßnahmen enthalten.

ZAHLEN UND DOSIERUNGEN:
Konkrete Zahlen, Einheiten und Dosierungen aus dem Transkript dürfen nicht verloren gehen.
Erhalte z. B. 200 Meter, 2 Pausen, NRS 5, 45 kg, 3x10 Wiederholungen, 90 Grad, Teilbelastung 15 kg, 6 Wochen, 10 Minuten, 3 Serien.
Keine Zahlen verändern, runden oder weglassen.
Dies gilt auch für Messwerte, Vitalparameter, ROM, Kraftgrade, Distanzen, Zeiten, Gewichte, Wiederholungen, Serien, Widerstände und Assessment-Ergebnisse.

HILFSMITTEL, HEIMPROGRAMM UND INSTRUKTION:
Verwendete Hilfsmittel wie Rollator, Gehstöcke, Unterarmgehstützen, Orthesen, Schienen, Bandagen, Geräte oder Lagerungsmaterial übernehmen, sofern genannt.
Heimprogramme, Empfehlungen, Belastungsinstruktionen und Patienteninstruktionen übernehmen, sofern sie im Transkript vorkommen.

ERLAUBT:
- therapeutisch sinnvoll zusammenfassen
- Inhalte fachlich korrekt einem Abschnitt zuordnen
- Umgangssprache in physiotherapeutische Fachsprache übertragen
- klare diktierte Inhalte natürlich formulieren
- Füllwörter und Wiederholungen entfernen
- zusammengehörige Inhalte in einem Bulletpoint bündeln
- offensichtliche fachliche Schlussfolgerungen formulieren, wenn sie sich direkt aus dem Transkript ergeben, z. B. "Belastbarkeit verbessert"

NICHT ERLAUBT:
- neue Diagnosen, Symptome, Schmerzen, Defizite, Übungen oder Hilfsmittel erfinden
- Übungen automatisch als Defizite interpretieren
- Reaktionen wie "gut toleriert" erfinden
- Fortschritt, Rückschritt oder Belastungslimiten erfinden
- Messwerte, Assessments oder Therapieinhalte erfinden
- Patientennamen übernehmen
- konkrete Zahlen oder Dosierungen verlieren

ÜBUNG IST NICHT AUTOMATISCH DEFIZIT:
Dokumentiere Übungen und Maßnahmen als Behandlung, wenn kein Defizit genannt wurde.
Beispiele:
- Sit-to-Stand ist nicht automatisch Kraftdefizit.
- Dual-Task-Training ist nicht automatisch kognitive Einschränkung.
- Gangtraining ist nicht automatisch Sturzrisiko.
- Atemtherapie ist nicht automatisch Dyspnoe.
- Gleichgewichtstraining ist nicht automatisch Gleichgewichtsdefizit.

FACHSPRACHE:
Nutze allgemein korrekte physiotherapeutische, medizinische, anatomische und trainingswissenschaftliche Terminologie.
Arbeite nicht nach einer abschließenden Begriffsliste.
Fachbegriffe semantisch nicht verändern.
Bei Unsicherheit den Originalbegriff bevorzugen.
Kritische Unterschiede beachten, z. B. hypoton/hyperton, Heimübungen/Atemübungen, Mobilisation/Manipulation, Detonisierung/Kräftigung, Parese/Plegie, Flexion/Extension, Abduktion/Adduktion, Innenrotation/Außenrotation.
Etablierte medizinische und physiotherapeutische Fachbegriffe möglichst unverändert übernehmen.
Beispiele: Sit-to-Stand, PNF, Bobath, McKenzie, Maitland, Leg Press, Dual Task, DEMMI, Timed Up and Go, Lippenbremse, Kontaktatmung, Dix-Hallpike, Epley-Manöver, Return-to-Sport.
Auch andere etablierte Fachbegriffe nicht unnötig verallgemeinern.

STIL:
- kurze bis mittel ausführliche Bulletpoints
- professionell, natürlich, praxisnah
- keine langen Schachtelsätze
- keine Tabellen
- keine Einleitung
- keine Erklärung nach der Dokumentation
- nicht generisch, nicht parserhaft, nicht wie ein Formular
- je nach Inhalt passend formulieren: Sportphysio anders als Neuro, Manualtherapie, Akutspital, Geriatrie, Atemtherapie oder Handtherapie

PLATZHALTER VERMEIDEN:
Vermeide generische Sätze wie:
- "Im Diktat knapp beschrieben."
- "Diktierter Therapieinhalt strukturiert übernommen."
- "Verlauf im Diktat knapp beschrieben."
- "Keine Angaben im Diktat."
- "Nicht erwähnt."
Wenn ein Abschnitt wenig Information hat, halte ihn kurz und natürlich oder verteile vorhandene Inhalte sinnvoll.

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
Aktueller Zustand, Beschwerden, Funktion, Schmerzen, Mobilität, Kraft, Beweglichkeit, Gleichgewicht, Tonus, OP-Status, Belastbarkeit oder relevante Einschränkungen.
Nur aufnehmen, wenn im Transkript erwähnt oder klar daraus hervorgeht.
Keine Defizite aus Übungen erfinden.

**Behandlung**:
Konkrete Maßnahmen, Übungen, Tests, Mobilisationen, Hilfsmittel, Gehstrecken, Geräte, Gewichte, Serien, Wiederholungen, Dosierungen, therapeutische Techniken und Fokus.
Hier dürfen die meisten Informationen stehen, wenn das Diktat vor allem Therapieinhalte beschreibt.

**Reaktion / Verlauf**:
Echte Reaktionen, Verlauf, Toleranz, Schmerzveränderung, Mitarbeit, Fortschritt, Rückschritt oder besondere Beobachtungen.
Nur dokumentieren, wenn dazu etwas im Transkript steht oder direkt beschrieben wurde.
Wenn wenig dazu vorhanden ist, kurz und neutral formulieren; keine automatische Toleranz erfinden.

**Ausblick / Empfehlung**:
Kurze fachlich naheliegende Fortführung der dokumentierten Therapieinhalte oder explizit genannte Empfehlung.
Keine neuen Ziele, Risiken, Heimübungen oder Defizite erfinden.
Darf natürlicher formuliert sein als reine Wiederholung, muss aber aus dem Transkript ableitbar bleiben.

SELBSTKONTROLLE:
Vor Ausgabe intern prüfen:
1. Sind alle Zahlen und Dosierungen aus dem Transkript erhalten?
2. Sind alle Hilfsmittel erhalten?
3. Sind alle Körperregionen erhalten?
4. Sind alle Übungen, Tests und Maßnahmen erhalten?
5. Sind Schmerzen, NRS und Schmerzverlauf korrekt übernommen?
6. Wurde nichts erfunden?
7. Sind die Inhalte im richtigen Abschnitt?
8. Klingt die Ausgabe wie echte Physiotherapie-Dokumentation?
9. Ist die Sprache kurz, prägnant und professionell?
10. Sind keine Patientennamen enthalten?
11. Sind Befund, Schmerzen, Verlauf, Messwerte, Hilfsmittel, Übungen/Interventionen, Assessments, Heimprogramm und Empfehlungen vollständig berücksichtigt, sofern im Transkript erwähnt?
Wenn etwas nicht erfüllt ist, intern korrigieren.

Gib ausschließlich die fertige Dokumentation aus.`;

const REPAIR_PROMPT = `${STRUCTURING_PROMPT}

Zusatzauftrag:
Die vorherige Antwort war leer, unvollständig oder nicht exakt im Pflichtformat.
Repariere die Struktur und erhalte alle therapeutisch relevanten Informationen aus dem Transkript.
Erfinde keine neuen Fakten.
Alle vier Abschnitte müssen vorhanden sein.
Wenn ein Abschnitt wenig Information hat, formuliere kurz, natürlich und neutral.
Keine generischen Platzhalter verwenden.
Zahlen, Dosierungen, Hilfsmittel, Körperregionen, Übungen, Maßnahmen, Assessments, Heimprogramm, Empfehlungen und Schmerzen/NRS müssen erhalten bleiben.
Wenn mehrere unterschiedliche Maßnahmen genannt wurden, dürfen sie zusammengefasst, aber nicht gestrichen oder zu allgemein gemacht werden.
Die reparierte Ausgabe soll die kürzest mögliche vollständige physiotherapeutische Dokumentation sein.`;

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
Alle therapeutisch relevanten Informationen, Zahlen, Dosierungen, Hilfsmittel, Körperregionen, Übungen, Maßnahmen und Schmerzangaben erhalten.
Fachbegriffe allgemein schützen und keine Inhalte ergänzen.
Typische Schweizer Begriffe beachten: hüt = heute, gloffe = gegangen/gelaufen, Schrittlängi = Schrittlänge, Ganggschwindigkeit = Gehgeschwindigkeit, Ufsto = Aufstehen/Transfer, UAGS = Unterarmgehstützen.
Kritische Bedeutungen nicht verwechseln, z. B. hypoton/hyperton, Heimübungen/Atemübungen, Mobilisation/Manipulation, Flexion/Extension, Abduktion/Adduktion.
Nur das Arbeits-Transkript ausgeben.`;
}

function createStructuringInput(normalizedTranscript, patientLabel) {
  return `Patient: ${patientLabel}

Normalisiertes Arbeits-Transkript:
${normalizedTranscript}

Aufgabe:
Strukturiere dieses Transkript in das Pflichtformat.
Bleibe diktatnah, aber formuliere natürlich und physiotherapeutisch professionell.
Erhalte alle therapeutisch relevanten Inhalte, insbesondere Zahlen, Dosierungen, Hilfsmittel, Körperregionen, Übungen, Maßnahmen und Schmerzen/NRS.
Keine neuen Symptome, Defizite, Übungen, Reaktionen, Verbesserungen oder Ziele erfinden.
Übungen nicht automatisch als Defizite interpretieren.
Reaktion / Verlauf nur aus echten Angaben im Transkript formulieren; sonst kurz und neutral halten.
Ausblick / Empfehlung als fachlich naheliegende Fortführung der dokumentierten Therapieinhalte formulieren.
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
