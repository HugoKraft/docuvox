const STORAGE_KEY = "docuvox-day-v3";
const BACKUP_KEY = "docuvox-last-day-backup-v1";
const SESSION_KEY = "docuvox-auth-session-v1";
const USER_STATE_PREFIX = "docuvox_state_";
const USER_BACKUP_PREFIX = "docuvox_backup_";

let currentUser = loadSessionUser();
let state = createEmptyState();
let currentPatientId = null;
let recognition = null;
let isRecording = false;
let finalTranscript = "";

const els = {
  loginView: document.querySelector("#loginView"),
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
  loginForm: document.querySelector("#loginForm"),
  loginEmail: document.querySelector("#loginEmail"),
  loginPassword: document.querySelector("#loginPassword"),
  createAccountButton: document.querySelector("#createAccountButton"),
  loginMessage: document.querySelector("#loginMessage"),
  userState: document.querySelector("#userState"),
  currentUserLabel: document.querySelector("#currentUserLabel"),
  logoutButton: document.querySelector("#logoutButton"),
  restoreStartButton: document.querySelector("#restoreStartButton"),
  restoreListButton: document.querySelector("#restoreListButton"),
};

bindEvents();
initSpeech();
registerServiceWorker();
bootApp();

function bindEvents() {
  els.loginForm.addEventListener("submit", handleLogin);
  els.createAccountButton.addEventListener("click", createAccount);
  els.logoutButton.addEventListener("click", logout);
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
  els.newDayButton.addEventListener("click", confirmNewDay);
  els.restoreStartButton.addEventListener("click", restoreLastDayBackup);
  els.restoreListButton.addEventListener("click", restoreLastDayBackup);
  els.rawText.addEventListener("input", saveCurrentRawText);
}

async function bootApp() {
  if (!currentUser) {
    showLogin();
    return;
  }

  state = loadState();
  updateUserUi();

  if (state.patients.length) {
    renderList();
    showView("list");
    refreshCloudDocumentsInBackground();
    return;
  }

  await refreshCloudDocuments();
  renderInitialView();
}

function showLogin() {
  currentUser = null;
  currentPatientId = null;
  state = createEmptyState();
  localStorage.removeItem(SESSION_KEY);
  updateUserUi();
  showView("login");
  window.setTimeout(() => els.loginEmail.focus(), 0);
}

async function handleLogin(event) {
  event.preventDefault();
  await authenticate("login");
}

async function createAccount() {
  await authenticate("signup");
}

async function authenticate(action) {
  const email = els.loginEmail.value.trim().toLowerCase();
  const password = els.loginPassword.value;

  if (!email || !password) {
    showLoginMessage("Bitte E-Mail-Adresse und Passwort eingeben.", true);
    return;
  }

  setAuthBusy(true);
  showLoginMessage("");

  try {
    const result = await requestAuth(action, email, password);

    if (result.requiresEmailConfirmation) {
      els.loginPassword.value = "";
      showLoginMessage(
        result.message || "Bitte bestätigen Sie zuerst Ihre E-Mail-Adresse. Wir haben Ihnen eine Bestätigungsmail gesendet."
      );
      return;
    }

    if (!result.session?.userId || !result.session?.email) {
      throw new Error("Session konnte nicht erstellt werden.");
    }

    currentUser = {
      userId: result.session.userId,
      email: result.session.email,
      accessToken: result.session.accessToken || "",
      refreshToken: result.session.refreshToken || "",
      expiresAt: result.session.expiresAt || null,
    };

    localStorage.setItem(SESSION_KEY, JSON.stringify(currentUser));
    state = loadState();
    updateUserUi();
    els.loginPassword.value = "";
    showLoginMessage("");

    if (state.patients.length) {
      renderList();
      showView("list");
      refreshCloudDocumentsInBackground();
      return;
    }

    await refreshCloudDocuments();
    renderInitialView();
  } catch (error) {
    showLoginMessage(error.message || "Login fehlgeschlagen.", true);
  } finally {
    setAuthBusy(false);
  }
}

function logout() {
  if (isRecording) stopDictation(false);
  saveState();
  showLogin();
}

function updateUserUi() {
  els.userState.classList.toggle("hidden", !currentUser);
  els.currentUserLabel.textContent = currentUser ? currentUser.email : "";
}

function loadSessionUser() {
  try {
    const user = JSON.parse(localStorage.getItem(SESSION_KEY));
    if (user?.userId && user?.email) return user;
  } catch {
    return null;
  }
  return null;
}

async function requestAuth(action, email, password) {
  const response = await fetch("/api/auth", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ action, email, password }),
  });

  const data = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new Error(data.error || "Authentifizierung fehlgeschlagen.");
  }

  return data;
}

async function ensureFreshAccessToken() {
  if (!currentUser?.accessToken) return false;

  const refreshWindowMs = 60_000;
  if (currentUser.expiresAt && Date.now() < currentUser.expiresAt - refreshWindowMs) {
    return true;
  }

  if (!currentUser.refreshToken) return false;

  try {
    const response = await fetch("/api/auth", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        action: "refresh",
        refreshToken: currentUser.refreshToken,
      }),
    });

    const data = await response.json().catch(() => ({}));
    if (!response.ok || !data.session?.accessToken) {
      throw new Error(data.error || "Session konnte nicht erneuert werden.");
    }

    currentUser = {
      userId: data.session.userId,
      email: data.session.email,
      accessToken: data.session.accessToken || "",
      refreshToken: data.session.refreshToken || currentUser.refreshToken,
      expiresAt: data.session.expiresAt || null,
    };
    localStorage.setItem(SESSION_KEY, JSON.stringify(currentUser));
    return true;
  } catch {
    showLogin();
    toast("Session abgelaufen. Bitte erneut einloggen.");
    return false;
  }
}

function setAuthBusy(active) {
  els.loginForm.classList.toggle("is-busy", active);
  els.loginForm.querySelectorAll("button, input").forEach((element) => {
    element.disabled = active;
  });
}

function showLoginMessage(message, isError = false) {
  els.loginMessage.textContent = message;
  els.loginMessage.classList.toggle("hidden", !message);
  els.loginMessage.classList.toggle("is-error", isError);
}

function getStateStorageKey() {
  return currentUser ? `${USER_STATE_PREFIX}${currentUser.userId}` : STORAGE_KEY;
}

function getBackupStorageKey() {
  return currentUser ? `${USER_BACKUP_PREFIX}${currentUser.userId}` : BACKUP_KEY;
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

async function createDayList(event) {
  event.preventDefault();
  const count = Number(els.patientCount.value);

  if (!Number.isInteger(count) || count < 1) {
    toast("Bitte eine Patientenzahl eingeben.");
    return;
  }

  if (!(await ensureFreshAccessToken())) return;

  try {
    const payload = await requestDayList({
      method: "POST",
      body: {
        action: "create",
        patientCount: count,
      },
    });
    state = buildStateFromDayListPayload(payload, state);
    currentPatientId = null;
    saveState();
    renderList();
    showView("list");
  } catch {
    toast("Cloud nicht erreichbar. Keine neue Tagesliste erstellt.");
  }
}

function resetDay() {
  if (isRecording) stopDictation(false);
  saveLastDayBackup();
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
    patient.rawText = "";
    patient.documentation = documentation;
    patient.status = "done";
    finalTranscript = "";
    els.rawText.value = "";
    els.finalDoc.value = documentation;
    showDictationSuccess();
    els.aiState.textContent = "KI aktiv";
    els.aiState.classList.remove("hidden");
    els.copyState.classList.remove("hidden");
    els.nextPatientButton.classList.remove("hidden");
    updateNextButton();
    saveState();
    await saveDocumentToCloud(patient);
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

async function refreshCloudDocuments() {
  if (!currentUser?.accessToken || isRecording) return;
  if (!(await ensureFreshAccessToken())) return;

  try {
    const payload = await requestDayList({ method: "GET" });
    state = buildStateFromDayListPayload(payload, state);
    saveState();
  } catch {
    toast("Cloud nicht erreichbar. Lokaler Cache wird angezeigt.");
  }
}

async function refreshCloudDocumentsInBackground() {
  await refreshCloudDocuments();

  if (!isRecording && !els.listView.classList.contains("hidden") && state.patients.length) {
    renderList();
  }
}

async function saveDocumentToCloud(patient) {
  if (!currentUser?.accessToken || !patient?.documentation) return;
  if (!(await ensureFreshAccessToken())) return;

  if (!state.dayListId) {
    toast("Cloud-Tagesliste fehlt. Dokumentation bleibt lokal gespeichert.");
    return;
  }

  try {
    const response = await fetch("/api/documents", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${currentUser.accessToken}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        dayListId: state.dayListId,
        patientNumber: patient.id,
        content: patient.documentation,
      }),
    });

    const data = await response.json().catch(() => ({}));
    if (!response.ok) throw new Error(data.error || "Cloud-Speicherung fehlgeschlagen.");
  } catch {
    toast("Cloud-Speicherung fehlgeschlagen. Dokumentation bleibt lokal gespeichert.");
  }
}

async function requestDayList({ method, body = null }) {
  const response = await fetch("/api/day-lists", {
    method,
    headers: {
      Authorization: `Bearer ${currentUser.accessToken}`,
      "Content-Type": "application/json",
    },
    body: body ? JSON.stringify(body) : undefined,
  });

  const payload = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new Error(payload.error || "Tagesliste konnte nicht geladen werden.");
  }

  return payload;
}

function buildStateFromDayListPayload(payload, previousState = createEmptyState()) {
  const dayList = payload?.dayList || null;
  const backupAvailable = Boolean(payload?.backupAvailable);

  if (!dayList) {
    if (previousState?.patients?.length) {
      return {
        ...previousState,
        backupAvailable,
      };
    }

    currentPatientId = null;
    return {
      ...createEmptyState(),
      backupAvailable,
    };
  }

  const patientCount = Math.max(0, Number(dayList.patient_count) || 0);
  const documents = Array.isArray(payload.documents) ? payload.documents : [];
  const documentsByPatient = new Map();
  documents.forEach((document) => {
    const patientNumber = Number(document.patient_number);
    if (!Number.isInteger(patientNumber) || patientNumber < 1 || !document.content) return;
    documentsByPatient.set(patientNumber, document);
  });

  const sameDayList = previousState?.dayListId === dayList.id || previousState?.dayId === dayList.id;
  const now = new Date().toISOString();
  const patients = Array.from({ length: patientCount }, (_, index) => {
    const id = index + 1;
    const previousPatient = sameDayList
      ? previousState.patients?.find((patient) => patient.id === id)
      : null;
    const cloudDocument = documentsByPatient.get(id);
    const documentation = cloudDocument ? String(cloudDocument.content || "") : "";
    const locallyActive = previousPatient?.status === "active" || previousState?.activePatientId === id;

    return {
      id,
      rawText: previousPatient?.rawText || "",
      documentation,
      status: documentation ? "done" : locallyActive ? "active" : "open",
    };
  });

  const activePatientStillExists = patients.some((patient) => patient.id === previousState?.activePatientId);
  return {
    date: dayList.date || today(),
    dayId: dayList.id,
    dayListId: dayList.id,
    dayListStatus: dayList.status,
    patientCount,
    backupAvailable,
    schemaVersion: dayList.schema_version || 1,
    userId: currentUser?.userId || dayList.user_id || null,
    updatedAt: dayList.updated_at || now,
    activePatientId: activePatientStillExists ? previousState.activePatientId : null,
    patients,
  };
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
  loadLastDayBackup();

  try {
    const storageKey = getStateStorageKey();
    const saved = JSON.parse(localStorage.getItem(storageKey));
    const persistableState = createPersistableState(saved);

    if (hasPersistedRawText(saved)) {
      localStorage.setItem(storageKey, JSON.stringify(persistableState));
    }

    if (persistableState && Array.isArray(persistableState.patients)) {
      return createRuntimeState(persistableState);
    }
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
  localStorage.setItem(getStateStorageKey(), JSON.stringify(createPersistableState(state)));
}

function saveLastDayBackup() {
  if (!state.patients.length) return;
  const backup = {
    savedAt: new Date().toISOString(),
    userId: currentUser?.userId || null,
    state: {
      ...state,
      userId: currentUser?.userId || null,
      updatedAt: new Date().toISOString(),
    },
  };
  localStorage.setItem(getBackupStorageKey(), JSON.stringify(createPersistableState(backup)));
}

function loadLastDayBackup() {
  try {
    const storageKey = getBackupStorageKey();
    const backup = JSON.parse(localStorage.getItem(storageKey));
    const persistableBackup = createPersistableState(backup);

    if (hasPersistedRawText(backup)) {
      localStorage.setItem(storageKey, JSON.stringify(persistableBackup));
    }

    if (persistableBackup?.state && Array.isArray(persistableBackup.state.patients)) {
      return {
        ...persistableBackup,
        state: createRuntimeState(persistableBackup.state),
      };
    }
  } catch {
    return null;
  }
  return null;
}

function createPersistableState(value) {
  if (Array.isArray(value)) {
    return value.map((item) => createPersistableState(item));
  }

  if (!value || typeof value !== "object") return value;

  return Object.fromEntries(
    Object.entries(value)
      .filter(([key]) => key !== "rawText")
      .map(([key, item]) => [key, createPersistableState(item)])
  );
}

function createRuntimeState(persistedState) {
  const runtimeState = createPersistableState(persistedState);

  return {
    ...runtimeState,
    patients: Array.isArray(runtimeState?.patients)
      ? runtimeState.patients.map((patient) => ({
          ...patient,
          rawText: "",
        }))
      : [],
  };
}

function hasPersistedRawText(value, seen = new WeakSet()) {
  if (!value || typeof value !== "object" || seen.has(value)) return false;
  seen.add(value);

  if (Object.prototype.hasOwnProperty.call(value, "rawText")) return true;
  return Object.values(value).some((item) => hasPersistedRawText(item, seen));
}

function updateBackupControls() {
  const hasBackup = currentUser ? Boolean(state.backupAvailable) : Boolean(loadLastDayBackup());
  els.restoreStartButton.classList.toggle("hidden", !hasBackup);
  els.restoreListButton.classList.toggle("hidden", !hasBackup);
}

async function restoreLastDayBackup() {
  const confirmed = window.confirm("Letzte Tagesliste wiederherstellen?\n\nDie aktuelle Tagesliste wird dadurch ersetzt.");
  if (!confirmed) return;

  if (isRecording) stopDictation(false);
  if (!(await ensureFreshAccessToken())) return;

  try {
    const payload = await requestDayList({
      method: "POST",
      body: {
        action: "restoreBackup",
      },
    });
    state = buildStateFromDayListPayload(payload, state);
    currentPatientId = null;
    saveState();
    renderList();
    showView("list");
    toast("Letzte Tagesliste wiederhergestellt.");
  } catch (error) {
    toast(error.message || "Keine gesicherte Tagesliste vorhanden.");
    updateBackupControls();
  }
}

function createEmptyState() {
  return {
    date: today(),
    dayId: `${today()}-${currentUser?.userId || "local"}`,
    dayListId: null,
    dayListStatus: null,
    patientCount: 0,
    backupAvailable: false,
    schemaVersion: 1,
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
