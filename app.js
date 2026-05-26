const STORAGE_KEY = "docuvox-day-v3";
const BACKUP_KEY = "docuvox-last-day-backup-v1";
const USERS_KEY = "docuvox-users-v1";
const SESSION_KEY = "docuvox-session-user-v1";
const USER_STATE_PREFIX = "docuvox_state_";
const USER_BACKUP_PREFIX = "docuvox_backup_";

let currentUser = loadSessionUser();
let state = createEmptyState();
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
  editLabel: document.querySelector("label[for='rawText']"),
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
  backBottomButton: document.querySelector("#backBottomButton"),
  backFromAllButton: document.querySelector("#backFromAllButton"),
  showAllButton: document.querySelector("#showAllButton"),
  copyAllButton: document.querySelector("#copyAllButton"),
  copyAllTopButton: document.querySelector("#copyAllTopButton"),
  newDayButton: document.querySelector("#newDayButton"),
  allDocsText: document.querySelector("#allDocsText"),
  toast: document.querySelector("#toast"),
};

setupGeneratedUi();
bindEvents();
initSpeech();
registerServiceWorker();
bootApp();

function setupGeneratedUi() {
  els.loginView = document.createElement("section");
  els.loginView.className = "view login-view hidden";
  els.loginView.id = "loginView";
  els.loginView.innerHTML = `
    <div class="login-card">
      <p class="eyebrow">Login</p>
      <h2>Bei DocuVox anmelden</h2>
      <p class="login-note">MVP only - spaeter sichere Authentifizierung und Cloud-Sync.</p>
      <form id="loginForm" class="login-form">
        <label class="field-label" for="loginUsername">Benutzername</label>
        <input id="loginUsername" type="text" autocomplete="username" placeholder="z. B. hugo" required />
        <label class="field-label" for="loginPassword">Passwort</label>
        <input id="loginPassword" type="password" autocomplete="current-password" placeholder="Passwort" required />
        <button class="primary-button" type="submit">Einloggen</button>
        <button class="secondary-button" id="demoUserButton" type="button">Demo-Nutzer erstellen</button>
      </form>
    </div>
  `;
  els.startView.parentElement.insertBefore(els.loginView, els.startView);
  els.loginForm = els.loginView.querySelector("#loginForm");
  els.loginUsername = els.loginView.querySelector("#loginUsername");
  els.loginPassword = els.loginView.querySelector("#loginPassword");
  els.demoUserButton = els.loginView.querySelector("#demoUserButton");

  els.userState = document.createElement("div");
  els.userState.className = "user-state hidden";
  els.userState.innerHTML = `
    <span id="currentUserLabel"></span>
    <button id="logoutButton" type="button">Abmelden</button>
  `;
  document.querySelector(".app-header").append(els.userState);
  els.currentUserLabel = els.userState.querySelector("#currentUserLabel");
  els.logoutButton = els.userState.querySelector("#logoutButton");

  els.processingState = document.createElement("div");
  els.processingState.className = "processing-state hidden";
  els.processingState.setAttribute("role", "status");
  els.processingState.setAttribute("aria-live", "polite");
  els.processingState.innerHTML = `
    <div class="processing-ring" aria-hidden="true"></div>
    <div>
      <strong>Dokumentation wird erstellt ...</strong>
      <p>Diktat wird strukturiert und fachlich geprüft.</p>
    </div>
  `;
  els.finalDoc.parentElement.insertBefore(els.processingState, els.finalDoc);

  els.restoreStartButton = document.createElement("button");
  els.restoreStartButton.className = "backup-button hidden";
  els.restoreStartButton.type = "button";
  els.restoreStartButton.textContent = "Letzte Tagesliste wiederherstellen";
  els.startView.querySelector(".hero-card").append(els.restoreStartButton);

  els.restoreListButton = document.createElement("button");
  els.restoreListButton.className = "backup-button hidden";
  els.restoreListButton.type = "button";
  els.restoreListButton.textContent = "Letzte Tagesliste wiederherstellen";
  els.listView.insertBefore(els.restoreListButton, els.newDayButton);
}

function bindEvents() {
  els.loginForm.addEventListener("submit", handleLogin);
  els.demoUserButton.addEventListener("click", createDemoUser);
  els.logoutButton.addEventListener("click", logout);
  els.dayForm.addEventListener("submit", createDayList);
  document.querySelectorAll("[data-count]").forEach((button) => {
    button.addEventListener("click", () => pickCount(button));
  });
  els.startDictationButton.addEventListener("click", startDictation);
  els.stopDictationButton.addEventListener("click", stopDictation);
  els.createDocButton.addEventListener("click", handleEditPanelAction);
  els.retryButton.addEventListener("click", createDocumentation);
  els.editButton.addEventListener("click", toggleEditPanel);
  els.copyDocButton.addEventListener("click", copyCurrentDocumentation);
  els.nextPatientButton.addEventListener("click", goToNextPatient);
  els.backBottomButton.addEventListener("click", showList);
  els.backFromAllButton.addEventListener("click", showList);
  els.showAllButton.addEventListener("click", showAllDocs);
  els.copyAllButton.addEventListener("click", copyAllDocs);
  els.copyAllTopButton.addEventListener("click", copyAllDocs);
  els.newDayButton.addEventListener("click", confirmNewDay);
  els.restoreStartButton.addEventListener("click", restoreLastDayBackup);
  els.restoreListButton.addEventListener("click", restoreLastDayBackup);
  els.rawText.addEventListener("input", handleEditTextInput);
}

async function bootApp() {
  if (!currentUser) {
    showLogin();
    return;
  }

  state = loadState();
  updateUserUi();
  renderInitialView();
}

function showLogin() {
  currentUser = null;
  currentPatientId = null;
  state = createEmptyState();
  localStorage.removeItem(SESSION_KEY);
  updateUserUi();
  showView("login");
  window.setTimeout(() => els.loginUsername.focus(), 0);
}

async function handleLogin(event) {
  event.preventDefault();
  const username = els.loginUsername.value.trim();
  const password = els.loginPassword.value;

  if (!username || !password) {
    toast("Bitte Benutzername und Passwort eingeben.");
    return;
  }

  const users = loadUsers();
  const userId = normalizeUserId(username);
  const existingUser = users[userId];
  const passwordHash = await hashPassword(password, userId);

  if (existingUser && existingUser.passwordHash !== passwordHash) {
    toast("Login fehlgeschlagen.");
    return;
  }

  if (!existingUser) {
    users[userId] = {
      userId,
      username,
      passwordHash,
      createdAt: new Date().toISOString(),
    };
    saveUsers(users);
  }

  currentUser = {
    userId,
    username: users[userId].username || username,
  };
  localStorage.setItem(SESSION_KEY, JSON.stringify(currentUser));
  migrateLegacyStateIfNeeded();
  state = loadState();
  updateUserUi();
  els.loginPassword.value = "";
  renderInitialView();
}

async function createDemoUser() {
  els.loginUsername.value = "demo";
  els.loginPassword.value = "demo";
  await handleLogin(new Event("submit"));
}

function logout() {
  if (isRecording) stopDictation(false);
  saveState();
  showLogin();
}

function updateUserUi() {
  els.userState.classList.toggle("hidden", !currentUser);
  els.currentUserLabel.textContent = currentUser ? currentUser.username : "";
}

function loadUsers() {
  try {
    const users = JSON.parse(localStorage.getItem(USERS_KEY));
    if (users && typeof users === "object") return users;
  } catch {
    return {};
  }
  return {};
}

function saveUsers(users) {
  localStorage.setItem(USERS_KEY, JSON.stringify(users));
}

function loadSessionUser() {
  try {
    const user = JSON.parse(localStorage.getItem(SESSION_KEY));
    if (user?.userId && user?.username) return user;
  } catch {
    return null;
  }
  return null;
}

function normalizeUserId(username) {
  return String(username || "")
    .trim()
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "") || "user";
}

async function hashPassword(password, userId) {
  // MVP only - spaeter durch sichere serverseitige Authentifizierung ersetzen.
  const source = `docuvox-mvp-v1:${userId}:${password}`;
  if (!crypto.subtle) return fallbackHash(source);
  const encoded = new TextEncoder().encode(source);
  const digest = await crypto.subtle.digest("SHA-256", encoded);
  return Array.from(new Uint8Array(digest))
    .map((byte) => byte.toString(16).padStart(2, "0"))
    .join("");
}

function fallbackHash(value) {
  let hash = 2166136261;
  for (let index = 0; index < value.length; index += 1) {
    hash ^= value.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }
  return `fallback-${(hash >>> 0).toString(16)}`;
}

function getStateStorageKey() {
  return currentUser ? `${USER_STATE_PREFIX}${currentUser.userId}` : STORAGE_KEY;
}

function getBackupStorageKey() {
  return currentUser ? `${USER_BACKUP_PREFIX}${currentUser.userId}` : BACKUP_KEY;
}

function migrateLegacyStateIfNeeded() {
  if (!currentUser) return;
  const userKey = getStateStorageKey();
  if (localStorage.getItem(userKey)) return;
  const legacyState = localStorage.getItem(STORAGE_KEY);
  if (legacyState) localStorage.setItem(userKey, legacyState);
  const legacyBackup = localStorage.getItem(BACKUP_KEY);
  const userBackupKey = getBackupStorageKey();
  if (legacyBackup && !localStorage.getItem(userBackupKey)) localStorage.setItem(userBackupKey, legacyBackup);
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
    dayId: `${today()}-${currentUser?.userId || "local"}`,
    userId: currentUser?.userId || null,
    updatedAt: new Date().toISOString(),
    activePatientId: null,
    patients: Array.from({ length: count }, (_, index) => ({
      id: index + 1,
      rawText: "",
      documentation: "",
      documentationEditCount: 0,
      patientLabel: `Patient ${index + 1}`,
      updatedAt: new Date().toISOString(),
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
  saveLastDayBackup();
  resetActiveDay();
}

function resetActiveDay() {
  state = createEmptyState();
  currentPatientId = null;
  els.patientCount.value = "";
  document.querySelectorAll("[data-count]").forEach((item) => item.classList.remove("active"));
  saveState();
  updateBackupControls();
  showView("start");
}

function confirmNewDay() {
  const confirmed = window.confirm(
    "Neue Tagesliste starten?\n\nDie aktuelle Tagesliste wird als letzte Tagesliste gesichert und kann wiederhergestellt werden."
  );
  if (!confirmed) return;
  resetDay();
}

function renderInitialView() {
  updateBackupControls();
  if (state.patients.length) {
    renderList();
    showView("list");
  } else {
    showView("start");
  }
}

function renderList() {
  updateBackupControls();
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
  setEditPanelMode(patient.documentation ? "documentation" : "raw");
  renderDocumentation(patient.documentation);
  els.editPanel.classList.add("hidden");
  els.errorState.classList.add("hidden");
  els.retryButton.classList.add("hidden");
  els.copyState.classList.add("hidden");
  els.aiState.classList.toggle("hidden", !patient.documentation);
  els.aiState.innerHTML = "<span></span>KI aktiv";
  els.copyDocButton.classList.remove("copied");
  els.copyDocButton.querySelector("span").textContent = "Dokumentation kopieren";
  updateDetailActions();
  saveState();
  showView("detail");
}

function startDictation() {
  if (!recognition || isRecording) return;

  const patient = getCurrentPatient();
  if (patient) {
    setEditPanelMode("raw");
    els.rawText.value = patient.rawText || "";
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

  setEditPanelMode("raw");
  const rawText = els.rawText.value.trim();
  if (!rawText) {
    toast("Bitte zuerst ein Diktat eingeben.");
    return;
  }

  hideResultStates();
  setProcessingState(true);

  try {
    const documentation = await createAiDocumentation(rawText, `Patient ${patient.id}`);
    patient.documentation = documentation;
    patient.documentationUpdatedAt = new Date().toISOString();
    patient.updatedAt = new Date().toISOString();
    patient.status = "done";
    renderDocumentation(documentation);
    showDictationSuccess();
    els.aiState.innerHTML = "<span></span>KI aktiv";
    els.aiState.classList.remove("hidden");
    els.copyState.classList.add("hidden");
    els.copyDocButton.classList.remove("hidden");
    els.copyDocButton.classList.remove("copied");
    els.copyDocButton.querySelector("span").textContent = "Dokumentation kopieren";
    updateDetailActions();
    saveState();
    setEditPanelMode("documentation");
    toast("KI-Dokumentation erstellt.");
  } catch (error) {
    showAiError(error.message);
  } finally {
    setProcessingState(false);
  }
}

function toggleEditPanel() {
  const patient = getCurrentPatient();
  if (!patient) return;

  const shouldOpen = els.editPanel.classList.contains("hidden");
  if (!shouldOpen) {
    els.editPanel.classList.add("hidden");
    return;
  }

  setEditPanelMode(patient.documentation ? "documentation" : "raw");
  els.editPanel.classList.remove("hidden");
  window.setTimeout(() => els.rawText.focus(), 0);
}

function setEditPanelMode(mode) {
  const patient = getCurrentPatient();
  const editMode = mode === "documentation" && patient?.documentation ? "documentation" : "raw";

  els.editPanel.dataset.mode = editMode;
  if (editMode === "documentation") {
    els.editLabel.textContent = "Fertige Dokumentation bearbeiten";
    els.rawText.value = patient.documentation;
    els.rawText.placeholder = "Fertige Dokumentation bearbeiten.";
    els.createDocButton.textContent = "Änderungen speichern";
  } else {
    els.editLabel.textContent = "Rohdiktat";
    els.rawText.value = patient?.rawText || "";
    els.rawText.placeholder = "Diktat erscheint hier. Du kannst den Text auch direkt eintippen.";
    els.createDocButton.textContent = "Doku erstellen und kopieren";
  }
}

function handleEditPanelAction() {
  if (els.editPanel.dataset.mode === "documentation") {
    saveEditedDocumentation();
    return;
  }

  createDocumentation();
}

function saveEditedDocumentation() {
  const patient = getCurrentPatient();
  if (!patient) return;

  const editedDocumentation = normalizeEditedDocumentation(els.rawText.value, patient.id);
  if (!editedDocumentation) {
    toast("Bitte eine Dokumentation eingeben.");
    return;
  }

  patient.documentation = editedDocumentation;
  patient.status = "done";
  patient.documentationEditCount = (patient.documentationEditCount || 0) + 1;
  patient.documentationUpdatedAt = new Date().toISOString();
  patient.lastManualEditAt = new Date().toISOString();
  patient.updatedAt = new Date().toISOString();
  renderDocumentation(patient.documentation);
  els.copyState.classList.add("hidden");
  els.aiState.innerHTML = "<span></span>Bearbeitet";
  els.aiState.classList.remove("hidden");
  updateDetailActions();
  saveState();
  els.editPanel.classList.add("hidden");
  toast("Dokumentation gespeichert.");
}

function normalizeEditedDocumentation(value, patientId) {
  const clean = String(value || "")
    .replace(/\r/g, "")
    .replace(/\n{3,}/g, "\n\n")
    .trim();

  if (!clean) return "";
  if (/^Patient\s+\d+/i.test(clean)) return clean;
  return `Patient ${patientId}\n\n${clean}`;
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
  els.processingState.classList.toggle("hidden", !active);
  els.finalDoc.classList.toggle("is-processing", active);
  els.speechStatus.textContent = active ? "Dokumentation wird erstellt ..." : "Bereit für Spracheingabe.";
}

function hideResultStates() {
  els.errorState.classList.add("hidden");
  els.retryButton.classList.add("hidden");
  els.copyState.classList.add("hidden");
  els.aiState.classList.add("hidden");
  els.processingState.classList.add("hidden");
}

function showAiError(message = "KI-Verarbeitung fehlgeschlagen – bitte erneut versuchen.") {
  els.errorState.textContent = "Dokumentation konnte nicht erstellt werden. Bitte erneut versuchen.";
  if (message && !message.includes("KI-Verarbeitung fehlgeschlagen")) {
    els.errorState.textContent += ` ${message}`;
  }
  els.errorState.classList.remove("hidden");
  els.retryButton.classList.remove("hidden");
  els.copyState.classList.add("hidden");
  els.copyDocButton.classList.add("hidden");
  els.nextPatientButton.classList.add("hidden");
  els.backBottomButton.classList.remove("prominent-return");
  els.aiState.innerHTML = "<span></span>KI nicht aktiv";
  els.aiState.classList.remove("hidden");
  toast("Dokumentation konnte nicht erstellt werden.");
}

async function copyCurrentDocumentation() {
  const patient = getCurrentPatient();
  if (!patient?.documentation) {
    toast("Noch keine Dokumentation vorhanden.");
    return;
  }

  const copied = await copyDocumentation(patient.documentation, patient.id, "Dokumentation kopiert.");
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

  const copied = await copyDocumentation(patient.documentation, patient.id, `Patient ${patient.id} kopiert.`);
  if (copied && button) showCopyButtonSuccess(button);
}

function handleEditTextInput() {
  if (els.editPanel.dataset.mode === "documentation") return;
  saveCurrentRawText();
}

function saveCurrentRawText() {
  const patient = getCurrentPatient();
  if (!patient) return;
  patient.rawText = els.rawText.value.trim();
  patient.updatedAt = new Date().toISOString();
  saveState();
}

function goToNextPatient() {
  const next = getNextOpenPatient();
  if (next) {
    openPatient(next.id);
  } else {
    showList();
  }
}

function updateDetailActions() {
  const patient = getCurrentPatient();
  const hasDocumentation = Boolean(patient?.documentation);
  const next = getNextOpenPatient();

  els.copyDocButton.classList.toggle("hidden", !hasDocumentation);
  els.nextPatientButton.classList.toggle("hidden", !hasDocumentation || !next);
  els.backBottomButton.classList.toggle("prominent-return", hasDocumentation && !next);

  if (next) {
    els.nextPatientButton.textContent = `Weiter zu Patient ${next.id}`;
  }
}

function getNextOpenPatient() {
  return state.patients.find((patient) => patient.id > currentPatientId && !patient.documentation);
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
  const documentedPatients = state.patients.filter((patient) => patient.documentation);
  await copyRichText(text, buildAllDocsHtml(documentedPatients), "Alle Dokumentationen kopiert.");
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

async function copyDocumentation(documentation, patientId, message) {
  const plainText = formatDocumentationForClipboard(documentation, patientId);
  const html = formatDocumentationHtmlForClipboard(documentation, patientId);
  return copyRichText(plainText, html, message);
}

async function copyRichText(plainText, html, message) {
  if (navigator.clipboard?.write && window.ClipboardItem) {
    try {
      const item = new ClipboardItem({
        "text/plain": new Blob([plainText], { type: "text/plain" }),
        "text/html": new Blob([html], { type: "text/html" }),
      });
      await navigator.clipboard.write([item]);
      toast(message);
      return true;
    } catch {
      return copyText(plainText, message);
    }
  }

  return copyText(plainText, message);
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
    label.textContent = "Kopiert ✓";
  } else {
    button.textContent = "Kopiert ✓";
  }

  window.setTimeout(() => {
    button.classList.remove("copied");
    if (label) {
      label.textContent = originalText;
    } else {
      button.innerHTML = originalHtml;
    }
  }, 2000);
}

function getAllDocsText() {
  return state.patients
    .filter((patient) => patient.documentation)
    .map((patient) => buildPlainTextDocumentation(patient))
    .join("\n\n");
}

function buildPlainTextDocumentation(patient) {
  if (!patient?.documentation) return "";
  return formatDocumentationForClipboard(patient.documentation, patient.id);
}

function formatDocumentationForClipboard(documentation, patientId) {
  const patientTitle = extractPatientTitle(documentation);
  const fallbackTitle = patientId ? `Patient ${patientId}` : patientTitle;
  const sections = extractDocumentationSections(documentation);
  const lines = [fallbackTitle || patientTitle || "Patient"];

  sections.forEach((section) => {
    const points = section.points
      .map(cleanClipboardLine)
      .filter(Boolean);

    lines.push("");
    lines.push(section.title);
    points.forEach((point) => lines.push(`- ${point}`));
  });

  return lines
    .join("\n")
    .replace(/[ \t]+\n/g, "\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

function formatDocumentationHtmlForClipboard(documentation, patientId) {
  const patientTitle = escapeHtml(patientId ? `Patient ${patientId}` : extractPatientTitle(documentation));
  const sections = extractDocumentationSections(documentation);
  const sectionHtml = sections
    .map((section) => {
      const points = section.points.map(cleanClipboardLine).filter(Boolean);
      return `
        <div style="margin: 0 0 12px 0;">
          <p style="margin: 0 0 4px 0; font-weight: 700;"><strong>${escapeHtml(section.title)}</strong></p>
          ${points.map((point) => `<p style="margin: 0 0 2px 0;">- ${escapeHtml(point)}</p>`).join("")}
        </div>
      `;
    })
    .join("");

  return `
    <!doctype html>
    <html>
      <head>
        <meta charset="utf-8">
        <style>
          body { font-family: Arial, sans-serif; font-size: 12pt; line-height: 1.45; white-space: normal; word-break: normal; overflow-wrap: normal; hyphens: none; }
          p { word-break: normal; overflow-wrap: normal; hyphens: none; }
        </style>
      </head>
      <body>
        <p style="margin: 0 0 12px 0;">${patientTitle}</p>
        ${sectionHtml}
      </body>
    </html>
  `.trim();
}

function buildAllDocsHtml(patients) {
  return `
    <!doctype html>
    <html>
      <head>
        <meta charset="utf-8">
        <style>
          body { font-family: Arial, sans-serif; font-size: 12pt; line-height: 1.45; white-space: normal; word-break: normal; overflow-wrap: normal; hyphens: none; }
          p { word-break: normal; overflow-wrap: normal; hyphens: none; }
        </style>
      </head>
      <body>
        ${patients.map((patient) => formatDocumentationHtmlForClipboard(patient.documentation, patient.id).replace(/^[\s\S]*<body>|<\/body>[\s\S]*$/g, "")).join('<div style="height: 14px;"></div>')}
      </body>
    </html>
  `.trim();
}

function cleanClipboardLine(value) {
  return String(value || "")
    .replace(/\*\*/g, "")
    .replace(/<\/?[^>]+>/g, "")
    .replace(/[\u00ad]/g, "")
    .replace(/\s*-\s*\n\s*/g, "")
    .replace(/[ \t]+/g, " ")
    .replace(/\s+([.,;:!?])/g, "$1")
    .trim();
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
    const endPattern = nextTitles ? `(?=\\n\\s*(?:[-•]\\s*)?(?:\\*\\*)?(?:${nextTitles})\\s*:?(?:\\*\\*)?|$)` : "$";
    const pattern = new RegExp(
      `(?:^|\\n)\\s*(?:[-•]\\s*)?(?:\\*\\*)?${escapeRegExp(title)}\\s*:?(?:\\*\\*)?\\s*([\\s\\S]*?)${endPattern}`,
      "i"
    );
    const match = String(documentation || "").match(pattern);
    return {
      title,
      points: splitSectionPoints(match?.[1] || "Im Diktat nicht eindeutig beschrieben; weiter beobachten."),
    };
  });
}

function splitSectionPoints(value) {
  const clean = String(value || "")
    .replace(/\r/g, "")
    .trim();
  const lines = clean
    .split(/\n+/)
    .map((line) => line.replace(/^[-•*]\s*/, "").trim())
    .filter(Boolean);

  if (lines.length > 1) return lines;
  if (lines.length === 1) return [lines[0]];

  return ["Im Diktat nicht eindeutig beschrieben; weiter beobachten."];
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
  els.loginView.classList.toggle("hidden", view !== "login");
  els.startView.classList.toggle("hidden", view !== "start");
  els.listView.classList.toggle("hidden", view !== "list");
  els.detailView.classList.toggle("hidden", view !== "detail");
  els.allDocsView.classList.toggle("hidden", view !== "all");
  updateBackupControls();
}

function loadState() {
  try {
    const saved = JSON.parse(localStorage.getItem(getStateStorageKey()));
    if (saved && Array.isArray(saved.patients)) return saved;
  } catch {
    return createEmptyState();
  }
  return createEmptyState();
}

function saveState() {
  state = {
    ...state,
    userId: currentUser?.userId || null,
    dayId: state.dayId || `${today()}-${currentUser?.userId || "local"}`,
    updatedAt: new Date().toISOString(),
  };
  localStorage.setItem(getStateStorageKey(), JSON.stringify(state));
}

function saveLastDayBackup() {
  if (!state.patients.length) return;
  const backup = {
    savedAt: new Date().toISOString(),
    userId: currentUser?.userId || null,
    state: JSON.parse(JSON.stringify({
      ...state,
      userId: currentUser?.userId || null,
      updatedAt: new Date().toISOString(),
    })),
  };
  localStorage.setItem(getBackupStorageKey(), JSON.stringify(backup));
}

function loadLastDayBackup() {
  try {
    const backup = JSON.parse(localStorage.getItem(getBackupStorageKey()));
    if (backup?.state && Array.isArray(backup.state.patients)) return backup;
  } catch {
    return null;
  }
  return null;
}

function updateBackupControls() {
  const hasBackup = Boolean(loadLastDayBackup());
  els.restoreStartButton?.classList.toggle("hidden", !hasBackup);
  els.restoreListButton?.classList.toggle("hidden", !hasBackup);
}

function restoreLastDayBackup() {
  const backup = loadLastDayBackup();
  if (!backup) {
    toast("Keine gesicherte Tagesliste vorhanden.");
    updateBackupControls();
    return;
  }

  const confirmed = window.confirm("Letzte Tagesliste wiederherstellen?\n\nDie aktuelle Tagesliste wird dadurch ersetzt.");
  if (!confirmed) return;

  if (isRecording) stopDictation(false);
  state = backup.state;
  currentPatientId = null;
  saveState();
  renderList();
  showView("list");
  toast("Letzte Tagesliste wiederhergestellt.");
}

function createEmptyState() {
  return {
    date: today(),
    dayId: `${today()}-${currentUser?.userId || "local"}`,
    userId: currentUser?.userId || null,
    updatedAt: new Date().toISOString(),
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
