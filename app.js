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
  copyDocButton: document.querySelector("#copyDocButton"),
  createDocButton: document.querySelector("#createDocButton"),
  retryButton: document.querySelector("#retryButton"),
  errorState: document.querySelector("#errorState"),
  aiState: document.querySelector("#aiState"),
  copyState: document.querySelector("#copyState"),
  nextPatientButton: document.querySelector("#nextPatientButton"),
  backButton: document.querySelector("#backButton"),
  backBottomButton: document.querySelector("#backBottomButton"),
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
  els.copyDocButton.addEventListener("click", copyCurrentDocumentation);
  els.nextPatientButton.addEventListener("click", goToNextPatient);
  els.backButton.addEventListener("click", showList);
  els.backBottomButton.addEventListener("click", showList);
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
      <div class="patient-card-main">
        <h3>Patient ${patient.id}</h3>
        <span class="status ${patient.documentation ? "done" : active ? "active" : ""}">${getStatusLabel(patient, active)}</span>
      </div>
      <div class="patient-card-actions">
        <button class="primary-button" type="button" data-action="dictate">Diktieren</button>
        ${
          patient.documentation
            ? `<button class="icon-copy-button" type="button" data-action="copy" aria-label="Dokumentation von Patient ${patient.id} kopieren">
                <svg viewBox="0 0 24 24" aria-hidden="true">
                  <rect x="9" y="9" width="11" height="11" rx="2" />
                  <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1" />
                </svg>
                <span>Kopieren</span>
              </button>`
            : ""
        }
      </div>
    `;
    card.addEventListener("click", (event) => {
      const actionButton = event.target.closest("button");
      if (actionButton?.dataset.action === "copy") {
        event.stopPropagation();
        copyPatientDocumentation(patient.id, actionButton);
        return;
      }
      openPatient(patient.id);
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
  renderDocumentation(patient.documentation);
  els.editPanel.classList.add("hidden");
  els.errorState.classList.add("hidden");
  els.retryButton.classList.add("hidden");
  els.copyState.classList.add("hidden");
  els.aiState.classList.toggle("hidden", !patient.documentation);
  els.aiState.innerHTML = "<span></span>KI aktiv";
  els.copyDocButton.classList.toggle("hidden", !patient.documentation);
  els.copyDocButton.classList.remove("copied");
  els.copyDocButton.querySelector("span").textContent = "Dokumentation kopieren";
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
  els.startDictationButton.classList.remove("success");
  els.stopDictationButton.classList.toggle("hidden", !active);
  els.startDictationButton.querySelector(".mic-label").textContent = active ? "Aufnahme läuft..." : "Diktat starten";
  els.speechStatus.textContent = active ? "Aufnahme läuft. Danach stoppen." : "Bereit für Spracheingabe.";
}

function showDictationSuccess() {
  els.startDictationButton.classList.remove("recording");
  els.startDictationButton.classList.add("success");
  els.startDictationButton.querySelector(".mic-label").textContent = "Doku erstellt";
  window.setTimeout(() => {
    if (!isRecording) {
      els.startDictationButton.classList.remove("success");
      els.startDictationButton.querySelector(".mic-label").textContent = "Diktat starten";
    }
  }, 1300);
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
    renderDocumentation(documentation);
    showDictationSuccess();
    els.aiState.innerHTML = "<span></span>KI aktiv";
    els.aiState.classList.remove("hidden");
    els.copyState.classList.add("hidden");
    els.copyDocButton.classList.remove("hidden");
    els.copyDocButton.classList.remove("copied");
    els.copyDocButton.querySelector("span").textContent = "Dokumentation kopieren";
    els.nextPatientButton.classList.remove("hidden");
    updateNextButton();
    saveState();
    toast("KI-Dokumentation erstellt.");
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
  els.copyDocButton.classList.add("hidden");
  els.nextPatientButton.classList.add("hidden");
  els.aiState.innerHTML = "<span></span>KI nicht aktiv";
  els.aiState.classList.remove("hidden");
  toast("KI-Verarbeitung fehlgeschlagen – bitte erneut versuchen.");
}

async function copyCurrentDocumentation() {
  const patient = getCurrentPatient();
  if (!patient?.documentation) {
    toast("Noch keine Dokumentation vorhanden.");
    return;
  }

  const copied = await copyText(patient.documentation, "Dokumentation kopiert.");
  if (!copied) return;

  showCopyConfirmation();
  showCopyButtonSuccess(els.copyDocButton);
}

async function copyPatientDocumentation(patientId, button) {
  const patient = state.patients.find((item) => item.id === patientId);
  if (!patient?.documentation) {
    toast("Noch keine Dokumentation vorhanden.");
    return;
  }

  const copied = await copyText(patient.documentation, `Patient ${patient.id} kopiert.`);
  if (copied && button) showCopyButtonSuccess(button);
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
  renderAllDocs();
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
    return true;
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
    return copied;
  }
}

function showCopyConfirmation() {
  els.copyState.classList.remove("hidden");
  window.clearTimeout(showCopyConfirmation.timeout);
  showCopyConfirmation.timeout = window.setTimeout(() => {
    els.copyState.classList.add("hidden");
  }, 2000);
}

function showCopyButtonSuccess(button) {
  const label = button.querySelector("span");
  const originalText = label ? label.textContent : button.textContent;
  const originalHtml = button.dataset.originalHtml || button.innerHTML;
  button.dataset.originalHtml = originalHtml;
  button.classList.add("copied");
  if (label) {
    label.textContent = "Kopiert";
  } else {
    button.textContent = "✓ Kopiert";
  }

  window.setTimeout(() => {
    button.classList.remove("copied");
    if (label) {
      label.textContent = originalText;
    } else {
      button.innerHTML = originalHtml;
    }
  }, 1600);
}

function getAllDocsText() {
  return state.patients
    .filter((patient) => patient.documentation)
    .map((patient) => patient.documentation)
    .join("\n\n");
}

function renderDocumentation(documentation) {
  if (!documentation) {
    els.finalDoc.innerHTML = `<p class="doc-placeholder">Nach dem Stoppen erscheint hier die KI-Dokumentation.</p>`;
    return;
  }

  els.finalDoc.innerHTML = documentationToHtml(documentation);
}

function renderAllDocs() {
  const documentedPatients = state.patients.filter((patient) => patient.documentation);
  els.allDocsText.innerHTML = "";

  if (!documentedPatients.length) {
    els.allDocsText.innerHTML = `<p class="doc-placeholder">Noch keine fertigen Dokumentationen vorhanden.</p>`;
    return;
  }

  documentedPatients.forEach((patient) => {
    const entry = document.createElement("article");
    entry.className = "all-doc-entry";
    entry.innerHTML = `
      <div class="all-doc-entry-top">
        <h3>Patient ${patient.id}</h3>
        <button class="icon-copy-button" type="button">
          <svg viewBox="0 0 24 24" aria-hidden="true">
            <rect x="9" y="9" width="11" height="11" rx="2" />
            <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1" />
          </svg>
          <span>Kopieren</span>
        </button>
      </div>
      <div class="documentation-box compact-doc">${documentationToHtml(patient.documentation)}</div>
    `;
    entry.querySelector("button").addEventListener("click", () => copyPatientDocumentation(patient.id, entry.querySelector("button")));
    els.allDocsText.append(entry);
  });
}

function documentationToHtml(documentation) {
  const patientTitle = extractPatientTitle(documentation);
  const sections = extractDocumentationSections(documentation);
  const sectionHtml = sections
    .map(
      (section) => `
        <section class="doc-section">
          <h3>${escapeHtml(section.title)}</h3>
          <ul>
            ${section.points.map((point) => `<li>${escapeHtml(point)}</li>`).join("")}
          </ul>
        </section>
      `
    )
    .join("");

  return `
    <div class="doc-patient-title">${escapeHtml(patientTitle)}</div>
    ${sectionHtml}
  `;
}

function extractPatientTitle(documentation) {
  const match = String(documentation || "").match(/Patient\s+\d+/i);
  return match ? match[0].replace(/^patient/i, "Patient") : "Patient";
}

function extractDocumentationSections(documentation) {
  const order = ["Befund aktuell", "Behandlung", "Reaktion / Verlauf", "Ausblick / Empfehlung"];
  return order.map((title, index) => {
    const nextTitles = order
      .filter((_, nextIndex) => nextIndex > index)
      .map(escapeRegExp)
      .join("|");
    const endPattern = nextTitles ? `(?=\\n\\s*•?\\s*(?:${nextTitles})\\s*:|$)` : "$";
    const pattern = new RegExp(`(?:^|\\n)\\s*•?\\s*${escapeRegExp(title)}\\s*:\\s*([\\s\\S]*?)${endPattern}`, "i");
    const match = String(documentation || "").match(pattern);
    return {
      title,
      points: splitSectionPoints(match?.[1] || "Keine weiteren Angaben dokumentiert."),
    };
  });
}

function splitSectionPoints(value) {
  const clean = String(value || "")
    .replace(/\r/g, "")
    .trim();
  const lines = clean
    .split(/\n+/)
    .map((line) => line.replace(/^[-•]\s*/, "").trim())
    .filter(Boolean);

  if (lines.length > 1) return lines;
  if (lines.length === 1) return [lines[0]];

  return ["Keine weiteren Angaben dokumentiert."];
}

function escapeHtml(value) {
  return String(value)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

function escapeRegExp(value) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
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
