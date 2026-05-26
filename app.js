const STORAGE_PREFIX = "docuvox_state_";
const BACKUP_PREFIX = "docuvox_last_day_backup_";
const SESSION_KEY = "docuvox_active_user";
const USERS_KEY = "docuvox_users";
const MODEL_STATUS_LABEL = "KI aktiv";
const PROCESSING_MESSAGE = "Dokumentation wird erstellt ...";
const PROCESSING_SUBTEXT = "Diktat wird strukturiert und fachlich geprüft.";
const ERROR_MESSAGE = "Dokumentation konnte nicht erstellt werden. Bitte erneut versuchen.";
const COPY_RESET_DELAY = 2000;

let state = {
  userId: null,
  username: "",
  dayId: createDayId(),
  createdAt: new Date().toISOString(),
  updatedAt: new Date().toISOString(),
  patientCount: 0,
  patients: [],
  activePatientId: null,
  view: "setup",
};

let recognition = null;
let isRecording = false;
let currentPatientId = null;
let finalTranscript = "";
let interimTranscript = "";
let selectedCount = null;
let copyResetTimer = null;
let allCopyResetTimer = null;
let editMode = false;

const els = {
  app: document.getElementById("app"),
  loginView: document.getElementById("login-view"),
  setupView: document.getElementById("setup-view"),
  listView: document.getElementById("list-view"),
  detailView: document.getElementById("detail-view"),
  summaryView: document.getElementById("summary-view"),
  usernameInput: document.getElementById("username-input"),
  passwordInput: document.getElementById("password-input"),
  loginButton: document.getElementById("login-button"),
  demoUserButton: document.getElementById("demo-user-button"),
  loginError: document.getElementById("login-error"),
  activeUser: document.getElementById("active-user"),
  logoutButton: document.getElementById("logout-button"),
  countButtons: document.querySelectorAll(".count-button"),
  customCount: document.getElementById("custom-count"),
  createListButton: document.getElementById("create-list"),
  restoreBackupButton: document.getElementById("restore-backup"),
  resetDayButton: document.getElementById("reset-day"),
  progressText: document.getElementById("progress-text"),
  progressBar: document.getElementById("progress-bar"),
  patientList: document.getElementById("patient-list"),
  allCopyButton: document.getElementById("copy-all"),
  showSummaryButton: document.getElementById("show-summary"),
  detailTitle: document.getElementById("detail-title"),
  detailCounter: document.getElementById("detail-counter"),
  micButton: document.getElementById("mic-button"),
  micIcon: document.getElementById("mic-icon"),
  micText: document.getElementById("mic-text"),
  stopButton: document.getElementById("stop-button"),
  processingBox: document.getElementById("processing-box"),
  processingText: document.getElementById("processing-text"),
  processingSubtext: document.getElementById("processing-subtext"),
  errorBox: document.getElementById("error-box"),
  retryButton: document.getElementById("retry-button"),
  documentationCard: document.getElementById("documentation-card"),
  documentationOutput: document.getElementById("documentation-output"),
  editPanel: document.getElementById("edit-panel"),
  editTextarea: document.getElementById("edit-textarea"),
  editSaveButton: document.getElementById("edit-save"),
  editCancelButton: document.getElementById("edit-cancel"),
  editLabel: document.getElementById("edit-label"),
  editButton: document.getElementById("edit-button"),
  copyButton: document.getElementById("copy-button"),
  copyButtonText: document.getElementById("copy-button-text"),
  nextButton: document.getElementById("next-button"),
  listButton: document.getElementById("list-button"),
  summaryList: document.getElementById("summary-list"),
  summaryCopyAll: document.getElementById("summary-copy-all"),
  summaryBackButton: document.getElementById("summary-back"),
};

document.addEventListener("DOMContentLoaded", () => {
  setupGeneratedUi();
  bindEvents();
  initSpeech();
  restoreSession();
  registerServiceWorker();
});

function setupGeneratedUi() {
  if (!els.processingBox.querySelector(".processing-spinner")) {
    const spinner = document.createElement("div");
    spinner.className = "processing-spinner";
    spinner.setAttribute("aria-hidden", "true");
    els.processingBox.prepend(spinner);
  }

  if (!document.querySelector(".pilot-privacy-notice")) {
    els.privacyNotice = document.createElement("div");
    els.privacyNotice.className = "pilot-privacy-notice";
    els.privacyNotice.innerHTML = `
      <strong>Pilotphase:</strong>
      Bitte keine vollständigen Patientennamen verwenden. Nutzen Sie Initialen oder anonymisierte Bezeichnungen.
    `;
    document.querySelector(".app-header").after(els.privacyNotice);
  }

  els.processingText.textContent = PROCESSING_MESSAGE;
  els.processingSubtext.textContent = PROCESSING_SUBTEXT;
}

function bindEvents() {
  els.loginButton.addEventListener("click", handleLogin);
  els.demoUserButton.addEventListener("click", createDemoUser);
  els.logoutButton.addEventListener("click", logout);

  [els.usernameInput, els.passwordInput].forEach((input) => {
    input.addEventListener("keydown", (event) => {
      if (event.key === "Enter") handleLogin();
    });
  });

  els.countButtons.forEach((button) => {
    button.addEventListener("click", () => pickCount(button));
  });

  els.customCount.addEventListener("input", () => {
    selectedCount = Number.parseInt(els.customCount.value, 10) || null;
    els.countButtons.forEach((button) => button.classList.remove("is-selected"));
  });

  els.createListButton.addEventListener("click", createDayList);
  els.restoreBackupButton.addEventListener("click", restoreLastBackup);
  els.resetDayButton.addEventListener("click", requestNewDayList);
  els.allCopyButton.addEventListener("click", copyAllDocumentation);
  els.showSummaryButton.addEventListener("click", () => showView("summary"));

  els.patientList.addEventListener("click", (event) => {
    const card = event.target.closest("[data-patient-id]");
    if (!card) return;

    const patientId = Number.parseInt(card.dataset.patientId, 10);
    const actionButton = event.target.closest("[data-action]");

    if (actionButton?.dataset.action === "copy") {
      event.stopPropagation();
      copyPatientDocumentation(patientId, actionButton);
      return;
    }

    if (actionButton?.dataset.action === "delete") {
      event.stopPropagation();
      deletePatientEntry(patientId);
      return;
    }

    openPatient(patientId);
  });

  els.summaryList.addEventListener("click", (event) => {
    const button = event.target.closest("[data-summary-copy]");
    if (!button) return;
    copyPatientDocumentation(Number.parseInt(button.dataset.summaryCopy, 10), button);
  });

  els.micButton.addEventListener("click", startDictation);
  els.stopButton.addEventListener("click", () => stopDictation(true));
  els.retryButton.addEventListener("click", () => createDocumentation(getActivePatient()));
  els.editButton.addEventListener("click", () => toggleEditPanel(true));
  els.editSaveButton.addEventListener("click", saveEditedDocumentation);
  els.editCancelButton.addEventListener("click", () => toggleEditPanel(false));
  els.copyButton.addEventListener("click", () => copyPatientDocumentation(state.activePatientId, els.copyButton));
  els.nextButton.addEventListener("click", goToNextPatient);
  els.listButton.addEventListener("click", () => showView("list"));
  els.summaryCopyAll.addEventListener("click", copyAllDocumentation);
  els.summaryBackButton.addEventListener("click", () => showView("list"));
}

function restoreSession() {
  const activeUser = localStorage.getItem(SESSION_KEY);
  if (!activeUser) {
    showLogin();
    return;
  }

  const users = getUsers();
  const user = users[activeUser];
  if (!user) {
    localStorage.removeItem(SESSION_KEY);
    showLogin();
    return;
  }

  state.userId = activeUser;
  state.username = user.username;
  state = loadState();
  showAuthenticatedApp();
}

function showLogin() {
  els.app.classList.add("is-logged-out");
  els.loginView.hidden = false;
  els.setupView.hidden = true;
  els.listView.hidden = true;
  els.detailView.hidden = true;
  els.summaryView.hidden = true;
  els.activeUser.textContent = "";
  els.logoutButton.hidden = true;
}

function showAuthenticatedApp() {
  els.app.classList.remove("is-logged-out");
  els.loginView.hidden = true;
  els.logoutButton.hidden = false;
  els.activeUser.textContent = state.username ? `Angemeldet: ${state.username}` : "";
  updateBackupButton();

  if (state.patientCount > 0) {
    renderList();
    showView("list");
  } else {
    showView("setup");
  }
}

async function handleLogin() {
  const username = normalizeUsername(els.usernameInput.value);
  const password = els.passwordInput.value;

  if (!username || !password) {
    showLoginError("Bitte Benutzername und Passwort eingeben.");
    return;
  }

  const users = getUsers();
  const existingUser = users[username];
  const passwordHash = await hashPassword(password);

  if (!existingUser) {
    users[username] = {
      username,
      passwordHash,
      createdAt: new Date().toISOString(),
    };
    saveUsers(users);
  } else if (existingUser.passwordHash !== passwordHash) {
    showLoginError("Login fehlgeschlagen. Bitte Zugangsdaten prüfen.");
    return;
  }

  localStorage.setItem(SESSION_KEY, username);
  state.userId = username;
  state.username = username;
  state = loadState();
  els.usernameInput.value = "";
  els.passwordInput.value = "";
  showLoginError("");
  showAuthenticatedApp();
}

async function createDemoUser() {
  els.usernameInput.value = "demo";
  els.passwordInput.value = "demo";
  await handleLogin();
}

function logout() {
  saveState();
  localStorage.removeItem(SESSION_KEY);
  state = {
    userId: null,
    username: "",
    dayId: createDayId(),
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    patientCount: 0,
    patients: [],
    activePatientId: null,
    view: "setup",
  };
  showLogin();
}

function showLoginError(message) {
  els.loginError.textContent = message;
  els.loginError.hidden = !message;
}

function getUsers() {
  try {
    return JSON.parse(localStorage.getItem(USERS_KEY) || "{}");
  } catch {
    return {};
  }
}

function saveUsers(users) {
  localStorage.setItem(USERS_KEY, JSON.stringify(users));
}

function normalizeUsername(value) {
  return value.trim().toLowerCase().replace(/[^a-z0-9._-]/gi, "-").replace(/-+/g, "-");
}

async function hashPassword(password) {
  const encoder = new TextEncoder();
  const data = encoder.encode(`docuvox-mvp:${password}`);
  const digest = await crypto.subtle.digest("SHA-256", data);
  return Array.from(new Uint8Array(digest))
    .map((byte) => byte.toString(16).padStart(2, "0"))
    .join("");
}

function initSpeech() {
  const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;

  if (!SpeechRecognition) {
    els.micButton.disabled = true;
    els.micText.textContent = "Diktat im Browser nicht verfügbar";
    return;
  }

  recognition = new SpeechRecognition();
  recognition.lang = "de-CH";
  recognition.continuous = true;
  recognition.interimResults = true;

  recognition.onresult = (event) => {
    interimTranscript = "";

    for (let index = event.resultIndex; index < event.results.length; index += 1) {
      const transcript = event.results[index][0].transcript;
      if (event.results[index].isFinal) {
        finalTranscript += `${transcript} `;
      } else {
        interimTranscript += transcript;
      }
    }
  };

  recognition.onerror = () => {
    stopDictation(false);
    showError("Diktat konnte nicht verarbeitet werden. Bitte erneut versuchen.");
  };

  recognition.onend = () => {
    if (isRecording) {
      try {
        recognition.start();
      } catch {
        stopDictation(false);
      }
    }
  };
}

function pickCount(button) {
  selectedCount = Number.parseInt(button.dataset.count, 10);
  els.customCount.value = "";
  els.countButtons.forEach((item) => item.classList.remove("is-selected"));
  button.classList.add("is-selected");
}

function createDayList() {
  const count = selectedCount || Number.parseInt(els.customCount.value, 10);

  if (!count || count < 1 || count > 60) {
    toast("Bitte eine Patientenzahl zwischen 1 und 60 wählen.");
    return;
  }

  const now = new Date().toISOString();

  state = {
    userId: state.userId,
    username: state.username,
    dayId: createDayId(),
    createdAt: now,
    updatedAt: now,
    patientCount: count,
    activePatientId: null,
    view: "list",
    patients: Array.from({ length: count }, (_, index) => ({
      id: index + 1,
      patientLabel: `Patient ${index + 1}`,
      status: "open",
      rawText: "",
      documentation: "",
      documentationUpdatedAt: null,
      documentationEditCount: 0,
      lastManualEditAt: null,
      updatedAt: now,
    })),
  };

  selectedCount = null;
  els.customCount.value = "";
  els.countButtons.forEach((button) => button.classList.remove("is-selected"));

  saveState();
  renderList();
  showView("list");
}

function requestNewDayList() {
  if (!state.patientCount) {
    showView("setup");
    return;
  }

  const confirmed = window.confirm(
    "Neue Tagesliste starten?\n\nDie aktuelle Tagesliste wird als letzte Tagesliste gesichert und kann wiederhergestellt werden."
  );

  if (!confirmed) return;

  saveLastDayBackup();
  state.patientCount = 0;
  state.patients = [];
  state.activePatientId = null;
  state.dayId = createDayId();
  state.createdAt = new Date().toISOString();
  state.updatedAt = new Date().toISOString();
  saveState();
  updateBackupButton();
  showView("setup");
}

function renderList() {
  const completed = getCompletedPatients().length;
  const total = state.patientCount;
  const progress = total ? Math.round((completed / total) * 100) : 0;

  els.progressText.textContent = `Heute ${completed} / ${total} erledigt`;
  els.progressBar.style.width = `${progress}%`;
  els.patientList.innerHTML = "";

  state.patients.forEach((patient) => {
    const card = document.createElement("article");
    card.className = `patient-card status-${patient.status}`;
    card.dataset.patientId = patient.id;

    const statusLabel = getStatusLabel(patient.status);
    const hasDocumentation = Boolean(patient.documentation);

    card.innerHTML = `
      <div class="patient-card-main">
        <div>
          <h3>Patient ${patient.id}</h3>
          <p>${statusLabel}</p>
        </div>
        <button class="dictate-button" type="button">Diktieren</button>
      </div>
      <div class="patient-card-actions">
        ${
          hasDocumentation
            ? `<button class="small-copy-button" type="button" data-action="copy" aria-label="Dokumentation von Patient ${patient.id} kopieren">
                Kopieren
              </button>`
            : ""
        }
        <button class="delete-patient-button" type="button" data-action="delete" aria-label="Eintrag von Patient ${patient.id} löschen">
          Eintrag löschen
        </button>
      </div>
    `;

    els.patientList.appendChild(card);
  });

  els.allCopyButton.disabled = completed === 0;
  els.showSummaryButton.disabled = completed === 0;
  updateBackupButton();
}

function getStatusLabel(status) {
  if (status === "done") return "fertig";
  if (status === "recording" || status === "processing") return "in Bearbeitung";
  return "offen";
}

function openPatient(patientId) {
  const patient = state.patients.find((item) => item.id === patientId);
  if (!patient) return;

  state.activePatientId = patientId;
  state.view = "detail";
  saveState();
  renderDetail();
  showView("detail");
}

function renderDetail() {
  const patient = getActivePatient();
  if (!patient) return;

  editMode = false;
  currentPatientId = patient.id;
  els.detailTitle.textContent = `Patient ${patient.id}`;
  els.detailCounter.textContent = `${patient.id} von ${state.patientCount}`;

  const hasDocumentation = Boolean(patient.documentation);
  setProcessing(patient.status === "processing");
  setError("");
  setRecordingUi(patient.status === "recording");
  setEditPanelMode(false);

  els.documentationCard.hidden = !hasDocumentation;
  els.documentationOutput.innerHTML = hasDocumentation
    ? renderDocumentation(patient.documentation)
    : "";

  els.editButton.hidden = !hasDocumentation;
  els.copyButton.hidden = !hasDocumentation;
  els.nextButton.hidden = !hasDocumentation || patient.id >= state.patientCount;
  els.nextButton.textContent = `Weiter zu Patient ${patient.id + 1}`;
  els.listButton.hidden = false;

  if (!hasDocumentation) {
    els.micButton.hidden = false;
    els.stopButton.hidden = !isRecording;
  } else {
    els.micButton.hidden = true;
    els.stopButton.hidden = true;
  }

  resetCopyButton(els.copyButton);
}

function startDictation() {
  const patient = getActivePatient();
  if (!patient || !recognition || isRecording) return;

  finalTranscript = "";
  interimTranscript = "";
  currentPatientId = patient.id;
  patient.status = "recording";
  patient.updatedAt = new Date().toISOString();
  saveState();
  setError("");
  setProcessing(false);
  setRecordingUi(true);

  try {
    recognition.start();
    isRecording = true;
  } catch {
    isRecording = false;
    patient.status = patient.documentation ? "done" : "open";
    saveState();
    setRecordingUi(false);
    showError("Diktat konnte nicht gestartet werden.");
  }
}

function stopDictation(shouldCreateDocumentation) {
  const patient = getActivePatient();

  if (recognition && isRecording) {
    isRecording = false;
    recognition.stop();
  }

  setRecordingUi(false);

  if (!patient) return;

  const rawText = `${finalTranscript} ${interimTranscript}`.replace(/\s+/g, " ").trim();
  patient.rawText = rawText;
  patient.status = rawText ? "processing" : "open";
  patient.updatedAt = new Date().toISOString();
  saveState();

  if (!rawText) {
    showError("Kein Diktat erkannt. Bitte erneut diktieren.");
    return;
  }

  if (shouldCreateDocumentation) {
    createDocumentation(patient);
  }
}

async function createDocumentation(patient) {
  if (!patient) return;

  patient.status = "processing";
  patient.updatedAt = new Date().toISOString();
  saveState();
  setError("");
  setProcessing(true);
  els.documentationCard.hidden = true;
  els.editButton.hidden = true;
  els.copyButton.hidden = true;
  els.nextButton.hidden = true;

  try {
    const response = await fetch("/api/document", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        text: patient.rawText,
        patientLabel: `Patient ${patient.id}`,
      }),
    });

    const data = await response.json().catch(() => ({}));

    if (!response.ok || !data.documentation) {
      throw new Error(data.error || "API request failed");
    }

    patient.documentation = normalizeDocumentation(data.documentation, `Patient ${patient.id}`);
    patient.rawText = "";
    patient.status = "done";
    patient.documentationUpdatedAt = new Date().toISOString();
    patient.updatedAt = patient.documentationUpdatedAt;
    saveState();

    setProcessing(false);
    renderDetail();
    await copyPatientDocumentation(patient.id, els.copyButton, { silent: true });
    toast("Dokumentation kopiert");
  } catch {
    patient.status = patient.documentation ? "done" : "open";
    patient.updatedAt = new Date().toISOString();
    saveState();
    setProcessing(false);
    showError(ERROR_MESSAGE);
    els.retryButton.hidden = false;
  }
}

function setEditPanelMode(isOpen) {
  editMode = isOpen;
  els.editPanel.hidden = !isOpen;

  if (!isOpen) {
    els.editTextarea.value = "";
    els.editSaveButton.textContent = "Änderungen speichern";
    els.editLabel.textContent = "Finale Dokumentation bearbeiten";
  }
}

function toggleEditPanel(forceOpen) {
  const patient = getActivePatient();
  if (!patient?.documentation) return;

  const shouldOpen = typeof forceOpen === "boolean" ? forceOpen : !editMode;
  setEditPanelMode(shouldOpen);

  if (shouldOpen) {
    els.editTextarea.value = patient.documentation;
    els.editLabel.textContent = `Finale Dokumentation Patient ${patient.id}`;
    els.editTextarea.focus();
  }
}

function handleEditPanelAction() {
  const patient = getActivePatient();
  if (!patient) return;

  if (editMode) {
    saveEditedDocumentation();
    return;
  }

  createDocumentation(patient);
}

function saveEditedDocumentation() {
  const patient = getActivePatient();
  if (!patient) return;

  const edited = els.editTextarea.value.trim();

  if (!edited) {
    toast("Dokumentation darf nicht leer sein.");
    return;
  }

  patient.documentation = normalizeEditedDocumentation(edited, `Patient ${patient.id}`);
  patient.status = "done";
  patient.documentationEditCount = (patient.documentationEditCount || 0) + 1;
  patient.lastManualEditAt = new Date().toISOString();
  patient.documentationUpdatedAt = patient.lastManualEditAt;
  patient.updatedAt = patient.lastManualEditAt;
  saveState();

  setEditPanelMode(false);
  renderDetail();
  toast("Dokumentation gespeichert.");
}

function normalizeEditedDocumentation(text, patientLabel) {
  const trimmed = text.trim();
  const hasPatientLine = new RegExp(`^${escapeRegExp(patientLabel)}\\b`, "i").test(trimmed);
  return hasPatientLine ? trimmed : `${patientLabel}\n\n${trimmed}`;
}

function setRecordingUi(active) {
  els.micButton.classList.toggle("is-recording", active);
  els.micButton.hidden = false;
  els.stopButton.hidden = !active;
  els.micText.textContent = active ? "Aufnahme läuft..." : "Diktat starten";
  els.micIcon.textContent = active ? "●" : "🎙";
}

function setProcessing(active) {
  els.processingBox.hidden = !active;
  els.micButton.hidden = active;
  els.stopButton.hidden = true;
}

function setError(message) {
  els.errorBox.textContent = message;
  els.errorBox.hidden = !message;
  els.retryButton.hidden = !message;
}

function showError(message) {
  setProcessing(false);
  setError(message);
}

async function copyPatientDocumentation(patientId, button, options = {}) {
  const patient = state.patients.find((item) => item.id === patientId);
  if (!patient?.documentation) return;

  const clipboard = buildClipboardDocumentation(patient);

  try {
    await writeClipboard(clipboard);
    if (!options.silent) {
      setCopySuccess(button);
    }
  } catch {
    toast("Kopieren nicht möglich. Bitte manuell markieren.");
  }
}

async function copyAllDocumentation() {
  const completed = getCompletedPatients();

  if (!completed.length) return;

  const plainText = completed.map((patient) => formatDocumentationForClipboard(patient.documentation)).join("\n\n");
  const html = completed.map((patient) => formatDocumentationHtmlForClipboard(patient.documentation)).join("<br><br>");

  try {
    await writeClipboard({ plainText, html });
    setCopySuccess(els.summaryCopyAll);
    setCopySuccess(els.allCopyButton);
  } catch {
    toast("Kopieren nicht möglich. Bitte manuell markieren.");
  }
}

async function writeClipboard({ plainText, html }) {
  if (navigator.clipboard?.write && window.ClipboardItem && html) {
    const item = new ClipboardItem({
      "text/plain": new Blob([plainText], { type: "text/plain" }),
      "text/html": new Blob([html], { type: "text/html" }),
    });
    await navigator.clipboard.write([item]);
    return;
  }

  await navigator.clipboard.writeText(plainText);
}

function buildClipboardDocumentation(patient) {
  return {
    plainText: formatDocumentationForClipboard(patient.documentation),
    html: formatDocumentationHtmlForClipboard(patient.documentation),
  };
}

function setCopySuccess(button) {
  if (!button) return;

  const original = button.dataset.originalText || button.textContent.trim();
  button.dataset.originalText = original;
  button.classList.add("is-copied");

  if (button === els.copyButton) {
    els.copyButtonText.textContent = "Kopiert ✓";
  } else {
    button.textContent = "Kopiert ✓";
  }

  window.clearTimeout(button._copyTimer);
  button._copyTimer = window.setTimeout(() => {
    button.classList.remove("is-copied");
    if (button === els.copyButton) {
      els.copyButtonText.textContent = "Dokumentation kopieren";
    } else {
      button.textContent = original;
    }
  }, COPY_RESET_DELAY);
}

function resetCopyButton(button) {
  if (!button) return;

  window.clearTimeout(button._copyTimer);
  button.classList.remove("is-copied");

  if (button === els.copyButton) {
    els.copyButtonText.textContent = "Dokumentation kopieren";
  } else if (button.dataset.originalText) {
    button.textContent = button.dataset.originalText;
  }
}

function goToNextPatient() {
  const patient = getActivePatient();
  if (!patient) return;

  const next = state.patients.find((item) => item.id === patient.id + 1);
  if (next) openPatient(next.id);
}

function deletePatientEntry(patientId) {
  const patient = state.patients.find((item) => item.id === patientId);
  if (!patient) return;

  const confirmed = window.confirm(
    `Eintrag von Patient ${patientId} löschen?\n\nRohdiktat und fertige Dokumentation dieses Patienten werden nur für den aktuellen Nutzer entfernt.`
  );

  if (!confirmed) return;

  if (isRecording && currentPatientId === patientId) {
    stopDictation(false);
  }

  patient.rawText = "";
  patient.documentation = "";
  patient.status = "open";
  patient.documentationEditCount = 0;
  patient.documentationUpdatedAt = null;
  patient.lastManualEditAt = null;
  patient.updatedAt = new Date().toISOString();

  if (state.activePatientId === patientId) {
    state.activePatientId = null;
  }

  if (currentPatientId === patientId) {
    currentPatientId = null;
    renderList();
    showView("list");
  } else {
    renderList();
  }

  saveState();
  toast(`Patient ${patientId} gelöscht.`);
}

function showView(view) {
  state.view = view;
  saveState();

  els.setupView.hidden = view !== "setup";
  els.listView.hidden = view !== "list";
  els.detailView.hidden = view !== "detail";
  els.summaryView.hidden = view !== "summary";

  if (view === "list") {
    renderList();
  }

  if (view === "summary") {
    renderSummary();
  }
}

function renderSummary() {
  const completed = getCompletedPatients();
  els.summaryList.innerHTML = "";

  if (!completed.length) {
    els.summaryList.innerHTML = `<p class="empty-state">Noch keine fertigen Dokumentationen.</p>`;
    els.summaryCopyAll.disabled = true;
    return;
  }

  completed.forEach((patient) => {
    const item = document.createElement("article");
    item.className = "summary-item";
    item.innerHTML = `
      <div class="summary-item-header">
        <h3>Patient ${patient.id}</h3>
        <button class="small-copy-button" type="button" data-summary-copy="${patient.id}">Kopieren</button>
      </div>
      <div class="documentation-output">
        ${renderDocumentation(patient.documentation)}
      </div>
    `;
    els.summaryList.appendChild(item);
  });

  els.summaryCopyAll.disabled = false;
}

function renderDocumentation(text) {
  const normalized = normalizeDocumentation(text, getActivePatientLabelFromText(text));
  const lines = normalized.split("\n");
  let html = "";
  let openList = false;

  lines.forEach((line) => {
    const trimmed = line.trim();
    if (!trimmed) {
      if (openList) {
        html += "</ul>";
        openList = false;
      }
      return;
    }

    if (/^Patient\s+\d+/i.test(trimmed)) {
      if (openList) {
        html += "</ul>";
        openList = false;
      }
      html += `<p class="doc-patient">${escapeHtml(trimmed)}</p>`;
      return;
    }

    const heading = trimmed.match(/^\*\*(.+?)\*\*$/) || trimmed.match(/^\*\*(.+?):\*\*$/);
    if (heading) {
      if (openList) {
        html += "</ul>";
        openList = false;
      }
      html += `<h4>${escapeHtml(heading[1].replace(/:$/, ""))}</h4>`;
      return;
    }

    const bullet = trimmed.replace(/^[-•]\s*/, "");
    if (!openList) {
      html += "<ul>";
      openList = true;
    }
    html += `<li>${escapeHtml(bullet)}</li>`;
  });

  if (openList) html += "</ul>";
  return html;
}

function normalizeDocumentation(text, patientLabel) {
  const cleaned = String(text || "")
    .replace(/\r/g, "")
    .replace(/\*\*(Befund aktuell|Behandlung|Reaktion \/ Verlauf|Ausblick \/ Empfehlung):\*\*/g, "**$1**")
    .trim();

  const label = patientLabel || "Patient 1";
  const withoutPatient = cleaned.replace(/^Patient\s+\d+\s*/i, "").trim();

  const sections = [
    "Befund aktuell",
    "Behandlung",
    "Reaktion / Verlauf",
    "Ausblick / Empfehlung",
  ];

  const parsed = {};
  let current = null;

  withoutPatient.split("\n").forEach((line) => {
    const trimmed = line.trim();
    if (!trimmed) return;

    const heading = sections.find((section) => {
      const pattern = new RegExp(`^\\*\\*${escapeRegExp(section)}:?\\*\\*|^${escapeRegExp(section)}:?$`, "i");
      return pattern.test(trimmed);
    });

    if (heading) {
      current = heading;
      parsed[current] = parsed[current] || [];
      return;
    }

    if (current) {
      parsed[current].push(trimmed.replace(/^[-•]\s*/, ""));
    }
  });

  let output = `${label}\n\n`;

  sections.forEach((section, index) => {
    const items = (parsed[section] || []).filter(Boolean);
    output += `**${section}**\n`;

    if (items.length) {
      output += items.map((item) => `- ${item}`).join("\n");
    }

    if (index < sections.length - 1) output += "\n\n";
  });

  return output.trim();
}

function formatDocumentationForClipboard(text) {
  return normalizeDocumentation(text, getActivePatientLabelFromText(text))
    .replace(/\*\*/g, "")
    .replace(/^•\s*/gm, "- ")
    .replace(/\n{3,}/g, "\n\n")
    .split("\n")
    .map((line) => line.trimEnd())
    .join("\n")
    .trim();
}

function formatDocumentationHtmlForClipboard(text) {
  const normalized = normalizeDocumentation(text, getActivePatientLabelFromText(text));
  const escaped = escapeHtml(normalized)
    .replace(/\*\*(Befund aktuell|Behandlung|Reaktion \/ Verlauf|Ausblick \/ Empfehlung)\*\*/g, "<strong>$1</strong>")
    .replace(/^- /gm, "• ");

  return `<div style="font-family: Arial, sans-serif; font-size: 14px; line-height: 1.45; color: #111827; word-break: normal; overflow-wrap: normal; hyphens: none; white-space: pre-wrap;">${escaped}</div>`;
}

function getActivePatientLabelFromText(text) {
  const match = String(text || "").match(/^Patient\s+\d+/i);
  if (match) return match[0];

  const patient = getActivePatient();
  return patient ? `Patient ${patient.id}` : "Patient 1";
}

function getActivePatient() {
  return state.patients.find((patient) => patient.id === state.activePatientId);
}

function getCompletedPatients() {
  return state.patients.filter((patient) => patient.documentation);
}

function loadState() {
  const base = {
    userId: state.userId,
    username: state.username,
    dayId: createDayId(),
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    patientCount: 0,
    patients: [],
    activePatientId: null,
    view: "setup",
  };

  try {
    const saved = JSON.parse(localStorage.getItem(getStorageKey()) || "null");
    if (!saved) return base;
    return sanitizeStateForStorage({ ...base, ...saved, userId: state.userId, username: state.username });
  } catch {
    return base;
  }
}

function saveState() {
  if (!state.userId) return;

  state.updatedAt = new Date().toISOString();
  const sanitized = sanitizeStateForStorage(state);
  state = sanitized;
  localStorage.setItem(getStorageKey(), JSON.stringify(sanitized));
}

function getStorageKey() {
  return `${STORAGE_PREFIX}${state.userId}`;
}

function getBackupKey() {
  return `${BACKUP_PREFIX}${state.userId}`;
}

function saveLastDayBackup() {
  if (!state.userId || !state.patientCount) return;

  const backup = sanitizeStateForStorage({
    ...state,
    backedUpAt: new Date().toISOString(),
  });

  localStorage.setItem(getBackupKey(), JSON.stringify(backup));
}

function updateBackupButton() {
  if (!state.userId) return;
  const backup = localStorage.getItem(getBackupKey());
  els.restoreBackupButton.hidden = !backup;
}

function restoreLastBackup() {
  const backupRaw = localStorage.getItem(getBackupKey());
  if (!backupRaw) return;

  const confirmed = window.confirm(
    "Letzte Tagesliste wiederherstellen?\n\nDie aktuelle Tagesliste wird dadurch ersetzt."
  );

  if (!confirmed) return;

  try {
    const backup = JSON.parse(backupRaw);
    state = sanitizeStateForStorage({
      ...backup,
      userId: state.userId,
      username: state.username,
      activePatientId: null,
      view: "list",
      updatedAt: new Date().toISOString(),
    });
    saveState();
    renderList();
    showView("list");
    toast("Letzte Tagesliste wiederhergestellt.");
  } catch {
    toast("Backup konnte nicht wiederhergestellt werden.");
  }
}

function sanitizeStateForStorage(value) {
  const patients = Array.isArray(value?.patients) ? value.patients : [];

  return {
    ...value,
    patients: patients.map((patient) => ({
      ...patient,
      patientLabel: patient.patientLabel || `Patient ${patient.id}`,
      rawText: patient.documentation ? "" : patient.rawText || "",
      updatedAt: patient.updatedAt || value.updatedAt || new Date().toISOString(),
    })),
  };
}

function createDayId() {
  return `day_${new Date().toISOString().slice(0, 10)}`;
}

function toast(message) {
  const existing = document.querySelector(".toast");
  if (existing) existing.remove();

  const toastEl = document.createElement("div");
  toastEl.className = "toast";
  toastEl.textContent = message;
  document.body.appendChild(toastEl);

  window.setTimeout(() => {
    toastEl.classList.add("is-visible");
  }, 10);

  window.setTimeout(() => {
    toastEl.classList.remove("is-visible");
    window.setTimeout(() => toastEl.remove(), 250);
  }, 2400);
}

function escapeHtml(value) {
  return String(value).replace(/[&<>"']/g, (char) => {
    const entities = {
      "&": "&amp;",
      "<": "&lt;",
      ">": "&gt;",
      '"': "&quot;",
      "'": "&#039;",
    };
    return entities[char];
  });
}

function escapeRegExp(value) {
  return String(value).replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function registerServiceWorker() {
  if ("serviceWorker" in navigator) {
    navigator.serviceWorker.register("/sw.js").catch(() => {});
  }
}
