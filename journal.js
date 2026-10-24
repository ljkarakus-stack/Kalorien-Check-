"use strict";

// Daily check-in: hunger, energy, cravings, water retention and (optional) period.
// Stored per day in state.journal; cycle phases are estimated from logged period days.

const JOURNAL_SCALES = [
  { key: "hunger", name: "Hunger", emoji: "🍽️", low: "kaum", high: "sehr" },
  { key: "energy", name: "Energie", emoji: "⚡", low: "müde", high: "fit" },
  { key: "craving", name: "Heißhunger", emoji: "🍫", low: "keiner", high: "stark" },
];
const WATER_RETENTION = ["keine", "leicht", "deutlich"];

function journalDay(k = currentDay) {
  return (state.journal || {})[k] || {};
}

function setJournal(k, patch) {
  state.journal = state.journal || {};
  const next = { ...journalDay(k), ...patch };
  for (const key of Object.keys(next)) if (next[key] === null || next[key] === undefined) delete next[key];
  if (Object.keys(next).length) state.journal[k] = next; else delete state.journal[k];
  save();
}

function cycleOn() {
  return !!state.settings?.cycle;
}

// ---------- Cycle estimation ----------

// First days of each logged period, oldest first
function periodStarts() {
  const j = state.journal || {};
  return Object.keys(j).filter(k => j[k].period && !j[shiftKey(k, -1)]?.period).sort();
}

function cycleInfo() {
  const starts = periodStarts();
  const gaps = starts.slice(1).map((k, i) => Math.round((keyToDate(k) - keyToDate(starts[i])) / 86400000))
    .filter(g => g >= 18 && g <= 45).slice(-6);
  const length = gaps.length ? Math.round(gaps.reduce((a, b) => a + b, 0) / gaps.length) : 28;
  // Typical bleeding length from logged periods (default 5 days)
  const j = state.journal || {};
  const lens = starts.map(s => { let n = 0; while (j[shiftKey(s, n)]?.period) n++; return n; }).filter(n => n > 0).slice(-6);
  const periodLength = lens.length ? Math.round(lens.reduce((a, b) => a + b, 0) / lens.length) : 5;
  return { starts, length, periodLength, measured: gaps.length };
}

const PHASES = {
  mens: { name: "Menstruation", emoji: "🩸" },
  foll: { name: "Follikelphase", emoji: "🌱" },
  ov: { name: "Eisprung-Zeit", emoji: "🌕" },
  lut: { name: "Lutealphase", emoji: "🌙" },
};

// Estimated cycle day and phase for a date, or null without enough data
function cyclePhase(k, info = cycleInfo()) {
  const start = [...info.starts].reverse().find(s => s <= k);
  if (!start) return null;
  const day = Math.round((keyToDate(k) - keyToDate(start)) / 86400000) + 1;
  if (day > info.length + 10) return null;           // too long ago to say anything
  const ovulation = info.length - 14;
  let phase;
  if (journalDay(k).period || day <= info.periodLength) phase = "mens";
  else if (day < ovulation - 1) phase = "foll";
  else if (day <= ovulation + 1) phase = "ov";
  else phase = "lut";
  return { day, phase, ...PHASES[phase] };
}

// ---------- Rendering ----------

function renderJournal() {
  const j = journalDay();
  const scale = s => `<div class="j-row">
      <span class="j-label"><span class="emoji">${s.emoji}</span> ${s.name}</span>
      <div class="j-scale" role="group" aria-label="${s.name}">
        ${[1, 2, 3, 4, 5].map(v => `<button type="button" class="j-dot ${j[s.key] === v ? "on" : ""}" data-j="${s.key}" data-v="${v}" aria-label="${s.name} ${v} von 5">${v}</button>`).join("")}
      </div>
      <span class="j-ends"><small>${s.low}</small><small>${s.high}</small></span>
    </div>`;
  let cycle = "";
  if (cycleOn()) {
    const ph = cyclePhase(currentDay);
    cycle = `<div class="j-cycle">
      <button type="button" class="chip ${j.period ? "active" : ""}" data-j-period>🩸 Periode heute</button>
      <span class="muted">${ph ? `Zyklustag ${ph.day} · ${ph.emoji} ${ph.name} <small>(geschätzt)</small>` : "Trag deine Periode ein, dann schätzt die App deine Zyklusphase."}</span>
    </div>`;
  }
  $("#journal").innerHTML = `
    <div class="meal-head"><h3><span class="emoji">📝</span> Wie geht's dir heute?</h3><small>optional</small></div>
    ${JOURNAL_SCALES.map(scale).join("")}
    <div class="j-row">
      <span class="j-label"><span class="emoji">💧</span> Wassereinlagerung</span>
      <div class="j-choice">
        ${WATER_RETENTION.map((w, i) => `<button type="button" class="chip ${j.retention === i ? "active" : ""}" data-j="retention" data-v="${i}">${w}</button>`).join("")}
      </div>
    </div>
    ${cycle}`;
}

document.addEventListener("click", e => {
  const b = e.target.closest("[data-j], [data-j-period]");
  if (!b) return;
  if (b.hasAttribute("data-j-period")) setJournal(currentDay, { period: journalDay().period ? null : true });
  else {
    const v = +b.dataset.v;
    // Tapping the selected value again clears it
    setJournal(currentDay, { [b.dataset.j]: journalDay()[b.dataset.j] === v ? null : v });
  }
  renderToday();
});
