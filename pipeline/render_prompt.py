#!/usr/bin/env python3
"""Render the weekly scan prompt for one deployment.

    python pipeline/render_prompt.py                       # reads config/site.json
    python pipeline/render_prompt.py --artifact-url URL    # or pass it directly

The output is the scheduled task's prompt. It embeds the source packs from
packs/, so re-render it (and update the task) whenever a pack changes. It holds
no personal data: the scope and the profile stay in the artifact's database.
"""
from __future__ import annotations

import argparse
import json
import sys
from pathlib import Path

REPO = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(REPO / "pipeline"))

from fund.packs import load_packs  # noqa: E402


def packs_json() -> str:
    """The packs as compact JSON, minus the explanatory comments."""
    def strip(x):
        if isinstance(x, dict):
            return {k: strip(v) for k, v in x.items() if not k.startswith("_")}
        if isinstance(x, list):
            return [strip(v) for v in x]
        return x
    return json.dumps(strip(load_packs()), ensure_ascii=False, separators=(",", ":"))


def render(artifact_url: str) -> str:
    text = (REPO / "pipeline" / "scan-prompt.md").read_text(encoding="utf-8")
    return text.replace("{{ARTIFACT_URL}}", artifact_url).replace("{{PACKS}}", packs_json())


def main() -> None:
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("--artifact-url")
    ap.add_argument("--config", type=Path, default=REPO / "config" / "site.json")
    args = ap.parse_args()
    cfg = json.loads(args.config.read_text(encoding="utf-8")) if args.config.exists() else {}
    url = args.artifact_url or cfg.get("artifactUrl")
    if not url or "<id>" in url:
        raise SystemExit("Pass --artifact-url or set artifactUrl in config/site.json")
    # The prompt contains non-ASCII characters; a Windows console would otherwise encode it as cp1252 and fail.
    sys.stdout.reconfigure(encoding="utf-8")
    print(render(url))


if __name__ == "__main__":
    main()
