const sectionNames = [
  "Befund aktuell",
  "Behandlung",
  "Reaktion / Verlauf",
  "Ausblick / Empfehlung",
];

let state = loadState();
let currentPatientId = null;
let recognition = null;
let isRecording = false;
let finalTranscript = "";

const els = {
  allDocsText: document.querySelector("#allDocsText"),
  allDocsView: document.querySelector("#allDocsView"),
  backButton: document.querySelector("#backButton"),
  backFromAllButton: document.querySelector("#backFromAllButton"),
  copyAllButton: document.querySelector("#copyAllButton"),
  copyAllTopButton: document.querySelector("#copyAllTopButton"),
  copyState: document.querySelector("#copyState"),
  createDocButton: document.querySelector("#createDocButton"),
  dayForm: document.querySelector("#dayForm"),
  dayTitle: document.querySelector("#dayTitle"),
  detailView: document.querySelector("#detailView"),
  editButton: document.querySelector("#editButton"),
  editPanel: document.querySelector("#editPanel"),
  finalDoc: document.querySelector("#finalDoc"),
  listView: document.querySelector("#listView"),
  newDayButton: document.querySelector("#newDayButton"),
  nextPatientButton: document.querySelector("#nextPatientButton"),
  patientCount: document.querySelector("#patientCount"),
  patientGrid: document.querySelector("#patientGrid"),
  patientPosition: document.querySelector("#patientPosition"),
  patientTitle: document.querySelector("#patientTitle"),
  progressBar: document.querySelector("#progressBar"),
  progressText: document.querySelector("#progressText"),
  rawText: document.querySelector("#rawText"),
  showAllButton: document.querySelector("#showAllButton"),
  speechStatus: document.querySelector("#speechStatus"),
  startDictationButton: document.querySelector("#startDictationButton"),
  startView: document.querySelector("#startView"),
  stopDictationButton: document.querySelector("#stopDictationButton"),
  toast: document.querySelector("#toast"),
};

initSpeech();
bindEvents();
registerServiceWorker();
renderInitialView();

function bindEvents() {
  els.dayForm.addEventListener("submit", createDayList);
  document.querySelectorAll("[data-count]").forEach((button) => {
    button.addEventListener("click", () => pickCount(button));
  });
  els.newDayButton.addEventListener("click", resetDay);
  els.backButton.addEventListener("click", showList);
  els.backFromAllButton.addEventListener("click", showList);
  els.showAllButton.addEventListener("click", showAllDocs);
  els.copyAllButton.addEventListener("click", copyAllDocs);
  els.copyAllTopButton.addEventListener("click", copyAllDocs);
  els.startDictationButton.addEventListener("click", startDictation);
  els.stopDictationButton.addEventListener("click", stopDictation);
  els.createDocButton.addEventListener("click", createDocumentation);
  els.nextPatientButton.addEventListener("click", goToNextPatient);
  els.editButton.addEventListener("click", toggleEdit);
  els.rawText.addEventListener("input", saveCurrentRawText);
}

function initSpeech() {
  const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;

  if (!SpeechRecognition) {
    els.speechStatus.textContent = "Spracheingabe nicht verfügbar. Text kann über Bearbeiten eingetippt werden.";
    els.startDictationButton.disabled = true;
    return;
  }

  recognition = new SpeechRecognition();
  recognition.lang = "de-CH";
  recognition.continuous = true;
  recognition.interimResults = true;
  els.speechStatus.textContent = "Bereit für Spracheingabe.";

  recognition.onresult = (event) => {
    let interimTranscript = "";
    for (let index = event.resultIndex; index < event.results.length; index += 1) {
      const transcript = event.results[index][0].transcript.trim();
      if (event.results[index].isFinal) {
        finalTranscript += `${transcript} `;
      } else {
        interimTranscript += transcript;
      }
    }
    els.rawText.value = `${finalTranscript}${interimTranscript}`.trim();
    saveCurrentRawText();
  };

  recognition.onerror = () => {
    setRecordingState(false);
    toast("Diktat wurde unterbrochen.");
  };

  recognition.onend = () => {
    if (isRecording) recognition.start();
  };
}

function pickCount(button) {
  document.querySelectorAll("[data-count]").forEach((item) => item.classList.remove("active"));
  button.classList.add("active");

  if (button.dataset.count === "other") {
    els.patientCount.value = "";
    els.patientCount.focus();
    return;
  }

  els.patientCount.value = button.dataset.count;
}

function createDayList(event) {
  event.preventDefault();
  const count = Number(els.patientCount.value);

  if (!Number.isInteger(count) || count < 1) {
    toast("Bitte eine Patientenzahl eingeben.");
    return;
  }

  state = {
    date: today(),
    activePatientId: null,
    patients: Array.from({ length: count }, (_, index) => ({
      id: index + 1,
      rawText: "",
      documentation: "",
      status: "open",
    })),
  };
  currentPatientId = null;
  saveState();
  renderList();
  showView("list");
}

function resetDay() {
  if (isRecording) stopDictation(false);
  state = window.docuVoxStorage.clearDayState(createEmptyState);
  currentPatientId = null;
  els.patientCount.value = "";
  document.querySelectorAll("[data-count]").forEach((item) => item.classList.remove("active"));
  showView("start");
}

function renderInitialView() {
  if (state.patients.length) {
    renderList();
    showView("list");
  } else {
    showView("start");
  }
}

function renderList() {
  const done = state.patients.filter((patient) => patient.documentation).length;
  const total = state.patients.length;
  const percent = total ? Math.round((done / total) * 100) : 0;

  els.dayTitle.textContent = `${total} Patienten heute`;
  els.progressText.textContent = `Heute ${done} / ${total} erledigt`;
  els.progressBar.style.width = `${percent}%`;
  els.patientGrid.innerHTML = "";

  state.patients.forEach((patient) => {
    const card = document.createElement("article");
    const active = patient.id === state.activePatientId && !patient.documentation;
    card.className = `patient-card${active ? " active" : ""}`;
    card.innerHTML = `
      <h3>Patient ${patient.id}</h3>
      <span class="status ${patient.documentation ? "done" : active ? "active" : ""}">
        ${getStatusLabel(patient, active)}
      </span>
      <button class="primary-button" type="button">Diktieren</button>
    `;
    card.querySelector("button").addEventListener("click", () => openPatient(patient.id));
    card.addEventListener("click", (event) => {
      if (event.target.tagName !== "BUTTON") openPatient(patient.id);
    });
    els.patientGrid.append(card);
  });
}

function getStatusLabel(patient, active) {
  if (patient.documentation) return "✅ fertig";
  if (active) return "🔵 in Bearbeitung";
  return "⚪ offen";
}

function openPatient(patientId) {
  if (isRecording) stopDictation(false);
  currentPatientId = patientId;
  state.activePatientId = patientId;
  const patient = getCurrentPatient();

  els.patientTitle.textContent = `Patient ${patient.id}`;
  els.patientPosition.textContent = `${patient.id} von ${state.patients.length}`;
  els.rawText.value = patient.rawText || "";
  els.finalDoc.value = patient.documentation || "";
  els.copyState.classList.toggle("hidden", !patient.documentation);
  els.nextPatientButton.classList.toggle("hidden", !patient.documentation);
  els.editPanel.classList.add("hidden");
  updateNextButton();
  saveState();
  showView("detail");
}

function showList() {
  if (isRecording) stopDictation(false);
  renderList();
  showView("list");
}

function showAllDocs() {
  els.allDocsText.textContent = getAllDocsText() || "Noch keine fertigen Dokumentationen vorhanden.";
  showView("all");
}

function startDictation() {
  if (!recognition || isRecording) return;
  const patient = getCurrentPatient();
  if (patient) {
    patient.status = "active";
    state.activePatientId = patient.id;
    saveState();
  }
  finalTranscript = `${els.rawText.value.trim()} `;
  recognition.start();
  setRecordingState(true);
}

function stopDictation(shouldCreate = true) {
  if (!recognition || !isRecording) return;
  recognition.stop();
  setRecordingState(false);
  saveCurrentRawText();
  if (shouldCreate) createDocumentation();
}

function setRecordingState(active) {
  isRecording = active;
  els.startDictationButton.classList.toggle("recording", active);
  els.stopDictationButton.classList.toggle("hidden", !active);
  els.startDictationButton.querySelector("strong").textContent = active ? "Diktat läuft" : "Diktat starten";
  els.speechStatus.textContent = active ? "Aufnahme läuft. Danach stoppen." : "Bereit für Spracheingabe.";
}

function saveCurrentRawText() {
  const patient = getCurrentPatient();
  if (!patient) return;
  patient.rawText = els.rawText.value.trim();
  saveState();
}

async function createDocumentation() {
  const patient = getCurrentPatient();
  if (!patient) return;

  const documentation = structureDictation(els.rawText.value);
  if (!documentation) return;

  patient.rawText = els.rawText.value.trim();
  patient.documentation = documentation;
  patient.status = "done";
  els.finalDoc.value = documentation;
  els.copyState.classList.remove("hidden");
  els.nextPatientButton.classList.remove("hidden");
  updateNextButton();
  saveState();
  await copyText(`Patient ${patient.id}:\n${documentation}`, "Dokumentation kopiert.");
}

function goToNextPatient() {
  const next = state.patients.find((patient) => patient.id > currentPatientId && !patient.documentation);
  if (next) {
    openPatient(next.id);
    return;
  }
  showList();
}

function updateNextButton() {
  const next = state.patients.find((patient) => patient.id > currentPatientId && !patient.documentation);
  els.nextPatientButton.textContent = next ? `Weiter zu Patient ${next.id}` : "Zurück zur Tagesliste";
}

function toggleEdit() {
  els.editPanel.classList.toggle("hidden");
}

async function copyAllDocs() {
  const text = getAllDocsText();
  if (!text) {
    toast("Noch keine fertigen Dokumentationen vorhanden.");
    return;
  }
  await copyText(text, "Alle Dokumentationen kopiert.");
}

async function copyText(text, message) {
  try {
    await navigator.clipboard.writeText(text);
    toast(message);
  } catch {
    const helper = document.createElement("textarea");
    helper.value = text;
    helper.style.position = "fixed";
    helper.style.opacity = "0";
    document.body.append(helper);
    helper.select();
    const copied = document.execCommand("copy");
    helper.remove();
    toast(copied ? message : "Kopieren ist in diesem Browser nicht erlaubt.");
  }
}

function structureDictation(rawText) {
  const cleanText = anonymize(rawText).trim();
  if (!cleanText) {
    toast("Bitte zuerst ein Diktat eingeben.");
    return "";
  }

  const sentences = splitSentences(cleanText).map(cleanSentence).filter(Boolean);
  const groups = {
    "Befund aktuell": [],
    Behandlung: [],
    "Reaktion / Verlauf": [],
    "Ausblick / Empfehlung": [],
  };

  sentences.forEach((sentence) => {
    groups[classify(sentence)].push(sentence);
  });

  const result = {
    "Befund aktuell": shortLine(groups["Befund aktuell"]),
    Behandlung: shortLine(groups.Behandlung),
    "Reaktion / Verlauf": shortLine(groups["Reaktion / Verlauf"]),
    "Ausblick / Empfehlung": shortLine(groups["Ausblick / Empfehlung"]) || "Heimprogramm fortführen und Verlauf weiter kontrollieren.",
  };

  return sectionNames.map((name) => `${name}:\n${result[name]}`).join("\n\n");
}

function classify(sentence) {
  const text = sentence.toLowerCase();
  if (hasAny(text, ["übung", "uebung", "training", "mobilisation", "kräftigung", "kraeftigung", "gangschule", "gleichgewicht", "dehnung", "manuell", "behandlung"])) {
    return "Behandlung";
  }
  if (hasAny(text, ["reagiert", "toleriert", "verlauf", "fortschritt", "besser", "schlechter", "schmerzreduktion", "stabiler", "unsicher", "ermüdung", "ermuedung"])) {
    return "Reaktion / Verlauf";
  }
  if (hasAny(text, ["empfohlen", "empfehlung", "weiter", "heimprogramm", "nächste", "naechste", "kontrolle", "steigern", "fortführen", "fortfuehren"])) {
    return "Ausblick / Empfehlung";
  }
  return "Befund aktuell";
}

function splitSentences(text) {
  return text
    .replace(/\s+/g, " ")
    .split(/(?<=[.!?])\s+|,\s+(?=(heute|weiter|danach|nachher|aktuell|patient|übungen|uebungen|empfehlung)\b)/i);
}

function cleanSentence(sentence) {
  return sentence
    .replace(/\bich habe\b|\bwir haben\b|\bhalt\b|\beigentlich\b|\bsozusagen\b|\bquasi\b/gi, "")
    .replace(/\s+/g, " ")
    .replace(/^[,.\s]+/, "")
    .trim()
    .replace(/^[a-zäöü]/, (match) => match.toUpperCase());
}

function shortLine(items) {
  if (!items.length) return "";
  return ensurePeriod(items.join(" ").split(" ").slice(0, 24).join(" "));
}

function ensurePeriod(text) {
  if (!text) return "";
  return /[.!?]$/.test(text) ? text : `${text}.`;
}

function hasAny(text, terms) {
  return terms.some((term) => text.includes(term));
}

function anonymize(text) {
  return text
    .replace(/\b(Herr|Frau|Patientin|Name|Klient|Klientin)\s+[A-ZÄÖÜ][A-Za-zÄÖÜäöüß-]+/g, "Patient")
    .replace(/\b[A-ZÄÖÜ][a-zäöüß]+ [A-ZÄÖÜ][a-zäöüß]+\b/g, "Patient");
}

function getAllDocsText() {
  return state.patients
    .filter((patient) => patient.documentation)
    .map((patient) => `Patient ${patient.id}:\n${patient.documentation}`)
    .join("\n\n");
}

function getCurrentPatient() {
  return state.patients.find((patient) => patient.id === currentPatientId);
}

function showView(view) {
  els.startView.classList.toggle("hidden", view !== "start");
  els.listView.classList.toggle("hidden", view !== "list");
  els.detailView.classList.toggle("hidden", view !== "detail");
  els.allDocsView.classList.toggle("hidden", view !== "all");
}

function loadState() {
  return window.docuVoxStorage.loadDayState(createEmptyState);
}

function saveState() {
  window.docuVoxStorage.saveDayState(state);
}

function createEmptyState() {
  return { date: today(), activePatientId: null, patients: [] };
}

function today() {
  return new Date().toISOString().slice(0, 10);
}

function toast(message) {
  els.toast.textContent = message;
  els.toast.classList.add("visible");
  window.clearTimeout(toast.timeout);
  toast.timeout = window.setTimeout(() => {
    els.toast.classList.remove("visible");
  }, 2200);
}

function registerServiceWorker() {
  if (!("serviceWorker" in navigator)) return;
  if (!window.isSecureContext) return;

  window.addEventListener("load", () => {
    navigator.serviceWorker.register("/sw.js").catch(() => {
      // PWA registration is best-effort in local test mode.
    });
  });
}
