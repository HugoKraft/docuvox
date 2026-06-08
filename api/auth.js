const SUPABASE_AUTH_VERSION = "docuvox-auth-supabase-v1";
const DOCUVOX_SUPABASE_URL = "https://cnshqztlaxmjahurxbgd.supabase.co";
const EMAIL_CONFIRMATION_REQUIRED_MESSAGE =
  "Bitte bestätigen Sie zuerst Ihre E-Mail-Adresse.";
const EMAIL_CONFIRMATION_SENT_MESSAGE =
  "Bitte bestätigen Sie zuerst Ihre E-Mail-Adresse. Wir haben Ihnen eine Bestätigungsmail gesendet.";

module.exports = async function handler(request, response) {
  if (request.method !== "POST") {
    return sendJson(response, 405, { error: "Method not allowed" });
  }

  try {
    const body = await readJsonBody(request);
    const action = String(body.action || "").trim();
    const email = normalizeEmail(body.email);
    const password = String(body.password || "");

    if (!["login", "signup"].includes(action)) {
      return sendJson(response, 400, { error: "Unbekannte Auth-Aktion." });
    }

    if (!isValidEmail(email) || password.length < 1) {
      return sendJson(response, 400, { error: "Bitte E-Mail-Adresse und Passwort prüfen." });
    }

    if (!process.env.SUPABASE_ANON_KEY) {
      return sendJson(response, 503, {
        error: "Login ist noch nicht konfiguriert. Bitte SUPABASE_ANON_KEY setzen.",
        authVersion: SUPABASE_AUTH_VERSION,
      });
    }

    if (action === "signup") {
      return signUpWithSupabase({ email, password, response });
    }

    return signInWithSupabase({ email, password, response });
  } catch (error) {
    return sendJson(response, 500, {
      error: error.message || "Authentifizierung fehlgeschlagen.",
      authVersion: SUPABASE_AUTH_VERSION,
    });
  }
};

async function signUpWithSupabase({ email, password, response }) {
  const payload = await supabaseRequest("/auth/v1/signup", {
    method: "POST",
    body: {
      email,
      password,
    },
  });

  const user = payload.user || payload;

  if (!isEmailConfirmed(user)) {
    return sendJson(response, 200, {
      session: null,
      requiresEmailConfirmation: true,
      message: EMAIL_CONFIRMATION_SENT_MESSAGE,
      authVersion: SUPABASE_AUTH_VERSION,
    });
  }

  const session = createSession(payload, user);

  return sendJson(response, 200, {
    session,
    requiresEmailConfirmation: false,
    message: "Konto erstellt.",
    authVersion: SUPABASE_AUTH_VERSION,
  });
}

async function signInWithSupabase({ email, password, response }) {
  const payload = await supabaseRequest("/auth/v1/token?grant_type=password", {
    method: "POST",
    body: {
      email,
      password,
    },
  });

  const accessToken = payload.access_token || "";
  const user = accessToken ? await fetchSupabaseUser(accessToken) : payload.user;

  if (!isEmailConfirmed(user)) {
    return sendJson(response, 403, {
      error: EMAIL_CONFIRMATION_REQUIRED_MESSAGE,
      requiresEmailConfirmation: true,
      authVersion: SUPABASE_AUTH_VERSION,
    });
  }

  const session = createSession(payload, user);

  if (!session) {
    return sendJson(response, 401, {
      error: "Login fehlgeschlagen. Bitte E-Mail und Passwort prüfen.",
      authVersion: SUPABASE_AUTH_VERSION,
    });
  }

  return sendJson(response, 200, {
    session,
    requiresEmailConfirmation: false,
    authVersion: SUPABASE_AUTH_VERSION,
  });
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
  const response = await fetch(`${baseUrl}${path}`, {
    method: options.method,
    headers: {
      apikey: anonKey,
      Authorization: `Bearer ${options.accessToken || anonKey}`,
      "Content-Type": "application/json",
    },
    body: options.body ? JSON.stringify(options.body) : undefined,
  });

  const payload = await response.json().catch(() => ({}));

  if (!response.ok) {
    throw new Error(mapSupabaseError(payload));
  }

  return payload;
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

function createSession(payload, verifiedUser) {
  const user = verifiedUser || payload.user || payload;
  const accessToken = payload.access_token || "";
  const refreshToken = payload.refresh_token || "";

  if (!user?.id || !user?.email) return null;

  return {
    userId: user.id,
    email: user.email,
    accessToken,
    refreshToken,
    expiresAt: payload.expires_in ? Date.now() + payload.expires_in * 1000 : null,
  };
}

function isEmailConfirmed(user) {
  return Boolean(user?.email_confirmed_at || user?.confirmed_at);
}

function mapSupabaseError(payload) {
  const message = String(payload.error_description || payload.msg || payload.message || "").toLowerCase();

  if (message.includes("invalid login") || message.includes("invalid credentials")) {
    return "Login fehlgeschlagen. Bitte E-Mail und Passwort prüfen.";
  }

  if (message.includes("already registered") || message.includes("already exists")) {
    return "Für diese E-Mail-Adresse existiert bereits ein Konto.";
  }

  if (message.includes("email not confirmed")) {
    return EMAIL_CONFIRMATION_REQUIRED_MESSAGE;
  }

  return payload.error_description || payload.msg || payload.message || "Authentifizierung fehlgeschlagen.";
}

function normalizeEmail(value) {
  return String(value || "").trim().toLowerCase();
}

function isValidEmail(value) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);
}

async function readJsonBody(request) {
  if (request.body && typeof request.body === "object") return request.body;
  if (typeof request.body === "string") return JSON.parse(request.body || "{}");

  return new Promise((resolve, reject) => {
    let raw = "";
    request.on("data", (chunk) => {
      raw += chunk;
      if (raw.length > 20_000) {
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
