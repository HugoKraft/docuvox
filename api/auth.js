const SUPABASE_AUTH_VERSION = "docuvox-auth-supabase-v1";

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

    if (!process.env.SUPABASE_URL || !process.env.SUPABASE_ANON_KEY) {
      return sendJson(response, 503, {
        error: "Login ist noch nicht konfiguriert. Bitte Supabase Auth Environment Variables setzen.",
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

  const session = createSession(payload);

  return sendJson(response, 200, {
    session,
    requiresEmailConfirmation: !session,
    message: session ? "Konto erstellt." : "Bitte bestätige deine E-Mail-Adresse.",
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

  const session = createSession(payload);

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

async function supabaseRequest(path, options) {
  const baseUrl = process.env.SUPABASE_URL.replace(/\/+$/, "");
  const response = await fetch(`${baseUrl}${path}`, {
    method: options.method,
    headers: {
      apikey: process.env.SUPABASE_ANON_KEY,
      Authorization: `Bearer ${process.env.SUPABASE_ANON_KEY}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(options.body || {}),
  });

  const payload = await response.json().catch(() => ({}));

  if (!response.ok) {
    throw new Error(mapSupabaseError(payload));
  }

  return payload;
}

function createSession(payload) {
  const user = payload.user || payload;
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

function mapSupabaseError(payload) {
  const message = String(payload.error_description || payload.msg || payload.message || "").toLowerCase();

  if (message.includes("invalid login") || message.includes("invalid credentials")) {
    return "Login fehlgeschlagen. Bitte E-Mail und Passwort prüfen.";
  }

  if (message.includes("already registered") || message.includes("already exists")) {
    return "Für diese E-Mail-Adresse existiert bereits ein Konto.";
  }

  if (message.includes("email not confirmed")) {
    return "Bitte bestätige zuerst deine E-Mail-Adresse.";
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
