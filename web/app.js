const byId = id => document.getElementById(id);
const native = globalThis.FreeTalkAndroid;
const questions = globalThis.QUESTIONS;
const catalogueKey = "published-catalogue";
const slotKey = "current-slot";
const catalogueConfigKey = "published-catalogue-config";
let published = native ? [] : JSON.parse(localStorage.getItem(catalogueKey) || "[]");
let catalogueConfig = native ? {} : JSON.parse(localStorage.getItem(catalogueConfigKey) || "{}");

async function refreshCatalogue() {
  if (native || !globalThis.FREETALK_API) return;
  try {
    const response = await fetch(globalThis.FREETALK_API + "/questions", {signal: AbortSignal.timeout(5000)});
    if (!response.ok) return;
    const data = await response.json();
    if (!Array.isArray(data.questions)) return;
    published = data.questions;
    catalogueConfig = {rotation: data.rotation || {}, managed: data.managed === true};
    localStorage.setItem(catalogueConfigKey, JSON.stringify(catalogueConfig));
    localStorage.setItem(catalogueKey, JSON.stringify(published));
  } catch {
    // The bundled questions and last successful catalogue remain available offline.
  }
}
const settings = byId("settings");
const link = new URLSearchParams(location.search);
const labels = {
  roleplay: "Nhập vai", brainstorm: "Brainstorming", storytelling: "Kể chuyện", everyday: "Đời sống",
  debate: "Nêu quan điểm", what_if: "Giả định", reflection: "Nhìn lại", creative_problem_solving: "Giải quyết vấn đề",
};
const defaults = { translation: true, enabled: false, interval: 120, start: "08:00", end: "22:00" };
const dateFormat = new Intl.DateTimeFormat("vi-VN", {
  hour: "2-digit", minute: "2-digit", hourCycle: "h23", day: "2-digit", month: "2-digit", year: "numeric",
});
let prefs = native ? JSON.parse(native.preferences()) : {
  ...defaults, translation: localStorage.getItem("translation") !== "false",
  ...JSON.parse(localStorage.getItem("schedule") || "{}"),
};
let refreshTimer;

// A fixed shuffle keeps each slot stable across reloads, tabs and offline use.
function rotationPool() {
  const { order = "ordered", topic = "all" } = catalogueConfig.rotation || {};
  const source = catalogueConfig.managed && published.length ? published : [...questions, ...published];
  let pool = source.filter(question => topic === "all" || (question.topic || "life") === topic);
  if (!pool.length) pool = [...source];
  if (order === "reverse") pool.reverse();
  if (order === "shuffle") {
    let seed = 41;
    for (let i = pool.length - 1; i > 0; i--) {
      seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0;
      const j = seed % (i + 1);
      [pool[i], pool[j]] = [pool[j], pool[i]];
    }
  }
  return pool;
}

function minutes(value) {
  const [hours, minutes] = value.split(":").map(Number);
  return hours * 60 + minutes;
}

function webAssignment(now) {
  const start = minutes(prefs.start);
  const count = Math.ceil((minutes(prefs.end) - start) / prefs.interval);
  const elapsed = now.getHours() * 60 + now.getMinutes() - start;
  const index = Math.min(Math.floor(elapsed / prefs.interval), count - 1);
  const day = new Date(now.getFullYear(), now.getMonth(), now.getDate() - (index < 0 ? 1 : 0));
  const slotIndex = index < 0 ? count - 1 : index;
  const slot = new Date(day);
  slot.setHours(0, start + slotIndex * prefs.interval, 0, 0);
  const next = new Date(slot);
  if (slotIndex + 1 === count) {
    next.setDate(next.getDate() + 1);
    next.setHours(0, start, 0, 0);
  } else {
    next.setHours(0, start + (slotIndex + 1) * prefs.interval, 0, 0);
  }
  const key = slot.toISOString();
  let assignment = JSON.parse(localStorage.getItem(slotKey) || "null");
  if (assignment?.slot !== key) {
    const pool = rotationPool();
    const previous = pool.findIndex(question => question.id === assignment?.question.id);
    const nextIndex = previous < 0 ? 0 : (previous + 1) % pool.length;
    assignment = {slot: key, question: pool[nextIndex]};

    localStorage.setItem(slotKey, JSON.stringify(assignment));
  }
  return {...assignment, next};
}

function render() {
  clearTimeout(refreshTimer);
  const now = new Date();
  const current = native ? JSON.parse(native.currentAssignment()) : webAssignment(now);
  const linked = [...published, ...questions].find(question => question.id === link.get("question"));
  const question = linked || current.question || questions[0];
  const linkedSlot = linked ? Date.parse(link.get("slot")) : NaN;
  const slot = new Date(Number.isFinite(linkedSlot) ? linkedSlot : current.slot);
  byId("category").textContent = labels[question.mode];
  byId("japanese").textContent = question.ja;
  byId("translation").textContent = question.vi;
  byId("translation").hidden = !prefs.translation;
  byId("question-time").dateTime = slot.toISOString();
  byId("question-time").textContent = dateFormat.format(slot);
  if (current.next && !linked) {
    refreshTimer = setTimeout(() => {
      render();
      void refreshCatalogue();
    }, Math.max(50, current.next - now));
  }
}

byId("open-settings").onclick = () => {
  if (native) prefs = JSON.parse(native.preferences());
  byId("show-translation").checked = prefs.translation;
  byId("reminders").checked = prefs.enabled;
  byId("interval").value = prefs.interval;
  byId("start").value = prefs.start;
  byId("end").value = prefs.end;
  byId("settings-status").textContent = "";
  settings.showModal();
};
byId("close-settings").onclick = () => settings.close();
byId("preferences").onsubmit = event => {
  event.preventDefault();
  const updated = {
    translation: byId("show-translation").checked, enabled: byId("reminders").checked,
    interval: Number(byId("interval").value), start: byId("start").value, end: byId("end").value,
  };
  if (updated.start >= updated.end) {
    byId("settings-status").textContent = "Giờ kết thúc phải sau giờ bắt đầu trong cùng ngày.";
    return;
  }
  if (native) {
    if (!native.savePreferences(JSON.stringify(updated))) {
      byId("settings-status").textContent = "Không lưu được cài đặt.";
      return;
    }
  } else {
    localStorage.setItem("schedule", JSON.stringify(updated));
  }
  prefs = updated;
  render();
  settings.close();
};

byId("notification-settings").hidden = !native;
byId("android-settings").hidden = !native;
byId("web-settings").hidden = !!native;
byId("test-reminder").onclick = () => native?.testReminder();
window.addEventListener("freetalk-update", render);
window.addEventListener("pageshow", render);
document.addEventListener("visibilitychange", () => {
  if (document.visibilityState === "visible") {
    render();
    void refreshCatalogue();
  }
});
render();
void refreshCatalogue();
if (!native && "serviceWorker" in navigator) {
  navigator.serviceWorker.register("./sw.js").catch(error => console.warn("Không bật được bộ nhớ ngoại tuyến", error));
}
