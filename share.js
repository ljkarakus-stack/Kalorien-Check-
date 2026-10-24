"use strict";

// Sharing without a server: recipes and challenges travel inside the link itself (#rezept=… / #challenge=…),
// the weekly result as an image. Nothing is uploaded; people decide themselves what they send.

const APP_URL = location.origin + location.pathname;

function encodeShare(obj) {
  const bytes = new TextEncoder().encode(JSON.stringify(obj));
  let bin = "";
  bytes.forEach(b => bin += String.fromCharCode(b));
  return btoa(bin).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

function decodeShare(code) {
  const bin = atob(code.replace(/-/g, "+").replace(/_/g, "/"));
  return JSON.parse(new TextDecoder().decode(Uint8Array.from(bin, c => c.charCodeAt(0))));
}

async function shareOrCopy({ title, text, url, files }) {
  try {
    if (files && navigator.canShare?.({ files })) { await navigator.share({ title, text, files }); return; }
    if (navigator.share && !files) { await navigator.share({ title, text, url }); return; }
  } catch (e) {
    if (e.name === "AbortError") return;
  }
  if (files) {
    const a = document.createElement("a");
    a.href = URL.createObjectURL(files[0]);
    a.download = files[0].name;
    a.click();
    setTimeout(() => URL.revokeObjectURL(a.href), 1000);
    toast("Bild gespeichert");
    return;
  }
  try { await navigator.clipboard.writeText(url ? `${text}\n${url}` : text); toast("Link kopiert. Füg ihn z. B. in WhatsApp ein."); }
  catch (e) { prompt("Kopier diesen Link:", url || text); }
}

// ---------- Recipes ----------

function shareRecipe(id) {
  const r = state.recipes.find(x => x.id === id);
  const payload = { t: r.title, c: r.cat, n: r.portions, x: r.text, i: r.ings.map(i => [i.food, i.g]) };
  shareOrCopy({
    title: r.title,
    text: `Mein Rezept „${r.title}“ für den jamileo Kalorien-Check 🍽️`,
    url: `${APP_URL}#rezept=${encodeShare(payload)}`,
  });
}

function importRecipe(code) {
  const d = decodeShare(code);
  if (!d.t || !Array.isArray(d.i)) throw new Error("bad recipe");
  const recipe = {
    id: uid(), title: String(d.t).slice(0, 80), cat: RECIPE_CATS.includes(d.c) ? d.c : "Mittagessen",
    portions: Math.max(1, +d.n || 1), text: d.x ? String(d.x).slice(0, 1500) : undefined,
    ings: d.i.map(([food, g]) => ({ food: { ...food, name: String(food.name).slice(0, 120), kcal: +food.kcal || 0, p: +food.p || 0, kh: +food.kh || 0, f: +food.f || 0 }, g: +g || 0 })),
  };
  if (!confirm(`Rezept „${recipe.title}“ übernehmen? Es landet unter „Meine Rezepte“.`)) return;
  state.recipes = [recipe, ...(state.recipes || [])];
  save();
  recipeTab = "mine";
  showView("ideas");
  toast(`„${recipe.title}“ übernommen`);
}

// ---------- Challenges ----------

const CHALLENGE_TYPES = {
  protein: { name: "Proteinziel schaffen", emoji: "💪", ok: k => totals(k).p >= state.goals.p },
  kcal: { name: "Im Kalorienziel bleiben", emoji: "🎯", ok: k => { const t = totals(k).kcal; return t > 0 && t <= state.goals.kcal; } },
  water: { name: "Wasserziel trinken", emoji: "💧", ok: k => day(k).water >= state.goals.water },
  track: { name: "Jeden Tag tracken", emoji: "📝", ok: k => totals(k).kcal > 0 },
};

function challengeProgress(c) {
  const days = Array.from({ length: c.days }, (_, i) => shiftKey(c.start, i));
  const past = days.filter(k => k <= todayKey());
  const done = past.filter(k => CHALLENGE_TYPES[c.type].ok(k)).length;
  return { done, elapsed: past.length, finished: days[days.length - 1] < todayKey(), end: days[days.length - 1] };
}

function challengeText(c, p) {
  const t = CHALLENGE_TYPES[c.type];
  return `${t.emoji} Challenge: ${c.days} Tage „${t.name}“. Ich habe schon ${p.done} von ${c.days} Tagen geschafft! Machst du mit?`;
}

function shareChallenge(id) {
  const c = state.challenges.find(x => x.id === id);
  const p = challengeProgress(c);
  shareOrCopy({
    title: "Challenge",
    text: p.elapsed ? challengeText(c, p) : `${CHALLENGE_TYPES[c.type].emoji} Machst du mit? ${c.days} Tage „${CHALLENGE_TYPES[c.type].name}“ ab ${fmtDay(c.start)} im jamileo Kalorien-Check.`,
    url: `${APP_URL}#challenge=${encodeShare({ y: c.type, d: c.days, s: c.start })}`,
  });
}

function importChallenge(code) {
  const d = decodeShare(code);
  if (!CHALLENGE_TYPES[d.y] || !(+d.d > 0) || !/^\d{4}-\d{2}-\d{2}$/.test(d.s)) throw new Error("bad challenge");
  if ((state.challenges || []).some(c => c.type === d.y && c.start === d.s && c.days === +d.d)) return toast("Die Challenge hast du schon");
  if (!confirm(`Bei der Challenge „${CHALLENGE_TYPES[d.y].name}“ (${d.d} Tage ab ${fmtDay(d.s)}) mitmachen?`)) return;
  state.challenges = [{ id: uid(), type: d.y, days: +d.d, start: d.s }, ...(state.challenges || [])];
  save();
  showView("week");
  toast("Du bist dabei! 💪");
}

function startChallenge(e) {
  e.preventDefault();
  const f = e.target.elements;
  state.challenges = [{ id: uid(), type: f.type.value, days: +f.days.value, start: todayKey() }, ...(state.challenges || [])];
  save();
  renderShareCard();
  toast("Challenge gestartet. Lade jetzt Freundinnen ein!");
}

// ---------- Weekly image ----------

async function weekImage() {
  await document.fonts.load("800 40px 'Baloo 2'");
  await document.fonts.load("40px 'Caveat Brush'");
  const keys = rangeKeys(7), tracked = trackedKeys(keys);
  const avg = avgOf(tracked.map(k => totals(k).kcal)) || 0;
  const prot = avgOf(tracked.map(k => totals(k).p)) || 0;
  const deficit = state.goals.kcal - avg;
  const W = 1080, H = 1350, c = document.createElement("canvas");
  c.width = W; c.height = H;
  const g = c.getContext("2d");
  g.fillStyle = "#FBF1EC"; g.fillRect(0, 0, W, H);
  g.fillStyle = "#F6D3DC"; g.beginPath(); g.arc(900, 160, 260, 0, 7); g.fill(); g.beginPath(); g.arc(140, 1220, 220, 0, 7); g.fill();
  g.save(); g.translate(90, 130); g.rotate(-0.03); g.fillStyle = "#6E1A2E"; g.fillRect(0, 0, 640, 110);
  g.fillStyle = "#FFFBFC"; g.font = "800 66px 'Baloo 2'"; g.fillText("Meine Woche", 40, 80); g.restore();
  g.fillStyle = "#6E1A2E"; g.font = "48px 'Caveat Brush'";
  g.fillText(`${fmtDay(keys[0])} – ${fmtDay(keys[6])}`, 100, 320);
  const card = (y, label, value, sub) => {
    g.fillStyle = "#FFFBFC"; g.beginPath(); g.roundRect(90, y, 900, 200, 40); g.fill();
    g.fillStyle = "#8A5A66"; g.font = "700 40px 'Baloo 2'"; g.fillText(label, 140, y + 62);
    g.fillStyle = "#4A0F1E"; g.font = "800 84px 'Baloo 2'"; g.fillText(value, 140, y + 155);
    if (sub) { g.fillStyle = "#8A5A66"; g.font = "600 34px 'Baloo 2'"; g.textAlign = "right"; g.fillText(sub, 940, y + 150); g.textAlign = "left"; }
  };
  card(380, "Ø Kalorien pro Tag", `${num(avg)} kcal`, `Ziel ${num(state.goals.kcal)}`);
  card(610, deficit >= 0 ? "Ø unter meinem Ziel" : "Ø über meinem Ziel", `${num(Math.abs(deficit))} kcal`, `${tracked.length} ${tracked.length === 1 ? "Tag" : "Tage"} getrackt`);
  card(840, "Ø Protein pro Tag", `${num(prot)} g`, `Ziel ${num(state.goals.p)} g`);
  g.fillStyle = "#6E1A2E"; g.font = "800 44px 'Baloo 2'"; g.textAlign = "center";
  g.fillText("Kalorien-Check by @jamileo__", W / 2, 1180); g.textAlign = "left";
  return new Promise(res => c.toBlob(b => res(new File([b], `meine-woche-${todayKey()}.png`, { type: "image/png" })), "image/png"));
}

// ---------- Share card in Trends ----------

function renderShareCard() {
  const list = (state.challenges || []).slice(0, 5);
  $("#t-share").innerHTML = `
    <h3><span class="emoji">🤝</span> Mit Freundinnen</h3>
    <p class="muted small">Freiwillig und ohne Konto: Du entscheidest selbst, was du teilst. Nichts wird bei uns gespeichert.</p>
    <button class="btn ghost" id="share-week">📸 Meine Woche als Bild teilen</button>
    <h4>Challenges</h4>
    ${list.map(c => {
      const p = challengeProgress(c), t = CHALLENGE_TYPES[c.type];
      return `<div class="challenge">
        <div class="nut-top"><span>${t.emoji} ${t.name}</span><span><b>${p.done}/${c.days}</b></span></div>
        <div class="bar"><i class="${p.done >= c.days ? "full" : ""}" style="width:${p.done / c.days * 100}%"></i></div>
        <p class="muted small">${p.finished ? (p.done >= c.days ? "Geschafft! 🎉" : `Beendet am ${fmtDay(p.end)}`) : `Bis ${fmtDay(p.end)}`}</p>
        <div class="btn-row"><button class="btn ghost small-btn" data-cshare="${c.id}">Einladen / Stand teilen</button>
        <button class="btn danger small-btn" data-cdel="${c.id}">Entfernen</button></div>
      </div>`;
    }).join("") || `<p class="muted small">Starte eine Challenge und lade Freundinnen per Link ein. Jede sieht ihren eigenen Fortschritt, und ihr könnt euch den Stand gegenseitig schicken.</p>`}
    <form class="form challenge-form" id="challenge-form">
      <div class="grid2">
        <label>Ziel <select name="type">${Object.entries(CHALLENGE_TYPES).map(([k, t]) => `<option value="${k}">${t.emoji} ${t.name}</option>`).join("")}</select></label>
        <label>Dauer <select name="days"><option value="7">7 Tage</option><option value="14">14 Tage</option><option value="30">30 Tage</option></select></label>
      </div>
      <button class="btn">Challenge starten</button>
    </form>`;
  $("#challenge-form").addEventListener("submit", startChallenge);
  $("#share-week").addEventListener("click", async () => {
    if (!trackedKeys(rangeKeys(7)).length) return toast("Trag erst ein paar Tage ein");
    shareOrCopy({ title: "Meine Woche", text: "Meine Woche im jamileo Kalorien-Check", files: [await weekImage()] });
  });
}

// ---------- Incoming links ----------

function handleIncoming(hashOrUrl) {
  const m = /#(rezept|challenge)=([A-Za-z0-9_-]+)/.exec(hashOrUrl);
  if (!m) return false;
  try {
    if (m[1] === "rezept") importRecipe(m[2]); else importChallenge(m[2]);
  } catch (e) {
    toast("Der Link ist leider ungültig");
  }
  return true;
}

document.addEventListener("click", e => {
  const b = e.target.closest("button");
  if (!b) return;
  if (b.dataset.rshare) shareRecipe(b.dataset.rshare);
  else if (b.dataset.cshare) shareChallenge(b.dataset.cshare);
  else if (b.dataset.cdel && confirm("Challenge entfernen?")) {
    state.challenges = state.challenges.filter(c => c.id !== b.dataset.cdel);
    save();
    renderShareCard();
  }
});

// Links opened in the browser can be pasted into the home-screen app (it has its own storage on iPhone)
$("#paste-form").addEventListener("submit", e => {
  e.preventDefault();
  if (!handleIncoming($("#paste-input").value.trim())) toast("Das ist kein Rezept- oder Challenge-Link");
  $("#paste-input").value = "";
});

window.addEventListener("hashchange", () => { if (handleIncoming(location.hash)) history.replaceState(null, "", APP_URL); });
