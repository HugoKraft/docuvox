const DOCUVOX_SUPABASE_URL = "https://cnshqztlaxmjahurxbgd.supabase.co";

module.exports = async function handler(request, response) {
  if (!["GET", "POST"].includes(request.method)) {
    return sendJson(response, 405, { error: "Method not allowed" });
  }

  if (!process.env.SUPABASE_ANON_KEY) {
    return sendJson(response, 503, {
      error: "Cloud-Speicherung ist nicht konfiguriert. Bitte SUPABASE_ANON_KEY setzen.",
    });
  }

  const accessToken = readBearerToken(request);
  if (!accessToken) {
    return sendJson(response, 401, { error: "Nicht angemeldet." });
  }

  try {
    if (request.method === "GET") {
      const url = new URL(request.url, `http://${request.headers.host || "localhost"}`);
      const date = normalizeDate(url.searchParams.get("date"));
      const documents = await listDocuments({ accessToken, date });
      return sendJson(response, 200, { documents });
    }

    const body = await readJsonBody(request);
    const date = normalizeDate(body.date);
    const patientNumber = Number.parseInt(body.patientNumber, 10);
    const content = String(body.content || "").trim();
    const userId = String(body.userId || "").trim();

    if (!Number.isInteger(patientNumber) || patientNumber < 1 || !content || !userId) {
      return sendJson(response, 400, { error: "patientNumber, content und userId sind erforderlich." });
    }

    const document = await saveDocument({
      accessToken,
      userId,
      patientNumber,
      content,
      date,
    });

    return sendJson(response, 200, { document });
  } catch (error) {
    return sendJson(response, 500, {
      error: error.message || "Cloud-Speicherung fehlgeschlagen.",
    });
  }
};

async function listDocuments({ accessToken, date }) {
  const { start, end } = getDayBounds(date);
  const path = `/rest/v1/documents?select=id,user_id,patient_number,content,created_at&created_at=gte.${encodeURIComponent(start)}&created_at=lt.${encodeURIComponent(end)}&order=patient_number.asc,created_at.asc`;
  return supabaseRequest(path, {
    method: "GET",
    accessToken,
  });
}

async function saveDocument({ accessToken, userId, patientNumber, content, date }) {
  const { start, end } = getDayBounds(date);
  const deletePath = `/rest/v1/documents?user_id=eq.${encodeURIComponent(userId)}&patient_number=eq.${patientNumber}&created_at=gte.${encodeURIComponent(start)}&created_at=lt.${encodeURIComponent(end)}`;

  console.log("SUPABASE DELETE REQUEST", {
    path: deletePath,
    userId,
    patientNumber,
    date,
    hasAccessToken: Boolean(accessToken),
  });

  try {
    await supabaseRequest(deletePath, {
      method: "DELETE",
      accessToken,
      prefer: "return=minimal",
    });
  } catch (error) {
    console.error("Supabase documents DELETE failed:", error.message || error);
    throw error;
  }

  const insertPath = "/rest/v1/documents?select=id,user_id,patient_number,content,created_at";

  console.log("SUPABASE INSERT REQUEST", {
    path: insertPath,
    userId,
    patientNumber,
    contentLength: content.length,
    hasAccessToken: Boolean(accessToken),
  });

  const inserted = await supabaseRequest(insertPath, {
    method: "POST",
    accessToken,
    prefer: "return=representation",
    body: {
      user_id: userId,
      patient_number: patientNumber,
      content,
    },
  });

  return Array.isArray(inserted) ? inserted[0] : inserted;
}

async function supabaseRequest(path, options) {
  const baseUrl = resolveSupabaseUrl();
  const anonKey = String(process.env.SUPABASE_ANON_KEY || "").trim();
  const headers = {
    apikey: anonKey,
    Authorization: `Bearer ${options.accessToken}`,
    "Content-Type": "application/json",
  };

  if (options.prefer) {
    headers.Prefer = options.prefer;
  }

  if (["DELETE", "POST"].includes(options.method)) {
    console.log("SUPABASE REQUEST", {
      method: options.method,
      path,
      hasAuthorizationHeader: Boolean(headers.Authorization),
      hasAnonKey: Boolean(anonKey),
      bodyKeys: options.body ? Object.keys(options.body) : [],
    });
  }

  const response = await fetch(`${baseUrl}${path}`, {
    method: options.method,
    headers,
    body: options.body ? JSON.stringify(options.body) : undefined,
  });

  if (["DELETE", "POST"].includes(options.method)) {
    console.log("SUPABASE RESPONSE", {
      method: options.method,
      status: response.status,
      path,
    });
  }

  if (response.status === 204) return null;

  const payload = await response.json().catch(() => ({}));

  if (!response.ok) {
    console.error("SUPABASE ERROR", {
      status: response.status,
      payload,
      path,
    });
    throw new Error(payload.message || payload.error_description || "Supabase documents request failed");
  }

  return payload;
}

function readBearerToken(request) {
  const authorization = request.headers.authorization || request.headers.Authorization || "";
  const match = String(authorization).match(/^Bearer\s+(.+)$/i);
  return match ? match[1].trim() : "";
}

function getDayBounds(date) {
  const startDate = new Date(`${date}T00:00:00.000Z`);
  const endDate = new Date(startDate);
  endDate.setUTCDate(endDate.getUTCDate() + 1);

  return {
    start: startDate.toISOString(),
    end: endDate.toISOString(),
  };
}

function normalizeDate(value) {
  const candidate = String(value || "").trim();
  if (/^\d{4}-\d{2}-\d{2}$/.test(candidate)) return candidate;
  return new Date().toISOString().slice(0, 10);
}

function resolveSupabaseUrl() {
  const rawValue = String(process.env.SUPABASE_URL || "").trim().replace(/^["']|["']$/g, "");

  if (!rawValue || isKnownPlaceholderSupabaseUrl(rawValue)) {
    return DOCUVOX_SUPABASE_URL;
  }

  try {
    const url = new URL(rawValue);
    if (url.protocol !== "https:" || !url.hostname.endsWith(".supabase.co")) {
      throw new Error("SUPABASE_URL must be an HTTPS Supabase project URL");
    }
    return url.origin;
  } catch {
    throw new Error("SUPABASE_URL ist ungültig. Erwartet wird z. B. https://cnshqztlaxmjahurxbgd.supabase.co.");
  }
}

function isKnownPlaceholderSupabaseUrl(value) {
  try {
    const url = new URL(value);
    return url.hostname.toLowerCase() === "abcde.supabase.co";
  } catch {
    return false;
  }
}

async function readJsonBody(request) {
  if (request.body && typeof request.body === "object") return request.body;
  if (typeof request.body === "string") return JSON.parse(request.body || "{}");

  return new Promise((resolve, reject) => {
    let raw = "";
    request.on("data", (chunk) => {
      raw += chunk;
      if (raw.length > 100_000) {
        reject(new Error("Request body too large"));
        request.destroy();
      }
    });
    request.on("end", () => {
      try {
        resolve(JSON.parse(raw || "{}"));
      } catch (error) {
        reject(error);
      }
    });
    request.on("error", reject);
  });
}

function sendJson(response, statusCode, body) {
  response.writeHead(statusCode, {
    "Content-Type": "application/json;charset=utf-8",
    "Cache-Control": "no-store",
  });
  response.end(JSON.stringify(body));
}
