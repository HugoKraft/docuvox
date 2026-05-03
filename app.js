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
  const patientLabel = `Patient ${patientNumber}`;
  const response = await fetch("/api/document", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ text: rawText, patientLabel }),
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
  els.aiState.textContent = "KI nicht aktiv";
  els.aiState.classList.remove("hidden");
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
