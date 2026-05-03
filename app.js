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
  errorState: document.querySelector("#errorState"),
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
  retryButton: document.querySelector("#retryButton"),
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
  els.retryButton.addEventListener("click", createDocumentation);
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
  els.finalDoc.value = patient.documentation ? normalizeDisplayedDocumentation(patient.documentation, patient.id) : "";
  els.copyState.classList.toggle("hidden", !patient.documentation);
  els.errorState.classList.add("hidden");
  els.retryButton.classList.add("hidden");
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

  const rawText = els.rawText.value.trim();
  if (!rawText) {
    toast("Bitte zuerst ein Diktat eingeben.");
    return;
  }

  setProcessingState(true);

  let documentation = "";
  try {
    documentation = await createAiDocumentation(rawText, patient.id);
  } catch (error) {
    setProcessingState(false);
    showAiError(error.message);
    return;
  }

  patient.rawText = rawText;
  patient.documentation = documentation;
  patient.status = "done";
  els.finalDoc.value = documentation;
  els.copyState.classList.remove("hidden");
  els.errorState.classList.add("hidden");
  els.retryButton.classList.add("hidden");
  els.nextPatientButton.classList.remove("hidden");
  updateNextButton();
  saveState();
  setProcessingState(false);
  await copyText(documentation, "Dokumentation kopiert.");
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

async function createAiDocumentation(rawText, patientNumber) {
  const response = await fetch("/api/document", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ rawText, patientNumber }),
  });

  const data = await response.json().catch(() => ({}));
  if (!response.ok || !data.documentation) {
    const details = data.details ? ` ${data.details}` : "";
    throw new Error(`${data.error || "KI-Verarbeitung fehlgeschlagen. Bitte erneut versuchen."}${details}`);
  }

  return data.documentation.trim();
}

function setProcessingState(active) {
  els.createDocButton.disabled = active;
  els.retryButton.disabled = active;
  els.stopDictationButton.disabled = active;
  els.startDictationButton.disabled = active;
  els.speechStatus.textContent = active ? "KI verarbeitet das Diktat..." : "Bereit für Spracheingabe.";
}

function showAiError(message = "KI-Verarbeitung fehlgeschlagen. Bitte erneut versuchen.") {
  els.errorState.textContent = message;
  els.errorState.classList.remove("hidden");
  els.retryButton.classList.remove("hidden");
  els.copyState.classList.add("hidden");
  els.nextPatientButton.classList.add("hidden");
  toast("KI-Verarbeitung fehlgeschlagen. Bitte erneut versuchen.");
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

function getAllDocsText() {
  return state.patients
    .filter((patient) => patient.documentation)
    .map((patient) => normalizeDisplayedDocumentation(patient.documentation, patient.id))
    .join("\n\n");
}

function normalizeDisplayedDocumentation(text, patientNumber) {
  const sections = {
    "Befund aktuell": extractDisplaySection(text, "Befund aktuell") || "Aktueller Befund aus Diktat nicht eindeutig ableitbar.",
    Behandlung: extractDisplaySection(text, "Behandlung") || "Therapeutische Behandlung gemäss Diktat durchgeführt.",
    "Reaktion / Verlauf": extractDisplaySection(text, "Reaktion / Verlauf") || "Behandlung wurde toleriert, weiterer Verlauf beobachten.",
    "Ausblick / Empfehlung": extractDisplaySection(text, "Ausblick / Empfehlung") || "Weiterführung der Therapie mit Fokus auf Funktion, Sicherheit und Selbstständigkeit.",
  };

  return `Patient ${patientNumber}

• Befund aktuell: ${ensureDisplayPeriod(sections["Befund aktuell"])}
• Behandlung: ${ensureDisplayPeriod(sections.Behandlung)}
• Reaktion / Verlauf: ${ensureDisplayPeriod(sections["Reaktion / Verlauf"])}
• Ausblick / Empfehlung: ${ensureDisplayPeriod(sections["Ausblick / Empfehlung"])}`;
}

function extractDisplaySection(text, sectionName) {
  const sectionOrder = [
    "Befund aktuell",
    "Behandlung",
    "Reaktion / Verlauf",
    "Ausblick / Empfehlung",
  ];
  const escaped = sectionName.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const nextSections = sectionOrder
    .filter((name) => name !== sectionName)
    .map((name) => name.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"))
    .join("|");
  const pattern = new RegExp(`(?:•\\s*)?${escaped}\\s*:\\s*([\\s\\S]*?)(?=\\n\\s*(?:•\\s*)?(?:${nextSections})\\s*:|$)`, "i");
  const match = String(text || "").match(pattern);

  return (match?.[1] || "")
    .replace(/^[-•\s]+/, "")
    .replace(/\s+/g, " ")
    .trim();
}

function ensureDisplayPeriod(text) {
  const clean = String(text || "").trim();
  return /[.!?]$/.test(clean) ? clean : `${clean}.`;
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
