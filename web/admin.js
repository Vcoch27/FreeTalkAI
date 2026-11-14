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
  if (!rows.length) byId("rows").textContent = "Chưa có câu nào.";
  for (const row of rows) {
    const item = document.createElement("div");
    item.className = "row";
    const content = document.createElement("div");
    for (const [text, lang] of [[row.ja, "ja"], [row.vi, "vi"], [statusLabels[row.status] + " · " + labels[row.mode], "vi"]]) {
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
  const run = catalogue.generation;
  byId("usage").textContent = run.day
    ? "Lượt gần nhất " + run.day + (run.status === "complete" ? " · " + run.count + " câu · " + run.tokens + " token" : "")
    : "Giới hạn một lượt mỗi ngày.";
  render();
}

function openEditor(row) {
  editing = row?.id || null;
  for (const field of ["mode", "ja", "vi", "status"]) {
    byId(field).value = row?.[field] || ({mode:"everyday", status:"draft"}[field] || "");
  }
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
byId("generation").onsubmit = event => submit(event, "message", async () => {
  byId("message").textContent = "Đang sinh câu…";
  const result = await api("generate", "POST", {topic:byId("topic").value.trim()});
  await refresh();
  byId("message").textContent = "Đã lưu " + result.count + " câu nháp.";
});
byId("question").onsubmit = event => submit(event, "editor-message", async () => {
  const data = {id:editing, revision};
  for (const field of ["mode", "ja", "vi", "status"]) data[field] = byId(field).value;
  await api("question","PUT",data);
  await refresh();
  byId("editor").close();
  byId("message").textContent = "Đã lưu câu.";
});
