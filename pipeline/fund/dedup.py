"""Duplicate detection and stable ids for call records.

The same call often appears on the funder's site and on several aggregators
(EURAXESS, Euresearch, a university's funding database). Records are matched on
  1. the call's own identifier when the funder gives one (e.g. an EU topic id), then
  2. the normalised funder + title + year of the first deadline,
and merged into one record whose provenance lists every source. The funder's
own page stays the main link.
"""
from __future__ import annotations

import re
import unicodedata
from typing import Iterable

_PUNCT = re.compile(r"[^a-z0-9]+")
# Words that vary between listings of the same call and say nothing about it.
_NOISE = {"call", "for", "proposals", "the", "a", "an", "of", "and", "programme", "program", "scheme", "grant", "grants"}


def fold(text: str | None) -> str:
    """Lower-case, strip accents and punctuation, collapse spaces."""
    t = unicodedata.normalize("NFD", text or "")
    t = "".join(c for c in t if unicodedata.category(c) != "Mn").lower()
    return _PUNCT.sub(" ", t).strip()


def _core(text: str | None) -> str:
    return " ".join(w for w in fold(text).split() if w not in _NOISE)


def _year(rec: dict) -> str:
    dates = sorted(str(d.get("date"))[:4] for d in rec.get("deadlines") or [] if d.get("date"))
    return dates[0] if dates else ""


def keys(rec: dict) -> list[str]:
    out = []
    ref = fold(rec.get("reference"))
    if ref:
        out.append("ref:" + ref)
    title = _core(rec.get("title"))
    if title:
        out.append(f"t:{_core(rec.get('funder'))}|{title}|{_year(rec)}")
    return out


def call_id(rec: dict) -> str:
    """Stable document id: the funder's reference, else funder + title + year (max 80 chars)."""
    base = rec.get("reference") or f"{rec.get('funder') or ''} {rec.get('title') or ''} {_year(rec)}"
    return _PUNCT.sub("-", fold(base)).strip("-")[:80].rstrip("-")


def merge(a: dict, b: dict) -> dict:
    """Merge b into a: keep a's values, fill gaps from b, union the sources.

    A record read from the funder's own page wins over one read from an aggregator.
    """
    if (b.get("provenance") or {}).get("fromFunder") and not (a.get("provenance") or {}).get("fromFunder"):
        a, b = b, a
    out = dict(a)
    for k, v in b.items():
        if k == "provenance":
            pa, pb = dict(a.get("provenance") or {}), v or {}
            pa["foundIn"] = list(dict.fromkeys([*(pa.get("foundIn") or []), *(pb.get("foundIn") or [])]))
            pa["firstSeen"] = min(x for x in [pa.get("firstSeen"), pb.get("firstSeen")] if x) if (pa.get("firstSeen") or pb.get("firstSeen")) else None
            pa["fromFunder"] = bool(pa.get("fromFunder") or pb.get("fromFunder"))
            out["provenance"] = pa
        elif out.get(k) in (None, "", [], {}) and v not in (None, "", [], {}):
            out[k] = v
    return out


def dedupe(records: Iterable[dict]) -> list[dict]:
    merged: list[dict] = []
    index: dict[str, int] = {}
    for rec in records:
        hit = next((index[k] for k in keys(rec) if k in index), None)
        if hit is None:
            merged.append(dict(rec))
            hit = len(merged) - 1
        else:
            merged[hit] = merge(merged[hit], rec)
        for k in keys(merged[hit]):
            index[k] = hit
    return merged
