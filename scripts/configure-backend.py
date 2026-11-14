"""Store the provider key and the hash of a generated admin token without displaying either."""
import hashlib
import json
import os
import re
import secrets
import sys
from pathlib import Path

import boto3

gemini = ""
if sys.argv[1] != "-":
    import urllib.error
    import urllib.request

    candidates = re.findall(r"[A-Za-z0-9_-]{30,150}", Path(sys.argv[1]).read_text(encoding="utf-8-sig"))
    if len(candidates) != 1:
        raise SystemExit("Gemini key file did not contain one recognizable key.")
    gemini = candidates[0]
    request = urllib.request.Request(
        "https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash-lite",
        headers={"x-goog-api-key": gemini})
    try:
        with urllib.request.urlopen(request, timeout=12):
            pass
    except urllib.error.HTTPError as error:
        raise SystemExit(f"Gemini rejected this key (HTTP {error.code}).") from None
target = Path(sys.argv[2])
target.parent.mkdir(parents=True, exist_ok=True)
if not target.exists():
    with target.open("x", encoding="ascii") as output:
        output.write(secrets.token_urlsafe(36) + "\n")
token = target.read_text(encoding="ascii").strip()
if not re.fullmatch(r"[A-Za-z0-9_-]{48}", token):
    raise SystemExit("Invalid local admin token file.")
ssm = boto3.Session(profile_name="aws-starter", region_name="ap-southeast-2").client("ssm")
ssm.put_parameter(Name="/freetalk-japanese/config", Type="SecureString", Tier="Standard", Overwrite=True,
                  Value=json.dumps({"gemini": gemini,
                                    "adminSha256": hashlib.sha256(token.encode()).hexdigest()}))
print("Backend credentials configured.")
