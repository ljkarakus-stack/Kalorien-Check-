"use strict";

const STORE_KEY = "jamileo-kalorien-check-v1";
const SLOTS = [
  { id: "fruehstueck", name: "Frühstück", emoji: "🥣" },
  { id: "mittag", name: "Mittagessen", emoji: "🍗" },
  { id: "abend", name: "Abendessen", emoji: "🥔" },
  { id: "snack", name: "Snacks", emoji: "🍎" },
];
const GLASS_ML = 250;

// ---------- State ----------

function blankState() {
  return { goals: null, profile: null, days: {}, weights: {}, custom: [], recent: [], amounts: {} };
}

function load() {
  try {
    const raw = localStorage.getItem(STORE_KEY);
    if (raw) return Object.assign(blankState(), JSON.parse(raw));
  } catch (e) { /* storage blocked or corrupt: start fresh */ }
  return blankState();
}

let state = load();

function save() {
  try { localStorage.setItem(STORE_KEY, JSON.stringify(state)); }
  catch (e) { toast("Speichern nicht möglich (privater Modus?)"); }
}

let currentDay = todayKey();
let view = "today";

// ---------- Helpers ----------

const $ = s => document.querySelector(s);
const $$ = s => [...document.querySelectorAll(s)];
const esc = s => String(s).replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
const num = (x, d = 0) => (Math.round(x * 10 ** d) / 10 ** d).toLocaleString("de-DE", { maximumFractionDigits: d });
const uid = () => Date.now().toString(36) + Math.random().toString(36).slice(2, 7);

function todayKey(d = new Date()) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}
function keyToDate(k) {
  const [y, m, d] = k.split("-").map(Number);
  return new Date(y, m - 1, d);
}
function shiftKey(k, days) {
  const d = keyToDate(k);
  d.setDate(d.getDate() + days);
  return todayKey(d);
}

function day(k = currentDay) {
  return state.days[k] || { entries: [], water: 0 };
}
function ensureDay(k = currentDay) {
  if (!state.days[k]) state.days[k] = { entries: [], water: 0 };
  return state.days[k];
}
function totals(k) {
  return day(k).entries.reduce((t, e) => ({
    kcal: t.kcal + e.kcal, p: t.p + e.p, kh: t.kh + e.kh, f: t.f + e.f,
  }), { kcal: 0, p: 0, kh: 0, f: 0 });
}

function allFoods() {
  return [...state.custom, ...FOODS];
}
function foodById(id) {
  const idea = id.startsWith("idee-") && ideaById(id.slice(5));
  return idea ? ideaFood(idea) : allFoods().find(f => f.id === id);
}
// Nutrients for an amount: grams for per-100 g foods, count for portion foods
function scale(food, amount) {
  const factor = food.portion ? amount : amount / 100;
  return { kcal: food.kcal * factor, p: food.p * factor, kh: food.kh * factor, f: food.f * factor };
}
function unitOf(food) {
  return food.ml ? "ml" : "g";
}
function baseLabel(food) {
  return food.portion ? `pro ${food.portion}` : `pro 100 ${unitOf(food)}`;
}
// Household units for a food (Stück, Scheibe, EL …) followed by the base unit (g / ml / portion)
function unitsOf(food) {
  if (food.portion) return [{ label: food.portion, size: 1 }];
  const extra = [food.piece, ...(food.units || [])].filter(Boolean).map(([label, size]) => ({ label, size }));
  return [...extra, { label: unitOf(food), size: 1 }];
}
const PLURALS = {
  Scheibe: "Scheiben", Hälfte: "Hälften", Zehe: "Zehen", Kugel: "Kugeln", Keks: "Kekse", Tasse: "Tassen",
  Dose: "Dosen", "kleine Dose": "kleine Dosen", Flasche: "Flaschen", "kleine Flasche": "kleine Flaschen",
  Packung: "Packungen", Filet: "Filets", Glas: "Gläser", Schüssel: "Schüsseln", Portion: "Portionen",
  Shake: "Shakes", Pizza: "Pizzen", "großer Becher": "große Becher",
};
function unitText(label, n) {
  return n === 1 ? label : PLURALS[label] || label;
}
// Last used unit and count, or one piece / 100 g
function defaultPick(food) {
  const units = unitsOf(food);
  const pref = state.amounts[food.id];
  if (pref && typeof pref === "object" && units.some(u => u.label === pref.u)) return pref;
  if (typeof pref === "number") return { u: units[units.length - 1].label, n: pref };
  return { u: units[0].label, n: units[0].size === 1 && !food.portion ? 100 : 1 };
}
// Lowercase and fold umlauts so "haehnchen" finds "Hähnchen"
function fold(str) {
  return str.toLowerCase().replace(/ä/g, "ae").replace(/ö/g, "oe").replace(/ü/g, "ue").replace(/ß/g, "ss");
}

let toastTimer;
function toast(msg) {
  const t = $("#toast");
  t.textContent = msg;
  t.classList.add("show");
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => t.classList.remove("show"), 2200);
}

// ---------- Goals ----------

// Mifflin-St Jeor, then a moderate deficit or surplus. Protein 1.6 g per kg.
function calcGoals({ sex, age, height, weight, activity, goal }) {
  const base = 10 * weight + 6.25 * height - 5 * age;
  const bmr = sex === "m" ? base + 5 : sex === "w" ? base - 161 : base - 78;
  let kcal = bmr * activity;
  if (goal === "lose") kcal -= 500;
  if (goal === "gain") kcal += 300;
  const floor = sex === "m" ? 1500 : 1200;
  kcal = Math.max(floor, Math.round(kcal / 50) * 50);
  const p = Math.round(weight * 1.6 / 5) * 5;
  const f = Math.round(kcal * 0.3 / 9);
  const kh = Math.max(0, Math.round((kcal - p * 4 - f * 9) / 4));
  const water = Math.round(weight * 35 / GLASS_ML) * GLASS_ML;
  return { kcal, p, kh, f, water };
}

// ---------- Rendering: Heute ----------

function renderToday() {
  const g = state.goals;
  const t = totals(currentDay);
  const d = keyToDate(currentDay);
  const diff = Math.round((keyToDate(currentDay) - keyToDate(todayKey())) / 86400000);
  $("#day-name").textContent = diff === 0 ? "Heute" : diff === -1 ? "Gestern" : diff === 1 ? "Morgen" : d.toLocaleDateString("de-DE", { weekday: "long" });
  $("#day-date").textContent = d.toLocaleDateString("de-DE", { day: "numeric", month: "long" });

  const left = g.kcal - t.kcal;
  $("#kcal-left").textContent = num(Math.abs(left));
  $("#kcal-left-label").textContent = left >= 0 ? "kcal übrig" : "kcal drüber";
  $("#kcal-eaten").textContent = `${num(t.kcal)} kcal`;
  $("#kcal-goal").textContent = `${num(g.kcal)} kcal`;
  const C = 2 * Math.PI * 52;
  const ring = $("#ring-fg");
  ring.style.strokeDasharray = C;
  ring.style.strokeDashoffset = C * (1 - Math.min(1, t.kcal / g.kcal));
  ring.classList.toggle("over", left < 0);

  const macros = [
    ["💪", "Protein", t.p, g.p],
    ["🌾", "Kohlenhydrate", t.kh, g.kh],
    ["🫒", "Fett", t.f, g.f],
  ];
  $("#macros").innerHTML = macros.map(([e, name, v, goal]) => {
    const pct = goal ? Math.min(100, v / goal * 100) : 0;
    // Going over protein is fine; over carbs or fat is flagged
    const over = name !== "Protein" && v > goal * 1.05;
    return `<div><div class="macro-top"><span><span class="emoji">${e}</span> ${name}</span><span><b>${num(v)}</b> / ${num(goal)} g</span></div>
      <div class="bar"><i class="${over ? "over" : ""}" style="width:${pct}%"></i></div></div>`;
  }).join("");

  const glasses = Math.max(8, Math.ceil(g.water / GLASS_ML));
  const drunk = day().water;
  $("#water-text").textContent = `${num(drunk / 1000, 2)} / ${num(g.water / 1000, 2)} l`;
  $("#glasses").innerHTML = Array.from({ length: glasses }, (_, i) =>
    `<button class="glass ${i < drunk / GLASS_ML ? "full" : ""}" data-glass="${i}" aria-label="${(i + 1) * GLASS_ML} ml"></button>`).join("");

  $("#meals").innerHTML = SLOTS.map(s => {
    const list = day().entries.filter(e => e.slot === s.id);
    const kcal = list.reduce((a, e) => a + e.kcal, 0);
    return `<div class="card meal">
      <div class="meal-head"><h3><span class="emoji">${s.emoji}</span> ${s.name}</h3><small>${num(kcal)} kcal</small></div>
      ${list.length ? list.map(e => `<button class="entry" data-entry="${e.id}">
          <span class="n">${esc(e.name)}</span><span class="k">${num(e.kcal)} kcal</span>
          <span class="d">${esc(e.amountLabel)} · ${num(e.p, 1)} g Protein · ${num(e.kh, 1)} g KH · ${num(e.f, 1)} g Fett</span>
        </button>`).join("") : `<p class="empty">Noch nichts eingetragen</p>`}
      <button class="add-line" data-add-slot="${s.id}">+ ${s.name} hinzufügen</button>
    </div>`;
  }).join("");
}

// ---------- Rendering: Woche ----------

function lastDays(n) {
  return Array.from({ length: n }, (_, i) => shiftKey(todayKey(), i - n + 1));
}

function barChart(values, goal, labels, unit) {
  const W = 340, H = 170, pad = 22, bw = 30;
  const max = Math.max(goal * 1.25, ...values, 1);
  const y = v => H - pad - (v / max) * (H - pad - 14);
  const step = (W - 20) / values.length;
  const bars = values.map((v, i) => {
    const x = 10 + i * step + (step - bw) / 2;
    const over = v > goal * 1.05 && unit === "kcal";
    return `<rect x="${x}" y="${y(v)}" width="${bw}" height="${Math.max(0, H - pad - y(v))}" rx="8" fill="${over ? "#B4472F" : i === values.length - 1 ? "#6E1A2E" : "#E9A9BA"}"/>
      <text x="${x + bw / 2}" y="${H - 6}" text-anchor="middle">${labels[i]}</text>
      ${v ? `<text x="${x + bw / 2}" y="${y(v) - 4}" text-anchor="middle">${num(v)}</text>` : ""}`;
  }).join("");
  const gy = y(goal);
  return `<svg viewBox="0 0 ${W} ${H}" role="img" aria-label="${unit} der letzten 7 Tage">
    ${bars}
    <line x1="6" x2="${W - 6}" y1="${gy}" y2="${gy}" stroke="#6E1A2E" stroke-width="2" stroke-dasharray="6 5"/>
    <text x="8" y="${gy - 5}" text-anchor="start">Ziel ${num(goal)}</text>
  </svg>`;
}

function lineChart(points) {
  if (points.length < 2) return `<p class="muted">Trag dein Gewicht an mindestens zwei Tagen ein, dann siehst du hier deinen Verlauf.</p>`;
  const W = 340, H = 160, pad = 26;
  const vals = points.map(p => p[1]);
  const min = Math.min(...vals) - 0.5, max = Math.max(...vals) + 0.5;
  const x = i => pad + i * (W - pad * 2) / (points.length - 1);
  const y = v => 12 + (1 - (v - min) / (max - min)) * (H - pad - 12);
  const path = points.map((p, i) => `${i ? "L" : "M"}${x(i)},${y(p[1])}`).join(" ");
  const first = keyToDate(points[0][0]).toLocaleDateString("de-DE", { day: "numeric", month: "short" });
  const last = keyToDate(points[points.length - 1][0]).toLocaleDateString("de-DE", { day: "numeric", month: "short" });
  return `<svg viewBox="0 0 ${W} ${H}" role="img" aria-label="Gewichtsverlauf">
    <path d="${path}" fill="none" stroke="#6E1A2E" stroke-width="3" stroke-linejoin="round" stroke-linecap="round"/>
    ${points.map((p, i) => `<circle cx="${x(i)}" cy="${y(p[1])}" r="4" fill="#6E1A2E"/>`).join("")}
    <text x="${x(0)}" y="${y(vals[0]) - 10}" text-anchor="start">${num(vals[0], 1)} kg</text>
    <text x="${x(points.length - 1)}" y="${y(vals[vals.length - 1]) - 10}" text-anchor="end">${num(vals[vals.length - 1], 1)} kg</text>
    <text x="${pad}" y="${H - 4}" text-anchor="start">${first}</text>
    <text x="${W - pad}" y="${H - 4}" text-anchor="end">${last}</text>
  </svg>`;
}

function renderWeek() {
  const keys = lastDays(7);
  const labels = keys.map(k => keyToDate(k).toLocaleDateString("de-DE", { weekday: "short" }).replace(".", ""));
  const t = keys.map(totals);
  $("#chart-kcal").innerHTML = barChart(t.map(x => Math.round(x.kcal)), state.goals.kcal, labels, "kcal");
  $("#chart-prot").innerHTML = barChart(t.map(x => Math.round(x.p)), state.goals.p, labels, "g");
  const tracked = t.filter(x => x.kcal > 0);
  const avg = key => tracked.length ? tracked.reduce((a, x) => a + x[key], 0) / tracked.length : 0;
  $("#avg-kcal").textContent = tracked.length ? `Ø ${num(avg("kcal"))} kcal an ${tracked.length} getrackten Tagen` : "Noch keine Einträge in den letzten 7 Tagen.";
  $("#avg-prot").textContent = tracked.length ? `Ø ${num(avg("p"))} g Protein pro Tag` : "";

  const pts = Object.entries(state.weights).sort((a, b) => a[0].localeCompare(b[0])).slice(-30);
  $("#chart-weight").innerHTML = lineChart(pts);
  const todayW = state.weights[todayKey()];
  $("#weight-input").value = todayW ?? "";
}

// ---------- Rendering: Profil ----------

function renderProfile() {
  const f = $("#goals-form");
  for (const k of ["kcal", "p", "kh", "f", "water"]) f.elements[k].value = state.goals[k];
}

function render() {
  if (!state.goals) return;
  if (view === "today") renderToday();
  if (view === "week") renderWeek();
  if (view === "profile") renderProfile();
  if (view === "ideas") renderIdeas($("#ideas-page"), false);
}

function showView(v) {
  view = v;
  $$(".view").forEach(s => s.hidden = s.id !== `view-${v}`);
  $$(".tabs [data-view]").forEach(b => b.classList.toggle("active", b.dataset.view === v));
  render();
  window.scrollTo(0, 0);
}

// ---------- Add sheet ----------

let pick = null;        // { food, amount, slot, entryId? }
let activeCat = "Alle";

function defaultSlot() {
  const h = new Date().getHours();
  return h < 11 ? "fruehstueck" : h < 15 ? "mittag" : h < 18 ? "snack" : "abend";
}

function openSheet(slot) {
  pick = { slot: slot || defaultSlot() };
  $("#sheet").hidden = false;
  $("#sheet-title").textContent = "Hinzufügen";
  $("#add-tabs").hidden = false;
  showTab("search");
  $("#search").value = "";
  renderFoodList();
}

function closeSheet() {
  stopScan();
  $("#sheet").hidden = true;
  pick = null;
}

function showTab(tab) {
  if (tab !== "scan") stopScan();
  $$("#sheet .tab").forEach(t => t.hidden = t.dataset.tab !== tab);
  $$("#add-tabs button").forEach(b => b.classList.toggle("active", b.dataset.tab === tab));
  if (tab === "ideas") renderIdeas($("#ideas-sheet"), true);
}

function renderFoodList() {
  const cats = ["Alle", "Zuletzt", ...(state.custom.length ? ["Eigene"] : []), ...CATEGORIES];
  if (!cats.includes(activeCat)) activeCat = "Alle";
  $("#cats").innerHTML = cats.map(c => `<button class="chip ${c === activeCat ? "active" : ""}" data-cat="${esc(c)}">${esc(c)}</button>`).join("");

  const raw = $("#search").value.trim();
  const words = fold(raw).split(/\s+/).filter(Boolean);
  let list;
  if (activeCat === "Zuletzt") list = state.recent.map(foodById).filter(Boolean);
  else if (activeCat === "Eigene") list = state.custom;
  else if (activeCat === "Alle") list = allFoods();
  else list = FOODS.filter(f => f.cat === activeCat);
  if (words.length) {
    list = allFoods().filter(f => words.every(w => fold(f.name).includes(w)));
    // Whole-word matches first ("ei" → Ei before Eiklar), then names starting with the word
    const rank = f => {
      const name = fold(f.name);
      return name.split(/[^a-z0-9]+/).includes(words[0]) ? 0 : name.startsWith(words[0]) ? 1 : 2;
    };
    list.sort((a, b) => rank(a) - rank(b));
  }

  $("#food-list").innerHTML = list.length ? list.map(f => `<button class="food" data-food="${esc(f.id)}">
      <span class="n">${esc(f.name)}</span><span class="k">${num(f.kcal)} kcal</span>
      <span class="d">${baseLabel(f)} · ${num(f.p, 1)} g Protein · ${num(f.kh, 1)} g KH · ${num(f.f, 1)} g Fett</span>
    </button>`).join("")
    : `<p class="empty">${activeCat === "Zuletzt" && !words.length ? "Hier erscheinen deine zuletzt genutzten Lebensmittel." : "In der Liste nicht gefunden."}</p>`;

  $("#online").innerHTML = raw.length >= 3
    ? `<button class="add-line" data-online-search>🔎 „${esc(raw)}“ online suchen</button>
       <p class="muted small center">Markenprodukte aus der freien Datenbank Open Food Facts</p>`
    : "";
}

// ---------- Online search (Open Food Facts) ----------

let onlineResults = {};

// Turn an Open Food Facts product into one of our foods, or null if it has no kcal value
function offFood(product, code) {
  const n = product?.nutriments;
  if (!n || n["energy-kcal_100g"] == null) return null;
  const name = [product.product_name_de || product.product_name, product.brands?.split(",")[0]]
    .filter(Boolean).join(" · ") || `Produkt ${code}`;
  return {
    id: "c-" + code, name, cat: "Eigene", barcode: code, portion: null,
    kcal: +n["energy-kcal_100g"] || 0, p: +n.proteins_100g || 0, kh: +n.carbohydrates_100g || 0, f: +n.fat_100g || 0,
  };
}

async function searchOnline() {
  const q = $("#search").value.trim();
  const box = $("#online");
  box.innerHTML = `<p class="muted center">Suche „${esc(q)}“ …</p>`;
  const url = "https://world.openfoodfacts.org/cgi/search.pl?" + new URLSearchParams({
    search_terms: q, search_simple: 1, action: "process", json: 1, page_size: 30, sort_by: "unique_scans_n",
    tagtype_0: "countries", tag_contains_0: "contains", tag_0: "germany",
    fields: "code,product_name,product_name_de,brands,nutriments",
  });
  try {
    const r = await fetch(url);
    if (!r.ok) throw new Error(r.status);
    const data = await r.json();
    onlineResults = {};
    const foods = (data.products || []).map(pr => offFood(pr, pr.code)).filter(f => f && f.name && plausible(f));
    foods.forEach(f => onlineResults[f.id] = f);
    if ($("#search").value.trim() !== q) return;
    box.innerHTML = foods.length
      ? `<h3 class="online-head">Online gefunden</h3><div class="list">${foods.map(f => `<button class="food" data-online="${esc(f.id)}">
          <span class="n">${esc(f.name)}</span><span class="k">${num(f.kcal)} kcal</span>
          <span class="d">pro 100 g · ${num(f.p, 1)} g Protein · ${num(f.kh, 1)} g KH · ${num(f.f, 1)} g Fett</span>
        </button>`).join("")}</div>
        <p class="muted small center">Daten: Open Food Facts. Bitte kurz mit der Packung vergleichen.</p>`
      : `<p class="empty center">Online nichts gefunden. Trag es unter „Manuell“ ein oder scanne die Packung.</p>`;
  } catch (e) {
    box.innerHTML = `<p class="empty center">Die Online-Suche ist gerade nicht erreichbar. Versuch es gleich nochmal.</p>
      <button class="add-line" data-online-search>Nochmal versuchen</button>`;
  }
}

// Drop obviously broken database entries
function plausible(f) {
  return f.kcal <= 950 && f.p + f.kh + f.f <= 105;
}

function pickOnline(id) {
  const food = onlineResults[id];
  if (!food) return;
  state.custom = [food, ...state.custom.filter(f => f.id !== food.id)];
  save();
  showAmount(food, pick.slot);
}

// ---------- Ideas (recipes from @jamileo__) ----------

const ideaById = id => IDEAS.find(i => i.id === id);

function ideaTotals(idea) {
  if (idea.meals) return idea.meals.map(id => ideaTotals(ideaById(id)))
    .reduce((t, x) => ({ kcal: t.kcal + x.kcal, p: t.p + x.p, kh: t.kh + x.kh, f: t.f + x.f }));
  return idea.items.reduce((t, [id, g]) => {
    const x = scale(FOODS.find(f => f.id === id), g);
    return { kcal: t.kcal + x.kcal, p: t.p + x.p, kh: t.kh + x.kh, f: t.f + x.f };
  }, { kcal: 0, p: 0, kh: 0, f: 0 });
}

// A recipe is logged as one entry per portion
function ideaFood(idea) {
  return { id: "idee-" + idea.id, name: idea.title, cat: "Ideen", portion: "Portion", ...ideaTotals(idea) };
}

function renderIdeas(el, compact) {
  el.innerHTML = IDEAS.map(idea => {
    const t = ideaTotals(idea);
    const ingredients = idea.meals
      ? idea.meals.map(id => ideaById(id).title)
      : idea.items.map(([id, g]) => `${num(g)} ${unitOf(FOODS.find(f => f.id === id))} ${FOODS.find(f => f.id === id).name}`);
    return `<article class="card idea">
      <img src="${idea.photo}" alt="" loading="lazy">
      <div class="idea-body">
        <h3>${esc(idea.title)}</h3>
        <p class="idea-macros"><span class="emoji">🔥</span> ${num(t.kcal)} kcal · <span class="emoji">💪</span> ${num(t.p)} g Protein</p>
        ${compact ? "" : `<p class="muted">${esc(idea.text)}</p>
        <details><summary>${idea.meals ? "Mahlzeiten" : "Zutaten"}</summary><ul>${ingredients.map(i => `<li>${esc(i)}</li>`).join("")}</ul></details>`}
        <button class="btn" data-idea="${idea.id}">${idea.meals ? "Ganzen Tag eintragen" : "Nachgekocht? Eintragen"}</button>
      </div>
    </article>`;
  }).join("");
}

function cookIdea(id, fromSheet) {
  const idea = ideaById(id);
  if (idea.meals) {
    const d = ensureDay();
    for (const m of idea.meals.map(ideaById)) d.entries.push(makeEntry(ideaFood(m), 1, m.slot));
    save();
    closeSheet();
    showView("today");
    toast(`„${idea.title}“ eingetragen`);
    return;
  }
  const slot = fromSheet ? pick.slot : idea.slot;
  pick = { slot };
  $("#sheet").hidden = false;
  showAmount(ideaFood(idea), slot, null, { u: "Portion", n: 1 });
}

// amount is in grams/ml (or portions); unit is the household unit it was entered in, if any
function makeEntry(food, amount, slot, id, unit) {
  const s = scale(food, amount);
  let amountLabel;
  if (food.portion) amountLabel = `${num(amount, 2)} × ${food.portion}`;
  else if (unit && unit.size !== 1) amountLabel = `${num(unit.n, 2)} ${unitText(unit.label, unit.n)} (${num(amount)} ${unitOf(food)})`;
  else amountLabel = `${num(amount)} ${unitOf(food)}`;
  return {
    id: id || uid(), foodId: food.id, name: food.name, slot, amount, amountLabel,
    unit: unit ? { u: unit.label, n: unit.n } : null,
    kcal: s.kcal, p: s.p, kh: s.kh, f: s.f,
    // Per-unit values, so the entry stays editable even if the food is removed later
    base: { portion: food.portion || null, ml: !!food.ml, piece: food.piece, units: food.units, kcal: food.kcal, p: food.p, kh: food.kh, f: food.f },
  };
}

function showAmount(food, slot, entryId, init = defaultPick(food)) {
  const units = unitsOf(food);
  const unit = units.find(u => u.label === init.u) || units[0];
  pick = { food, slot, entryId, units, unit };
  $("#add-tabs").hidden = true;
  $("#sheet-title").textContent = entryId ? "Bearbeiten" : "Menge";
  showTab("amount");
  $("#pick-name").textContent = food.name;
  $("#pick-base").textContent = `${baseLabel(food)}: ${num(food.kcal)} kcal · ${num(food.p, 1)} g Protein`;
  $("#amount-unit").innerHTML = units.map(u =>
    `<option value="${esc(u.label)}" ${u === unit ? "selected" : ""}>${esc(u.label)}${u.size !== 1 ? ` (${num(u.size)} ${unitOf(food)})` : ""}</option>`).join("");
  $("#amount-unit").disabled = units.length === 1;
  $("#amount").value = init.n;
  $("#slot").innerHTML = SLOTS.map(s => `<option value="${s.id}" ${s.id === slot ? "selected" : ""}>${s.name}</option>`).join("");
  $("#amount-submit").textContent = entryId ? "Speichern" : "Hinzufügen";
  $("#entry-delete").hidden = !entryId;
  renderQuick();
  updatePreview();
}

function renderQuick() {
  const { unit, food } = pick;
  let quick;
  if (unit.size !== 1 || food.portion) quick = food.portion ? [0.5, 1, 1.5, 2] : [0.5, 1, 2, 3];
  else quick = food.ml ? [100, 200, 250, 330, 500] : [50, 100, 150, 200, 250];
  $("#amount").step = unit.size !== 1 || food.portion ? "0.5" : "1";
  $("#quick-amounts").innerHTML = quick.map(q =>
    `<button type="button" class="chip" data-amount="${q}">${num(q, 1)} ${esc(unitText(unit.label, q))}</button>`).join("");
}

// Switching unit keeps the same real amount, e.g. 120 g egg becomes 2 Stück
function changeUnit() {
  const next = pick.units.find(u => u.label === $("#amount-unit").value);
  // Convert from the exact amount, so switching back and forth never drifts
  pick.exact = pick.exact ?? baseAmount();
  const n = pick.exact / next.size;
  $("#amount").value = next.size === 1 ? Math.round(n) : Math.round(n * 100) / 100;
  pick.unit = next;
  renderQuick();
  updatePreview();
}

function baseAmount() {
  return (parseFloat($("#amount").value) || 0) * pick.unit.size;
}

function updatePreview() {
  const s = scale(pick.food, baseAmount());
  $("#pick-preview").innerHTML = [["kcal", s.kcal, ""], ["Protein", s.p, " g"], ["KH", s.kh, " g"], ["Fett", s.f, " g"]]
    .map(([l, v, u]) => `<div><b>${num(v, l === "kcal" ? 0 : 1)}${u}</b><small>${l}</small></div>`).join("");
}

function submitAmount(e) {
  e.preventDefault();
  const n = parseFloat($("#amount").value);
  if (!(n > 0)) return toast("Bitte eine Menge eingeben");
  const slot = $("#slot").value;
  const d = ensureDay();
  const entry = makeEntry(pick.food, n * pick.unit.size, slot, pick.entryId, { label: pick.unit.label, size: pick.unit.size, n });
  if (pick.entryId) d.entries = d.entries.map(x => x.id === pick.entryId ? entry : x);
  else d.entries.push(entry);
  state.recent = [pick.food.id, ...state.recent.filter(id => id !== pick.food.id)].slice(0, 20);
  // Remember the amount per food as the default for next time
  state.amounts[pick.food.id] = { u: pick.unit.label, n };
  save();
  const edited = !!pick.entryId;
  closeSheet();
  render();
  toast(edited ? "Gespeichert" : `${entry.name} eingetragen`);
}

function editEntry(id) {
  const e = day().entries.find(x => x.id === id);
  if (!e) return;
  const food = foodById(e.foodId) || { id: e.foodId, name: e.name, ...e.base };
  $("#sheet").hidden = false;
  showAmount(food, e.slot, id, e.unit || { u: food.portion || unitOf(food), n: e.amount });
}

function deleteEntry() {
  const d = ensureDay();
  d.entries = d.entries.filter(x => x.id !== pick.entryId);
  save();
  closeSheet();
  render();
  toast("Eintrag gelöscht");
}

// ---------- Manual entry ----------

let manualBasis = "100";

function submitManual(e) {
  e.preventDefault();
  const f = e.target.elements;
  const food = {
    id: "c-" + uid(), name: f.name.value.trim(), cat: "Eigene",
    portion: manualBasis === "portion" ? "Portion" : null,
    kcal: +f.kcal.value || 0, p: +f.p.value || 0, kh: +f.kh.value || 0, f: +f.f.value || 0,
    barcode: f.barcode.value || undefined,
  };
  if (!food.name) return;
  if (f.save.checked) { state.custom.unshift(food); save(); }
  e.target.reset();
  showAmount(food, pick.slot);
}

// ---------- Barcode scanning (ZXing + Open Food Facts) ----------

let scanControls = null;
let zxingLoad = null;

function loadZXing() {
  if (window.ZXingBrowser) return Promise.resolve();
  zxingLoad = zxingLoad || new Promise((res, rej) => {
    const s = document.createElement("script");
    s.src = "vendor/zxing-browser.min.js";
    s.onload = res;
    s.onerror = rej;
    document.head.appendChild(s);
  });
  return zxingLoad;
}

async function startScan() {
  const status = $("#scan-status");
  if (!navigator.mediaDevices?.getUserMedia) {
    status.textContent = "Dein Browser erlaubt keinen Kamerazugriff. Tipp den Barcode einfach ein.";
    return;
  }
  try {
    status.textContent = "Kamera wird gestartet …";
    await loadZXing();
    const reader = new ZXingBrowser.BrowserMultiFormatReader();
    scanControls = await reader.decodeFromConstraints(
      { video: { facingMode: "environment" } }, $("#scan-video"),
      result => { if (result) { stopScan(); lookupBarcode(result.getText()); } });
    status.textContent = "Halte den Barcode in den Rahmen.";
    $("#scan-start").hidden = true;
  } catch (err) {
    status.textContent = "Kamera nicht verfügbar. Erlaube den Zugriff in den Einstellungen oder tipp den Barcode ein.";
  }
}

function stopScan() {
  if (scanControls) { scanControls.stop(); scanControls = null; }
  $("#scan-start").hidden = false;
}

async function lookupBarcode(code) {
  code = String(code).replace(/\D/g, "");
  if (code.length < 6) return toast("Ungültiger Barcode");
  const known = state.custom.find(f => f.barcode === code);
  if (known) return showAmount(known, pick.slot);
  $("#scan-status").textContent = "Suche Produkt …";
  try {
    const r = await fetch(`https://world.openfoodfacts.org/api/v2/product/${code}.json?fields=product_name,product_name_de,brands,nutriments`);
    const data = await r.json();
    const food = data.status === 1 ? offFood(data.product, code) : null;
    if (!food) throw new Error("not found");
    state.custom = [food, ...state.custom.filter(f => f.barcode !== code)];
    save();
    showAmount(food, pick.slot);
  } catch (e) {
    toast("Produkt nicht gefunden, bitte Werte von der Packung eintragen");
    showTab("manual");
    $("#manual-form").elements.barcode.value = code;
    $("#scan-status").textContent = "Halte den Barcode der Packung vor die Kamera.";
  }
}

// ---------- Onboarding ----------

function openOnboarding() {
  const f = $("#onboard-form");
  if (state.profile) for (const [k, v] of Object.entries(state.profile)) if (f.elements[k]) f.elements[k].value = v;
  $("#onboard-preview").hidden = true;
  f.querySelector(".btn").textContent = "Ziel berechnen";
  delete f.dataset.ready;
  $("#onboard").hidden = false;
}

function submitOnboarding(e) {
  e.preventDefault();
  const f = e.target;
  const el = f.elements;
  const profile = {
    sex: el.sex.value, age: +el.age.value, height: +el.height.value,
    weight: +el.weight.value, activity: +el.activity.value, goal: el.goal.value,
  };
  // First press shows the result, second press confirms it
  if (!f.dataset.ready) {
    const g = calcGoals(profile);
    $("#onboard-preview").innerHTML = [["kcal", g.kcal, ""], ["Protein", g.p, " g"], ["KH", g.kh, " g"], ["Fett", g.f, " g"]]
      .map(([l, v, u]) => `<div><b>${num(v)}${u}</b><small>${l}</small></div>`).join("");
    $("#onboard-preview").hidden = false;
    f.querySelector(".btn").textContent = "Passt, los geht's!";
    f.dataset.ready = "1";
    return;
  }
  state.profile = profile;
  state.goals = calcGoals(profile);
  if (!state.weights[todayKey()]) state.weights[todayKey()] = profile.weight;
  save();
  $("#onboard").hidden = true;
  showView("today");
  toast("Deine Ziele sind gespeichert. Du kannst sie im Profil ändern.");
}

// ---------- Events ----------

document.addEventListener("click", e => {
  const b = e.target.closest("button, [data-cat]");
  if (!b) return;
  if (b.dataset.view) showView(b.dataset.view);
  else if (b.dataset.day) { currentDay = shiftKey(currentDay, +b.dataset.day); renderToday(); }
  else if (b.dataset.glass !== undefined) {
    const d = ensureDay();
    const target = (+b.dataset.glass + 1) * GLASS_ML;
    d.water = d.water === target ? target - GLASS_ML : target;
    save();
    renderToday();
  }
  else if (b.dataset.addSlot) openSheet(b.dataset.addSlot);
  else if (b.dataset.entry) editEntry(b.dataset.entry);
  else if (b.dataset.tab && b.closest("#add-tabs")) showTab(b.dataset.tab);
  else if (b.dataset.cat) { activeCat = b.dataset.cat; $("#search").value = ""; renderFoodList(); }
  else if (b.dataset.food) { const f = foodById(b.dataset.food); showAmount(f, pick.slot); }
  else if (b.dataset.online) pickOnline(b.dataset.online);
  else if (b.hasAttribute("data-online-search")) searchOnline();
  else if (b.dataset.idea) cookIdea(b.dataset.idea, !!b.closest("#sheet"));
  else if (b.dataset.amount) { $("#amount").value = b.dataset.amount; pick.exact = null; updatePreview(); }
  else if (b.dataset.basis) { manualBasis = b.dataset.basis; $$("#manual-basis button").forEach(x => x.classList.toggle("active", x === b)); }
});

$("#fab").addEventListener("click", () => openSheet());
$("#sheet-close").addEventListener("click", closeSheet);
$("#sheet").addEventListener("click", e => { if (e.target.id === "sheet") closeSheet(); });
document.addEventListener("keydown", e => { if (e.key === "Escape" && !$("#sheet").hidden) closeSheet(); });
$("#search").addEventListener("input", renderFoodList);
$("#search").addEventListener("keydown", e => {
  if (e.key === "Enter" && $("#search").value.trim().length >= 3) { e.preventDefault(); searchOnline(); }
});
$("#amount").addEventListener("input", () => { pick.exact = null; updatePreview(); });
$("#amount-unit").addEventListener("change", changeUnit);
$("#amount-form").addEventListener("submit", submitAmount);
$("#entry-delete").addEventListener("click", deleteEntry);
$("#manual-form").addEventListener("submit", submitManual);
$("#scan-start").addEventListener("click", startScan);
$("#barcode-form").addEventListener("submit", e => { e.preventDefault(); lookupBarcode($("#barcode-input").value); });
$("#onboard-form").addEventListener("submit", submitOnboarding);
$("#onboard-form").addEventListener("input", () => { delete $("#onboard-form").dataset.ready; $("#onboard-form .btn").textContent = "Ziel berechnen"; });
$("#onboard-skip").addEventListener("click", () => {
  state.goals = state.goals || { kcal: 1600, p: 100, kh: 170, f: 55, water: 2000 };
  save();
  $("#onboard").hidden = true;
  showView("profile");
  toast("Trag deine Ziele hier ein");
});
$("#recalc").addEventListener("click", openOnboarding);

$("#goals-form").addEventListener("submit", e => {
  e.preventDefault();
  const f = e.target.elements;
  state.goals = { kcal: +f.kcal.value, p: +f.p.value, kh: +f.kh.value, f: +f.f.value, water: +f.water.value };
  save();
  toast("Ziele gespeichert");
});

$("#weight-form").addEventListener("submit", e => {
  e.preventDefault();
  const v = parseFloat($("#weight-input").value);
  if (!(v > 0)) return;
  state.weights[todayKey()] = v;
  save();
  renderWeek();
  toast("Gewicht gespeichert");
});

$("#reset").addEventListener("click", () => {
  if (!confirm("Wirklich alle Einträge, Ziele und eigenen Lebensmittel löschen?")) return;
  state = blankState();
  save();
  openOnboarding();
});

// Install prompt (Android / desktop Chrome); iOS uses the share sheet
let installEvent = null;
window.addEventListener("beforeinstallprompt", e => {
  e.preventDefault();
  installEvent = e;
  $("#install-btn").hidden = false;
});
$("#install-btn").addEventListener("click", async () => {
  if (!installEvent) return;
  installEvent.prompt();
  await installEvent.userChoice;
  installEvent = null;
  $("#install-btn").hidden = true;
});
if (matchMedia("(display-mode: standalone)").matches) $("#install-card").hidden = true;

if ("serviceWorker" in navigator && location.protocol === "https:") {
  navigator.serviceWorker.register("sw.js").catch(() => {});
}

// ---------- Keeping data safe ----------

// Ask the browser not to clear our storage under pressure (granted automatically for installed apps)
navigator.storage?.persist?.().catch(() => {});

// In-app browsers (Instagram, TikTok …) and plain browser tabs on iPhone can lose local data.
// Point people to the home screen version, where it stays put.
function storageHint() {
  if (matchMedia("(display-mode: standalone)").matches || navigator.standalone) return null;
  const ua = navigator.userAgent;
  if (/Instagram|FBAN|FBAV|FB_IAB|TikTok|musical_ly|BytedanceWebview|Snapchat|Line\//i.test(ua)) return {
    title: "Du bist im App-Browser",
    text: "Hier können deine Einträge verloren gehen. Tippe oben rechts auf „…“ → „Im Browser öffnen“ und füge die App dann zum Home-Bildschirm hinzu.",
  };
  if (/iPhone|iPad|iPod/.test(ua)) return {
    title: "Tipp: Auf den Home-Bildschirm",
    text: "Damit deine Einträge sicher gespeichert bleiben, öffne diese Seite in Safari, tippe auf „Teilen“ und dann auf „Zum Home-Bildschirm“. Starte die App danach immer über das neue Symbol.",
  };
  return null;
}

function showStorageHint() {
  const hint = storageHint();
  let dismissed = false;
  try { dismissed = localStorage.getItem(STORE_KEY + "-hint") === "1"; } catch (e) { /* ignore */ }
  if (!hint || dismissed) return;
  $("#storage-hint-title").textContent = hint.title;
  $("#storage-hint-text").textContent = hint.text;
  $("#storage-hint").hidden = false;
}
$("#storage-hint-close").addEventListener("click", () => {
  $("#storage-hint").hidden = true;
  try { localStorage.setItem(STORE_KEY + "-hint", "1"); } catch (e) { /* ignore */ }
});
showStorageHint();

// ---------- Start ----------

if (!state.goals) openOnboarding();
else showView("today");
