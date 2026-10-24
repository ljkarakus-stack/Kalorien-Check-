"use strict";

// Anonymous feedback: only the message is sent, no user data. Needs the Supabase values in config.js.
const FEEDBACK = window.KC_CONFIG || {};
const feedbackOn = !!(FEEDBACK.supabaseUrl && FEEDBACK.supabaseKey);

async function sendFeedback(e) {
  e.preventDefault();
  const f = e.target;
  const message = f.elements.message.value.trim();
  if (!message) return;
  const btn = f.querySelector(".btn");
  btn.disabled = true;
  const headers = { apikey: FEEDBACK.supabaseKey, "Content-Type": "application/json", Prefer: "return=minimal" };
  // Older projects use a JWT "anon" key, which also has to go into the Authorization header
  if (FEEDBACK.supabaseKey.startsWith("eyJ")) headers.Authorization = `Bearer ${FEEDBACK.supabaseKey}`;
  try {
    const r = await fetch(`${FEEDBACK.supabaseUrl.replace(/\/$/, "")}/rest/v1/feedback`, {
      method: "POST", headers, body: JSON.stringify({ message }),
    });
    if (!r.ok) throw new Error(r.status);
    f.reset();
    toast("Danke für dein Feedback! 💌");
  } catch (err) {
    toast("Senden hat nicht geklappt. Bitte versuch es nochmal.");
  } finally {
    btn.disabled = false;
  }
}

$("#feedback-form").hidden = !feedbackOn;
$("#feedback-form").addEventListener("submit", sendFeedback);
