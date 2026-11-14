from pathlib import Path

root = Path(__file__).resolve().parents[1] / "backend"
template = (root / "template.yaml").read_text(encoding="utf-8")
source = (root / "index.py").read_text(encoding="utf-8")
print(template.replace("          # SOURCE FROM backend/index.py",
                       "\n".join("          " + line if line else "" for line in source.splitlines())))
