"""Source packs: which sources a radar scans, given its scope.

packs/eu.json            European programmes (on when the scope includes the EU)
packs/community.json     community channels (on when the user picks them)
packs/countries/<cc>.json one per country: national funders + main universities

A university is scanned for internal funds only when the user marked it as a
home institution; target institutions matter for host conditions and, later,
for positions.
"""
from __future__ import annotations

import json
from pathlib import Path
from typing import Mapping

PACKS = Path(__file__).resolve().parents[2] / "packs"


def load_packs(root: Path = PACKS) -> dict:
    """{"eu": {...}, "community": {...}, "countries": {"ch": {...}, ...}}; files starting with _ are templates."""
    out: dict = {"countries": {}}
    for name in ("eu", "community"):
        p = root / f"{name}.json"
        if p.exists():
            out[name] = json.loads(p.read_text(encoding="utf-8"))
    for p in sorted((root / "countries").glob("*.json")):
        if not p.name.startswith("_"):
            pack = json.loads(p.read_text(encoding="utf-8"))
            out["countries"][pack["id"]] = pack
    return out


def _on(src: Mapping, overrides: Mapping) -> bool:
    v = overrides.get(src["id"])
    return v if isinstance(v, bool) else bool(src.get("default", True))


def active_sources(config: Mapping, packs: Mapping | None = None) -> list[dict]:
    """The sources one scan should read, in order: EU, national, home institutions, communities."""
    packs = packs if packs is not None else load_packs()
    over = config.get("sources") or {}
    out: list[dict] = []
    if config.get("includeEU", True) and "eu" in packs:
        out += [dict(s, pack="eu") for s in packs["eu"]["sources"] if _on(s, over)]
    countries = [c.lower() for c in config.get("countries") or []]
    for cc in countries:
        pack = packs["countries"].get(cc)
        if pack:
            out += [dict(s, pack=cc) for s in pack["sources"] if _on(s, over)]
    chosen = {i.get("id"): i for i in config.get("institutions") or []}
    for cc in countries:
        pack = packs["countries"].get(cc) or {}
        for inst in pack.get("institutions") or []:
            pick = chosen.get(inst["id"])
            if pick and pick.get("role") == "home":
                url = pick.get("fundingUrl") or inst.get("fundingUrl")
                out.append({"id": "inst-" + inst["id"], "label": inst["name"] + " (internal funds)", "url": url or inst["site"],
                            "discover": not url, "access": "browser", "pack": cc, "institution": inst["id"],
                            "how": "Internal funds open to members of this institution." if url else
                            "Find this institution's research-funding or grants-office page from its site, store it as fundingUrl, then read it."})
    for cid in config.get("communities") or []:
        src = next((s for s in (packs.get("community") or {}).get("sources", []) if s["id"] == cid), None)
        if src:
            out.append(dict(src, pack="community"))
    return out


def missing_countries(config: Mapping, packs: Mapping | None = None) -> list[str]:
    """Countries in the scope that have no pack yet (the scan reports them; docs/new-pack.md explains how to add one)."""
    packs = packs if packs is not None else load_packs()
    return [c for c in config.get("countries") or [] if c.lower() not in packs["countries"]]
