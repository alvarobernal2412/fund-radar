#!/usr/bin/env python3
"""Assemble the site sources into one self-contained HTML page.

Copied from Research Radar. The Claude artifact host serves a single HTML
page, so the sources under site/src are concatenated in a fixed order:

  * styles/main.css first, then every other stylesheet alphabetically;
  * js/*.js alphabetically (the numeric prefixes set the order), wrapped in
    one strict-mode IIFE so the parts share a scope without leaking globals;
  * external libraries listed in site/vendor.json become <script src> tags,
    or are loaded on demand ("lazy");
  * the source packs under packs/ are embedded, so the Settings page can list
    each country's universities and sources.

Usage:
  python site/build.py                  # uses config/site.json if present
  python site/build.py --title "My Fund Radar"
  python site/build.py --check          # also syntax-check the JS with node
  python site/build.py --static export.json   # read-only snapshot page (calls only, no profile)

Standard library only.
"""
from __future__ import annotations

import argparse
import json
import shutil
import subprocess
import sys
import tempfile
from pathlib import Path

ROOT = Path(__file__).resolve().parent
REPO = ROOT.parent
SRC = ROOT / "src"
sys.path.insert(0, str(REPO / "pipeline"))

from fund.packs import load_packs  # noqa: E402


def load_config(path: Path | None) -> dict:
    for candidate in [path, REPO / "config" / "site.json", REPO / "config" / "site.example.json"]:
        if candidate and candidate.exists():
            return json.loads(candidate.read_text(encoding="utf-8"))
    return {}


def js_json(value) -> str:
    """JSON safe to inline in a <script>: "</" would end the script early."""
    return json.dumps(value, ensure_ascii=False).replace("</", "<" + chr(92) + "/")


def packs_for_page() -> dict:
    def strip(x):
        if isinstance(x, dict):
            return {k: strip(v) for k, v in x.items() if not k.startswith("_")}
        if isinstance(x, list):
            return [strip(v) for v in x]
        return x
    return strip(load_packs())


def static_docs(export: dict) -> dict:
    """{path: data} for a fund-radar/v1 export. The profile and the marks are left out on purpose."""
    if export.get("format") != "fund-radar/v1":
        raise SystemExit("not a fund-radar/v1 export")
    docs: dict = {}
    for k in ("run", "weights"):
        if export.get(k):
            docs[f"meta/{k}"] = export[k]
    cfg = {a: b for a, b in (export.get("config") or {}).items() if a not in ("triggerId", "institutions")}
    docs["meta/config"] = cfg
    for d in export.get("calls") or []:
        if d.get("id"):
            docs[f"calls/{d['id']}"] = {a: b for a, b in d.items() if a not in ("id", "gaps", "why")}
    return docs


def build(title: str, out: Path, static: dict | None = None) -> Path:
    template = (SRC / "index.html").read_text(encoding="utf-8")
    css_files = sorted((SRC / "styles").glob("*.css"), key=lambda p: (p.name != "main.css", p.name))
    styles = "\n".join(p.read_text(encoding="utf-8").rstrip() for p in css_files)
    js_files = sorted((SRC / "js").glob("*.js"))
    scripts = "\n\n".join(f"/* ===== {p.name} ===== */\n" + p.read_text(encoding="utf-8").rstrip() for p in js_files)
    vendor = json.loads((ROOT / "vendor.json").read_text(encoding="utf-8"))
    vendor_tags = "\n".join(f'<script src="{v["url"]}"></script>' for v in vendor.get("eager", []))
    for placeholder, value in (("/*@VENDOR_LAZY@*/{}", js_json({v["name"]: v["url"] for v in vendor.get("lazy", [])})),
                               ("/*@PACKS@*/{}", js_json(packs_for_page()))):
        if placeholder not in scripts:
            raise SystemExit(f"{placeholder} placeholder missing from the scripts")
        scripts = scripts.replace(placeholder, value)
    if static is not None:
        shim = (ROOT / "static-shim.js").read_text(encoding="utf-8")
        nl = chr(10)
        vendor_tags = f"<script>window.__FUND_DOCS__={js_json(static_docs(static))};</script>{nl}<script>{nl}{shim}{nl}</script>{nl}" + vendor_tags
    html = (
        template.replace("{{TITLE}}", title)
        .replace("{{STYLES}}", styles)
        .replace("{{VENDOR_SCRIPTS}}", vendor_tags)
        .replace("{{SCRIPTS}}", scripts)
    )
    if "{{" in html.split("<script>")[0]:
        raise SystemExit("Unreplaced placeholder in the page head")
    out.parent.mkdir(parents=True, exist_ok=True)
    out.write_text(html, encoding="utf-8")
    return out


def check(out: Path) -> None:
    node = shutil.which("node")
    if not node:
        print("node not found; skipping syntax check", file=sys.stderr)
        return
    html = out.read_text(encoding="utf-8")
    inline = html.rsplit("<script>", 1)[1].split("</script>", 1)[0]
    with tempfile.NamedTemporaryFile("w", suffix=".js", delete=False, encoding="utf-8") as fh:
        fh.write(inline)
    res = subprocess.run([node, "--check", fh.name], capture_output=True, text=True)
    Path(fh.name).unlink(missing_ok=True)
    if res.returncode:
        sys.stderr.write(res.stderr)
        raise SystemExit("JavaScript syntax check failed")
    print("JavaScript syntax OK")


def main() -> None:
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("--config", type=Path, help="site config JSON (default: config/site.json)")
    ap.add_argument("--title", help="page title (overrides the config)")
    ap.add_argument("--out", type=Path, help="output file (default: dist/<outFile>)")
    ap.add_argument("--static", type=Path, metavar="EXPORT", help="build a read-only snapshot page from a fund-radar/v1 export (default output: dist/pages/index.html)")
    ap.add_argument("--check", action="store_true", help="syntax-check the assembled JavaScript with node")
    args = ap.parse_args()
    cfg = load_config(args.config)
    title = args.title or cfg.get("title") or "Fund Radar"
    static = json.loads(args.static.read_text(encoding="utf-8")) if args.static else None
    out = args.out or (REPO / "dist" / "pages" / "index.html" if static else REPO / "dist" / (cfg.get("outFile") or "fund-radar.html"))
    path = build(title, out, static)
    print(f"Built {path.relative_to(REPO) if path.is_relative_to(REPO) else path} ({path.stat().st_size // 1024} KB)")
    if args.check:
        check(path)


if __name__ == "__main__":
    main()
