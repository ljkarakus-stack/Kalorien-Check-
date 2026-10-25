"use strict";

// Trends: balance, all metrics side by side, meal times and cycle patterns.

let range = 7;
let metricKey = "kcal";

const avgOf = list => list.length ? list.reduce((a, b) => a + b, 0) / list.length : null;
const fmtDay = k => keyToDate(k).toLocaleDateString("de-DE", { day: "numeric", month: "short" });

// Days of the range ending with today (oldest first); "before" shifts it back by whole ranges
function rangeKeys(n, before = 0) {
  const end = shiftKey(todayKey(), -n * before);
  return Array.from({ length: n }, (_, i) => shiftKey(end, i - n + 1));
}

// Days with food entries, without today (today is usually not finished yet)
function trackedKeys(keys) {
  return keys.filter(k => k !== todayKey() && totals(k).kcal > 0);
}

const METRICS = [
  { key: "kcal", name: "Kalorien", unit: "kcal", food: true, goal: () => state.goals.kcal, val: k => totals(k).kcal },
  { key: "p", name: "Protein", unit: "g", food: true, goal: () => state.goals.p, val: k => totals(k).p },
  { key: "kh", name: "Kohlenhydrate", unit: "g", food: true, goal: () => state.goals.kh, val: k => totals(k).kh },
  { key: "f", name: "Fett", unit: "g", food: true, goal: () => state.goals.f, val: k => totals(k).f },
  { key: "water", name: "Wasser", unit: "l", d: 1, goal: () => state.goals.water / 1000, val: k => day(k).water ? day(k).water / 1000 : null },
  { key: "weight", name: "Gewicht", unit: "kg", d: 1, line: true, goal: () => state.settings?.goalWeight, val: k => state.weights[k] ?? null },
  { key: "waist", name: "Taille", unit: "cm", d: 1, line: true, val: k => state.measures?.[k]?.waist ?? null },
  { key: "hip", name: "Hüfte", unit: "cm", d: 1, line: true, val: k => state.measures?.[k]?.hip ?? null },
  { key: "hunger", name: "Hunger", unit: "/5", d: 1, line: true, val: k => journalDay(k).hunger ?? null },
  { key: "energy", name: "Energie", unit: "/5", d: 1, line: true, val: k => journalDay(k).energy ?? null },
  { key: "craving", name: "Heißhunger", unit: "/5", d: 1, line: true, val: k => journalDay(k).craving ?? null },
];

// Average of a metric over a set of days; food metrics only count tracked days
function metricAvg(m, keys) {
  const days = m.food ? trackedKeys(keys) : keys;
  return avgOf(days.map(m.val).filter(v => v != null));
}

// ---------- Balance ----------

function renderBalance() {
  const keys = rangeKeys(range);
  const tracked = trackedKeys(keys);
  if (!tracked.length) {
    $("#t-balance").innerHTML = `<h3>Bilanz</h3><p class="muted">Noch keine abgeschlossenen Tage in diesem Zeitraum. Trag ein paar Tage ein, dann siehst du hier deinen Schnitt.</p>`;
    return;
  }
  const avgKcal = avgOf(tracked.map(k => totals(k).kcal));
  const deficit = state.goals.kcal - avgKcal;
  const total = deficit * tracked.length;
  const over = tracked.filter(k => totals(k).kcal > state.goals.kcal).length;
  const hits = tracked.filter(k => totals(k).p >= state.goals.p).length;
  $("#t-balance").innerHTML = `
    <h3>Bilanz · ${range} Tage</h3>
    <div class="big-stat ${deficit >= 0 ? "good" : "bad"}">
      <b>${deficit >= 0 ? "−" : "+"}${num(Math.abs(deficit))} kcal</b>
      <span>Ø pro Tag ${deficit >= 0 ? "unter" : "über"} deinem Ziel</span>
    </div>
    <div class="stat-row">
      <div><b>${num(avgKcal)}</b><small>Ø kcal / Tag</small></div>
      <div><b>${tracked.length}</b><small>Tage getrackt</small></div>
      <div><b>${over}</b><small>Tage über Ziel</small></div>
    </div>
    <div class="hitrate">
      <span><span class="emoji">💪</span> Proteinziel erreicht</span>
      <b>${hits} von ${tracked.length} ${tracked.length === 1 ? "Tag" : "Tagen"} · ${num(hits / tracked.length * 100)} %</b>
      <div class="bar"><i class="${hits === tracked.length ? "full" : ""}" style="width:${hits / tracked.length * 100}%"></i></div>
    </div>
    <p class="muted small">Insgesamt ca. ${num(Math.abs(total))} kcal ${total >= 0 ? "Defizit" : "Überschuss"}, rechnerisch etwa ${num(Math.abs(total) / 7000, 1)} kg Körperfett. Ohne heute. Das Gewicht schwankt zusätzlich durch Wasser, Zyklus und Verdauung.</p>`;
}

// ---------- Tiles + chart ----------

function trendArrow(cur, prev, m) {
  if (cur == null || prev == null || !prev) return "";
  const diff = (cur - prev) / Math.abs(prev) * 100;
  if (Math.abs(diff) < 2) return `<span class="trend">→</span>`;
  return `<span class="trend">${diff > 0 ? "↑" : "↓"} ${num(Math.abs(diff))} %</span>`;
}

function renderTiles() {
  const keys = rangeKeys(range), prevKeys = rangeKeys(range, 1);
  $("#t-tiles").innerHTML = METRICS.map(m => {
    const cur = metricAvg(m, keys);
    const goal = m.goal?.();
    let latest = null;
    if (m.line) latest = [...keys].reverse().map(m.val).find(v => v != null);
    const shown = m.line ? latest : cur;
    return `<button class="tile ${m.key === metricKey ? "active" : ""}" data-metric="${m.key}">
      <small>${m.name}</small>
      <b>${shown == null ? "–" : num(shown, m.d || 0)} <em>${m.unit}</em></b>
      <span>${m.line ? "zuletzt" : "Ø"}${goal ? ` · Ziel ${num(goal, m.d || 0)}` : ""}</span>
      ${trendArrow(cur, metricAvg(m, prevKeys), m)}
    </button>`;
  }).join("");
}

function chartSvg(m, keys) {
  const W = 340, H = 180, padL = 8, padB = 22, top = 16;
  const vals = keys.map(k => { const v = m.val(k); return v == null || (m.food && !v) ? null : v; });
  const goal = m.goal?.();
  const present = vals.filter(v => v != null);
  if (!present.length) return `<p class="muted">Für ${m.name} gibt es in diesem Zeitraum noch keine Werte.</p>`;
  let min = m.line ? Math.min(...present, goal ?? Infinity) : 0;
  let max = Math.max(...present, goal ?? 0);
  if (m.line) { const pad = Math.max((max - min) * 0.15, 0.5); min -= pad; max += pad; } else max *= 1.15;
  const y = v => top + (1 - (v - min) / (max - min || 1)) * (H - padB - top);
  const step = (W - padL * 2) / keys.length;
  const cx = i => padL + step * i + step / 2;
  let body;
  if (m.key === "weight") {
    // Single weigh-ins as light dots, the 7-day moving average as the line
    const ma = keys.map(movingWeight);
    const dots = vals.map((v, i) => v == null ? "" : `<circle cx="${cx(i)}" cy="${y(v)}" r="${keys.length > 31 ? 2 : 3.5}" fill="#E9A9BA"/>`).join("");
    const pts = ma.map((v, i) => v == null ? null : [cx(i), y(v)]).filter(Boolean);
    body = dots + `<path d="${pts.map((p, i) => `${i ? "L" : "M"}${p[0]},${p[1]}`).join(" ")}" fill="none" stroke="#6E1A2E" stroke-width="3.5" stroke-linejoin="round" stroke-linecap="round"/>`;
  } else if (m.line) {
    const pts = vals.map((v, i) => v == null ? null : [cx(i), y(v)]).filter(Boolean);
    body = `<path d="${pts.map((p, i) => `${i ? "L" : "M"}${p[0]},${p[1]}`).join(" ")}" fill="none" stroke="#6E1A2E" stroke-width="3" stroke-linejoin="round" stroke-linecap="round"/>
      ${pts.map(p => `<circle cx="${p[0]}" cy="${p[1]}" r="${keys.length > 31 ? 2 : 3.5}" fill="#6E1A2E"/>`).join("")}`;
  } else {
    const bw = Math.max(2, Math.min(28, step * 0.7));
    body = vals.map((v, i) => v == null ? "" : `<rect x="${cx(i) - bw / 2}" y="${y(v)}" width="${bw}" height="${H - padB - y(v)}" rx="${Math.min(6, bw / 2)}"
      fill="${m.key === "kcal" && goal && v > goal * 1.05 ? "#B4472F" : "#E9A9BA"}"/>`).join("");
  }
  const goalLine = goal ? `<line x1="0" x2="${W}" y1="${y(goal)}" y2="${y(goal)}" stroke="#6E1A2E" stroke-width="2" stroke-dasharray="6 5"/>
    <text x="4" y="${y(goal) - 5}">Ziel ${num(goal, m.d || 0)} ${m.unit}</text>` : "";
  const every = Math.ceil(keys.length / 7);
  const labels = keys.map((k, i) => (keys.length - 1 - i) % every === 0
    ? `<text x="${cx(i)}" y="${H - 6}" text-anchor="middle">${keys.length <= 7 ? keyToDate(k).toLocaleDateString("de-DE", { weekday: "short" }).replace(".", "") : fmtDay(k)}</text>` : "").join("");
  return `<svg viewBox="0 0 ${W} ${H}" role="img" aria-label="${m.name}, letzte ${keys.length} Tage">${goalLine}${body}${labels}</svg>`;
}

// Average of all weigh-ins in the 7 days up to and including k
function movingWeight(k) {
  const vals = Array.from({ length: 7 }, (_, i) => state.weights[shiftKey(k, -i)]).filter(v => v != null);
  return vals.length ? avgOf(vals) : null;
}

function renderChart() {
  const m = METRICS.find(x => x.key === metricKey);
  const keys = rangeKeys(range);
  $("#t-chart-title").textContent = `${m.name} · ${range} Tage`;
  $("#t-chart").innerHTML = chartSvg(m, keys);
  const cur = metricAvg(m, keys);
  const goal = m.goal?.();
  let note = cur == null ? "" : `Ø ${num(cur, m.d || 0)} ${m.unit}`;
  if (cur != null && goal) note += m.line && m.key === "weight"
    ? ` · noch ${num(Math.abs(movingWeight([...keys].reverse().find(k => movingWeight(k) != null)) - goal), 1)} kg bis zum Ziel`
    : ` · ${num(cur / goal * 100)} % vom Ziel`;
  if (m.key === "weight") {
    const first = keys.find(k => movingWeight(k) != null), last = [...keys].reverse().find(k => movingWeight(k) != null);
    if (first && last && first !== last) {
      const diff = movingWeight(last) - movingWeight(first);
      note = `7-Tage-Ø: ${diff <= 0 ? "−" : "+"}${num(Math.abs(diff), 1)} kg in ${range} Tagen` + (goal ? ` · noch ${num(Math.abs(movingWeight(last) - goal), 1)} kg bis zum Ziel` : "");
    }
    note += ". Linie = 7-Tage-Durchschnitt, Punkte = einzelne Messungen.";
  }
  $("#t-chart-note").textContent = note;
}

// ---------- Meal times ----------

const toMin = t => { const [h, m] = t.split(":").map(Number); return h * 60 + m; };
const fromMin = m => `${String(Math.floor(m / 60) % 24).padStart(2, "0")}:${String(Math.round(m % 60)).padStart(2, "0")}`;

function renderTimes() {
  const tracked = trackedKeys(rangeKeys(range));
  const timed = tracked.map(k => ({ k, e: day(k).entries.filter(e => e.time) })).filter(d => d.e.length);
  if (timed.length < 2) {
    $("#t-times").innerHTML = `<h3><span class="emoji">🕐</span> Essenszeiten</h3><p class="muted">Ab jetzt bekommt jeder Eintrag eine Uhrzeit. Nach ein paar Tagen siehst du hier, wann du isst und wie sich das auf deinen Hunger auswirkt.</p>`;
    return;
  }
  const byHour = Array(24).fill(0);
  let kcal = 0;
  const days = timed.map(({ k, e }) => {
    for (const x of e) { byHour[toMin(x.time) / 60 | 0] += x.kcal; kcal += x.kcal; }
    const mins = e.map(x => toMin(x.time));
    // Meals = distinct times at least 30 min apart
    const sorted = [...new Set(mins)].sort((a, b) => a - b);
    const meals = sorted.filter((m, i) => !i || m - sorted[i - 1] >= 30).length;
    return { k, first: Math.min(...mins), last: Math.max(...mins), meals, hunger: journalDay(k).hunger, craving: journalDay(k).craving };
  });
  const first = avgOf(days.map(d => d.first)), last = avgOf(days.map(d => d.last));
  const W = 340, H = 120, bw = W / 24;
  const max = Math.max(...byHour, 1);
  const bars = byHour.map((v, h) => `<rect x="${h * bw + 1}" y="${H - 18 - (v / max) * (H - 30)}" width="${bw - 2}" height="${(v / max) * (H - 30)}" rx="2" fill="${v ? "#6E1A2E" : "#FCEBF0"}"/>`).join("")
    + [0, 6, 12, 18].map(h => `<text x="${h * bw + 2}" y="${H - 4}">${h} Uhr</text>`).join("");

  // Hunger compared between early and late first meals / short and long eating windows
  const insights = [];
  const compare = (label, a, b, labelA, labelB, field) => {
    const ha = avgOf(a.map(d => d[field]).filter(v => v != null)), hb = avgOf(b.map(d => d[field]).filter(v => v != null));
    const na = a.filter(d => d[field] != null).length, nb = b.filter(d => d[field] != null).length;
    if (na >= 3 && nb >= 3 && Math.abs(ha - hb) >= 0.5) insights.push(`${label}: ${labelA} Ø ${num(ha, 1)}/5, ${labelB} Ø ${num(hb, 1)}/5.`);
  };
  const medFirst = [...days].sort((a, b) => a.first - b.first)[days.length >> 1]?.first;
  compare("Hunger", days.filter(d => d.first <= medFirst), days.filter(d => d.first > medFirst),
    `an Tagen mit Frühstück bis ${fromMin(medFirst)}`, "später", "hunger");
  compare("Heißhunger", days.filter(d => d.meals >= 3), days.filter(d => d.meals < 3), "bei 3+ Mahlzeiten", "bei weniger", "craving");
  const late = days.filter(d => d.last >= 21 * 60).length;

  $("#t-times").innerHTML = `
    <h3><span class="emoji">🕐</span> Essenszeiten</h3>
    <div class="chart"><svg viewBox="0 0 ${W} ${H}" role="img" aria-label="Kalorien nach Uhrzeit">${bars}</svg></div>
    <p class="muted small">Wann deine Kalorien kommen, über ${timed.length} Tage.</p>
    <div class="stat-row">
      <div><b>${fromMin(first)}</b><small>Ø erste Mahlzeit</small></div>
      <div><b>${fromMin(last)}</b><small>Ø letzte Mahlzeit</small></div>
      <div><b>${num((last - first) / 60, 1)} h</b><small>Ø Essensfenster</small></div>
    </div>
    <p class="muted small">Ø ${num(avgOf(days.map(d => d.meals)), 1)} Mahlzeiten pro Tag${late ? ` · an ${late} Tagen nach 21 Uhr gegessen` : ""}.</p>
    ${insights.length ? `<h4>Muster bei dir</h4>${insights.map(i => `<p class="hint">${i}</p>`).join("")}<p class="muted small">Zusammenhänge, keine Ursachen. Je mehr Tage, desto aussagekräftiger.</p>`
      : `<p class="muted small">Trag öfter Hunger und Heißhunger unter „Wie geht's dir heute?“ ein, dann zeigt die App dir Zusammenhänge mit deinen Essenszeiten.</p>`}`;
}

// ---------- Cycle patterns ----------

function renderCyclePatterns() {
  const el = $("#t-cycle");
  el.hidden = !cycleOn();
  if (!cycleOn()) return;
  const info = cycleInfo();
  if (info.starts.length < 2) {
    el.innerHTML = `<h3><span class="emoji">🌙</span> Zyklus-Muster</h3><p class="muted">Trag deine Periode unter „Wie geht's dir heute?“ ein. Ab zwei Zyklen zeigt die App dir hier, wie sich Hunger, Energie, Kalorien und Gewicht über deinen Zyklus verändern.</p>
      <p class="muted small">Bisher erfasst: ${info.starts.length} Periode${info.starts.length === 1 ? "" : "n"}.</p>`;
    return;
  }
  // Last ~6 months, grouped by estimated phase
  const keys = rangeKeys(180);
  const groups = Object.fromEntries(Object.keys(PHASES).map(p => [p, []]));
  for (const k of keys) { const ph = cyclePhase(k, info); if (ph) groups[ph.phase].push(k); }
  // Weight relative to the 28-day average around each day, to remove the overall trend
  const weightDev = k => {
    const w = state.weights[k];
    if (w == null) return null;
    const around = Array.from({ length: 29 }, (_, i) => state.weights[shiftKey(k, i - 14)]).filter(v => v != null);
    return around.length >= 4 ? w - avgOf(around) : null;
  };
  const cols = [
    ["Kalorien", ks => avgOf(trackedKeys(ks).map(k => totals(k).kcal)), 0, ""],
    ["Hunger", ks => avgOf(ks.map(k => journalDay(k).hunger).filter(v => v != null)), 1, "/5"],
    ["Heißhunger", ks => avgOf(ks.map(k => journalDay(k).craving).filter(v => v != null)), 1, "/5"],
    ["Energie", ks => avgOf(ks.map(k => journalDay(k).energy).filter(v => v != null)), 1, "/5"],
    ["Gewicht ±", ks => avgOf(ks.map(weightDev).filter(v => v != null)), 1, " kg"],
    ["Wasser­einlagerung", ks => avgOf(ks.map(k => journalDay(k).retention).filter(v => v != null)), 1, "/2"],
  ];
  const fmt = (v, d, u) => v == null ? "–" : (u === " kg" && v > 0 ? "+" : "") + num(v, d) + u;
  el.innerHTML = `
    <h3><span class="emoji">🌙</span> Zyklus-Muster</h3>
    <p class="muted small">Durchschnitt je geschätzter Phase, letzte 6 Monate (${info.starts.length} Perioden, Ø Zyklus ${info.length} Tage${info.measured ? "" : ", angenommen"}).</p>
    <div class="table-wrap"><table class="cycle-table">
      <thead><tr><th></th>${Object.values(PHASES).map(p => `<th>${p.emoji}<br>${p.name.replace("phase", "-<br>phase")}</th>`).join("")}</tr></thead>
      <tbody>${cols.map(([name, fn, d, u]) => `<tr><th>${name}</th>${Object.keys(PHASES).map(p => `<td>${fmt(groups[p].length ? fn(groups[p]) : null, d, u)}</td>`).join("")}</tr>`).join("")}</tbody>
    </table></div>
    <p class="muted small">Gewicht ± zeigt die Abweichung vom Durchschnitt der umliegenden 4 Wochen. Viele merken z. B. in der Lutealphase mehr Hunger und mehr Wasser. Das ist normal und kein Rückschritt. Die Phasen sind geschätzt, keine medizinische Auswertung.</p>`;
}

// ---------- Measures form ----------

function fillMeasures() {
  const f = $("#measure-form").elements, k = todayKey();
  f.weight.value = state.weights[k] ?? "";
  f.waist.value = state.measures?.[k]?.waist ?? "";
  f.hip.value = state.measures?.[k]?.hip ?? "";
}

$("#measure-form").addEventListener("submit", e => {
  e.preventDefault();
  const f = e.target.elements, k = todayKey();
  const v = name => { const x = parseFloat(f[name].value); return x > 0 ? x : null; };
  if (v("weight")) state.weights[k] = v("weight"); else delete state.weights[k];
  state.measures = state.measures || {};
  const m = { waist: v("waist"), hip: v("hip") };
  if (m.waist || m.hip) state.measures[k] = m; else delete state.measures[k];
  save();
  renderTrends();
  toast("Messwerte gespeichert");
});

// ---------- Wiring ----------

function renderTrends() {
  renderBalance();
  renderTiles();
  renderChart();
  fillMeasures();
  renderTimes();
  renderCyclePatterns();
  if (typeof renderShareCard === "function") renderShareCard();
}

document.addEventListener("click", e => {
  const r = e.target.closest("[data-range]");
  if (r) {
    range = +r.dataset.range;
    $$("#range-seg button").forEach(b => b.classList.toggle("active", b === r));
    renderTrends();
  }
  const t = e.target.closest("[data-metric]");
  if (t) { metricKey = t.dataset.metric; renderTiles(); renderChart(); }
});
