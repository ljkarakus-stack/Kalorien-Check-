"use strict";

// Optional account with sync via Supabase. Without config.js values the app stays local-only.
// Expects one table `user_data` (see supabase-setup.sql): one row per user holding the whole state as JSON.

const CFG = window.KC_CONFIG || {};
const sb = CFG.supabaseUrl && CFG.supabaseKey && window.supabase
  ? window.supabase.createClient(CFG.supabaseUrl, CFG.supabaseKey, {
    auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: true },
  })
  : null;

let user = null;
let syncTimer = null;
let syncing = false;
let pending = false;
let lastSync = null;
let authMode = "login";

// ---------- Merge ----------

// Days, weights and own foods are combined from both sides; for anything present on both,
// the side that was changed more recently wins.
function mergeStates(local, remote) {
  const newer = (remote.updatedAt || 0) >= (local.updatedAt || 0) ? remote : local;
  const older = newer === remote ? local : remote;
  const byId = list => Object.fromEntries((list || []).map(f => [f.id, f]));
  return Object.assign(blankState(), older, newer, {
    days: { ...older.days, ...newer.days },
    weights: { ...older.weights, ...newer.weights },
    custom: Object.values({ ...byId(older.custom), ...byId(newer.custom) }),
    amounts: { ...older.amounts, ...newer.amounts },
    goals: newer.goals || older.goals,
    profile: newer.profile || older.profile,
    updatedAt: Math.max(local.updatedAt || 0, remote.updatedAt || 0),
  });
}

function isEmpty(st) {
  return !st.goals && !Object.keys(st.days || {}).length;
}

// ---------- Sync ----------

async function pull() {
  const { data, error } = await sb.from("user_data").select("data").eq("user_id", user.id).maybeSingle();
  if (error) throw error;
  const remote = data?.data;
  if (!remote) return push();
  const merged = isEmpty(state) ? Object.assign(blankState(), remote) : mergeStates(state, remote);
  const changedLocally = JSON.stringify(merged) !== JSON.stringify(state);
  state = merged;
  save(false);
  if (changedLocally) afterRemoteLoad();
  if ((merged.updatedAt || 0) > (remote.updatedAt || 0) || JSON.stringify(merged) !== JSON.stringify(remote)) await push();
}

async function push() {
  const { error } = await sb.from("user_data").upsert({ user_id: user.id, data: state, updated_at: new Date().toISOString() });
  if (error) throw error;
}

async function sync(fn = push) {
  if (!user) return;
  if (syncing) { pending = true; return; }
  syncing = true;
  setSyncStatus("Wird gespeichert …");
  try {
    await fn();
    lastSync = new Date();
    setSyncStatus();
  } catch (e) {
    pending = true;
    setSyncStatus("Nicht synchronisiert, ich versuche es gleich nochmal.");
  } finally {
    syncing = false;
    if (pending && navigator.onLine) { pending = false; scheduleSync(4000); }
  }
}

function scheduleSync(delay = 1500) {
  clearTimeout(syncTimer);
  syncTimer = setTimeout(() => sync(), delay);
}

window.onLocalChange = () => { if (user) scheduleSync(); };
window.addEventListener("online", () => { if (user) sync(pull); });
document.addEventListener("visibilitychange", () => {
  // Pick up entries made on another device when coming back to the app
  if (user && document.visibilityState === "visible") sync(pull);
});

function afterRemoteLoad() {
  if (state.goals) {
    $("#onboard").hidden = true;
    showView(view);
  } else {
    openOnboarding();
  }
}

// ---------- UI ----------

function setSyncStatus(msg) {
  const el = $("#sync-status");
  if (!el) return;
  el.textContent = msg || (lastSync ? `Zuletzt gespeichert um ${lastSync.toLocaleTimeString("de-DE", { hour: "2-digit", minute: "2-digit" })}` : "");
}

function renderAccount() {
  $("#account-card").hidden = !sb;
  $("#onboard-login").hidden = !sb || !!user;
  if (!sb) return;
  $("#account-out").hidden = !!user;
  $("#account-in").hidden = !user;
  if (user) $("#account-email").textContent = user.email;
  setSyncStatus();
}

function openAuth(mode) {
  authMode = mode;
  const f = $("#auth-form");
  f.reset();
  $("#auth-title").textContent = { login: "Anmelden", signup: "Konto erstellen", reset: "Passwort vergessen", newpass: "Neues Passwort" }[mode];
  $("#auth-email-row").hidden = mode === "newpass";
  $("#auth-pass-row").hidden = mode === "reset";
  $("#auth-consent-row").hidden = mode !== "signup";
  f.elements.consent.required = mode === "signup";
  f.elements.email.required = mode !== "newpass";
  f.elements.password.required = mode !== "reset";
  f.elements.password.autocomplete = mode === "login" ? "current-password" : "new-password";
  $("#auth-submit").textContent = { login: "Anmelden", signup: "Konto erstellen", reset: "Link senden", newpass: "Passwort speichern" }[mode];
  $("#auth-switch").hidden = mode === "newpass";
  $("#auth-switch").innerHTML = mode === "login"
    ? `Noch kein Konto? <button type="button" class="link" data-auth="signup">Konto erstellen</button><br><button type="button" class="link" data-auth="reset">Passwort vergessen?</button>`
    : `Schon ein Konto? <button type="button" class="link" data-auth="login">Anmelden</button>`;
  $("#auth-msg").textContent = "";
  $("#auth").hidden = false;
}

const AUTH_ERRORS = {
  "Invalid login credentials": "E-Mail oder Passwort stimmt nicht.",
  "Email not confirmed": "Bitte bestätige zuerst deine E-Mail-Adresse über den Link, den wir dir geschickt haben.",
  "User already registered": "Für diese E-Mail gibt es schon ein Konto. Melde dich einfach an.",
};
function authError(e) {
  const m = e?.message || "";
  if (AUTH_ERRORS[m]) return AUTH_ERRORS[m];
  if (/password/i.test(m) && /least|short|characters/i.test(m)) return "Das Passwort muss mindestens 8 Zeichen haben.";
  if (/rate limit|too many/i.test(m)) return "Zu viele Versuche. Bitte warte kurz.";
  if (/fetch|network/i.test(m)) return "Keine Verbindung. Bitte prüfe dein Internet.";
  return "Das hat nicht geklappt. Bitte versuch es nochmal.";
}

async function submitAuth(e) {
  e.preventDefault();
  const f = e.target.elements;
  const email = f.email.value.trim();
  const password = f.password.value;
  const msg = $("#auth-msg");
  const btn = $("#auth-submit");
  btn.disabled = true;
  msg.textContent = "";
  const redirect = location.origin + location.pathname;
  try {
    if (authMode === "login") {
      const { error } = await sb.auth.signInWithPassword({ email, password });
      if (error) throw error;
      $("#auth").hidden = true;
      toast("Angemeldet");
    } else if (authMode === "signup") {
      if (password.length < 8) throw new Error("password too short: at least 8 characters");
      const { data, error } = await sb.auth.signUp({
        email, password, options: { emailRedirectTo: redirect, data: { consent_health_data: new Date().toISOString() } },
      });
      if (error) throw error;
      if (data.session) { $("#auth").hidden = true; toast("Konto erstellt"); }
      else msg.textContent = "Fast geschafft! Wir haben dir eine E-Mail geschickt. Tippe auf den Link darin, dann melde dich hier an.";
    } else if (authMode === "reset") {
      const { error } = await sb.auth.resetPasswordForEmail(email, { redirectTo: redirect });
      if (error) throw error;
      msg.textContent = "Wenn es ein Konto mit dieser E-Mail gibt, ist ein Link zum Zurücksetzen unterwegs.";
    } else if (authMode === "newpass") {
      if (password.length < 8) throw new Error("password too short: at least 8 characters");
      const { error } = await sb.auth.updateUser({ password });
      if (error) throw error;
      $("#auth").hidden = true;
      toast("Neues Passwort gespeichert");
    }
  } catch (err) {
    msg.textContent = authError(err);
  } finally {
    btn.disabled = false;
  }
}

async function logout() {
  if (!confirm("Abmelden? Deine Einträge bleiben in deinem Konto gespeichert und werden von diesem Gerät entfernt.")) return;
  await sync(push).catch(() => {});
  await sb.auth.signOut();
  state = blankState();
  save(false);
  openOnboarding();
  toast("Abgemeldet");
}

async function deleteAccount() {
  if (!confirm("Konto und alle gespeicherten Daten endgültig löschen? Das kann nicht rückgängig gemacht werden.")) return;
  const { error } = await sb.rpc("delete_my_account");
  if (error) return toast("Löschen hat nicht geklappt. Bitte versuch es nochmal.");
  await sb.auth.signOut();
  state = blankState();
  save(false);
  openOnboarding();
  toast("Dein Konto wurde gelöscht");
}

// ---------- Wiring ----------

if (sb) {
  sb.auth.onAuthStateChange((event, session) => {
    const wasOut = !user;
    user = session?.user || null;
    renderAccount();
    if (event === "PASSWORD_RECOVERY") openAuth("newpass");
    // Defer so Supabase finishes its own bookkeeping before we query
    if (user && wasOut) setTimeout(() => sync(pull), 0);
  });
}

document.addEventListener("click", e => {
  const b = e.target.closest("[data-auth]");
  if (b) { e.preventDefault(); openAuth(b.dataset.auth); }
});
$("#auth-form").addEventListener("submit", submitAuth);
$("#auth-close").addEventListener("click", () => $("#auth").hidden = true);
$("#logout").addEventListener("click", logout);
$("#delete-account").addEventListener("click", deleteAccount);
renderAccount();
