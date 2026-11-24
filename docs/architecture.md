# Architecture

Fund Radar follows Research Radar's design: the repository is a template, and each installed radar keeps its own data in its own Claude artifact. Nothing a radar collects or learns about its user is committed to the repository.

## Pieces

| Piece | Where it runs | What it does |
|---|---|---|
| Page (`dist/fund-radar.html`) | The viewer's browser, inside Claude's artifact viewer | Shows the catalogue, call details, the profile and the scope; writes the scope, weights, profile, marks and scan requests. It has no network access beyond the CDN scripts. |
| Artifact database | Claude | JSON documents (see `pipeline/schema/fund.schema.json`). Shared documents are readable by everyone the artifact is shared with and writable by Editors. `data/users/<id>/…` is private to each viewer. |
| Scan (scheduled task) | A fresh Claude session on the user's computer, weekly or on Run now | Follows `pipeline/scan-prompt.md`: reads the database, reads the sources through Chrome, extracts and de-duplicates calls, checks eligibility, scores fit, writes, and reports. |
| Source packs (`packs/`) | The repository; embedded into the page and the scan prompt at build time | National funders and main universities per country, European programmes, community channels. |
| Pipeline helpers (`pipeline/fund`) | Tests, and the scan as a reference | Encode the scoring, eligibility, de-duplication, pack and scheduling rules so they can be tested. |

## Documents

- `calls/<id>`: one call record each, written by the scan, never deleted (closed calls stay as records).
- `meta/config`: radar name, schedule, task id, and the scope: countries, European programmes on or off, opportunity types, career stage, institutions with their role (home or target) and funding page, communities, per-source overrides, preparation times.
- `meta/weights`: the affinity weights. The page applies them, so changing them re-ranks the catalogue without a scan.
- `meta/profile`: the user's profile, its revision, when it was confirmed, its inputs (links and file names) and changes proposed by a scan (`pending`).
- `meta/profile-text`: text extracted on the page from the CV and LinkedIn PDF export (at most 6 files, 20,000 characters each).
- `meta/control`: requests from the page to the scan: `status` (queued, running, done), `mode` (incremental, rescore, full), `deriveProfile`.
- `meta/run`: the last run's status, counts, unread sources, issues and history.
- `data/users/<id>/marks`: the viewer's interested, applying and discarded calls.

## Eligibility and affinity

Each call gets two separate judgments (`pipeline/fund/eligibility.py`, `pipeline/fund/scoring.py`, mirrored in `site/src/js/00-core.js`):

- **Eligibility verdict.** Each condition the funder states is stored as its own item, marked met, not met or unclear against the profile. Any not met → not eligible; else any unclear, or none extracted → check; else eligible.
- **Affinity.** Three components scored 0–100 by the scan (topical, skills, practical) plus a feedback adjustment of at most ±10 from the user's marks, combined with the user's weights. The deadline is never part of the score; the page flags deadlines closer than the preparation time set for the call's type.

## Profile updates

The page can draft the profile directly from the uploaded files through its `sample` capability. The scan reads the website and ORCID, which the page cannot reach. A scan writes a draft only into an empty, unconfirmed profile; for a confirmed profile it only proposes changes in `meta/profile.pending`, which the user accepts or rejects on the Profile page. Every weekly scan re-reads the user's website for such changes.

## Page to scan

1. The page writes `meta/control` with `status: "queued"`.
2. **Run now** calls the Claude Code Remote connector's `fire_trigger` with the task id from `meta/config.triggerId`, through the page's `mcp` capability.
3. The scan sets `status: "running"`, does the work, then `status: "done"` with `lastResult`. If Run now isn't available, the next scheduled run picks up the queued request.

## Why one HTML file

The artifact host serves a single page and allows scripts only from a few CDNs. The sources stay split for version control; `site/build.py` (copied from Research Radar) concatenates them in a fixed order into one strict-mode scope. pdf.js loads only when a PDF is dropped on the Profile page, and runs on the main thread because the page can't start cross-origin workers.
