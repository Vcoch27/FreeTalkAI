"""Reuse the Android/web catalogue and branding in both iOS targets."""
import json
import shutil
import subprocess
from pathlib import Path

ios = Path(__file__).resolve().parent
root = ios.parent
generated = ios / "Generated"
generated.mkdir(exist_ok=True)
source = (root / "web/questions.js").read_text(encoding="utf-8")
questions = json.loads(source.split(" = ", 1)[1].strip().removesuffix(";"))
if len(questions) != 100 or len({question["id"] for question in questions}) != 100:
    raise ValueError("Expected 100 unique bilingual seed questions")
(generated / "questions.json").write_text(json.dumps(questions, ensure_ascii=False), encoding="utf-8")
client = generated / "Client"
client.mkdir(exist_ok=True)
for name in ("index.html", "app.js", "style.css", "icon-192.png", "backend-config.js"):
    shutil.copyfile(root / "web" / name, client / name)
config = (root / "web/backend-config.js").read_text(encoding="utf-8")
(generated / "backend-url.txt").write_text(json.loads(config.split(" = ", 1)[1].strip().removesuffix(";")), encoding="utf-8")
shutil.copyfile(root / "android/src/main/res/raw/lets_talk.wav", generated / "lets_talk.wav")
icon_dir = ios / "App/Assets.xcassets/AppIcon.appiconset"
icon_dir.mkdir(parents=True, exist_ok=True)
subprocess.run(["sips", "-z", "1024", "1024", str(root / "web/icon-512.png"),
                "--out", str(icon_dir / "AppIcon.png")], check=True)
(icon_dir / "Contents.json").write_text(json.dumps({
    "images": [{"filename": "AppIcon.png", "idiom": "universal", "platform": "ios", "size": "1024x1024"}],
    "info": {"author": "xcode", "version": 1},
}), encoding="utf-8")
(icon_dir.parent / "Contents.json").write_text(
    json.dumps({"info": {"author": "xcode", "version": 1}}), encoding="utf-8")
