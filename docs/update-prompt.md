# Update prompt

When the repository has new commits (a better scan, a new country pack, page fixes), bring your radar up to date with one prompt. Paste it into Claude Code from your clone. It pulls, tests, rebuilds, republishes the page in place and updates the scheduled task only when the scan prompt or the packs changed. Your calls, profile and marks live in the artifact's database, so they are kept.

```text
Update my Fund Radar to the latest code in the repo. Do not change my data.

Before you do anything else, ask me with the AskUserQuestion tool (or in plain
text if it is not available):
1. Which folder holds my clone: the current directory (Recommended) / Other.
2. If the scan instructions or the packs changed, should you update my
   scheduled task automatically (Recommended), show me the diff first, or
   leave the task alone?

Steps:
1. Go to the clone. Run git status. If there are uncommitted changes, stop and
   show them to me. Check that config/site.json exists and has an artifactUrl;
   if not, this clone was never installed: point me to docs/setup-prompt.md
   and stop.
2. git fetch, then git pull --ff-only. Never merge, rebase or force anything
   without asking me. Let OLD be config/site.json's lastPublishedCommit (or the
   commit I was on before pulling) and NEW be HEAD. If they are the same, tell
   me everything is up to date and stop.
3. Summarise git log --oneline OLD..NEW and git diff --stat OLD..NEW in plain
   language, grouped as: page (site/), scan instructions
   (pipeline/scan-prompt.md, pipeline/render_prompt.py), source packs
   (packs/), data model (pipeline/schema/), capabilities
   (site/capabilities.json), docs and tests.
4. Run python -m pytest and python site/build.py --check. Stop and show me the
   output if either fails.
5. Publish the page in place: read the live artifact at artifactUrl first, then
   publish dist/fund-radar.html to that same URL. Pass capabilities only if
   site/capabilities.json changed between OLD and NEW.
6. If pipeline/scan-prompt.md, pipeline/render_prompt.py or anything under
   packs/ changed: run python pipeline/render_prompt.py, compare it with my
   scheduled task's current prompt, and update the task according to my answer
   to question 2. Keep its schedule and task id.
7. If pipeline/schema/ changed, tell me what changed and whether stored
   documents need a migration. Do not write to the database unless a commit
   message or the docs say a migration is required, and then ask me first.
8. Open the artifact and check that it loads without errors. Report anything
   that failed.
9. Write NEW into config/site.json as lastPublishedCommit and report what was
   updated and what I still have to do myself.

Rules:
- Never commit, force-push or delete data. Never commit config/site.json or any
  export.
- If a step fails, stop and tell me; do not work around it silently.
```
