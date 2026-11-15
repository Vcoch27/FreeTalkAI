"""Publish the bundled 85 life and 15 work questions through the admin API."""
import json
import urllib.error
import urllib.request
from pathlib import Path

root = Path(__file__).resolve().parents[1]
token = (root / ".env.admin-token").read_text().strip()
config = (root / "web/backend-config.js").read_text(encoding="utf-8")
api = json.loads(config.split(" = ", 1)[1].strip().rstrip(";"))


def request(path, method="GET", data=None):
    request = urllib.request.Request(
        api + path, data=json.dumps(data, ensure_ascii=False).encode() if data else None,
        headers={"Authorization": "Bearer " + token, "Content-Type": "application/json"},
        method=method,
    )
    try:
        with urllib.request.urlopen(request, timeout=25) as response:
            return json.load(response)
    except urllib.error.HTTPError as error:
        raise SystemExit(f"HTTP {error.code}: {json.load(error).get('error', 'AWS request failed')}") from None


source = (root / "web/questions.js").read_text(encoding="utf-8")
questions = json.loads(source.split(" = ", 1)[1].strip().rstrip(";"))
assert len(questions) == 100 and sum(row["topic"] == "work" for row in questions) == 15
catalogue = request("/admin/catalogue")
print(request("/admin/question", "PUT", {"action": "import", "seed": True, "status": "published",
                                        "revision": catalogue["revision"], "questions": questions}))
