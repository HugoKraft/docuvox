"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");

const APP_SOURCE = fs.readFileSync(path.join(__dirname, "..", "app.js"), "utf8");

test("normal LocalStorage state does not persist rawText", () => {
  const app = loadApp();
  app.context.fixture = createState({ rawText: "Temporary transcript", documentation: "Finished documentation" });

  app.run(`
    currentUser = { userId: "user-state", email: "state@example.test" };
    state = fixture;
    saveState();
  `);

  const persisted = JSON.parse(app.localStorage.getItem("docuvox_state_user-state"));
  assert.equal(hasRawTextProperty(persisted), false);
  assert.equal(persisted.patients[0].documentation, "Finished documentation");
});

test("local day-list backup does not persist rawText", () => {
  const app = loadApp();
  app.context.fixture = createState({ rawText: "Backup transcript", documentation: "Backup documentation" });

  app.run(`
    currentUser = { userId: "user-backup", email: "backup@example.test" };
    state = fixture;
    saveLastDayBackup();
  `);

  const backup = JSON.parse(app.localStorage.getItem("docuvox_backup_user-backup"));
  assert.equal(hasRawTextProperty(backup), false);
  assert.equal(backup.state.patients[0].documentation, "Backup documentation");

  const loadedBackup = app.run("loadLastDayBackup()");
  assert.equal(loadedBackup.state.patients[0].rawText, "");
  assert.equal(loadedBackup.state.patients[0].documentation, "Backup documentation");
});

test("legacy state and backup rawText are removed only for the current user", () => {
  const app = loadApp();
  const currentState = createState({ rawText: "Current user state transcript", documentation: "Current doc" });
  const currentBackup = {
    savedAt: "2026-09-16T12:00:00.000Z",
    userId: "user-current",
    state: createState({ rawText: "Current user backup transcript", documentation: "Backup doc" }),
  };
  const otherUserState = createState({ rawText: "Other user transcript", documentation: "Other doc" });

  app.localStorage.setItem("docuvox_state_user-current", JSON.stringify(currentState));
  app.localStorage.setItem("docuvox_backup_user-current", JSON.stringify(currentBackup));
  app.localStorage.setItem("docuvox_state_user-other", JSON.stringify(otherUserState));

  app.run(`currentUser = { userId: "user-current", email: "current@example.test" };`);
  const runtimeState = app.run("loadState()");

  assert.equal(runtimeState.patients[0].rawText, "");
  assert.equal(runtimeState.patients[0].documentation, "Current doc");
  assert.equal(hasRawTextProperty(JSON.parse(app.localStorage.getItem("docuvox_state_user-current"))), false);
  assert.equal(hasRawTextProperty(JSON.parse(app.localStorage.getItem("docuvox_backup_user-current"))), false);
  assert.equal(hasRawTextProperty(JSON.parse(app.localStorage.getItem("docuvox_state_user-other"))), true);
});

test("runtime state may temporarily contain rawText", () => {
  const app = loadApp();
  app.context.fixture = createState({ rawText: "Legacy transcript", documentation: "" });

  const runtimeState = app.run("createRuntimeState(fixture)");
  assert.equal(runtimeState.patients[0].rawText, "");

  runtimeState.patients[0].rawText = "Temporary runtime transcript";
  app.context.runtimeState = runtimeState;
  const persistableState = app.run("createPersistableState(runtimeState)");

  assert.equal(runtimeState.patients[0].rawText, "Temporary runtime transcript");
  assert.equal(hasRawTextProperty(persistableState), false);
  assert.equal(app.run("hasPersistedRawText(runtimeState)"), true);
});

test("successful AI documentation clears all runtime transcript values and keeps documentation", async () => {
  const app = loadApp();
  app.context.fixture = createState({ rawText: "Successful transcript", documentation: "" });

  app.run(`
    currentUser = { userId: "user-success", email: "success@example.test", accessToken: "" };
    state = fixture;
    currentPatientId = 1;
    finalTranscript = "Successful transcript ";
    els.rawText.value = "Successful transcript";
    createAiDocumentation = async () => "Finished clinical documentation";
    copyText = async () => {};
  `);

  await app.run("createDocumentation()");

  assert.equal(app.run("state.patients[0].rawText"), "");
  assert.equal(app.run("finalTranscript"), "");
  assert.equal(app.run("els.rawText.value"), "");
  assert.equal(app.run("state.patients[0].documentation"), "Finished clinical documentation");
  assert.equal(app.run("els.finalDoc.value"), "Finished clinical documentation");

  const persisted = JSON.parse(app.localStorage.getItem("docuvox_state_user-success"));
  assert.equal(hasRawTextProperty(persisted), false);
  assert.equal(persisted.patients[0].documentation, "Finished clinical documentation");
});

test("failed AI documentation keeps rawText temporarily for retry without persisting it", async () => {
  const app = loadApp();
  app.context.fixture = createState({ rawText: "Retry transcript", documentation: "" });

  app.run(`
    currentUser = { userId: "user-retry", email: "retry@example.test", accessToken: "" };
    state = fixture;
    currentPatientId = 1;
    finalTranscript = "Retry transcript ";
    els.rawText.value = "Retry transcript";
    saveCurrentRawText();
    createAiDocumentation = async () => { throw new Error("Request failed"); };
  `);

  await app.run("createDocumentation()");

  assert.equal(app.run("state.patients[0].rawText"), "Retry transcript");
  assert.equal(app.run("finalTranscript"), "Retry transcript ");
  assert.equal(app.run("els.rawText.value"), "Retry transcript");
  assert.equal(app.run("state.patients[0].documentation"), "");
  assert.equal(app.run("els.retryButton.classList.contains('hidden')"), false);

  const persisted = JSON.parse(app.localStorage.getItem("docuvox_state_user-retry"));
  assert.equal(hasRawTextProperty(persisted), false);
});

test("frontend /api/documents request contains documentation but no rawText", async () => {
  const requests = [];
  const app = loadApp({
    fetch: async (url, options) => {
      requests.push({ url, options });
      return {
        ok: true,
        status: 200,
        json: async () => ({}),
      };
    },
  });

  app.context.patient = {
    id: 1,
    rawText: "Cloud transcript must not be sent",
    documentation: "Cloud documentation",
    status: "done",
  };
  app.run(`
    currentUser = {
      userId: "user-cloud",
      email: "cloud@example.test",
      accessToken: "access-token",
      expiresAt: Date.now() + 120_000,
    };
    state = { ...createEmptyState(), dayListId: "day-list-1" };
  `);

  await app.run("saveDocumentToCloud(patient)");

  assert.equal(requests.length, 1);
  assert.equal(requests[0].url, "/api/documents");
  const body = JSON.parse(requests[0].options.body);
  assert.deepEqual(body, {
    dayListId: "day-list-1",
    patientNumber: 1,
    content: "Cloud documentation",
  });
  assert.equal(hasRawTextProperty(body), false);
});

test("backend /api/documents ignores rawText and persists only required document fields", async () => {
  const originalFetch = global.fetch;
  const originalAnonKey = process.env.SUPABASE_ANON_KEY;
  const originalSupabaseUrl = process.env.SUPABASE_URL;
  const supabaseRequests = [];

  process.env.SUPABASE_ANON_KEY = "test-anon-key";
  delete process.env.SUPABASE_URL;
  global.fetch = async (url, options) => {
    supabaseRequests.push({ url, options });

    if (url.endsWith("/auth/v1/user")) {
      return jsonResponse({ id: "user-cloud" });
    }
    if (url.includes("/rest/v1/day_lists?")) {
      return jsonResponse([{ id: "day-list-1", user_id: "user-cloud", status: "active" }]);
    }
    if (options.method === "DELETE") {
      return { ok: true, status: 204, json: async () => ({}) };
    }

    return jsonResponse([JSON.parse(options.body)]);
  };

  const request = {
    method: "POST",
    headers: {
      authorization: "Bearer access-token",
      host: "localhost",
    },
    body: {
      dayListId: "day-list-1",
      patientNumber: 1,
      content: "Persisted documentation",
      rawText: "Injected transcript must be ignored",
    },
  };
  const response = createResponseRecorder();

  try {
    const documentsHandler = require("../api/documents");
    await documentsHandler(request, response);

    assert.equal(response.statusCode, 200);
    const writes = supabaseRequests.filter(({ options }) => options.body);
    assert.equal(writes.length, 1);
    const persistedBody = JSON.parse(writes[0].options.body);
    assert.deepEqual(persistedBody, {
      user_id: "user-cloud",
      day_list_id: "day-list-1",
      patient_number: 1,
      content: "Persisted documentation",
    });
    assert.equal(hasRawTextProperty(persistedBody), false);
  } finally {
    global.fetch = originalFetch;
    restoreEnvironmentValue("SUPABASE_ANON_KEY", originalAnonKey);
    restoreEnvironmentValue("SUPABASE_URL", originalSupabaseUrl);
  }
});

function loadApp({ fetch = async () => jsonResponse({}) } = {}) {
  const localStorage = createLocalStorage();
  const elements = new Map();
  const document = {
    querySelector(selector) {
      if (!elements.has(selector)) elements.set(selector, createElement());
      return elements.get(selector);
    },
    querySelectorAll() {
      return [];
    },
    createElement() {
      return createElement();
    },
    body: createElement(),
    execCommand() {
      return true;
    },
  };
  const window = {
    SpeechRecognition: null,
    webkitSpeechRecognition: null,
    isSecureContext: false,
    setTimeout() {
      return 1;
    },
    clearTimeout() {},
    addEventListener() {},
    confirm() {
      return true;
    },
  };
  const context = vm.createContext({
    console: { log() {}, warn() {}, error() {} },
    document,
    window,
    navigator: {
      clipboard: {
        async writeText() {},
      },
    },
    localStorage,
    fetch,
    URL,
    Date,
    JSON,
    Object,
    Array,
    Map,
    WeakSet,
    String,
    Number,
    Boolean,
    Math,
    Promise,
  });

  vm.runInContext(APP_SOURCE, context, { filename: "app.js" });

  return {
    context,
    localStorage,
    run(source) {
      return vm.runInContext(source, context);
    },
  };
}

function createState({ rawText, documentation }) {
  return {
    date: "2026-09-17",
    dayId: "day-list-1",
    dayListId: "day-list-1",
    dayListStatus: "active",
    patientCount: 1,
    backupAvailable: true,
    schemaVersion: 1,
    userId: "fixture-user",
    updatedAt: "2026-09-17T10:00:00.000Z",
    activePatientId: 1,
    patients: [
      {
        id: 1,
        rawText,
        documentation,
        status: documentation ? "done" : "active",
      },
    ],
  };
}

function hasRawTextProperty(value) {
  if (!value || typeof value !== "object") return false;
  if (Object.prototype.hasOwnProperty.call(value, "rawText")) return true;
  return Object.values(value).some((item) => hasRawTextProperty(item));
}

function createLocalStorage() {
  const values = new Map();
  return {
    getItem(key) {
      return values.has(key) ? values.get(key) : null;
    },
    setItem(key, value) {
      values.set(String(key), String(value));
    },
    removeItem(key) {
      values.delete(String(key));
    },
  };
}

function createElement() {
  const child = {
    textContent: "",
  };

  return {
    value: "",
    textContent: "",
    innerHTML: "",
    disabled: false,
    dataset: {},
    style: {},
    className: "",
    classList: createClassList(),
    addEventListener() {},
    append() {},
    focus() {},
    select() {},
    remove() {},
    querySelector() {
      return child;
    },
  };
}

function createClassList() {
  const values = new Set();
  return {
    add(...names) {
      names.forEach((name) => values.add(name));
    },
    remove(...names) {
      names.forEach((name) => values.delete(name));
    },
    toggle(name, force) {
      if (force === undefined) {
        if (values.has(name)) values.delete(name);
        else values.add(name);
        return values.has(name);
      }
      if (force) values.add(name);
      else values.delete(name);
      return force;
    },
    contains(name) {
      return values.has(name);
    },
  };
}

function jsonResponse(payload, status = 200) {
  return {
    ok: status >= 200 && status < 300,
    status,
    json: async () => payload,
  };
}

function createResponseRecorder() {
  return {
    statusCode: null,
    headers: null,
    body: "",
    writeHead(statusCode, headers) {
      this.statusCode = statusCode;
      this.headers = headers;
    },
    end(body) {
      this.body = body;
    },
  };
}

function restoreEnvironmentValue(name, value) {
  if (value === undefined) {
    delete process.env[name];
  } else {
    process.env[name] = value;
  }
}
