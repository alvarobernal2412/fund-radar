# Setup prompt

One prompt that takes a computer from nothing to a running Fund Radar: clone, build, publish, schedule. Paste it into Claude Code (the desktop app, with Claude in Chrome, because the funders' sites are read through your browser). The agent first asks a few multiple-choice questions, so there is nothing to fill in.

```text
I want to set up Fund Radar, a weekly radar of research funding calls. Clone the
repo and configure everything, then tell me what is left for me to do by hand.

Repo: https://github.com/alvarobernal2412/fund-radar

Before you do anything else, clone the repo into a temporary folder and read
README.md, docs/new-pack.md and the packs under packs/, so you can offer the
countries and universities that have a source pack. Then ask me for the values
below. Use the AskUserQuestion tool (multiple-choice with an "Other" free-text
option) in two calls, because it takes at most 4 questions each. If that tool
is not available, ask the same questions in plain text in one message. Mark the
suggested option "(Recommended)" and wait for my answers.

Call 1:
1. Clone folder: ~/code/fund-radar (Recommended) / the current directory / Other.
2. Countries to scan (multiple choice): one option per country pack in
   packs/countries/ (skip files starting with _), plus "EU and international
   programmes" (Recommended, ticked by default). Under Other I can type ISO
   codes of countries without a pack.
3. Opportunity types (multiple choice): Project funding / Fellowships and
   mobility / Networking and event funds / Prizes. Nothing ticked means all.
4. Career stage: PhD student / Postdoc / Senior researcher or lecturer /
   Professor.

Call 2:
5. My home institution, whose internal funds should be scanned: offer up to
   three universities from the pack of the first country I picked, and let me
   type another under Other. "None" is a valid answer.
6. Scan day: call assign_slot() from pipeline/fund/schedule.py with the
   weekday and time of every Research Radar scan you find on this computer
   (research-radar clones list them in config/site.json under radars), so the
   two never scan on the same day. Offer the slot it returns at a minute that
   is not on the hour, e.g. "Wednesdays 08:49 (Recommended)" / another
   weekday / Other. Ask my time zone if you cannot read it from this machine.
7. Radar name: "Fund Radar" (Recommended) / Other.

Steps:
1. Move or clone the repo into the folder I gave you. Check python 3.11+ is
   installed (node is optional). Install nothing system-wide without asking me.
   Run: python -m pytest
2. Copy config/site.example.json to config/site.json and fill in title,
   siteName, scheduleText, weekday, time and timezone from my answers.
   config/site.json is git-ignored: never commit it.
3. Build: python site/build.py --check
4. Publish dist/fund-radar.html as a NEW artifact with the capabilities in
   site/capabilities.json. Put the returned URL into config/site.json as
   artifactUrl, and git rev-parse HEAD as lastPublishedCommit. If
   config/site.json already has a real artifactUrl (this is a re-run), read
   that artifact first and update it in place instead of creating a second one.
5. Run python pipeline/render_prompt.py and create a scheduled task named
   "<radar name> weekly scan" at my slot, using that output as its prompt. It
   must run on my computer (Chrome reads the funders' sites). Put the task id
   into config/site.json as triggerId.
6. Write to the artifact's database:
   - meta/config: {siteName, scheduleText, timezone, triggerId,
     countries (upper-case ISO codes), includeEU, opportunityTypes (project,
     fellowship, mobility, networking, prize; empty for all), careerStage
     (phd, postdoc, senior, professor), institutions ([{id, country, role:
     "home"}] for my home institution, using the pack's institution id),
     communities: [], prepWeeks: {}}
   - meta/weights: {topical: 0.5, skills: 0.3, practical: 0.2}
   - meta/profile: {revision: 0, confirmedAt: null, inputs: {}}
   Nothing from my scope or profile goes into the repository.
7. Finish with a short checklist of what I still have to do myself. It must
   include: open the radar's Profile page, add my website, ORCID, CV and
   LinkedIn PDF export, answer the questionnaire, draft and confirm the
   profile; check the scope and pick target institutions on Scope & scans;
   then press "Run now" for the first scan (the radar is empty until a scan
   has run). Note that the artifact is private until I share it from its
   Share menu, and that sharing it also shares my profile.

Rules:
- Never commit config/site.json, data exports, or anything from my profile.
- Do not ask me to paste my CV or LinkedIn export into the chat: they go on the
  radar's Profile page.
- Do not run git commit yourself: show me the proposed message and wait.
```

## What stays manual

- **Your profile.** Add your links and files on the Profile page, answer the questionnaire, and confirm the draft. Drafting uses your own Claude session from the page, or the next scan for your website and ORCID.
- **Target institutions and communities.** Pick them on Scope & scans.
- **The first scan.** The catalogue is empty until a scan has run. Press "Run now" on Scope & scans, or wait for the first scheduled run.
- **Approving the scheduled task.** A task that runs on your computer must be approved from a conversation linked to that computer.
- **Sharing.** The artifact is private to you until you share it. Sharing it shares your profile too.

## Re-running it

The prompt is safe to run again in an existing clone: if `config/site.json` already holds a real `artifactUrl`, the agent updates that artifact instead of creating a second one, and your data is kept.

## Requirements

- A Claude account with artifacts and scheduled tasks.
- The Claude desktop app with Claude in Chrome, so the scan can read the funders' sites.
- Python 3.11+. Node is optional (syntax check and smoke test).
