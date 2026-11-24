import json
from datetime import date
from pathlib import Path

from fund.dedup import call_id, dedupe, fold
from fund.eligibility import phd_window, verdict, years_since
from fund.packs import active_sources, load_packs, missing_countries
from fund.schedule import assign_slot, cron_expression, schedule_text
from fund.scoring import affinity, call_status, days_left, next_deadline, normalize_weights, too_close
from render_prompt import render

FIX = Path(__file__).parent / "fixtures"
TODAY = date(2026, 11, 24)


# ---------- scoring ----------

def test_weights_are_normalised_and_fall_back_to_defaults():
    assert normalize_weights({"topical": 2, "skills": 1, "practical": 1}) == {"topical": 0.5, "skills": 0.25, "practical": 0.25}
    assert normalize_weights({"topical": 0, "skills": 0, "practical": 0}) == {"topical": 0.5, "skills": 0.3, "practical": 0.2}
    assert normalize_weights(None)["topical"] == 0.5


def test_affinity_combines_components_and_caps_feedback():
    s = {"topical": 80, "skills": 60, "practical": 50}
    assert affinity(s) == 68  # 0.5*80 + 0.3*60 + 0.2*50
    assert affinity(s, {"topical": 1, "skills": 0, "practical": 0}) == 80
    assert affinity(s, adjust=25) == 78  # adjustment capped at +10
    assert affinity({"topical": 80}) is None  # not fully scored yet


def test_next_deadline_skips_past_dates_and_knows_rolling_calls():
    c = {"deadlines": [{"stage": "pre-proposal", "date": "2026-10-01"}, {"stage": "full", "date": "2027-02-01"}]}
    assert next_deadline(c, TODAY) == {"date": "2027-02-01", "stage": "full"}
    assert days_left(c, TODAY) == 69
    assert next_deadline({"deadlines": [{"date": "2026-01-01"}]}, TODAY) is None
    assert next_deadline({"deadlines": [], "rolling": True}, TODAY) == {"date": None, "stage": "rolling"}


def test_too_close_uses_preparation_time_per_type():
    soon = {"type": "fellowship", "deadlines": [{"date": "2026-12-20"}]}  # 26 days
    assert too_close(soon, today=TODAY) is True  # 8 weeks by default
    assert too_close(dict(soon, type="networking"), today=TODAY) is False  # 2 weeks
    assert too_close(soon, {"fellowship": 3}, TODAY) is False


def test_call_status():
    c = {"deadlines": [{"date": "2027-01-10"}], "eligibility": [{"text": "PhD", "mark": "met"}]}
    assert call_status(c, None, TODAY) == "new"
    assert call_status(c, dict(c), TODAY) == "open"
    assert call_status(c, dict(c, deadlines=[{"date": "2027-01-03"}]), TODAY) == "changed"
    assert call_status({"deadlines": [{"date": "2026-01-01"}]}, None, TODAY) == "closed"


# ---------- eligibility ----------

def test_verdict_rules():
    assert verdict([{"mark": "met"}, {"mark": "met"}]) == "eligible"
    assert verdict([{"mark": "met"}, {"mark": "unclear"}]) == "check"
    assert verdict([{"mark": "unclear"}, {"mark": "not_met"}]) == "not_eligible"
    assert verdict([]) == "check"  # nothing extracted is never "eligible"


def test_phd_window_with_partial_dates_and_career_breaks():
    assert years_since("2022-11-24", TODAY) == 4.0
    assert phd_window("2022", 2, 5, TODAY) == "met"
    assert phd_window("2020-06", 0, 6, TODAY) == "not_met"  # 6.4 years
    assert phd_window("2020-06", 0, 6, TODAY, career_breaks_months=12) == "met"  # 5.4 years after a 12-month break
    assert phd_window(None, 0, 4, TODAY) == "unclear"
    assert phd_window("2026-06", 1, None, TODAY) == "not_met"


# ---------- dedup ----------

def test_call_id_is_stable_and_short():
    assert call_id({"reference": "HORIZON-MSCA-2026-PF-01-01"}) == "horizon-msca-2026-pf-01-01"
    rec = {"funder": "Swiss National Science Foundation", "title": "Project Funding", "deadlines": [{"date": "2027-04-01"}]}
    assert call_id(rec) == "swiss-national-science-foundation-project-funding-2027"
    assert len(call_id({"funder": "x" * 100, "title": "y"})) <= 80


def test_dedupe_merges_aggregator_and_funder_copies():
    funder = {"funder": "SNSF", "title": "Project Funding", "deadlines": [{"date": "2027-04-01"}], "links": {"call": "https://snf.ch/pf"},
              "provenance": {"foundIn": ["SNSF"], "fromFunder": True, "firstSeen": "2026-11-24"}}
    agg = {"funder": "snsf", "title": "Call for proposals: Project funding", "deadlines": [{"date": "2027-04-01"}], "links": {"call": "https://agg.example/pf"},
           "summary": "From the aggregator", "provenance": {"foundIn": ["EURAXESS"], "firstSeen": "2026-11-17"}}
    other = {"funder": "SNSF", "title": "Project Funding", "deadlines": [{"date": "2028-04-01"}], "provenance": {"foundIn": ["SNSF"]}}
    out = dedupe([agg, funder, other])
    assert len(out) == 2
    m = out[0]
    assert m["links"]["call"] == "https://snf.ch/pf"  # the funder's page wins
    assert m["summary"] == "From the aggregator"  # gaps filled from the other copy
    assert m["provenance"]["foundIn"] == ["SNSF", "EURAXESS"] and m["provenance"]["firstSeen"] == "2026-11-17"


def test_fold():
    assert fold("Université de Genève!") == "universite de geneve"


# ---------- packs ----------

def test_packs_load_and_skip_templates():
    p = load_packs()
    assert "ch" in p["countries"] and "xx" not in p["countries"]
    names = {i["name"] for i in p["countries"]["ch"]["institutions"]}
    assert {"ETH Zurich", "EPFL", "University of Zurich", "ZHAW Zurich University of Applied Sciences"} <= names


def test_every_pack_source_and_institution_is_well_formed():
    p = load_packs()
    srcs = p["eu"]["sources"] + p["community"]["sources"] + [s for c in p["countries"].values() for s in c["sources"]]
    ids = [s["id"] for s in srcs]
    assert len(ids) == len(set(ids)), "source ids must be unique across packs"
    for s in srcs:
        assert s["url"].startswith("https://") and s["how"] and s["types"]
    for c in p["countries"].values():
        for i in c["institutions"]:
            assert i["site"].startswith("https://") and (i["fundingUrl"] is None or i["fundingUrl"].startswith("https://"))


def test_active_sources_follow_the_scope():
    cfg = {"countries": ["CH"], "includeEU": True, "communities": ["ieee-tfpm"],
           "institutions": [{"id": "unisg", "role": "home"}, {"id": "ethz", "role": "target"}, {"id": "epfl", "role": "home"}],
           "sources": {"ch-swissuniversities": True, "euraxess-funding": False}}
    ids = [s["id"] for s in active_sources(cfg)]
    assert ids[0] == "eu-ftop" and "euraxess-funding" not in ids
    assert "ch-snsf" in ids and "ch-swissuniversities" in ids  # override turns a default-off source on
    assert "inst-unisg" in ids and "inst-epfl" in ids and "inst-ethz" not in ids  # target institutions are not scanned for internal funds
    epfl = next(s for s in active_sources(cfg) if s["id"] == "inst-epfl")
    assert epfl["discover"] is True  # no funding page known yet: the scan finds it
    assert ids[-1] == "ieee-tfpm"
    assert [s["id"] for s in active_sources({"countries": [], "includeEU": False})] == []


def test_missing_countries_are_reported():
    assert missing_countries({"countries": ["CH", "DE"]}) == ["DE"]


# ---------- schedule (copied from Research Radar) ----------

def test_schedule_avoids_research_radar_days():
    day, time = assign_slot([{"weekday": 6, "time": "09:00"}])
    assert day == 2 and time == "09:00"
    assert schedule_text(2, "09:00") == "Wednesdays at 09:00"
    assert cron_expression(2, "08:49") == "49 8 * * 3"


# ---------- prompt ----------

def test_scan_prompt_renders_with_url_and_packs():
    text = render("https://claude.ai/artifact/abc")
    assert "https://claude.ai/artifact/abc" in text and "{{" not in text
    assert '"ch-snsf"' in text and '"_comment"' not in text  # packs are embedded, without their comments
    assert '"xx-funder"' not in text  # the template pack is left out


# ---------- fixtures ----------

def test_fixture_calls_follow_the_rules():
    calls = json.loads((FIX / "calls.sample.json").read_text(encoding="utf-8"))
    assert len(calls) >= 8
    for c in calls:
        assert c["verdict"] == verdict(c["eligibility"]), c["title"]
        assert set(c["scores"]) >= {"topical", "skills", "practical"}
