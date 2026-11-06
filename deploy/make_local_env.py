"""Create the shared LegalCompass API key for local development (run once; never overwrites an existing key).

Writes LEGALCOMPASS_API_KEY to backend/.env and the same value as NEXT_PUBLIC_LEGALCOMPASS_API_KEY to web/.env.local.
Both files are git-ignored.   Usage:  python deploy/make_local_env.py
"""
import re
import secrets
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
BACKEND, WEB = ROOT / "backend" / ".env", ROOT / "web" / ".env.local"


def read(path: Path, name: str) -> str:
    if path.exists():
        m = re.search(rf"^{name}=(.+)$", path.read_text(encoding="utf-8"), re.M)
        if m:
            return m.group(1).strip()
    return ""


def append(path: Path, name: str, value: str, comment: str) -> None:
    text = path.read_text(encoding="utf-8") if path.exists() else ""
    if text and not text.endswith("\n"):
        text += "\n"
    path.write_text(f"{text}# {comment}\n{name}={value}\n", encoding="utf-8")


key = read(BACKEND, "LEGALCOMPASS_API_KEY") or "lc_" + secrets.token_urlsafe(32)
if not read(BACKEND, "LEGALCOMPASS_API_KEY"):
    append(BACKEND, "LEGALCOMPASS_API_KEY", key, "Shared public LegalCompass API key (local only, git-ignored)")
web_key = read(WEB, "NEXT_PUBLIC_LEGALCOMPASS_API_KEY")
if not web_key:
    append(WEB, "NEXT_PUBLIC_LEGALCOMPASS_API_KEY", key, "Must equal LEGALCOMPASS_API_KEY in backend/.env")
elif web_key != key:
    print("WARNING: web/.env.local has a different key from backend/.env - the website will get 401 errors.")
print(f"LEGALCOMPASS_API_KEY={key}")
