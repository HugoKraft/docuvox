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
    const userId = await getAuthenticatedUserId(accessToken);

    if (request.method === "GET") {
      const url = new URL(request.url, `http://${request.headers.host || "localhost"}`);
      const dayListId = normalizeOptionalId(url.searchParams.get("dayListId"));

      if (dayListId) {
        await getDayListForUser({ accessToken, userId, dayListId });
        const documents = await listDocumentsForDayList({ accessToken, userId, dayListId });
        return sendJson(response, 200, { documents });
      }

      const date = normalizeDate(url.searchParams.get("date"));
      const documents = await listDocuments({ accessToken, userId, date });
      return sendJson(response, 200, { documents });
    }

    const body = await readJsonBody(request);
    const dayListId = normalizeOptionalId(body.dayListId);
    const patientNumber = Number.parseInt(body.patientNumber, 10);
    const content = String(body.content || "").trim();

    if (!Number.isInteger(patientNumber) || patientNumber < 1 || !content) {
      return sendJson(response, 400, { error: "patientNumber und content sind erforderlich." });
    }

    if (dayListId) {
      const dayList = await getDayListForUser({ accessToken, userId, dayListId });

      if (dayList.status !== "active") {
        return sendJson(response, 403, { error: "Dokumente können nur in der aktiven Tagesliste gespeichert werden." });
      }

      const document = await saveDocumentForDayList({
        accessToken,
        userId,
        dayListId,
        patientNumber,
        content,
      });

      return sendJson(response, 200, { document });
    }

    const date = normalizeDate(body.date);
    const document = await saveDocument({
      accessToken,
      userId,
      patientNumber,
      content,
      date,
    });

    return sendJson(response, 200, { document });
  } catch (error) {
    return sendJson(response, error.statusCode || 500, {
      error: error.message || "Cloud-Speicherung fehlgeschlagen.",
    });
  }
};

async function getAuthenticatedUserId(accessToken) {
  const user = await supabaseRequest("/auth/v1/user", {
    method: "GET",
    accessToken,
  });

  const userId = String(user?.id || "").trim();
  if (!userId) {
    throw createHttpError(401, "Benutzer konnte nicht ermittelt werden.");
  }

  return userId;
}

async function getDayListForUser({ accessToken, userId, dayListId }) {
  const dayLists = await supabaseRequest(
    `/rest/v1/day_lists?select=id,user_id,status,date,patient_count,schema_version,created_at,updated_at&id=eq.${encodeURIComponent(dayListId)}&user_id=eq.${encodeURIComponent(userId)}&limit=1`,
    {
      method: "GET",
      accessToken,
    }
  );

  const dayList = Array.isArray(dayLists) ? dayLists[0] : null;
  if (!dayList) {
    throw createHttpError(404, "Tagesliste wurde nicht gefunden.");
  }

  return dayList;
}

async function listDocuments({ accessToken, userId, date }) {
  const { start, end } = getDayBounds(date);
  const path = `/rest/v1/documents?select=id,user_id,patient_number,content,created_at&user_id=eq.${encodeURIComponent(userId)}&day_list_id=is.null&created_at=gte.${encodeURIComponent(start)}&created_at=lt.${encodeURIComponent(end)}&order=patient_number.asc,created_at.asc`;
  return supabaseRequest(path, {
    method: "GET",
    accessToken,
  });
}

async function listDocumentsForDayList({ accessToken, userId, dayListId }) {
  const path = `/rest/v1/documents?select=id,user_id,day_list_id,patient_number,content,created_at&user_id=eq.${encodeURIComponent(userId)}&day_list_id=eq.${encodeURIComponent(dayListId)}&order=patient_number.asc,created_at.asc`;
  return supabaseRequest(path, {
    method: "GET",
    accessToken,
  });
}

async function saveDocument({ accessToken, userId, patientNumber, content, date }) {
  const { start, end } = getDayBounds(date);
  const deletePath = `/rest/v1/documents?user_id=eq.${encodeURIComponent(userId)}&day_list_id=is.null&patient_number=eq.${patientNumber}&created_at=gte.${encodeURIComponent(start)}&created_at=lt.${encodeURIComponent(end)}`;

  await supabaseRequest(deletePath, {
    method: "DELETE",
    accessToken,
    prefer: "return=minimal",
  });

  const insertPath = "/rest/v1/documents?select=id,user_id,patient_number,content,created_at";

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

async function saveDocumentForDayList({ accessToken, userId, dayListId, patientNumber, content }) {
  const deletePath = `/rest/v1/documents?user_id=eq.${encodeURIComponent(userId)}&day_list_id=eq.${encodeURIComponent(dayListId)}&patient_number=eq.${patientNumber}`;

  await supabaseRequest(deletePath, {
    method: "DELETE",
    accessToken,
    prefer: "return=minimal",
  });

  const insertPath = "/rest/v1/documents?select=id,user_id,day_list_id,patient_number,content,created_at";

  const inserted = await supabaseRequest(insertPath, {
    method: "POST",
    accessToken,
    prefer: "return=representation",
    body: {
      user_id: userId,
      day_list_id: dayListId,
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

  const response = await fetch(`${baseUrl}${path}`, {
    method: options.method,
    headers,
    body: options.body ? JSON.stringify(options.body) : undefined,
  });

  if (response.status === 204) return null;

  const payload = await response.json().catch(() => ({}));

  if (!response.ok) {
    console.error("SUPABASE ERROR", {
      status: response.status,
      payload,
      path,
    });

    const error = createHttpError(
      response.status === 401 ? 401 : 500,
      payload.message || payload.error_description || "Supabase documents request failed"
    );
    throw error;
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

function normalizeOptionalId(value) {
  return String(value || "").trim();
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

function createHttpError(statusCode, message) {
  const error = new Error(message);
  error.statusCode = statusCode;
  return error;
}

function sendJson(response, statusCode, body) {
  response.writeHead(statusCode, {
    "Content-Type": "application/json;charset=utf-8",
    "Cache-Control": "no-store",
  });
  response.end(JSON.stringify(body));
}
