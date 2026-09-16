"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const { redactPiiFromTranscript } = require("../api/document");

test("redacts concrete ages", () => {
  const cases = [
    "53 Jahre",
    "53-jährig",
    "53-jährige Patientin",
    "53-jähriger Patient",
    "Patientin ist 53 Jahre alt",
    "Patient ist 82",
    "Alter 76",
  ];

  for (const input of cases) {
    const result = redactPiiFromTranscript(input);
    assert.match(result, /\[ALTER ENTFERNT\]/);
    assert.doesNotMatch(result, /\b(?:53|76|82)\b/);
  }
});

test("redacts birth dates but preserves explicitly clinical dates", () => {
  assert.equal(redactPiiFromTranscript("Geburtsdatum 12. März 1942"), "Geburtsdatum [GEBURTSDATUM ENTFERNT]");
  assert.equal(redactPiiFromTranscript("geboren am 12.03.1942"), "geboren am [GEBURTSDATUM ENTFERNT]");
  assert.equal(redactPiiFromTranscript("12.03.1942"), "[GEBURTSDATUM ENTFERNT]");
  assert.equal(redactPiiFromTranscript("Operation am 12.03.2026"), "Operation am 12.03.2026");
});

test("redacts AHV numbers", () => {
  for (const input of ["756.1234.5678.97", "AHV 756 1234 5678 97", "AHV-Nr. 756-1234-5678-97"]) {
    assert.match(redactPiiFromTranscript(input), /\[AHV ENTFERNT\]/);
  }
});

test("redacts email addresses and conservative Swiss phone formats", () => {
  assert.equal(redactPiiFromTranscript("Mail anna.meier@example.ch"), "Mail [EMAIL ENTFERNT]");
  for (const input of ["+41 79 123 45 67", "0041 44 123 45 67", "079 123 45 67", "044-123-45-67"]) {
    assert.equal(redactPiiFromTranscript(input), "[TELEFON ENTFERNT]");
  }
});

test("redacts contextual reference numbers without removing Patient X labels", () => {
  const cases = [
    ["Patientennummer 123456", "[PATIENTENNUMMER ENTFERNT]"],
    ["Patienten-Nr. 123456", "[PATIENTENNUMMER ENTFERNT]"],
    ["Aktennummer 83922", "[AKTENNUMMER ENTFERNT]"],
    ["Fallnummer 29384", "[FALLNUMMER ENTFERNT]"],
    ["Dossiernummer 19283", "[DOSSIERNUMMER ENTFERNT]"],
    ["Versichertennummer 12345678", "[VERSICHERTENNUMMER ENTFERNT]"],
  ];

  for (const [input, expected] of cases) {
    assert.equal(redactPiiFromTranscript(input), expected);
  }
  assert.equal(redactPiiFromTranscript("Patient 12"), "Patient 12");
});

test("redacts names only when introduced by Herr or Frau", () => {
  assert.equal(redactPiiFromTranscript("Herr Müller"), "[NAME ENTFERNT]");
  assert.equal(redactPiiFromTranscript("Frau Anna Meier"), "[NAME ENTFERNT]");
  assert.equal(redactPiiFromTranscript("Müller"), "Müller");
});

test("redacts clearly recognizable addresses", () => {
  assert.equal(redactPiiFromTranscript("Bahnhofstrasse 12, 8001 Zürich"), "[ADRESSE ENTFERNT]");
  assert.equal(redactPiiFromTranscript("Musterweg 5"), "[ADRESSE ENTFERNT]");
  assert.equal(redactPiiFromTranscript("Adresse: Hauptplatz 7, 9000 St. Gallen"), "[ADRESSE ENTFERNT]");
});

test("preserves clinically relevant numbers and dosages", () => {
  const values = [
    "NRS 5",
    "NRS 7/10",
    "3 x 10 Wiederholungen",
    "3 × 10 Wiederholungen",
    "90°",
    "Flexion 110 Grad",
    "15 kg",
    "30 Meter",
    "500 m",
    "Blutdruck 120/80",
    "Puls 72",
    "SpO2 95 %",
    "2 Minuten",
    "8 Stufen",
    "20 Wiederholungen",
    "4 Serien",
    "2x/Woche",
  ];

  for (const value of values) {
    assert.equal(redactPiiFromTranscript(value), value);
  }
});

test("redacts PII while preserving clinical content in a realistic transcript", () => {
  const input = "Frau Anna Müller, 53 Jahre alt, geboren am 12.03.1973, Patientennummer 847392, berichtet über Schmerzen NRS 5. Heute 30 Meter mit dem Rollator gegangen und 3 x 10 Sit-to-Stand durchgeführt.";
  const result = redactPiiFromTranscript(input);

  assert.match(result, /\[NAME ENTFERNT\]/);
  assert.match(result, /\[ALTER ENTFERNT\]/);
  assert.match(result, /\[GEBURTSDATUM ENTFERNT\]/);
  assert.match(result, /\[PATIENTENNUMMER ENTFERNT\]/);
  assert.match(result, /NRS 5/);
  assert.match(result, /30 Meter/);
  assert.match(result, /3 x 10/);
  assert.match(result, /Rollator/);
  assert.match(result, /Sit-to-Stand/);
});

test("passes only redacted text through normalization, structuring, and repair", async () => {
  const originalFetch = global.fetch;
  const originalApiKey = process.env.OPENAI_API_KEY;
  const requestBodies = [];
  const openAiOutputs = [
    "[NAME ENTFERNT], [ALTER ENTFERNT], [EMAIL ENTFERNT]. Schmerzen NRS 5.",
    "Unvollständige Antwort",
  ];

  process.env.OPENAI_API_KEY = "test-key";
  global.fetch = async (_url, options) => {
    requestBodies.push(JSON.parse(options.body));
    return {
      ok: true,
      status: 200,
      json: async () => ({ output_text: openAiOutputs.shift() }),
    };
  };

  const request = {
    method: "POST",
    body: {
      text: "Herr Xaver Quirin, 53 Jahre alt, xaver.quirin@example.ch, Schmerzen NRS 5.",
      patientLabel: "Patient 3",
    },
  };
  const response = createResponseRecorder();

  try {
    const documentHandler = require("../api/document");
    await documentHandler(request, response);

    assert.equal(response.statusCode, 200);
    assert.equal(requestBodies.length, 2);

    for (const body of requestBodies) {
      const serialized = JSON.stringify(body);
      assert.doesNotMatch(serialized, /Xaver|Quirin|xaver\.quirin@example\.ch|53 Jahre/);
    }

    assert.match(requestBodies[0].input, /\[NAME ENTFERNT\]/);
    assert.match(requestBodies[0].input, /\[ALTER ENTFERNT\]/);
    assert.match(requestBodies[0].input, /\[EMAIL ENTFERNT\]/);
    assert.match(requestBodies[0].input, /NRS 5/);
    assert.match(requestBodies[1].input, /\[NAME ENTFERNT\]/);
  } finally {
    global.fetch = originalFetch;
    if (originalApiKey === undefined) {
      delete process.env.OPENAI_API_KEY;
    } else {
      process.env.OPENAI_API_KEY = originalApiKey;
    }
  }
});

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
