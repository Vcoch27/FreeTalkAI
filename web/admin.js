const byId = id => document.getElementById(id);
const labels = {everyday:"Đời sống", roleplay:"Nhập vai", debate:"Nêu quan điểm", brainstorm:"Brainstorming",
  what_if:"Giả định", storytelling:"Kể chuyện", reflection:"Nhìn lại", creative_problem_solving:"Giải quyết vấn đề"};
const statusLabels = {draft:"Bản nháp", published:"Đã xuất bản", hidden:"Đã ẩn"};
let token = "";
let revision = 0;
let questions = [];
let editing = null;
for (const [value, title] of Object.entries(labels)) byId("mode").add(new Option(title, value));

async function api(path, method = "GET", body) {
  const response = await fetch(globalThis.FREETALK_API + "/admin/" + path, {
    method,
    headers: {Authorization:"Bearer " + token, ...(body && {"Content-Type":"application/json"})},
    body: body && JSON.stringify(body),
  });
  const result = await response.json();
  if (!response.ok) throw new Error(result.error || "Yêu cầu chưa hoàn tất.");
  return result;
}

function render() {
  const filter = byId("filter").value;
  const rows = questions.filter(row => !filter || row.status === filter).slice().reverse();
  byId("rows").replaceChildren();
  byId("publish-drafts").hidden = !questions.some(row => row.status === "draft");
  if (!rows.length) byId("rows").textContent = "Chưa có câu nào.";
  for (const row of rows) {
    const item = document.createElement("div");
    item.className = "row";
    const content = document.createElement("div");
    for (const [text, lang] of [[row.ja, "ja"], [row.vi, "vi"], [statusLabels[row.status] + " · " + (row.topic === "work" ? "Công việc" : "Đời sống") + " · " + labels[row.mode], "vi"]]) {
      const paragraph = document.createElement("p");
      paragraph.lang = lang;
      paragraph.textContent = text;
      if (content.children.length === 2) paragraph.className = "muted";
      content.append(paragraph);
    }
    const edit = document.createElement("button");
    edit.textContent = "Sửa";
    edit.onclick = () => openEditor(row);
    item.append(content, edit);
    byId("rows").append(item);
  }
}

async function refresh() {
  const catalogue = await api("catalogue");
  revision = catalogue.revision;
  questions = catalogue.questions;
  byId("rotation-topic").value = catalogue.rotation?.topic || "all";
  byId("rotation-order").value = catalogue.rotation?.order || "ordered";
  render();
}

function openEditor(row) {
  editing = row?.id || null;
  for (const field of ["mode", "topic", "ja", "vi", "status"]) {
    byId(field).value = row?.[field] || ({mode:"everyday", topic:"life", status:"draft"}[field] || "");
  }
  byId("position-label").hidden = !row;
  byId("position").hidden = !row;
  byId("position").max = questions.length;
  byId("position").value = row ? questions.findIndex(item => item.id === row.id) + 1 : "";
  byId("editor-message").textContent = "";
  byId("editor").showModal();
}

async function submit(event, messageId, action) {
  event.preventDefault();
  const button = event.submitter;
  button.disabled = true;
  byId(messageId).textContent = "";
  try {
    await action();
  } catch (error) {
    byId(messageId).textContent = error.message;
  } finally {
    button.disabled = false;
  }
}

byId("login").onsubmit = event => submit(event, "message", async () => {
  token = byId("access").value.trim();
  try { await refresh(); } catch (error) { token = ""; throw error; }
  byId("access").value = "";
  byId("login").hidden = true;
  byId("workspace").hidden = false;
  byId("logout").hidden = false;
});
byId("logout").onclick = () => location.reload();
byId("filter").onchange = render;
byId("add").onclick = () => openEditor();
byId("close").onclick = () => byId("editor").close();
const basePrompt = `Hãy tạo 10 tình huống ngắn để người Việt luyện phản xạ nói tiếng Nhật ở mức N3–N2. Ưu tiên tình huống đời sống cụ thể, tự nhiên. Mỗi tình huống có một câu hỏi mở và bản dịch tiếng Việt sát nghĩa. Đổi bối cảnh, cách hỏi và cách người học cần phản hồi giữa các câu.

Chỉ trả về mảng JSON hợp lệ, không dùng Markdown. Mỗi phần tử có dạng {"mode":"roleplay","topic":"life","ja":"電車が遅れています。友達にどう伝えますか？","vi":"Tàu bị trễ. Bạn báo với bạn mình thế nào?"}.
topic: life (đời sống) hoặc work (công việc).
mode: everyday, roleplay, debate, brainstorm, what_if, storytelling, reflection hoặc creative_problem_solving.
ja: tối đa 100 ký tự. vi: tối đa 180 ký tự. Không kèm đáp án và không lặp lại ví dụ. Mỗi lô tối đa 100 câu.`;

function updatePrompt() {
  const extra = byId("extra-prompt").value.trim();
  byId("prompt-preview").value = extra ? basePrompt + "\n\nYêu cầu bổ sung:\n" + extra : basePrompt;
}
byId("extra-prompt").value = localStorage.getItem("admin-prompt-extra") || "";
updatePrompt();
byId("extra-prompt").oninput = () => {
  localStorage.setItem("admin-prompt-extra", byId("extra-prompt").value);
  updatePrompt();
};
byId("copy-prompt").onclick = async () => {
  const preview = byId("prompt-preview");
  try {
    await navigator.clipboard.writeText(preview.value);
    byId("message").textContent = "Đã sao chép prompt.";
  } catch {
    preview.focus();
    preview.select();
    byId("message").textContent = "Nhấn Ctrl+C để sao chép prompt.";
  }
};
byId("import").onsubmit = event => submit(event, "message", async () => {
  let rows;
  try {
    const input = byId("import-data").value.trim().replace(/^```(?:json)?\s*|\s*```$/gi, "");
    rows = JSON.parse(input);
  } catch {
    throw new Error("JSON không hợp lệ. Hãy dán mảng câu do AI trả về.");
  }
  if (!Array.isArray(rows)) throw new Error("Hãy dán một mảng JSON.");
  const result = await api("question", "PUT", {action:"import", revision, questions:rows});
  await refresh();
  byId("filter").value = "draft";
  render();
  byId("import-data").value = "";
  byId("message").textContent = `Đã nhập ${result.count} bản nháp. Bỏ qua ${result.duplicates} câu trùng.`;
});
byId("rotation").onsubmit = event => submit(event, "message", async () => {
  await api("question", "PUT", {action:"rotation", revision, topic:byId("rotation-topic").value, order:byId("rotation-order").value});
  await refresh();
  byId("message").textContent = "Đã lưu cách phát. App dùng cấu hình mới sau lần đồng bộ.";
});
byId("publish-drafts").onclick = async () => {
  const count = questions.filter(row => row.status === "draft").length;
  if (!window.confirm(`Xuất bản toàn bộ ${count} bản nháp trong kho?`)) return;
  const button = byId("publish-drafts");
  button.disabled = true;
  try {
    const result = await api("question", "PUT", {action:"publish_drafts", revision});
    await refresh();
    byId("filter").value = "";
    render();
    byId("message").textContent = `Đã xuất bản ${result.count} câu.`;
  } catch (error) {
    byId("message").textContent = error.message;
  } finally { button.disabled = false; }
};
byId("question").onsubmit = event => submit(event, "editor-message", async () => {
  const data = {id:editing, revision};
  if (editing && byId("position").value) data.position = Number(byId("position").value);
  for (const field of ["mode", "topic", "ja", "vi", "status"]) data[field] = byId(field).value;
  await api("question","PUT",data);
  await refresh();
  byId("editor").close();
  byId("message").textContent = "Đã lưu câu.";
});
