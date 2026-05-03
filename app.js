let state = loadState();
let currentPatientId = null;
let recognition = null;
let isRecording = false;
let finalTranscript = "";

const els = {
  allDocsText: document.querySelector("#allDocsText"),
  allDocsView: document.querySelector("#allDocsView"),
  aiState: document.querySelector("#aiState"),
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
  
