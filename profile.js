"use strict";

// Profile picture and name. Stored in state.settings, so only on this device.
// avatar: { type: "photo", data: <jpeg data URL> } or { type: "emoji", emoji, color }

const AVATAR_EMOJIS = ["😊", "😎", "🥰", "💪", "🏃‍♀️", "🧘‍♀️", "🥑", "🍓", "🥗", "🍝", "🌸", "🦋", "🐱", "🐶", "⭐", "🔥"];
const AVATAR_COLORS = ["#6E1A2E", "#E9A9BA", "#F6D3DC", "#F2B630", "#5E9A45", "#7FB7D9", "#9B7BC9", "#4A0F1E"];
const AVATAR_SIZE = 256;

function avatar() {
  return state.settings?.avatar || null;
}

// Initials of the name, or a neutral emoji
function avatarHtml(a = avatar()) {
  if (a?.type === "photo") return `<img src="${a.data}" alt="" style="width:100%;height:100%;object-fit:cover;border-radius:50%">`;
  if (a?.type === "emoji") return `<span class="emoji" style="background:${a.color}">${a.emoji}</span>`;
  const name = (state.settings?.name || "").trim();
  return name ? `<span class="initials">${esc(name.split(/\s+/).map(w => w[0]).join("").slice(0, 2).toUpperCase())}</span>` : `<span class="emoji neutral">👤</span>`;
}

function renderAvatar() {
  $("#header-avatar").innerHTML = avatarHtml();
  $("#profile-avatar").innerHTML = avatarHtml();
  $("#profile-name").value = state.settings?.name || "";
  $("#avatar-remove").hidden = !avatar();
  const a = avatar();
  $("#emoji-grid").innerHTML = AVATAR_EMOJIS.map(e => `<button type="button" class="emoji-pick ${a?.emoji === e ? "on" : ""}" data-av-emoji="${e}"><span class="emoji">${e}</span></button>`).join("");
  $("#color-row").innerHTML = AVATAR_COLORS.map(c => `<button type="button" class="color-pick ${a?.color === c ? "on" : ""}" data-av-color="${c}" style="background:${c}" aria-label="Farbe ${c}"></button>`).join("");
}

function setAvatar(a) {
  state.settings = { ...state.settings, avatar: a };
  save();
  renderAvatar();
}

// Crop a square and shrink it, so the picture stays small (about 20–40 KB)
function loadPhoto(file) {
  if (!file || !file.type.startsWith("image/")) return toast("Bitte ein Bild auswählen");
  const url = URL.createObjectURL(file);
  const img = new Image();
  img.onload = () => {
    const side = Math.min(img.naturalWidth, img.naturalHeight);
    const c = document.createElement("canvas");
    c.width = c.height = AVATAR_SIZE;
    // Portrait photos: faces are usually in the upper part, so crop closer to the top
    c.getContext("2d").drawImage(img, (img.naturalWidth - side) / 2, (img.naturalHeight - side) * 0.2, side, side, 0, 0, AVATAR_SIZE, AVATAR_SIZE);
    URL.revokeObjectURL(url);
    setAvatar({ type: "photo", data: c.toDataURL("image/jpeg", 0.82) });
    toast("Profilbild gespeichert");
  };
  img.onerror = () => { URL.revokeObjectURL(url); toast("Das Bild konnte nicht geöffnet werden"); };
  img.src = url;
}

$("#avatar-file").addEventListener("change", e => { loadPhoto(e.target.files[0]); e.target.value = ""; });
$("#avatar-emoji-btn").addEventListener("click", () => {
  $("#avatar-maker").hidden = !$("#avatar-maker").hidden;
  if (!$("#avatar-maker").hidden && avatar()?.type !== "emoji") setAvatar({ type: "emoji", emoji: "😊", color: AVATAR_COLORS[1] });
});
$("#avatar-remove").addEventListener("click", () => { setAvatar(null); $("#avatar-maker").hidden = true; });
$("#profile-name").addEventListener("change", e => {
  state.settings = { ...state.settings, name: e.target.value.trim() || null };
  save();
  renderAvatar();
});
document.addEventListener("click", e => {
  const b = e.target.closest("[data-av-emoji], [data-av-color]");
  if (!b) return;
  const cur = avatar()?.type === "emoji" ? avatar() : { type: "emoji", emoji: "😊", color: AVATAR_COLORS[1] };
  setAvatar({ ...cur, ...(b.dataset.avEmoji ? { emoji: b.dataset.avEmoji } : { color: b.dataset.avColor }) });
});

renderAvatar();
