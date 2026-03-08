// ============================================================
// API.JS v2 - Conexion con el Backend
// Con refresh token automatico, validaciones y exportacion
// ============================================================

const API_URL = window.location.hostname === "localhost" || window.location.hostname === "127.0.0.1"
  ? "http://localhost:3000/api"
  : "/api";

// ── TOKEN STORAGE ────────────────────────────────────────
function getAccessToken()  { return localStorage.getItem("gym_access"); }
function getRefreshToken() { return localStorage.getItem("gym_refresh"); }
function setTokens(access, refresh) {
  localStorage.setItem("gym_access", access);
  if (refresh) localStorage.setItem("gym_refresh", refresh);
}
function getUser() {
  const u = localStorage.getItem("gym_user");
  return u ? JSON.parse(u) : null;
}
function isLoggedIn() { return !!getAccessToken(); }

// ── FETCH CON AUTO-REFRESH ────────────────────────────────
let isRefreshing = false;
let refreshQueue = [];

async function apiCall(method, endpoint, body = null, isRetry = false) {
  const headers = { "Content-Type": "application/json" };
  const token = getAccessToken();
  if (token) headers["Authorization"] = "Bearer " + token;
  const options = { method, headers };
  if (body) options.body = JSON.stringify(body);

  try {
    const res = await fetch(API_URL + endpoint, options);
    const data = await res.json();

    // Token expirado -> intentar refresh automaticamente
    if (res.status === 401 && data.error === "TOKEN_EXPIRED" && !isRetry) {
      const refreshed = await tryRefresh();
      if (refreshed) return apiCall(method, endpoint, body, true);
      else { logout(); return { status: 401, data: { ok: false, error: "Sesion expirada" } }; }
    }
    return { status: res.status, data };
  } catch(e) {
    return { status: 0, data: { ok: false, error: "Sin conexion" } };
  }
}

async function tryRefresh() {
  const refreshToken = getRefreshToken();
  if (!refreshToken) return false;
  try {
    const res = await fetch(API_URL + "/auth/refresh", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ refreshToken })
    });
    const data = await res.json();
    if (data.ok) { setTokens(data.accessToken, data.refreshToken); return true; }
    return false;
  } catch(e) { return false; }
}

// ── AUTH ──────────────────────────────────────────────────
async function register(username, email, password) {
  const r = await apiCall("POST", "/auth/register", { username, email, password });
  if (r.data.ok) { setTokens(r.data.accessToken, r.data.refreshToken); localStorage.setItem("gym_user", JSON.stringify(r.data.usuario)); }
  return r;
}

async function login(email, password) {
  const r = await apiCall("POST", "/auth/login", { email, password });
  if (r.data.ok) { setTokens(r.data.accessToken, r.data.refreshToken); localStorage.setItem("gym_user", JSON.stringify(r.data.usuario)); }
  return r;
}

function logout() {
  apiCall("POST", "/auth/logout").catch(()=>{});
  ["gym_access","gym_refresh","gym_user","gym_offline_queue"].forEach(k => localStorage.removeItem(k));
  window.location.href = "/";
}

async function forgotPassword(email) { return apiCall("POST", "/auth/forgot-password", { email }); }
async function resetPassword(token, password) { return apiCall("POST", "/auth/reset-password", { token, password }); }

// ── SESIONES ──────────────────────────────────────────────
async function getSesiones(params = {}) {
  const qs = new URLSearchParams(params).toString();
  return apiCall("GET", "/sesiones" + (qs ? "?" + qs : ""));
}
async function getStats()          { return apiCall("GET", "/sesiones/stats"); }
async function getSesion(id)       { return apiCall("GET", "/sesiones/" + id); }
async function crearSesion(d)      { return apiCall("POST", "/sesiones", d); }
async function actualizarSesion(id,d) { return apiCall("PUT", "/sesiones/" + id, d); }
async function eliminarSesion(id)  { return apiCall("DELETE", "/sesiones/" + id); }

// ── EXPORTAR CSV ──────────────────────────────────────────
async function exportarCSV() {
  const token = getAccessToken();
  const res = await fetch(API_URL + "/sesiones/export/csv", { headers: { "Authorization": "Bearer " + token } });
  const blob = await res.blob();
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url; a.download = "gymy_export.csv"; a.click();
  URL.revokeObjectURL(url);
}

// ── OFFLINE ───────────────────────────────────────────────
function guardarOffline(sesion) {
  const q = JSON.parse(localStorage.getItem("gym_offline_queue") || "[]");
  sesion._offline_id = Date.now();
  q.push(sesion);
  localStorage.setItem("gym_offline_queue", JSON.stringify(q));
}
async function sincronizarOffline() {
  const q = JSON.parse(localStorage.getItem("gym_offline_queue") || "[]");
  if (!q.length) return { sincronizadas: 0 };
  const r = await apiCall("POST", "/sesiones/sync", { sesiones: q });
  if (r.data.ok) { localStorage.removeItem("gym_offline_queue"); return { sincronizadas: q.length }; }
  return { sincronizadas: 0 };
}
function getPendientesOffline() { return JSON.parse(localStorage.getItem("gym_offline_queue") || "[]"); }

// ── VALIDACIONES FRONTEND ─────────────────────────────────
function validarSesion(datos) {
  const errores = [];
  if (!datos.fecha) errores.push("La fecha es obligatoria");
  else if (new Date(datos.fecha) > new Date()) errores.push("La fecha no puede ser futura");
  if (!datos.tipo) errores.push("El tipo es obligatorio");
  if (datos.duracion_min && (datos.duracion_min < 1 || datos.duracion_min > 600)) errores.push("Duracion entre 1 y 600 min");
  if (datos.calorias && (datos.calorias < 1 || datos.calorias > 10000)) errores.push("Calorias entre 1 y 10000");
  if (datos.valoracion && (datos.valoracion < 1 || datos.valoracion > 5)) errores.push("Valoracion entre 1 y 5");
  return errores;
}
