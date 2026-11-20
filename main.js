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

// Moving from the old address: the old page hands the saved data over inside the link
// (#umzug=<gzip, base64url>); the part after # never reaches a server
async function importMove(packed) {
  try {
    const bin = Uint8Array.from(atob(packed.replace(/-/g, "+").replace(/_/g, "/")), c => c.charCodeAt(0));
    const text = await new Response(new Blob([bin]).stream().pipeThrough(new DecompressionStream("gzip"))).text();
    const moved = JSON.parse(text);
    const hasData = !!state.goals || Object.keys(state.days).length > 0;
    if (moved[STORE_KEY] && (!hasData || confirm("Deine Daten von der alten App-Adresse übernehmen? Die Einträge auf diesem Gerät werden dabei ersetzt."))) {
      for (const [k, v] of Object.entries(moved)) localStorage.setItem(k, v);
    }
  } catch (e) { /* broken link: start normally */ }
  location.replace(APP_URL);
}

if (location.hash.startsWith("#umzug=")) importMove(location.hash.slice(7));
else {
  if (!state.goals) openOnboarding();
  else showView("today");

  // Recipe or challenge link opened directly
  if (location.hash && handleIncoming(location.hash)) history.replaceState(null, "", APP_URL);
}
