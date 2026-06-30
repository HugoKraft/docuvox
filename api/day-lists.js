const DOCUVOX_SUPABASE_URL = "https://cnshqztlaxmjahurxbgd.supabase.co";

module.exports = async function handler(request, response) {
  if (!["GET", "POST"].includes(request.method)) {
    return sendJson(response, 405, { error: "Method not allowed" });
  }

  if (!process.env.SUPABASE_ANON_KEY) {
    return sendJson(response, 503, {
      error: "Day-List-Speicherung ist nicht konfiguriert. Bitte SUPABASE_ANON_KEY setzen.",
    });
  }

  const accessToken = readBearerToken(request);
  if (!accessToken) {
    return sendJson(response, 401, { error: "Nicht angemeldet." });
  }

  try {
    const user = await fetchSupabaseUser(accessToken);
    const userId = String(user?.id || "").trim();

    if (!userId) {
      return sendJson(response, 401, { error: "Benutzer konnte nicht ermittelt werden." });
    }

    if (request.method === "GET") {
      const payload = await buildActiveDayListPayload({ accessToken, userId });
      return sendJson(response, 200, payload);
    }

    const body = await readJsonBody(request);
    const action = String(body.action || "").trim();

    if (action === "create") {
      const patientCount = Number.parseInt(body.patientCount, 10);
      if (!Number.isInteger(patientCount) || patientCount < 1) {
        return sendJson(response, 400, { error: "patientCount muss eine ganze Zahl >= 1 sein." });
      }

      await createActiveDayList({ accessToken, userId, patientCount });
      const payload = await buildActiveDayListPayload({ accessToken, userId });
      return sendJson(response, 200, payload);
    }

    if (action === "restoreBackup") {
      const restored = await restoreBackupDayList({ accessToken, userId });
      if (!restored) {
        return sendJson(response, 404, { error: "Keine vorherige Tagesliste zum Wiederherstellen vorhanden." });
      }

      const payload = await buildActiveDayListPayload({ accessToken, userId });
      return sendJson(response, 200, payload);
    }

    return sendJson(response, 400, { error: "Unbekannte Day-List-Aktion." });
  } catch (error) {
    return sendJson(response, 500, {
      error: error.message || "Day-List-Verarbeitung fehlgeschlagen.",
    });
  }
};

async function buildActiveDayListPayload({ accessToken, userId }) {
  const [activeDayList, backupAvailable] = await Promise.all([
    getDayListByStatus({ accessToken, userId, status: "active" }),
    hasDayListByStatus({ accessToken, userId, status: "backup" }),
  ]);

  const documents = activeDayList
    ? await listDocumentsForDayList({ accessToken, userId, dayListId: activeDayList.id })
    : [];

  return {
    dayList: activeDayList,
    documents,
    backupAvailable,
  };
}

async function createActiveDayList({ accessToken, userId, patientCount }) {
  await deleteDayListsByStatus({ accessToken, userId, status: "backup" });
  await updateDayListStatus({ accessToken, userId, fromStatus: "active", toStatus: "backup" });

  const inserted = await supabaseRequest("/rest/v1/day_lists?select=id,user_id,status,date,patient_count,schema_version,created_at,updated_at", {
    method: "POST",
    accessToken,
    prefer: "return=representation",
    body: {
      user_id: userId,
      status: "active",
      date: today(),
      patient_count: patientCount,
      schema_version: 1,
    },
  });

  return Array.isArray(inserted) ? inserted[0] : inserted;
}

async function restoreBackupDayList({ accessToken, userId }) {
  const backupDayList = await getDayListByStatus({ accessToken, userId, status: "backup" });
  if (!backupDayList) return null;

  await deleteDayListsByStatus({ accessToken, userId, status: "active" });

  const restored = await supabaseRequest(
    `/rest/v1/day_lists?id=eq.${encodeURIComponent(backupDayList.id)}&user_id=eq.${encodeURIComponent(userId)}&select=id,user_id,status,date,patient_count,schema_version,created_at,updated_at`,
    {
      method: "PATCH",
      accessToken,
      prefer: "return=representation",
      body: {
        status: "active",
      },
    }
  );

  return Array.isArray(restored) ? restored[0] : restored;
}

async function getDayListByStatus({ accessToken, userId, status }) {
  const dayLists = await supabaseRequest(
    `/rest/v1/day_lists?select=id,user_id,status,date,patient_count,schema_version,created_at,updated_at&user_id=eq.${encodeURIComponent(userId)}&status=eq.${encodeURIComponent(status)}&limit=1`,
    {
      method: "GET",
      accessToken,
    }
  );

  return Array.isArray(dayLists) ? dayLists[0] || null : null;
}

async function hasDayListByStatus({ accessToken, userId, status }) {
  const dayList = await getDayListByStatus({ accessToken, userId, status });
  return Boolean(dayList);
}

async function deleteDayListsByStatus({ accessToken, userId, status }) {
  await supabaseRequest(
    `/rest/v1/day_lists?user_id=eq.${encodeURIComponent(userId)}&status=eq.${encodeURIComponent(status)}`,
    {
      method: "DELETE",
      accessToken,
      prefer: "return=minimal",
    }
  );
}

async function updateDayListStatus({ accessToken, userId, fromStatus, toStatus }) {
  const updated = await supabaseRequest(
    `/rest/v1/day_lists?user_id=eq.${encodeURIComponent(userId)}&status=eq.${encodeURIComponent(fromStatus)}&select=id,user_id,status,date,patient_count,schema_version,created_at,updated_at`,
    {
      method: "PATCH",
      accessToken,
      prefer: "return=representation",
      body: {
        status: toStatus,
      },
    }
  );

  return Array.isArray(updated) ? updated : [];
}

async function listDocumentsForDayList({ accessToken, userId, dayListId }) {
  return supabaseRequest(
    `/rest/v1/documents?select=id,user_id,day_list_id,patient_number,content,created_at&user_id=eq.${encodeURIComponent(userId)}&day_list_id=eq.${encodeURIComponent(dayListId)}&order=patient_number.asc,created_at.asc`,
    {
      method: "GET",
      accessToken,
    }
  );
}

async function fetchSupabaseUser(accessToken) {
  return supabaseRequest("/auth/v1/user", {
    method: "GET",
    accessToken,
  });
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

  const supabaseResponse = await fetch(`${baseUrl}${path}`, {
    method: options.method,
    headers,
    body: options.body ? JSON.stringify(options.body) : undefined,
  });

  if (supabaseResponse.status === 204) return null;

  const payload = await supabaseResponse.json().catch(() => ({}));

  if (!supabaseResponse.ok) {
    throw new Error(payload.message || payload.error_description || "Supabase day_lists request failed");
  }

  return payload;
}

function readBearerToken(request) {
  const authorization = request.headers.authorization || request.headers.Authorization || "";
  const match = String(authorization).match(/^Bearer\s+(.+)$/i);
  return match ? match[1].trim() : "";
}

function today() {
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
      if (raw.length > 50_000) {
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
