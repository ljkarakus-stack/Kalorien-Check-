"use strict";

// Loaded last, once every feature script has registered itself

// Entries logged before nutrient data existed get it from the food list, where the food is known
function backfillNutrients() {
  let changed = 0;
  for (const d of Object.values(state.days)) for (const e of d.entries) {
    if (e.m) continue;
    const food = foodById(e.foodId);
    if (!food?.m) continue;
    e.m = scale(food, e.amount).m;
    if (e.base) e.base.m = food.m;
    changed++;
  }
  if (changed) save();
}
backfillNutrients();

if (!state.goals) openOnboarding();
else showView("today");

// Recipe or challenge link opened directly
if (location.hash && handleIncoming(location.hash)) history.replaceState(null, "", APP_URL);
