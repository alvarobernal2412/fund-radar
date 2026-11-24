"""Affinity score and deadline rules for call records.

A call gets two separate judgments: an eligibility verdict (see eligibility.py)
and an affinity score from 0 to 100. The score combines three components, each
scored 0-100 by the scan:

    A = wT * topical + wS * skills + wP * practical   (+ a small feedback adjustment)

The weights are the user's (meta/weights) and always sum to 1. The page
recomputes A from the stored components, so changing the weights re-ranks the
catalogue at once without a new scan. The deadline is never part of the score.
Mirrored in site/src/js/00-core.js (affinity, nextDeadline, tooClose).
"""
from __future__ import annotations

from datetime import date
from typing import Mapping

DEFAULT_WEIGHTS = {"topical": 0.5, "skills": 0.3, "practical": 0.2}
# Calls open to any topic get a neutral topical fit instead of a low one.
OPEN_THEME_TOPICAL = 60
# Feedback (discarding or marking calls) may move a score by at most this much.
MAX_FEEDBACK_ADJUST = 10
# Preparation time per call type, in weeks, before a deadline counts as too close.
DEFAULT_PREP_WEEKS = {"project": 10, "fellowship": 8, "mobility": 6, "networking": 2, "infrastructure": 10, "prize": 3, "other": 4}


def _clamp(v: float, lo: float, hi: float) -> float:
    return max(lo, min(hi, v))


def normalize_weights(w: Mapping | None) -> dict:
    """Non-negative weights that sum to 1; missing or all-zero weights fall back to the defaults."""
    w = dict(w or {})
    vals = {k: max(0.0, float(w.get(k, DEFAULT_WEIGHTS[k]) or 0)) for k in DEFAULT_WEIGHTS}
    total = sum(vals.values())
    if total <= 0:
        return dict(DEFAULT_WEIGHTS)
    return {k: round(v / total, 4) for k, v in vals.items()}


def affinity(scores: Mapping | None, weights: Mapping | None = None, adjust: float = 0) -> int | None:
    """Weighted affinity 0-100, or None when a component is missing (not scored yet)."""
    if not scores:
        return None
    w = normalize_weights(weights)
    parts = []
    for k in DEFAULT_WEIGHTS:
        v = scores.get(k)
        if not isinstance(v, (int, float)):
            return None
        parts.append(w[k] * _clamp(float(v), 0, 100))
    adj = _clamp(float(adjust or 0), -MAX_FEEDBACK_ADJUST, MAX_FEEDBACK_ADJUST)
    return int(round(_clamp(sum(parts) + adj, 0, 100)))


def _iso(d: str | None) -> date | None:
    try:
        return date.fromisoformat(str(d)[:10]) if d else None
    except ValueError:
        return None


def next_deadline(call: Mapping, today: date | None = None) -> dict | None:
    """The earliest deadline on or after today: {"date", "stage"}; None when all have passed or none is stated.

    A rolling call (no fixed date) returns {"date": None, "stage": "rolling"}.
    """
    today = today or date.today()
    best = None
    for d in call.get("deadlines") or []:
        when = _iso(d.get("date"))
        if when and when >= today and (best is None or when < best[0]):
            best = (when, d.get("stage") or "deadline")
    if best:
        return {"date": best[0].isoformat(), "stage": best[1]}
    if call.get("rolling"):
        return {"date": None, "stage": "rolling"}
    return None


def days_left(call: Mapping, today: date | None = None) -> int | None:
    today = today or date.today()
    nd = next_deadline(call, today)
    if not nd or not nd["date"]:
        return None
    return (date.fromisoformat(nd["date"]) - today).days


def too_close(call: Mapping, prep_weeks: Mapping | None = None, today: date | None = None) -> bool:
    """True when the next deadline is nearer than the preparation time set for the call's type."""
    n = days_left(call, today)
    if n is None:
        return False
    weeks = dict(DEFAULT_PREP_WEEKS, **(prep_weeks or {}))
    need = weeks.get(call.get("type") or "other", weeks["other"])
    return n < need * 7


def call_status(call: Mapping, previous: Mapping | None, today: date | None = None) -> str:
    """new (not seen before), changed (deadline or eligibility differ), closed (no future deadline), else open."""
    today = today or date.today()
    if next_deadline(call, today) is None:
        return "closed"
    if previous is None:
        return "new"
    for k in ("deadlines", "eligibility", "amount"):
        if (call.get(k) or None) != (previous.get(k) or None):
            return "changed"
    return "open"
