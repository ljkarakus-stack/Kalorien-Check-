"use strict";

// Loaded last, once every feature script has registered itself

// Entries logged before fibre was tracked get it from the food list, where the food is known
function backfillFibre() {
  let changed = false;
  for (const d of Object.values(state.days)) for (const e of d.entries) {
    if (e.fib != null) continue;
    const food = foodById(e.foodId);
    if (!food || food.fib == null) continue;
    e.fib = scale(food, e.amount).fib;
    if (e.base) e.base.fib = food.fib;
    changed = true;
  }
  if (changed) save();
}
backfillFibre();

if (!state.goals) openOnboarding();
else showView("today");

// Recipe or challenge link opened directly
if (location.hash && handleIncoming(location.hash)) history.replaceState(null, "", APP_URL);
