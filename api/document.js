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
  "Airex",
  "Dividat",
  "Dividat Sensor",
  "Dividat Senso",
  "Simple",
  "Überwärmung",
  "Entstauungsgriffe",
  "manuelle Lymphdrainage",
  "Fußrücken",
  "Unterschenkel",
  "Hochlagerung",
  "Strecksehne",
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
5. Selbstkorrekturen im Diktat auflösen.
6. Dosierungen der richtigen unmittelbar genannten Übung oder Maßnahme zuordnen.
7. Nur das bereinigte Arbeits-Transkript ausgeben.

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

SELBSTKORREKTUREN IM DIKTAT:
Wenn sich der Therapeut im Diktat selbst korrigiert, gilt die zuletzt korrigierte Angabe nur für die betroffene Aussage.
Beispiele:
- "NRS 3, nein, eher NRS 2" -> nur NRS 2.
- "60 Meter, nein, eher 80 Meter" -> nur 80 Meter.
- "rechts mehr als links, ah nein, links mehr als rechts" -> nur links mehr als rechts.
- "Brücke zweimal zehn, nein, dreimal zehn Wiederholungen" -> Brücke 3 × 10 Wiederholungen.
- "Sit-to-Stand zuerst zehn Wiederholungen, nein, zwei mal zehn Wiederholungen" -> Sit-to-Stand 2 × 10 Wiederholungen.
Nicht beide Varianten sichern.
Nicht "unklar" schreiben.
Die korrigierte Dosierung nicht automatisch auf andere vorher genannte Übungen übertragen.

DOSIERUNGEN RICHTIG ZUORDNEN:
Zahlen, Wiederholungen, Serien und Dosierungen gehören zur unmittelbar genannten Übung, Maßnahme oder Strecke.
Beispiel: "Beckenkippen, Dead Bug vereinfacht, Brücke zweimal zehn, nein dreimal zehn" -> Beckenkippen und vereinfachter Dead Bug ohne Dosierung; Brücke 3 × 10 Wiederholungen.
Beispiel: "Sit-to-Stand drei mal zehn Wiederholungen" -> Sit-to-Stand 3 × 10 Wiederholungen.
Keine Sammeldosierung erzeugen, wenn die Dosierung nur für eine Übung genannt wurde.

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
Weitere Dosierungsbeispiele: "zwei mal zäh" = 2 × 10 Wiederholungen, "eis mal zäh" = 1 × 10 Wiederholungen.
Wenn eine Dialekt-Dosierung direkt nach einer Übung kommt, gehört sie zu dieser Übung.
Beispiel: "Denn no Sit-to-Stand drü mal zäh" -> Sit-to-Stand 3 × 10 Wiederholungen.

FACHBEGRIFFS- UND DIKTIERFEHLER-SCHUTZ:
Arbeite nicht nur mit einer statischen Liste. Erkenne etablierte medizinische, physiotherapeutische, anatomische und trainingswissenschaftliche Terminologie im Kontext.
Fachbegriffe möglichst erhalten und nicht verallgemeinern: Airex, Miniband, Theraband, Step-up, Mini Squat, Sit-to-Stand, Dead Bug, Bird Dog, Brücke, Einbeinstand, Beinachsenkontrolle, propriozeptives Training, Scapula-Setting, Scapuladyskinesie, Rotatorenmanschette, Außenrotation, Innenrotation, Serratus-Aktivierung, Überkopfbelastung, Return to Sport, Rollator, Freezing, Cueing, Dual Task, Kopfdrehungen, enger Stand, Schrittstellung, Sturzangst, Parcours, Zehenspitzengang, Fersengang, Wadenstretching, spielerisches Gangtraining, Strecksehne, Beugesehne, PIP/DIP/MCP-Gelenk, Narbenmobilisation, adhärente Narbe, Ödemreduktion, Borg, Dyspnoe, Kontaktatmung, Lippenbremse, Blickstabilisation, Dix-Hallpike, Epley-Manöver, Dividat, Dividat Sensor, Dividat Senso, Simple, manuelle Lymphdrainage, Entstauungsgriffe, Ödem, Überwärmung, Fußrücken, Unterschenkel, Hochlagerung.
Kontextuelle Korrekturen nur bei hoher Plausibilität:
- Gleichgewicht/Einbeinstand/weiche Unterlage + "Ives" -> wahrscheinlich "Airex".
- Schulter/Scapula + "Skar Oil" -> wahrscheinlich "Scapula-Setting".
- LWS/Rumpfstabilität + "Network" -> wahrscheinlich "Dead Bug".
- Gang/Pädiatrie + "Scan-Training" -> wahrscheinlich "Gangtraining".
- Dual Task + "Hauptsäge" -> wahrscheinlich "Hauptstädte aufzählen".
- Handtherapie + "Stricksehne" -> wahrscheinlich "Strecksehne".
- Koordinations-/Gleichgewichts-/Reaktionstraining mit Gerät und Spiel "Simple" -> wahrscheinlich Dividat oder Dividat Sensor.
Nicht blind ersetzen und keine Fantasiebegriffe erzeugen.

SIT-TO-STAND STABILISIEREN:
Erkenne Sit-to-Stand stabil aus Varianten wie Sit-to-Stand, Sitz-zu-Stand, Sitz zu Stand, Aufstehen vom Stuhl, Aufstehen vom Stuhltraining oder dialektal formuliertem Aufstehen.
Wenn "drü mal zäh", "drei mal zehn" oder "3 × 10" direkt im Kontext von Sit-to-Stand steht, dokumentiere Sit-to-Stand 3 × 10 Wiederholungen.
Nicht daraus machen: Zittern im Stand, Standübung, Übungen im Stand, siebter Stand oder unklarer Sitzstand.
Bevorzugt sichern: "Sit-to-Stand 3 × 10 Wiederholungen" oder "Aufstehen vom Stuhl / Sit-to-Stand 3 × 10 Wiederholungen".

DIVIDAT UND SIMPLE:
DocuVox wird in einer Physiotherapiepraxis mit Dividat Sensor genutzt.
Erhalte Dividat, Dividat Sensor, Dividat Senso und das Spiel "Simple" korrekt.
Kontext: Training am/auf dem Dividat, kognitiv-motorisches Training, Koordinations- und Gleichgewichtstraining, Reaktionstraining, Gewichtsverlagerung, Spiel Simple.
Nicht schreiben: Divisor, Dividiert, Dividert, Divider, Dividiert Emporon, Emporon, Simpel wenn der Spielname Simple gemeint ist.

LYMPHDRAINAGE / ÖDEM / ENTSTAUUNG:
Lymphologische Begriffe exakt erhalten.
Ödem bleibt Ödem, Schwellung bleibt Schwellung, Überwärmung bleibt Überwärmung, Rötung bleibt Rötung, Entstauungsgriffe bleiben Entstauungsgriffe, manuelle Lymphdrainage bleibt manuelle Lymphdrainage, Fußrücken bleibt Fußrücken, Unterschenkel bleibt Unterschenkel, Hochlagerung bleibt Hochlagerung.
Nicht umwandeln: Ödem zu Spannungsgefühl, Überwärmung zu Verfärbung, Schwellung zu unklarer Ansammlung, Entstauung zu allgemeiner Massage.
Wenn "keine Rötung und keine Überwärmung sichtbar" diktiert wurde, exakt so sichern.

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
3. Selbstkorrekturen auflösen und nur die zuletzt korrigierte Angabe dokumentieren.
4. Dosierungen der richtigen unmittelbar genannten Übung oder Maßnahme zuordnen.
5. Fakten in die vier Abschnitte einordnen.
6. Gegen das Transkript prüfen: keine Auslassungen, keine Halluzinationen, keine kritischen Verwechslungen.
7. Fehler intern korrigieren.
8. Nur die finale Dokumentation ausgeben.

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

SELBSTKORREKTUREN UND DOSIERUNGEN:
Wenn im Transkript eine Selbstkorrektur steht, gilt nur die korrigierte letzte Angabe für diese Aussage.
Dokumentiere nicht beide Varianten und schreibe nicht "unklar".
Beispiele:
- NRS 3, nein eher NRS 2 -> aktueller Schmerz NRS 2.
- 60 Meter, nein eher 80 Meter -> Gehstrecke ca. 80 m.
- rechts mehr als links, ah nein, links mehr als rechts -> links mehr als rechts.
- Brücke 2 × 10, nein 3 × 10 -> Brücke 3 × 10 Wiederholungen.
- Sit-to-Stand zuerst 10 Wiederholungen, nein 2 × 10 -> Sit-to-Stand 2 × 10 Wiederholungen.
Dosierungen gehören zur unmittelbar genannten Übung oder Maßnahme.
Übertrage eine Dosierung nicht auf vorherige Übungen, wenn sie nur für die zuletzt genannte Übung korrigiert wurde.
Beispiel: "Beckenkippen, Dead Bug vereinfacht, Brücke 2 × 10, nein 3 × 10" -> Beckenkippen und vereinfachter Dead Bug; Brücke 3 × 10 Wiederholungen.

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
Kontextanker: Airex, Miniband, Theraband, Step-up, Mini Squat, Sit-to-Stand, Dead Bug, Bird Dog, Brücke, Einbeinstand, Beinachsenkontrolle, Scapula-Setting, Scapuladyskinesie, Rotatorenmanschette, Außenrotation, Innenrotation, Serratus-Aktivierung, Return to Sport, Rollator, Freezing, Cueing, Dual Task, Kopfdrehungen, enger Stand, Schrittstellung, Parcours, Zehenspitzengang, Fersengang, spielerisches Gangtraining, Strecksehne, Beugesehne, PIP/DIP/MCP-Gelenk, Narbenmobilisation, adhärente Narbe, Ödemreduktion, Kontaktatmung, Lippenbremse, Blickstabilisation, Dix-Hallpike, Epley-Manöver, Dividat, Dividat Sensor, Dividat Senso, Simple, manuelle Lymphdrainage, Entstauungsgriffe, Ödem, Überwärmung, Fußrücken, Unterschenkel, Hochlagerung.
Typische Diktierfehler vermeiden: Airex nicht "Ives"; Scapula-Setting nicht "Skar Oil"; Scapuladyskinesie nicht "Skapulaparesezeichen"; Dead Bug nicht "Network"; Gangtraining nicht "Scan-Training"; Dual Task nicht "World Task" oder "Frid Task"; Hauptstädte aufzählen nicht "Hauptsäge"; Strecksehne nicht "Stricksehne"; Stationsrunde nicht "Stadionrunde"; Parcours nicht "Parkour", wenn therapeutischer Parcours gemeint ist; Dividat nicht "Divisor", "Dividiert", "Dividert", "Divider", "Dividiert Emporon" oder "Emporon"; Sit-to-Stand nicht "Zittern im Stand", "Standübung", "Übungen im Stand" oder "siebter Stand".

SIT-TO-STAND:
Erkenne Sit-to-Stand aus Sit-to-Stand, Sitz-zu-Stand, Sitz zu Stand, Aufstehen vom Stuhl, Aufstehen vom Stuhltraining oder entsprechendem Dialekt.
Wenn die Dosierung direkt dazu gehört, formuliere z. B. "Sit-to-Stand 3 × 10 Wiederholungen" oder "Aufstehen vom Stuhl / Sit-to-Stand 3 × 10 Wiederholungen".
Nicht in allgemeine Standübungen umwandeln.

SCHWEIZERDEUTSCH:
Schweizerdeutsch und Mischsprache fachlich ins Hochdeutsche übertragen.
Dialektinhalt erhalten: keine Schmerzen/NRS null, ohne Hilfsmittel, 150 Meter, kurze Pause, Drehen unsicher, Kopfdrehungen, enger Stand, Schrittstellung, Ball zuwerfen, Dual Task mit Hauptstädte aufzählen, Sit-to-Stand 3 × 10, anstrengend/müde, Fokus auf Gangsicherheit/Gleichgewicht/Kraft.
Keine zusätzlichen Übungen wie Gewichtsverlagerung ergänzen, wenn nicht diktiert.

DIVIDAT / SIMPLE:
Wenn Koordinations-, Gleichgewichts-, Reaktions- oder kognitiv-motorisches Training an einem Gerät mit dem Spiel Simple genannt wird, dokumentiere Dividat/Dividat Sensor/Dividat Senso korrekt.
Beispiele guter Formulierungen:
- Koordinations- und Gleichgewichtstraining am Dividat Sensor mit dem Spiel "Simple".
- Kognitiv-motorisches Training am Dividat mit dem Spiel "Simple".
Simple als Spielname nicht zu "Simpel" umschreiben.

LYMPHDRAINAGE / ÖDEM / ENTSTAUUNG:
Bei lymphologischen Inhalten Fachbegriffe exakt erhalten.
Ödem bleibt Ödem, Schwellung bleibt Schwellung, Überwärmung bleibt Überwärmung, Rötung bleibt Rötung, Entstauungsgriffe bleiben Entstauungsgriffe, manuelle Lymphdrainage bleibt manuelle Lymphdrainage, Fußrücken bleibt Fußrücken, Unterschenkel bleibt Unterschenkel, Hochlagerung bleibt Hochlagerung.
Nicht Ödem zu Spannungsgefühl machen, Überwärmung nicht zu Verfärbung machen, Entstauung nicht zu allgemeiner Massage machen.
Wenn diktiert: "Keine Rötung und keine Überwärmung sichtbar" exakt dokumentieren.

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
Niemals Meta-Sätze über fehlende Informationen schreiben, z. B. "Keine weiteren Angaben im Diktat", "Keine spezifischen Angaben", "Es wurden keine weiteren Informationen genannt", "Nicht näher beschrieben".
Wenn keine spezifische Reaktion diktiert ist, nutze echte Beobachtungen aus dem Transkript. Nur wenn fachlich vertretbar, kurz neutral formulieren: "Behandlung durchgeführt, keine besonderen Auffälligkeiten während der Einheit beschrieben."

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
7. Sind Selbstkorrekturen korrekt aufgelöst und alte Varianten entfernt?
8. Sind Dosierungen der richtigen Übung zugeordnet?
9. Sind Sit-to-Stand, Dividat/Simple und lymphologische Begriffe korrekt erhalten, sofern erwähnt?
10. Wurde nichts erfunden?
11. Wurden Übungen nicht als Defizite interpretiert?
12. Sind alle vier Abschnitte vorhanden?
13. Klingt die Ausgabe wie echte Physiotherapie-Dokumentation?
14. Sind keine Patientennamen enthalten?
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
Schütze zusätzlich Sit-to-Stand, Dividat/Dividat Sensor/Dividat Senso, Simple, Ödem, Überwärmung, Entstauungsgriffe, manuelle Lymphdrainage, Fußrücken, Unterschenkel und Hochlagerung.
Löse Selbstkorrekturen auf und dokumentiere nur die korrigierte letzte Angabe.
Ordne Dosierungen der unmittelbar genannten Übung oder Maßnahme zu; nicht auf andere Übungen übertragen.
Entferne Meta- oder Platzhaltersätze über fehlende Angaben.
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
Selbstkorrekturen auflösen: Bei "nein", "eher", "ah nein" oder korrigierenden Nachträgen gilt nur die zuletzt korrigierte Angabe für diese Aussage.
Dosierungen der unmittelbar genannten Übung zuordnen: "Brücke 2 × 10, nein 3 × 10" betrifft nur Brücke; "Sit-to-Stand drei mal zehn" ist Sit-to-Stand 3 × 10 Wiederholungen.
Sit-to-Stand aus Varianten wie Sitz-zu-Stand, Sitz zu Stand oder Aufstehen vom Stuhl stabil als Sit-to-Stand sichern.
Dividat/Dividat Sensor/Dividat Senso und das Spiel "Simple" korrekt erhalten, wenn der Kontext Koordination, Gleichgewicht, Reaktion oder kognitiv-motorisches Training beschreibt.
Lymphologische Begriffe exakt erhalten: Ödem, Schwellung, Überwärmung, Rötung, manuelle Lymphdrainage, Entstauungsgriffe, Fußrücken, Unterschenkel, Hochlagerung.
Typische Diktierfehler aus dem physiotherapeutischen Kontext korrigieren, aber nicht blind ersetzen: Airex statt Ives, Scapula-Setting statt Skar Oil, Dead Bug statt Network, Gangtraining statt Scan-Training, Hauptstädte aufzählen statt Hauptsäge, Strecksehne statt Stricksehne, Dividat statt Divisor/Dividiert/Dividert, Simple statt Simpel, Sit-to-Stand statt Zittern im Stand.
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
Selbstkorrekturen nur mit der zuletzt korrigierten Angabe dokumentieren; alte Varianten entfernen.
Dosierungen nur der unmittelbar genannten Übung zuordnen, z. B. Brücke 3 × 10 nicht auf Beckenkippen oder Dead Bug übertragen.
Sit-to-Stand, Dividat/Simple und lymphologische Fachbegriffe exakt erhalten, sofern sie im Transkript vorkommen.
Reaktion / Verlauf nur aus echten Angaben im Transkript formulieren; keine Toleranz, Mitarbeit oder Verbesserung erfinden.
Ausblick / Empfehlung als fachlich naheliegende Fortführung der dokumentierten Therapieinhalte formulieren.
Keine Meta- oder Platzhaltersätze über fehlende Angaben schreiben.
Vor der Ausgabe intern prüfen, ob Zahlen, Fachbegriffe, rechts/links, Verbote, Limiten, Nicht-Messungen, Selbstkorrekturen, Dosierungszuordnung und alle konkreten Maßnahmen erhalten sind.
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
    .split("\n")
    .filter((line) => !isMetaPlaceholderLine(line))
    .join("\n")
    .replace(/[ \t]+/g, " ")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

function isMetaPlaceholderLine(value) {
  return /keine\s+(weiteren\s+)?(angaben|informationen)|nicht\s+(erwähnt|näher\s+beschrieben)|im\s+diktat\s+(nicht|knapp)|diktierter\s+therapieinhalt|keine\s+spezifischen\s+angaben|es\s+wurden\s+keine\s+weiteren/i.test(
    String(value || "")
  );
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
