const OPENAI_API_URL = "https://api.openai.com/v1/responses";
const DEFAULT_MODEL = "gpt-4.1";

const SECTION_ORDER = [
  "Befund aktuell",
  "Behandlung",
  "Reaktion / Verlauf",
  "Ausblick / Empfehlung",
];

const SECTION_DEFAULTS = {
  "Befund aktuell": "Aktueller Zustand kurz dokumentiert.",
  Behandlung: "Therapeutische Inhalte aus dem Diktat übernommen.",
  "Reaktion / Verlauf": "Verlauf kurz dokumentiert.",
  "Ausblick / Empfehlung": "Fortführung der dokumentierten Maßnahmen.",
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
Erstelle aus einem gesprochenen Rohdiktat ein stabiles, vollständiges Arbeits-Transkript für die spätere physiotherapeutische Dokumentation.
Dies ist SCHRITT 1 der internen Verarbeitung: Rohdiktat verstehen, fachlich normalisieren, Schweizerdeutsch/Umgangssprache stabilisieren und alle relevanten Fakten sichern.
Du strukturierst noch nicht in die vier Dokumentationsabschnitte.
Du ergänzt keine neuen medizinischen Fakten.

PIPELINE, DIE DU INTERN AUSFÜHRST:
1. Rohdiktat semantisch verstehen.
2. Schweizerdeutsch, Mischsprache, Satzabbrüche und Diktierfehler vorsichtig in professionelles Hochdeutsch übertragen.
3. Alle physiotherapeutisch relevanten Fakten vollständig sichern.
4. Kritische Fachbegriffe, Messwerte, Limiten, Verbote, rechts/links und Nicht-Messungen gegen Verwechslung prüfen.
5. Nur das bereinigte Arbeits-Transkript ausgeben.

GRUNDSATZ:
Das Rohdiktat ist die Quelle der Wahrheit.
Bedeutungstreue und Vollständigkeit sind wichtiger als sprachliche Eleganz.
Keine Diagnosen, Symptome, Messwerte, Übungen, Defizite, Reaktionen, Freigaben oder ärztlichen Vorgaben ergänzen.
Wenn ein Begriff unsicher ist, verwende den wahrscheinlich passenden physiotherapeutischen Begriff nur bei starkem Kontext. Sonst Originalbegriff bevorzugen und neutral formulieren.

VOLLSTÄNDIGKEIT VOR KÜRZE:
Alle konkret diktierten therapeutisch relevanten Informationen müssen erhalten bleiben, auch wenn das Diktat chaotisch ist.
Mehrere unterschiedliche Übungen, Geräte, Tests, Muskeln, Gelenke, Interventionen oder Assessments dürfen gebündelt, aber nicht gestrichen oder zu allgemein gemacht werden.
Nicht "mehrere Muskelgruppen behandelt" schreiben, wenn einzelne Strukturen genannt wurden.
Wenn Trapezius pars descendens, Levator scapulae, Rhomboideen, Pectoralis minor und Suboccipitalmuskulatur diktiert wurden, müssen alle erhalten bleiben.

THERAPEUTISCHE RELEVANZ ALLGEMEIN:
Erhalte alle relevanten Informationen unabhängig vom Fachgebiet: Geriatrie, Neurologie, Orthopädie, Sportphysiotherapie, Pädiatrie, Handtherapie, Lymphologie, Atemtherapie, Vestibulartherapie, Beckenboden, Manualtherapie, Trainingstherapie, Rehabilitation und weitere Physio-Bereiche.
Dazu gehören insbesondere: Beschwerden, Schmerzen, NRS, Borg, Schwindelintensität, Gehstrecken, Pausen, Hilfsmittel, Gangbild, Transfers, Treppen, Kraft, Übungen, Geräte, Gewichte, Serien, Wiederholungen, Widerstände, ROM, Bewegungsgrade, rechts/links, Muskeln, Gelenke, Tonus, Koordination, Gleichgewicht, Standformen, Unterlagen, Dual Task, Assessments, OP-Status, postoperative Vorgaben, Belastungslimiten, ärztliche Verbote, Heimprogramm, Instruktionen, Reaktion, Verlauf und Empfehlungen.

MESSWERTE UND NICHT-MESSUNGEN:
Alle Zahlen, Einheiten und Dosierungen exakt erhalten: z. B. 200 Meter, 2 Pausen, NRS 5, Borg 5, Schwindel 4/10, 45 kg, 3 × 10 Wiederholungen, 90 Grad, 0-120 Grad, Teilbelastung 15 kg, 6 Wochen, 10 Minuten, 3 Serien.
Keine Zahlen runden, ändern oder weglassen.
Explizite Nicht-Messungen erhalten, z. B. "Sauerstoffsättigung heute nicht gemessen".
Keine Sauerstoffwerte oder andere Messwerte erfinden.
Schwindel nicht als NRS bezeichnen; bei Schwindel "Schwindelintensität .../10" sichern.
Borg für Belastung/Dyspnoe sichern, NRS für Schmerz.

KRITISCHE VORGABEN WORTGETREU SCHÜTZEN:
Ärztliche Vorgaben und Belastungslimiten dürfen nicht semantisch verändert werden.
Exakt erhalten: Teilbelastung 15 kg, Vollbelastung, Flexion maximal 70 Grad, Extension frei, keine Adduktion, keine Abduktion, keine Rotation, keine Innenrotation, keine Außenrotation, keine forcierte Flexion, kein Joggen, kein Sprungtraining, rechts, links, postoperative Wochenangaben und kg-/Grad-Angaben.
Sicherheitsregeln:
- Adduktion niemals zu Abduktion machen.
- Abduktion niemals zu Adduktion machen.
- hyperton niemals zu hypoton machen.
- hypoton niemals zu hyperton machen.
- rechts niemals zu links machen.
- links niemals zu rechts machen.
- Teilbelastung niemals zu Vollbelastung machen.
- Verbot niemals zu Empfehlung machen.
- "keine forcierte Flexion" niemals zu "forcierte Flexion" machen.
- "kein Joggen" und "kein Sprungtraining" als Verbote erhalten.

SCHWEIZERDEUTSCH UND UMGANGSSPRACHE:
Schweizerdeutsch zuerst sinngemäß in fachliches Hochdeutsch übertragen, ohne Inhalte zu verlieren.
Nicht nur Wortlisten abarbeiten, sondern Bedeutungsmuster erkennen: Zustand, Schmerzen, Gehstrecke, Hilfsmittel, Pausen, Unsicherheiten, Übungen, Dosierungen, Reaktion, Müdigkeit, Motivation und Ausblick.
Beispiele: hüt = heute, kei Schmärze = keine Schmerzen, NRS null = NRS 0, ohni Hilfsmittel = ohne Hilfsmittel, hundertfüfzg Meter = 150 Meter, churzi Pause = kurze Pause, bim Dräie = beim Drehen, Chopf nach rächts und links = Kopf nach rechts und links, Gleichgwicht = Gleichgewicht, Schrittstellig = Schrittstellung, Ball zuewerfe = Ball zuwerfen, chli Dual Task = leichte Dual-Task-Aufgabe, Hauptstädt säge = Hauptstädte aufzählen, drü mal zäh = 3 × 10 Wiederholungen, streng worde = anstrengend geworden, müed = müde, Chraft = Kraft.

FACHBEGRIFFS- UND DIKTIERFEHLER-SCHUTZ:
Arbeite nicht nur mit einer statischen Liste. Erkenne etablierte medizinische, physiotherapeutische, anatomische und trainingswissenschaftliche Terminologie im Kontext.
Fachbegriffe möglichst erhalten und nicht verallgemeinern: Airex, Miniband, Theraband, Step-up, Mini Squat, Sit-to-Stand, Dead Bug, Bird Dog, Brücke, Einbeinstand, Beinachsenkontrolle, propriozeptives Training, Scapula-Setting, Scapuladyskinesie, Rotatorenmanschette, Außenrotation, Innenrotation, Serratus-Aktivierung, Überkopfbelastung, Return to Sport, Rollator, Freezing, Cueing, Dual Task, Kopfdrehungen, enger Stand, Schrittstellung, Sturzangst, Parcours, Zehenspitzengang, Fersengang, Wadenstretching, spielerisches Gangtraining, Strecksehne, Beugesehne, PIP/DIP/MCP-Gelenk, Narbenmobilisation, adhärente Narbe, Ödemreduktion, Borg, Dyspnoe, Kontaktatmung, Lippenbremse, Blickstabilisation, Dix-Hallpike, Epley-Manöver.
Kontextuelle Korrekturen nur bei hoher Plausibilität:
- Gleichgewicht/Einbeinstand/weiche Unterlage + "Ives" -> wahrscheinlich "Airex".
- Schulter/Scapula + "Skar Oil" -> wahrscheinlich "Scapula-Setting".
- LWS/Rumpfstabilität + "Network" -> wahrscheinlich "Dead Bug".
- Gang/Pädiatrie + "Scan-Training" -> wahrscheinlich "Gangtraining".
- Dual Task + "Hauptsäge" -> wahrscheinlich "Hauptstädte aufzählen".
- Handtherapie + "Stricksehne" -> wahrscheinlich "Strecksehne".
Nicht blind ersetzen und keine Fantasiebegriffe erzeugen.

HALLUZINATIONSSTOPP:
Nicht ergänzen: Diagnosen, Sauerstoffsättigung, Instabilitätszeichen, neurologische Zeichen, Sportfreigaben, Belastungsfreigaben, BPPV, Lagerungsschwindel, Zerebralparese, Entwicklungsverzögerung, Parese, strukturelle Schäden, Sturzrisiko, Heimübungen oder Reaktionen, wenn sie nicht diktiert wurden.
Übungen sind keine Defizite: Sit-to-Stand ist nicht automatisch Kraftdefizit; Dual Task ist nicht automatisch kognitive Einschränkung; Gangtraining ist nicht automatisch Sturzrisiko; Gleichgewichtstraining ist nicht automatisch Gleichgewichtsdefizit.

AUSGABE:
Gib ausschließlich das normalisierte Arbeits-Transkript zurück.
Keine Überschriften.
Keine Faktenliste.
Keine Selbstprüfung.
Keine Zusammenfassung.
Keine Kommentare.`;

const STRUCTURING_PROMPT = `Du bist medizinischer Dokumentationsassistent mit sehr hoher physiotherapeutischer Dokumentationsqualität.

AUFGABE:
Erstelle aus einem normalisierten Arbeits-Transkript eine kurze, vollständige und professionelle Physiotherapie-Verlaufsdokumentation für SoftPlus.
Die Dokumentation soll wie von einem erfahrenen Physiotherapeuten formuliert wirken: klinisch relevant, diktatnah, fachlich präzise, natürlich und ohne erfundene Inhalte.
Die Aufgabe ist nicht, möglichst kurz zu schreiben.
Die Aufgabe ist, die kürzest mögliche vollständige physiotherapeutische Dokumentation zu erstellen.

INTERNE PIPELINE:
1. Transkript verstehen und physiotherapeutischen Kontext erfassen.
2. Vollständige Faktenliste im Kopf bilden: Befund, Schmerzen, Messwerte, Hilfsmittel, Übungen, Interventionen, Assessments, Heimprogramm, Empfehlungen, Verlauf.
3. Fakten in die vier Abschnitte einordnen.
4. Gegen das Transkript prüfen: keine Auslassungen, keine Halluzinationen, keine kritischen Verwechslungen.
5. Fehler intern korrigieren.
6. Nur die finale Dokumentation ausgeben.

GRUNDSATZ:
Das Transkript ist die Quelle der Wahrheit.
Du darfst therapeutisch sinnvoll zusammenfassen, Fachsprache nutzen, Umgangssprache glätten und Inhalte logisch sortieren.
Du darfst keine neuen Fakten erfinden.
Wenn ein Detail konkret diktiert wurde, hat es Vorrang vor eleganter Kürzung.

VOLLSTÄNDIGKEIT VOR SPRACHLICHER ELEGANZ:
Alle konkret genannten physiotherapeutisch relevanten Informationen müssen erhalten bleiben.
Wenn mehrere unterschiedliche Übungen, Interventionen, Assessments, Geräte, Muskeln, Gelenke oder Maßnahmen genannt wurden, dokumentiere sie alle.
Unterschiedliche Maßnahmen dürfen in einem Bulletpoint zusammengefasst, aber nicht gestrichen oder zu allgemein gemacht werden.
Schlecht: "Koordinationstraining durchgeführt."
Gut: "Koordinationstraining mit Hüpfen, Slalomlaufen und Einbeinstand."
Schlecht: "Weichteiltechniken Schulter/Nacken."
Gut: "Weichteiltechniken an Trapezius pars descendens, Levator scapulae, Rhomboideen, Pectoralis minor und Suboccipitalmuskulatur."

THERAPEUTISCHE RELEVANZ ALLGEMEIN:
Berücksichtige alle Physio-Fachbereiche: Geriatrie, Neurologie, Orthopädie, Sportphysiotherapie, Pädiatrie, Handtherapie, Lymphologie, Atemtherapie, Vestibulartherapie, Beckenboden, Manualtherapie, Trainingstherapie, Rehabilitation und weitere Bereiche.
Erhalte insbesondere:
- Beschwerden, Schmerzen, NRS, Schmerzlokalisation, Schmerzqualität, Schmerzverlauf.
- Borg, Dyspnoe, Schwindelintensität, Vitalparameter und explizite Nicht-Messungen.
- Mobilität, Gehstrecke, Hilfsmittel, Pausen, Treppen, Transfers, Gangbild, Belastbarkeit.
- Kraft, Übungen, Geräte, Gewichte, Serien, Wiederholungen, Widerstände, Dosierungen.
- ROM, Bewegungsgrade, Gelenke, Bewegungsrichtungen, rechts/links, Muskeln und anatomische Strukturen.
- Gleichgewicht, Standformen, Unterlagen, Dual-Task, Koordination, Reaktionen und Unsicherheiten.
- Neurologische, orthopädische, sportphysiotherapeutische, manualtherapeutische, atemtherapeutische, vestibuläre, lymphologische, handtherapeutische, pädiatrische und beckenbodenbezogene Inhalte.
- Assessments, Tests, OP-Status, postoperative Vorgaben, Belastungslimiten, ärztliche Verbote.
- Heimprogramm, Instruktionen, Empfehlungen, Verlauf, Reaktion und Änderungen.

MESSWERTE UND NICHT-MESSUNGEN:
Alle Zahlen, Einheiten und Dosierungen exakt übernehmen: 200 Meter, 2 Pausen, NRS 5, NRS 0, Borg 5, Schwindel bis 4/10, 45 kg, 3 × 10 Wiederholungen, 90 Grad, 0-120 Grad, Teilbelastung 15 kg, 8 Wochen, 10 Minuten, 3 Serien.
Keine Zahlen verändern, runden oder weglassen.
Wenn "Sauerstoffsättigung wurde nicht gemessen" diktiert wurde, dokumentiere "Sauerstoffsättigung heute nicht gemessen."
Keine Sauerstoffsättigung oder andere Messwerte erfinden.
Schwindel nicht als NRS bezeichnen; schreibe "Schwindelintensität bis 4/10".
Borg für Belastung/Dyspnoe, NRS für Schmerz.

KRITISCHE VORGABEN WORTGETREU ERHALTEN:
Ärztliche Vorgaben, Verbote und Belastungslimiten exakt schützen.
Erhalte exakt: Teilbelastung 15 kg, Vollbelastung, Flexion maximal 70 Grad, Extension frei, keine Adduktion, keine Abduktion, keine Rotation, keine Innenrotation, keine Außenrotation, keine forcierte Flexion, kein Joggen, kein Sprungtraining, rechts, links, postoperative Wochenangaben und kg-/Grad-Angaben.
Niemals:
- Adduktion mit Abduktion verwechseln.
- Abduktion mit Adduktion verwechseln.
- hyperton mit hypoton verwechseln.
- hypoton mit hyperton verwechseln.
- rechts mit links verwechseln.
- links mit rechts verwechseln.
- Teilbelastung zu Vollbelastung machen.
- Ein Verbot zu einer Empfehlung machen.
- "keine forcierte Flexion" zu "forcierte Flexion" machen.

FACHBEGRIFFE UND KONTEXTUELLE NORMALISIERUNG:
Arbeite nicht nur mit einer Wortliste, sondern erkenne medizinische, physiotherapeutische, anatomische und trainingswissenschaftliche Fachsprache im Kontext.
Etablierte Fachbegriffe möglichst unverändert übernehmen und nicht unnötig verallgemeinern.
Kontextanker: Airex, Miniband, Theraband, Step-up, Mini Squat, Sit-to-Stand, Dead Bug, Bird Dog, Brücke, Einbeinstand, Beinachsenkontrolle, Scapula-Setting, Scapuladyskinesie, Rotatorenmanschette, Außenrotation, Innenrotation, Serratus-Aktivierung, Return to Sport, Rollator, Freezing, Cueing, Dual Task, Kopfdrehungen, enger Stand, Schrittstellung, Parcours, Zehenspitzengang, Fersengang, spielerisches Gangtraining, Strecksehne, Beugesehne, PIP/DIP/MCP-Gelenk, Narbenmobilisation, adhärente Narbe, Ödemreduktion, Kontaktatmung, Lippenbremse, Blickstabilisation, Dix-Hallpike, Epley-Manöver.
Typische Diktierfehler vermeiden: Airex nicht "Ives"; Scapula-Setting nicht "Skar Oil"; Scapuladyskinesie nicht "Skapulaparesezeichen"; Dead Bug nicht "Network"; Gangtraining nicht "Scan-Training"; Dual Task nicht "Frid Task"; Hauptstädte aufzählen nicht "Hauptsäge"; Strecksehne nicht "Stricksehne"; Stationsrunde nicht "Stadionrunde"; Parcours nicht "Parkour", wenn therapeutischer Parcours gemeint ist.

SCHWEIZERDEUTSCH:
Schweizerdeutsch und Mischsprache fachlich ins Hochdeutsche übertragen.
Dialektinhalt erhalten: keine Schmerzen/NRS null, ohne Hilfsmittel, 150 Meter, kurze Pause, Drehen unsicher, Kopfdrehungen, enger Stand, Schrittstellung, Ball zuwerfen, Dual Task mit Hauptstädte aufzählen, Sit-to-Stand 3 × 10, anstrengend/müde, Fokus auf Gangsicherheit/Gleichgewicht/Kraft.
Keine zusätzlichen Übungen wie Gewichtsverlagerung ergänzen, wenn nicht diktiert.

HALLUZINATIONSSTOPP:
Nicht erfinden:
- Diagnosen, Symptome, Schmerzen, Defizite, Messwerte, Sauerstoffsättigung.
- Instabilitätszeichen, neurologische Zeichen, strukturelle Schäden, Sportfreigaben, Belastungsfreigaben.
- BPPV, Lagerungsschwindel, Zerebralparese, Entwicklungsverzögerung, Parese, Sturzrisiko.
- Übungen, Tests, Hilfsmittel, Heimübungen, Reaktionen, Verlaufsaussagen oder Therapieziele.
Pädiatrie und Vestibular besonders konservativ dokumentieren: keine Diagnose ergänzen, wenn nicht diktiert.

ÜBUNG IST NICHT AUTOMATISCH DEFIZIT:
Dokumentiere Übungen als Behandlung, wenn kein Defizit genannt wurde.
Gleichgewichtstraining mit Kopfdrehungen bedeutet nicht automatisch Gangunsicherheit bei Kopfdrehungen.
Sit-to-Stand bedeutet nicht automatisch Kraftdefizit.
Dual-Task bedeutet nicht automatisch kognitive Einschränkung.
Gangtraining bedeutet nicht automatisch Sturzrisiko.
Atemtherapie bedeutet nicht automatisch Dyspnoe.

STIL:
- Kurze bis mittel ausführliche Bulletpoints.
- Natürlich, klinisch, fachlich und SoftPlus-tauglich.
- Keine langen Schachtelsätze.
- Keine Tabellen.
- Keine Einleitung und keine Erklärung nach der Dokumentation.
- Nicht generisch, nicht parserhaft, nicht formularartig.
- Fachbereich passend formulieren: Sportphysio anders als Geriatrie, Neuro, Pädiatrie, Atemtherapie, Handtherapie oder Vestibulartherapie.

PLATZHALTER VERMEIDEN:
Vermeide generische Sätze wie "Keine Angaben im Diktat", "Nicht erwähnt", "Im Diktat knapp beschrieben", "Diktierter Therapieinhalt übernommen" oder ähnliche KI-Platzhalter.
Wenn ein Abschnitt wenig Information hat, halte ihn kurz und natürlich oder ordne vorhandene Fakten sinnvoll zu.

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

INTERNE SELBSTKONTROLLE VOR AUSGABE:
Vor Ausgabe intern prüfen:
1. Sind alle Zahlen, Messwerte, Dosierungen und Nicht-Messungen erhalten?
2. Sind NRS, Borg und Schwindelintensität korrekt zugeordnet?
3. Sind rechts/links, Adduktion/Abduktion, Flexion/Extension, hyperton/hypoton korrekt?
4. Sind Verbote und Limiten als Verbote/Limiten erhalten?
5. Sind Hilfsmittel, Geräte, Übungen, Tests, Muskeln, Gelenke und Körperregionen vollständig erhalten?
6. Sind Heimprogramm, Instruktionen und Empfehlungen übernommen, sofern diktiert?
7. Wurde nichts erfunden?
8. Wurden Übungen nicht als Defizite interpretiert?
9. Sind alle vier Abschnitte vorhanden?
10. Klingt die Ausgabe wie echte Physiotherapie-Dokumentation?
11. Sind keine Patientennamen enthalten?
Wenn etwas nicht erfüllt ist, intern korrigieren.

Gib ausschließlich die fertige Dokumentation aus.`;

const REPAIR_PROMPT = `${STRUCTURING_PROMPT}

Zusatzauftrag:
Die vorherige Antwort war leer, unvollständig oder nicht exakt im Pflichtformat.
Repariere die Struktur und prüfe streng gegen das Transkript.
Erhalte alle therapeutisch relevanten Informationen aus dem Transkript.
Erfinde keine neuen Fakten und entferne erfundene Inhalte.
Alle vier Abschnitte müssen vorhanden sein.
Wenn ein Abschnitt wenig Information hat, formuliere kurz, natürlich und neutral.
Keine generischen Platzhalter verwenden.
Zahlen, Dosierungen, Messwerte, Nicht-Messungen, Hilfsmittel, rechts/links, Verbote, Limiten, Körperregionen, Übungen, Maßnahmen, Assessments, Heimprogramm, Empfehlungen und Schmerzen/NRS/Borg/Schwindelintensität müssen erhalten bleiben.
Wenn mehrere unterschiedliche Maßnahmen genannt wurden, dürfen sie zusammengefasst, aber nicht gestrichen oder zu allgemein gemacht werden.
Korrigiere kritische Verwechslungen wie Adduktion/Abduktion, hypoton/hyperton, rechts/links, Teilbelastung/Vollbelastung, NRS/Borg/Schwindelintensität.
Vermeide Fantasiebegriffe wie Ives, Skar Oil, Network, Scan-Training, Frid Task, Hauptsäge oder Stricksehne, wenn der physiotherapeutische Kontext einen etablierten Begriff nahelegt.
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
    maxOutputTokens: 1200,
  });

  const first = await requestOpenAi({
    apiKey,
    model,
    instructions: STRUCTURING_PROMPT.replaceAll("Patient X", patientLabel),
    input: createStructuringInput(normalizedTranscript, patientLabel),
    maxOutputTokens: 1800,
  });

  if (hasCompleteSections(first)) {
    return normalizeDocumentation(first, patientNumber);
  }

  const repaired = await requestOpenAi({
    apiKey,
    model,
    instructions: REPAIR_PROMPT.replaceAll("Patient X", patientLabel),
    input: `${createStructuringInput(normalizedTranscript, patientLabel)}\n\nUnvollständige vorherige Antwort:\n${first}`,
    maxOutputTokens: 1800,
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

Normalisiere dieses Diktat zu einem stabilen Arbeits-Transkript für Physiotherapie-Dokumentation.
Sichere zuerst die Bedeutung, dann normalisiere Sprache und Fachbegriffe.
Schweizerdeutsch, Hochdeutsch und Mischsprache in professionelles Standarddeutsch übertragen, ohne Inhalte zu verändern.
Alle therapeutisch relevanten Informationen vollständig erhalten: Befund, Schmerzen, NRS, Borg, Schwindelintensität, Messwerte, Nicht-Messungen, Hilfsmittel, rechts/links, Verbote, Limiten, Übungen, Geräte, Muskeln, Gelenke, Dosierungen, Wiederholungen, Serien, Gewichte, Gehstrecken, Pausen, Assessments, Reaktion, Verlauf, Heimprogramm und Empfehlungen.
Keine neuen Fakten ergänzen.
Kritische Bedeutungen nicht verwechseln: hypoton/hyperton, Heimübungen/Atemübungen, Mobilisation/Manipulation, Flexion/Extension, Abduktion/Adduktion, rechts/links, Teilbelastung/Vollbelastung, Verbot/Empfehlung.
Typische Diktierfehler aus dem physiotherapeutischen Kontext korrigieren, aber nicht blind ersetzen: Airex statt Ives, Scapula-Setting statt Skar Oil, Dead Bug statt Network, Gangtraining statt Scan-Training, Hauptstädte aufzählen statt Hauptsäge, Strecksehne statt Stricksehne.
Nur das Arbeits-Transkript ausgeben.`;
}

function createStructuringInput(normalizedTranscript, patientLabel) {
  return `Patient: ${patientLabel}

Normalisiertes Arbeits-Transkript:
${normalizedTranscript}

Aufgabe:
Strukturiere dieses Transkript in das Pflichtformat.
Bleibe diktatnah, aber formuliere natürlich und physiotherapeutisch professionell.
Erhalte alle therapeutisch relevanten Inhalte, insbesondere Zahlen, Dosierungen, Messwerte, Nicht-Messungen, Hilfsmittel, rechts/links, Verbote, Limiten, Körperregionen, Übungen, Geräte, Maßnahmen, Assessments, Schmerzen/NRS, Borg und Schwindelintensität.
Keine neuen Diagnosen, Symptome, Defizite, Übungen, Reaktionen, Verbesserungen, Messwerte, Freigaben oder Ziele erfinden.
Übungen nicht automatisch als Defizite interpretieren.
Reaktion / Verlauf nur aus echten Angaben im Transkript formulieren; keine Toleranz, Mitarbeit oder Verbesserung erfinden.
Ausblick / Empfehlung als fachlich naheliegende Fortführung der dokumentierten Therapieinhalte formulieren.
Vor der Ausgabe intern prüfen, ob Zahlen, Fachbegriffe, rechts/links, Verbote, Limiten, Nicht-Messungen und alle konkreten Maßnahmen erhalten sind.
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
