const STORAGE_KEY = "docuvox-day-v3";

let state = loadState();
let currentPatientId = null;
let recognition = null;
let isRecording = false;
let finalTranscript = "";

const els = {
  startView: document.querySelector("#startView"),
  listView: document.querySelector("#listView"),
  detailView: document.querySelector("#detailView"),
  allDocsView: document.querySelector("#allDocsView"),
  dayForm: document.querySelector("#dayForm"),
  patientCount: document.querySelector("#patientCount"),
  patientGrid: document.querySelector("#patientGrid"),
  dayTitle: document.querySelector("#dayTitle"),
  progressText: document.querySelector("#progressText"),
  progressBar: document.querySelector("#progressBar"),
  patientTitle: document.querySelector("#patientTitle"),
  patientPosition: document.querySelector("#patientPosition"),
  startDictationButton: document.querySelector("#startDictationButton"),
  stopDictationButton: document.querySelector("#stopDictationButton"),
  speechStatus: document.querySelector("#speechStatus"),
  rawText: document.querySelector("#rawText"),
  finalDoc: document.querySelector("#finalDoc"),
  editPanel: document.querySelector("#editPanel"),
  editButton: document.querySelector("#editButton"),
  createDocButton: document.querySelector("#createDocButton"),
  retryButton: document.querySelector("#retryButton"),
  errorState: document.querySelector("#errorState"),
  aiState: document.querySelector("#aiState"),
  copyState: document.querySelector("#copyState"),
  nextPatientButton: document.querySelector("#nextPatientButton"),
  backButton: document.querySelector("#backButton"),
  backFromAllButton: document.querySelector("#backFromAllButton"),
  showAllButton: document.querySelector("#showAllButton"),
  copyAllButton: document.querySelector("#copyAllButton"),
  copyAllTopButton: document.querySelector("#copyAllTopButton"),
  newDayButton: document.querySelector("#newDayButton"),
  allDocsText: document.querySelector("#allDocsText"),
  toast: document.querySelector("#toast"),
};

bindEvents();
initSpeech();
registerServiceWorker();
renderInitialView();

function bindEvents() {
  els.dayForm.addEventListener("submit", createDayList);
  document.querySelectorAll("[data-count]").forEach((button) => {
    button.addEventListener("click", () => pickCount(button));
  });
  els.startDictationButton.addEventListener("click", startDictation);
  els.stopDictationButton.addEventListener("click", stopDictation);
  els.createDocButton.addEventListener("click", createDocumentation);
  els.retryButton.addEventListener("click", createDocumentation);
  els.editButton.addEventListener("click", () => els.editPanel.classList.toggle("hidden"));
  els.nextPatientButton.addEventListener("click", goToNextPatient);
  els.backButton.addEventListener("click", showList);
  els.backFromAllButton.addEventListener("click", showList);
  els.showAllButton.addEventListener("click", showAllDocs);
  els.copyAllButton.addEventListener("click", copyAllDocs);
  els.copyAllTopButton.addEventListener("click", copyAllDocs);
  els.newDayButton.addEventListener("click", resetDay);
  els.rawText.addEventListener("input", saveCurrentRawText);
}

function initSpeech() {
  const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;

  if (!SpeechRecognition) {
    els.speechStatus.textContent = "Spracheingabe nicht verfügbar. Über Bearbeiten kann Text eingegeben werden.";
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
  state = createEmptyState();
  currentPatientId = null;
  els.patientCount.value = "";
  document.querySelectorAll("[data-count]").forEach((item) => item.classList.remove("active"));
  saveState();
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
    const active = patient.id === state.activePatientId && !patient.documentation;
    const card = document.createElement("article");
    card.className = `patient-card${active ? " active" : ""}`;
    card.innerHTML = `
      <h3>Patient ${patient.id}</h3>
      <span class="status ${patient.documentation ? "done" : active ? "active" : ""}">${getStatusLabel(patient, active)}</span>
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
  els.editPanel.classList.add("hidden");
  els.errorState.classList.add("hidden");
  els.retryButton.classList.add("hidden");
  els.copyState.classList.toggle("hidden", !patient.documentation);
  els.aiState.classList.toggle("hidden", !patient.documentation);
  els.aiState.textContent = patient.documentation ? "KI aktiv" : "";
  els.nextPatientButton.classList.toggle("hidden", !patient.documentation);
  updateNextButton();
  saveState();
  showView("detail");
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

  if (shouldCreate) {
    createDocumentation();
  }
}

function setRecordingState(active) {
  isRecording = active;
  els.startDictationButton.classList.toggle("recording", active);
  els.stopDictationButton.classList.toggle("hidden", !active);
  els.startDictationButton.querySelector("strong").textContent = active ? "Diktat läuft" : "Diktat starten";
  els.speechStatus.textContent = active ? "Aufnahme läuft. Danach stoppen." : "Bereit für Spracheingabe.";
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
  hideResultStates();

  try {
    const documentation = await createAiDocumentation(rawText, `Patient ${patient.id}`);
    patient.rawText = rawText;
    patient.documentation = documentation;
    patient.status = "done";
    els.finalDoc.value = documentation;
    els.aiState.textContent = "KI aktiv";
    els.aiState.classList.remove("hidden");
    els.copyState.classList.remove("hidden");
    els.nextPatientButton.classList.remove("hidden");
    updateNextButton();
    saveState();
    await copyText(documentation, "Dokumentation kopiert.");
  } catch (error) {
    showAiError(error.message);
  } finally {
    setProcessingState(false);
  }
}

async function createAiDocumentation(rawText, patientLabel) {
  const response = await fetch("/api/document", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      text: rawText,
      patientLabel,
    }),
  });

  const data = await response.json().catch(() => ({}));
  if (!response.ok || !data.documentation) {
    const message = data.error || "KI-Verarbeitung fehlgeschlagen – bitte erneut versuchen.";
    const details = data.details ? ` ${data.details}` : "";
    throw new Error(`${message}${details}`);
  }

  return String(data.documentation).trim();
}

function setProcessingState(active) {
  els.createDocButton.disabled = active;
  els.retryButton.disabled = active;
  els.stopDictationButton.disabled = active;
  els.startDictationButton.disabled = active;
  els.speechStatus.textContent = active ? "KI verarbeitet das Diktat..." : "Bereit für Spracheingabe.";
}

function hideResultStates() {
  els.errorState.classList.add("hidden");
  els.retryButton.classList.add("hidden");
  els.copyState.classList.add("hidden");
  els.aiState.classList.add("hidden");
}

function showAiError(message = "KI-Verarbeitung fehlgeschlagen – bitte erneut versuchen.") {
  els.errorState.textContent = "KI-Verarbeitung fehlgeschlagen – bitte erneut versuchen.";
  if (message && !message.includes("KI-Verarbeitung fehlgeschlagen")) {
    els.errorState.textContent += ` ${message}`;
  }
  els.errorState.classList.remove("hidden");
  els.retryButton.classList.remove("hidden");
  els.copyState.classList.add("hidden");
  els.nextPatientButton.classList.add("hidden");
  els.aiState.textContent = "KI nicht aktiv";
  els.aiState.classList.remove("hidden");
  toast("KI-Verarbeitung fehlgeschlagen – bitte erneut versuchen.");
}

function saveCurrentRawText() {
  const patient = getCurrentPatient();
  if (!patient) return;
  patient.rawText = els.rawText.value.trim();
  saveState();
}

function goToNextPatient() {
  const next = state.patients.find((patient) => patient.id > currentPatientId && !patient.documentation);
  if (next) {
    openPatient(next.id);
  } else {
    showList();
  }
}

function updateNextButton() {
  const next = state.patients.find((patient) => patient.id > currentPatientId && !patient.documentation);
  els.nextPatientButton.textContent = next ? `Weiter zu Patient ${next.id}` : "Zurück zur Tagesliste";
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

function getAllDocsText() {
  return state.patients
    .filter((patient) => patient.documentation)
    .map((patient) => patient.documentation)
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
  try {
    const saved = JSON.parse(localStorage.getItem(STORAGE_KEY));
    if (saved && Array.isArray(saved.patients)) return saved;
  } catch {
    return createEmptyState();
  }
  return createEmptyState();
}

function saveState() {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
}

function createEmptyState() {
  return {
    date: today(),
    activePatientId: null,
    patients: [],
  };
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
    navigator.serviceWorker.register("/sw.js").catch(() => {});
  });
}
