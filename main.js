"use strict";

// Loaded last, once every feature script has registered itself

if (!state.goals) openOnboarding();
else showView("today");

// Recipe or challenge link opened directly
if (location.hash && handleIncoming(location.hash)) history.replaceState(null, "", APP_URL);
