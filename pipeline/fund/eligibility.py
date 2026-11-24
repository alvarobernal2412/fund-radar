"""Eligibility verdicts.

Each condition stated by the funder is stored as its own item and compared with
the profile: "met", "not_met" or "unclear". The call's verdict follows:

  * not_eligible  at least one condition is clearly not met;
  * check         otherwise, at least one is unclear, or none could be extracted;
  * eligible      every condition is met.

Mirrored in site/src/js/00-core.js (verdictOf).
"""
from __future__ import annotations

from datetime import date
from typing import Iterable, Mapping

MARKS = ("met", "not_met", "unclear")
VERDICTS = ("eligible", "check", "not_eligible")


def verdict(conditions: Iterable[Mapping] | None) -> str:
    marks = [str(c.get("mark") or "unclear") for c in (conditions or [])]
    if not marks:
        return "check"
    if any(m == "not_met" for m in marks):
        return "not_eligible"
    if all(m == "met" for m in marks):
        return "eligible"
    return "check"


def years_since(day: str | None, on: date | None = None) -> float | None:
    """Years between an ISO date (or year-month, or year) and `on`, to one decimal."""
    if not day:
        return None
    on = on or date.today()
    s = str(day)
    try:
        if len(s) == 4:
            d = date(int(s), 7, 1)
        elif len(s) == 7:
            d = date(int(s[:4]), int(s[5:7]), 15)
        else:
            d = date.fromisoformat(s[:10])
    except ValueError:
        return None
    return round((on - d).days / 365.25, 1)


def phd_window(phd_date: str | None, min_years: float | None, max_years: float | None, on: date | None = None, career_breaks_months: int = 0) -> str:
    """Mark a "PhD obtained between X and Y years ago" condition.

    Career breaks the user declared (parental leave, illness, care) extend the
    window, as most funders allow; the funder's own rules still decide.
    """
    y = years_since(phd_date, on)
    if y is None:
        return "unclear"
    y -= (career_breaks_months or 0) / 12
    if min_years is not None and y < min_years:
        return "not_met"
    if max_years is not None and y > max_years:
        return "not_met"
    return "met"
