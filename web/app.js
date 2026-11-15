const byId = id => document.getElementById(id);
const native = globalThis.FreeTalkAndroid || globalThis.FreeTalkIOS;
const settings = byId("settings");
const hints = byId("suggestions");
const defaults = { translation: true, enabled: false, interval: 120, start: "08:00", end: "22:00" };
const labels = {
  roleplay: "Nhập vai", brainstorm: "Brainstorming", storytelling: "Kể chuyện", everyday: "Đời sống",
  debate: "Nêu quan điểm", what_if: "Giả định", reflection: "Nhìn lại", creative_problem_solving: "Giải quyết vấn đề",
};
const dateFormat = new Intl.DateTimeFormat("vi-VN", {
  hour: "2-digit", minute: "2-digit", hourCycle: "h23", day: "2-digit", month: "2-digit", year: "numeric",
});
const cacheKey = "freetalk-shared-schedule-v1";
let feed = null;
let prefs = { ...defaults, translation: native || localStorage.getItem("translation") !== "false" };
let current = null;
let timer;
let requestPending = false;

function parsed(json, fallback) {
  try { return JSON.parse(json) ?? fallback; } catch { return fallback; }
}

async function sync() {
  if (native || requestPending || !globalThis.FREETALK_API) return;
  requestPending = true;
  try {
    const response = await fetch(globalThis.FREETALK_API + "/v1/schedule", { signal: AbortSignal.timeout(5000) });
    if (!response.ok) return;
    const data = await response.json();
    if (!Array.isArray(data.entries) || !data.entries.length || !Number.isFinite(Date.parse(data.validUntil))) return;
    feed = data;
    localStorage.setItem(cacheKey, JSON.stringify(feed));
  } catch {
    // A successfully fetched timeline is usable until its last confirmed boundary.
  } finally {
    requestPending = false;
    render();
  }
}

function render() {
  clearTimeout(timer);
  const now = Date.now();
  if (native) {
    prefs = { ...defaults, ...parsed(native.preferences(), {}) };
    feed = parsed(native.discussionSchedule(), null);
  }
  const entries = feed?.entries || [];
  const active = entries.filter(entry => Date.parse(entry.slot) <= now).at(-1);
  const stale = !feed || now >= Date.parse(feed.validUntil);
  const history = native ? parsed(native.linkedAssignment(), null) : null;
  const next = entries.find(entry => Date.parse(entry.slot) > now);
  const entry = history || active;
  byId("back-to-current").hidden = !native?.dismissLinkedAssignment || !history || history.slot === active?.slot;
  if (entry?.slot !== current?.slot || entry?.question.id !== current?.question.id) {
    byId("direction").hidden = true;
  }
  current = entry;
  byId("discussion").hidden = !entry;
  byId("open-suggestions").hidden = !entry;
  byId("schedule-status").textContent = !entry ? "Đang tải tình huống chung. Hãy kết nối mạng để đồng bộ lần đầu."
    : stale && !history ? "Đang hiển thị tình huống đã lưu. Kết nối mạng để cập nhật lịch chung." : "";
  if (entry) {
    byId("category").textContent = labels[entry.question.mode] || "";
    byId("japanese").textContent = entry.question.ja;
    byId("translation").textContent = entry.question.vi;
    byId("translation").hidden = !prefs.translation;
    byId("question-time").dateTime = entry.slot;
    byId("question-time").textContent = dateFormat.format(new Date(entry.slot));
  }
  const nextTime = Math.min(next ? Date.parse(next.slot) : Infinity, now + 15 * 60 * 1000);
  timer = setTimeout(() => {
    render();
    void sync();
  }, Math.max(100, nextTime - now));
}

byId("open-settings").onclick = () => {
  byId("show-translation").checked = prefs.translation;
  byId("reminders").checked = prefs.enabled;
  byId("start").value = prefs.start;
  byId("end").value = prefs.end;
  byId("settings-status").textContent = "";
  settings.showModal();
};
byId("close-settings").onclick = () => settings.close();
byId("preferences").onsubmit = event => {
  event.preventDefault();
  const updated = {...prefs, translation: byId("show-translation").checked, enabled: byId("reminders").checked,
    start: byId("start").value, end: byId("end").value };
  if (native && updated.start >= updated.end) {
    byId("settings-status").textContent = "Giờ kết thúc phải sau giờ bắt đầu trong cùng ngày.";
    return;
  }
  if (native && !native.savePreferences(JSON.stringify(updated))) {
    byId("settings-status").textContent = "Không lưu được cài đặt.";
    return;
  }
  if (!native) localStorage.setItem("translation", String(updated.translation));
  prefs = updated;
  settings.close();
  render();
};

byId("notification-settings").hidden = !native;
byId("device-settings").hidden = !native;
byId("test-reminder").onclick = () => native?.testReminder();
byId("back-to-current").onclick = () => {
  native?.dismissLinkedAssignment?.();
  render();
};
byId("open-suggestions").onclick = () => hints.showModal();
byId("close-suggestions").onclick = () => hints.close();
byId("ideas").onsubmit = event => {
  event.preventDefault();
  if (!current) return;
  const question = current.question;
  const preference = byId("idea-prompt").value.trim().toLocaleLowerCase("vi");
  const [opening, continuation] = feed?.coaching?.[question.mode] || [
    "Chọn một việc bạn sẽ làm và nói lý do.",
    "Hỏi người kia có trải nghiệm nào tương tự, rồi hỏi thêm về một chi tiết họ vừa kể.",
  ];
  const focus = /công việc|đồng nghiệp|lịch sự|khách hàng/.test(preference)
    ? "Đặt mình vào vai người đang trao đổi với đồng nghiệp hoặc khách. Chọn cách mở lời phù hợp với mối quan hệ."
    : /ngắn|đơn giản|mới học|dễ/.test(preference)
      ? "Bắt đầu bằng một ý dễ nói. Sau khi người kia trả lời, hỏi thêm một câu bắt đầu từ điều họ vừa nhắc."
      : /cá nhân|trải nghiệm|bản thân/.test(preference)
        ? "Liên hệ với một việc bạn từng trải qua, rồi chọn một chi tiết cụ thể để kể."
        : "Đặt mình vào tình huống đang hiển thị và chọn ý gần với trải nghiệm của bạn nhất.";
  byId("idea-focus").textContent = focus;
  byId("idea-opening").textContent = opening;
  byId("idea-continue").textContent = continuation;
  byId("direction").hidden = false;
};

window.addEventListener("freetalk-update", render);
window.addEventListener("pageshow", render);
document.addEventListener("visibilitychange", () => {
  if (document.visibilityState === "visible") {
    render();
    void sync();
  }
});
if (!native) feed = parsed(localStorage.getItem(cacheKey), null);
render();
void sync();
if (!native && "serviceWorker" in navigator) navigator.serviceWorker.register("./sw.js").catch(() => {});
