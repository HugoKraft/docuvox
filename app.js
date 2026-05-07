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
