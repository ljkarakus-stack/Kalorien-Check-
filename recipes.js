"use strict";

// Own recipes: stored in state.recipes. Each ingredient keeps a copy of its nutrition values,
// so a recipe still works after a custom food is deleted or when it is shared with someone else.

const RECIPE_CATS = ["Frühstück", "Mittagessen", "Abendessen", "Snack", "Dessert", "Getränk", "Meal Prep"];
const CAT_SLOT = { "Frühstück": "fruehstueck", "Mittagessen": "mittag", "Abendessen": "abend", "Snack": "snack", "Dessert": "snack", "Getränk": "snack" };

let recipeTab = "mine";
let recipeCat = "Alle";
let draft = null;   // recipe being edited: { id?, ings: [{ food, g }] }

// Nutrition snapshot of a food (per 100 g / ml, or per portion)
function snapshot(food) {
  const round = v => Math.round(v * 100) / 100;
  return { id: food.id, name: food.name, portion: food.portion || undefined, ml: food.ml || undefined,
    kcal: round(food.kcal), p: round(food.p), kh: round(food.kh), f: round(food.f), fib: round(food.fib || 0) };
}

function recipeTotals(r) {
  return addUp(r.ings.map(i => scale(i.food, i.g)));
}

// One portion of a recipe as a loggable food
function recipeFood(r) {
  const t = recipeTotals(r), n = r.portions || 1;
  return { id: "rez-" + r.id, name: r.title, cat: "Rezepte", portion: "Portion",
    kcal: t.kcal / n, p: t.p / n, kh: t.kh / n, f: t.f / n, fib: t.fib / n };
}

function ingLabel(i) {
  return i.food.portion ? `${num(i.g, 2)} × ${i.food.portion}` : `${num(i.g)} ${i.food.ml ? "ml" : "g"}`;
}

// ---------- Recipes view ----------

function recipeCard(r, compact) {
  const f = recipeFood(r);
  return `<article class="card idea recipe">
    <div class="idea-body">
      <span class="tag-cat">${esc(r.cat || "Ohne Kategorie")}</span>
      <h3>${esc(r.title)}</h3>
      <p class="idea-macros"><span class="emoji">🔥</span> ${num(f.kcal)} kcal · <span class="emoji">💪</span> ${num(f.p)} g Protein <small class="muted">pro Portion</small></p>
      ${compact ? "" : `<details><summary>Zutaten (${r.portions || 1} ${r.portions > 1 ? "Portionen" : "Portion"})</summary>
        <ul>${r.ings.map(i => `<li>${esc(ingLabel(i))} ${esc(i.food.name)}</li>`).join("")}</ul>
        ${r.text ? `<p class="muted">${esc(r.text)}</p>` : ""}</details>`}
      <div class="btn-row">
        <button class="btn" data-cook="${r.id}">Gegessen? Eintragen</button>
        ${compact ? "" : `<button class="btn ghost" data-redit="${r.id}">Bearbeiten</button>
        <button class="btn ghost" data-rshare="${r.id}" aria-label="Teilen">Teilen</button>`}
      </div>
    </div>
  </article>`;
}

function filteredRecipes(q) {
  const words = fold(q || "").split(/\s+/).filter(Boolean);
  return (state.recipes || [])
    .filter(r => recipeCat === "Alle" || r.cat === recipeCat)
    .filter(r => words.every(w => fold(r.title + " " + r.ings.map(i => i.food.name).join(" ")).includes(w)))
    .sort((a, b) => (b.used || 0) - (a.used || 0) || a.title.localeCompare(b.title, "de"));
}

function renderRecipesView() {
  $$("#recipe-seg button").forEach(b => b.classList.toggle("active", b.dataset.rtab === recipeTab));
  $("#mine-pane").hidden = recipeTab !== "mine";
  $("#ideas-pane").hidden = recipeTab !== "ideas";
  if (recipeTab === "ideas") { renderIdeas($("#ideas-page"), false); return; }
  const used = new Set((state.recipes || []).map(r => r.cat));
  const cats = ["Alle", ...RECIPE_CATS.filter(c => used.has(c))];
  if (!cats.includes(recipeCat)) recipeCat = "Alle";
  $("#recipe-cats").innerHTML = cats.length > 2 ? cats.map(c => `<button class="chip ${c === recipeCat ? "active" : ""}" data-rcat="${esc(c)}">${esc(c)}</button>`).join("") : "";
  const list = filteredRecipes($("#recipe-search").value);
  $("#recipe-list").innerHTML = list.length ? list.map(r => recipeCard(r, false)).join("")
    : (state.recipes || []).length
      ? `<p class="empty">Kein Rezept gefunden.</p>`
      : `<div class="card empty-state"><b>Noch keine eigenen Rezepte</b><p class="muted">Leg Gerichte an, die du oft kochst. Dann trägst du sie mit einem Tipp ein, statt jede Zutat einzeln zu suchen.</p></div>`;
}

// Recipes inside the add sheet: own recipes first, then jamileo ideas
function renderSheetRecipes() {
  const mine = filteredRecipes("");
  $("#ideas-sheet").innerHTML = (mine.length ? `<h3 class="online-head">Meine Rezepte</h3>${mine.map(r => recipeCard(r, true)).join("")}` : "")
    + `<h3 class="online-head">Ideen von jamileo</h3><div class="ideas compact" id="ideas-sheet-ideas"></div>`;
  renderIdeas($("#ideas-sheet-ideas"), true);
}

function cookRecipe(id, fromSheet) {
  const r = state.recipes.find(x => x.id === id);
  r.used = (r.used || 0) + 1;
  const slot = fromSheet && pick ? pick.slot : CAT_SLOT[r.cat] || defaultSlot();
  pick = { slot };
  $("#sheet").hidden = false;
  showAmount(recipeFood(r), slot, null, { u: "Portion", n: 1 });
}

// ---------- Editor ----------

function openRecipeEditor(id) {
  const r = id && state.recipes.find(x => x.id === id);
  draft = r ? { id: r.id, ings: r.ings.map(i => ({ ...i })) } : { ings: [] };
  const f = $("#recipe-form");
  f.reset();
  f.elements.cat.innerHTML = RECIPE_CATS.map(c => `<option>${c}</option>`).join("");
  if (r) { f.elements.title.value = r.title; f.elements.cat.value = r.cat; f.elements.portions.value = r.portions || 1; f.elements.text.value = r.text || ""; }
  $("#recipe-title").textContent = r ? "Rezept bearbeiten" : "Neues Rezept";
  $("#recipe-delete").hidden = !r;
  $("#ing-search").value = "";
  $("#ing-results").innerHTML = "";
  renderIngredients();
  $("#recipe-sheet").hidden = false;
}

function renderIngredients() {
  $("#ing-list").innerHTML = draft.ings.length ? draft.ings.map((i, n) => `<div class="ing">
      <span class="ing-name">${esc(i.food.name)}</span>
      <input type="number" min="0" step="any" inputmode="decimal" value="${i.g}" data-ing="${n}" aria-label="Menge ${esc(i.food.name)}">
      <span class="ing-unit">${i.food.portion ? "×" : i.food.ml ? "ml" : "g"}</span>
      <button type="button" class="icon-btn small" data-ing-del="${n}" aria-label="Entfernen">✕</button>
    </div>`).join("") : `<p class="empty">Noch keine Zutaten. Such unten nach Lebensmitteln.</p>`;
  updateRecipePreview();
}

function updateRecipePreview() {
  const n = Math.max(1, +$("#recipe-form").elements.portions.value || 1);
  const t = recipeTotals({ ings: draft.ings });
  $("#recipe-preview").innerHTML = [["kcal", t.kcal / n, ""], ["Protein", t.p / n, " g"], ["KH", t.kh / n, " g"], ["Fett", t.f / n, " g"]]
    .map(([l, v, u]) => `<div><b>${num(v, l === "kcal" ? 0 : 1)}${u}</b><small>${l}</small></div>`).join("")
    + `<p class="muted small span4">pro Portion</p>`;
}

function searchIngredients() {
  const words = fold($("#ing-search").value.trim()).split(/\s+/).filter(Boolean);
  if (!words.length) { $("#ing-results").innerHTML = ""; return; }
  const list = allFoods().filter(f => words.every(w => fold(f.name).includes(w))).slice(0, 6);
  $("#ing-results").innerHTML = list.map(f => `<button type="button" class="food" data-ing-add="${esc(f.id)}">
      <span class="n">${esc(f.name)}</span><span class="k">${num(f.kcal)} kcal</span></button>`).join("")
    || `<p class="empty">Nicht gefunden. Leg es zuerst über + → Manuell oder die Online-Suche an.</p>`;
}

function saveRecipe(e) {
  e.preventDefault();
  if (!draft.ings.length) return toast("Bitte mindestens eine Zutat hinzufügen");
  const f = e.target.elements;
  const recipe = {
    id: draft.id || uid(), title: f.title.value.trim(), cat: f.cat.value,
    portions: Math.max(1, Math.round(+f.portions.value || 1)), text: f.text.value.trim() || undefined,
    ings: draft.ings.filter(i => i.g > 0),
  };
  const old = (state.recipes || []).find(r => r.id === recipe.id);
  if (old) recipe.used = old.used;
  state.recipes = [recipe, ...(state.recipes || []).filter(r => r.id !== recipe.id)];
  save();
  $("#recipe-sheet").hidden = true;
  recipeTab = "mine";
  renderRecipesView();
  toast(`„${recipe.title}“ gespeichert`);
}

// ---------- Events ----------

document.addEventListener("click", e => {
  const b = e.target.closest("button");
  if (!b) return;
  if (b.dataset.rtab) { recipeTab = b.dataset.rtab; renderRecipesView(); }
  else if (b.dataset.rcat) { recipeCat = b.dataset.rcat; renderRecipesView(); }
  else if (b.dataset.cook) cookRecipe(b.dataset.cook, !!b.closest("#sheet"));
  else if (b.dataset.redit) openRecipeEditor(b.dataset.redit);
  else if (b.dataset.ingAdd) {
    const food = foodById(b.dataset.ingAdd);
    draft.ings.push({ food: snapshot(food), g: food.portion ? 1 : food.piece ? food.piece[1] : 100 });
    $("#ing-search").value = "";
    $("#ing-results").innerHTML = "";
    renderIngredients();
  } else if (b.dataset.ingDel) { draft.ings.splice(+b.dataset.ingDel, 1); renderIngredients(); }
});

$("#recipe-new").addEventListener("click", () => openRecipeEditor());
$("#recipe-close").addEventListener("click", () => $("#recipe-sheet").hidden = true);
$("#recipe-search").addEventListener("input", renderRecipesView);
$("#ing-search").addEventListener("input", searchIngredients);
$("#ing-list").addEventListener("input", e => {
  if (e.target.dataset.ing === undefined) return;
  draft.ings[+e.target.dataset.ing].g = parseFloat(e.target.value) || 0;
  updateRecipePreview();
});
$("#recipe-form").elements.portions.addEventListener("input", updateRecipePreview);
$("#recipe-form").addEventListener("submit", saveRecipe);
$("#recipe-delete").addEventListener("click", () => {
  if (!confirm("Rezept löschen? Bereits eingetragene Mahlzeiten bleiben erhalten.")) return;
  state.recipes = state.recipes.filter(r => r.id !== draft.id);
  save();
  $("#recipe-sheet").hidden = true;
  renderRecipesView();
  toast("Rezept gelöscht");
});
