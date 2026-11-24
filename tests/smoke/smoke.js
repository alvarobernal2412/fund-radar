// End-to-end smoke test of the built page against an in-memory mock of the
// artifact runtime (db, user, sample, mcp, downloads). The mock is copied from
// Research Radar's smoke test.
//
//   npm i --no-save playwright-core@1.47.2
//   python site/build.py && node tests/smoke/smoke.js [--shots dir]
//
// Set CHROMIUM=/path/to/chrome if Playwright can't find a browser.
const fs = require("fs");
const path = require("path");
let chromium;
try { ({ chromium } = require("playwright-core")); } catch (e) { ({ chromium } = require("playwright")); }

const repo = path.resolve(__dirname, "../..");
const args = process.argv.slice(2);
const shotsIdx = args.indexOf("--shots");
const shots = shotsIdx >= 0 ? args[shotsIdx + 1] : null;
const page = path.join(repo, "dist/fund-radar.html");

function mockRuntime(seed) {
  // Runs inside the page before any script.
  const store = new Map();
  const listeners = [];
  const put = (p, d) => { if (d === undefined) store.delete(p); else store.set(p, JSON.parse(JSON.stringify(d))); };
  for (const [p, d] of Object.entries(seed)) put(p, d);
  const colDocs = (c) => [...store.entries()].filter(([p]) => p.startsWith(c + "/") && p.split("/").length === c.split("/").length + 1)
    .map(([p, d]) => ({ id: p.split("/").pop(), exists: true, data: () => d }));
  const notify = () => setTimeout(() => {
    for (const l of listeners) {
      if (l.kind === "doc") { const d = store.get(l.path); l.cb({ id: l.path.split("/").pop(), exists: !!d, data: () => d }); }
      else { const docs = colDocs(l.path); l.cb({ docs, size: docs.length, empty: !docs.length }); }
    }
  }, 10);
  const doc = (p) => ({
    id: p.split("/").pop(), path: p,
    get: async () => ({ exists: store.has(p), data: () => store.get(p) }),
    set: async (d) => { window.__writes.push(["set", p]); put(p, d); notify(); },
    update: async (d) => { put(p, Object.assign({}, store.get(p), d)); notify(); },
    delete: async () => { window.__writes.push(["delete", p]); put(p, undefined); notify(); },
    onSnapshot: (cb) => { listeners.push({ kind: "doc", path: p, cb }); notify(); return () => {}; },
  });
  const col = (c) => {
    const q = { limit: () => q, where: () => q, orderBy: () => q,
      onSnapshot: (cb) => { listeners.push({ kind: "col", path: c, cb }); notify(); return () => {}; },
      get: async () => { const docs = colDocs(c); return { docs, size: docs.length, empty: !docs.length }; },
      doc: (id) => doc(c + "/" + id) };
    return q;
  };
  window.__writes = []; window.__fired = []; window.__saved = [];
  window.__store = store;
  const sample = async () => ({ text: "", truncated: false });
  sample.json = async (prompt) => { window.__prompt = prompt; return {
    name: "Alex Example", headline: "Drafted headline", careerStage: "phd", phdDate: "2027-06", phdExpected: true, employer: "Example University",
    researchAreas: [{ name: "Analytic provenance", weight: 1, keywords: ["provenance"], from: { source: "cv", asOf: "2026-06" } }, { name: "Drafted area", weight: 0.7, keywords: ["drafted"], from: { source: "cv", asOf: "2026-06" } }],
    methods: ["User studies"], skills: { hard: ["Python"], soft: ["Teaching"] }, languages: [{ language: "English", level: "C2" }],
    teaching: [], funding: [], publications: [{ title: "A provenance model for exploratory process mining", venue: "Example Conference", year: 2026, type: "conference", position: "first", doi: "10.1234/example.1" }] }; };
  const caps = {
    db: { doc, collection: col },
    user: { canEdit: async () => true, id: async () => "u_test", isOwner: () => true },
    sample,
    mcp: { callTool: async (s, t, i) => { window.__fired.push([s, t, i]); return { content: [], payload: {} }; } },
    downloads: { save: async (r) => { window.__saved.push(r.filename); return { status: "saved" }; } },
  };
  window.claude = { use: async (n) => caps[n] || null };
}

// Fixture dates are written for 2026-11-24; shift them so the test means the same thing on any day.
function shiftDates(calls) {
  const ref = Date.parse("2026-11-24T12:00:00Z"), now = new Date(), t0 = Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate(), 12);
  const off = Math.round((t0 - ref) / 864e5);
  const sh = (d) => new Date(Date.parse(d + "T12:00:00Z") + off * 864e5).toISOString().slice(0, 10);
  for (const c of calls) {
    for (const d of c.deadlines || []) if (d.date) d.date = sh(d.date);
    const p = c.provenance || {};
    for (const k of ["firstSeen", "lastConfirmed"]) if (p[k]) p[k] = sh(p[k]);
  }
  return { calls, today: sh("2026-11-24") };
}

(async () => {
  const { calls, today } = shiftDates(JSON.parse(fs.readFileSync(path.join(repo, "tests/fixtures/calls.sample.json"), "utf8")));
  const profile = JSON.parse(fs.readFileSync(path.join(repo, "tests/fixtures/profile.sample.json"), "utf8"));
  const seed = {
    "meta/config": { siteName: "Test Fund Radar", triggerId: "trig_test", scheduleText: "Wednesdays at 08:49", countries: ["CH"], includeEU: true, opportunityTypes: [], institutions: [{ id: "unisg", country: "CH", role: "home" }], communities: [] },
    "meta/profile": profile,
    "meta/profile-text": { files: [{ name: "cv.pdf", kind: "cv", text: "Alex Example. PhD student in process mining. ".repeat(10), addedAt: "2026-11-01T00:00:00Z" }] },
    "meta/run": { lastRunAt: today + "T08:00:00Z", status: "partial", counts: { newCalls: 4, sourcesRead: 6, sourcesUnread: 1 }, unreadSources: [{ id: "ch-innosuisse", label: "Innosuisse", reason: "Timed out" }],
      history: [{ date: today, status: "partial", newCalls: 4, sourcesRead: 6, sourcesUnread: 1, note: "Innosuisse timed out" }] },
  };
  for (const c of calls) { const { id, ...rest } = c; seed["calls/" + id] = rest; }

  const browser = await chromium.launch(process.env.CHROMIUM ? { executablePath: process.env.CHROMIUM } : fs.existsSync("/usr/bin/google-chrome") ? { executablePath: "/usr/bin/google-chrome" } : {});
  const ctx = await browser.newContext({ viewport: { width: 1280, height: 900 } });
  await ctx.route("**/*", (r) => (r.request().url().startsWith("file:") ? r.continue() : r.abort()));
  const pg = await ctx.newPage();
  const errors = [];
  pg.on("pageerror", (e) => errors.push(e.message));
  pg.on("console", (m) => { if (m.type() === "error" && !/net::ERR_FAILED|Failed to load resource/.test(m.text())) errors.push(m.text()); });
  await pg.addInitScript(mockRuntime, seed);
  let failed = 0;
  const check = (name, ok, extra) => { console.log(`${ok ? "ok  " : "FAIL"} ${name}${extra ? "  (" + extra + ")" : ""}`); if (!ok) failed++; };
  const shot = async (n) => { if (shots) { fs.mkdirSync(shots, { recursive: true }); await pg.screenshot({ path: path.join(shots, n + ".png"), fullPage: true }); } };
  const rows = () => pg.$$eval(".crow", (r) => r.length);
  const writes = () => pg.evaluate(() => window.__writes.map(([, p]) => p));
  const stored = (p) => pg.evaluate((p) => window.__store.get(p), p);

  await pg.goto("file://" + page + "#calls");
  await pg.waitForTimeout(600);
  await shot("catalogue");
  const visible = calls.filter((c) => c.verdict !== "not_eligible" && c.status !== "closed").length;
  check("catalogue shows open calls you may apply to by default", (await rows()) === visible, `${await rows()}/${visible}`);
  check("brand uses the radar name", (await pg.textContent("#brand")) === "Test Fund Radar");
  const aff = (c, w) => Math.round(Math.max(0, Math.min(100, w.t * c.scores.topical + w.s * c.scores.skills + w.p * c.scores.practical + (c.scores.adjust || 0))));
  const best = calls.filter((c) => c.verdict !== "not_eligible" && c.status !== "closed").sort((a, b) => aff(b, { t: .5, s: .3, p: .2 }) - aff(a, { t: .5, s: .3, p: .2 }))[0];
  check("calls are ranked by affinity", (await pg.getAttribute(".crow", "data-id")) === best.id, best.id);
  check("summary strip counts new calls", (await pg.textContent(".strip .stat")).trim().startsWith(String(calls.filter((c) => c.status === "new" && c.verdict !== "closed").length)));
  check("unread sources are flagged in the strip", (await pg.textContent(".strip .stat.warn")).includes("1"));
  check("tight deadlines are flagged", (await pg.$$(".due.prep")).length >= 1);

  await pg.click('.crow[data-id="example-dissertation-prize"] .disc summary');
  await pg.click('.crow[data-id="example-dissertation-prize"] [data-reason="not-interesting"]');
  await pg.waitForTimeout(200);
  check("discarding a call removes it from the list", (await rows()) === visible - 1);
  check("discarded calls are counted", (await pg.textContent("#flt-disc-n")) === "1");
  check("the discard is stored with the viewer's marks", (await stored("data/users/u_test/marks")).calls["example-dissertation-prize"].discarded === "not-interesting");
  await pg.check("#flt-disc");
  await pg.waitForTimeout(200);
  check("Show discarded brings it back, marked", (await rows()) === visible && (await pg.$$(".crow.discarded")).length === 1);
  await pg.click('.crow.discarded [data-restore]');
  await pg.waitForTimeout(200);
  check("Restore clears the discard", (await pg.$$(".crow.discarded")).length === 0 && !(await stored("data/users/u_test/marks")).calls["example-dissertation-prize"].discarded);
  await pg.uncheck("#flt-disc");

  await pg.click('.crow[data-id="example-ai-foundation-call"] [data-mark="interested"]');
  await pg.waitForTimeout(200);
  check("marking interested is stored", (await stored("data/users/u_test/marks")).calls["example-ai-foundation-call"].interested === true);
  await pg.click('[data-quick="marked"]');
  await pg.waitForTimeout(200);
  check("quick filter shows marked calls only", (await rows()) === 1);
  await pg.click('[data-quick="eligible"]');
  await pg.waitForTimeout(200);
  check("quick filter shows eligible calls only", (await rows()) === calls.filter((c) => c.verdict === "eligible" && c.status !== "closed").length);
  await pg.click("#flt-reset");
  await pg.waitForTimeout(200);
  await pg.click("#flt-verdict summary");
  await pg.check('#flt-verdict input[value="not_eligible"]');
  await pg.waitForTimeout(200);
  check("ticking Not eligible brings ineligible calls back", (await rows()) === visible + 1);
  await pg.click("#flt-reset");
  await pg.fill("#flt-q", "dissertation");
  await pg.waitForTimeout(200);
  check("search narrows the list", (await rows()) === 1);
  await pg.click("#flt-reset");
  await pg.waitForTimeout(200);

  await pg.goto("file://" + page + "#call.horizon-msca-2027-pf-01-01");
  await pg.waitForTimeout(400);
  await shot("call");
  const ct = await pg.textContent("#app");
  check("call detail lists each eligibility condition", (await pg.$$(".cond")).length === 2 && (await pg.$$(".cond.unclear")).length === 1);
  check("an unclear condition says what to find out", ct.includes("To find out: Will you have lived in the host country"));
  check("call detail shows the score parts with the weights", (await pg.$$(".sbar")).length === 3 && ct.includes("× 50%"));
  await pg.goto("file://" + page + "#call.example-travel-grant");
  await pg.waitForTimeout(300);
  check("a partial call says its unstated details are unknown", !!(await pg.$("#partial-note")));

  await pg.goto("file://" + page + "#profile");
  await pg.waitForTimeout(400);
  await shot("profile");
  check("pending changes from the website are shown", (await pg.$$("#pf-pending .pendlist li")).length === 1);
  await pg.click('[data-pf="accept"][data-i="0"]');
  await pg.waitForTimeout(300);
  let prof = await stored("meta/profile");
  check("accepting a change applies it and bumps the revision", prof.teaching.length === 2 && prof.revision === profile.revision + 1 && !prof.pending);
  check("publications are listed in full", (await pg.$$("#pf-pubs tbody tr")).length === profile.publications.length);
  await pg.click('#pf-pubs [data-pub="an-early-workshop-paper-2024"]');
  await pg.waitForTimeout(300);
  prof = await stored("meta/profile");
  check("hiding a publication keeps it, flagged hidden", prof.publications.length === 2 && prof.publications.find((x) => x.id === "an-early-workshop-paper-2024").hidden === true);
  check("hidden publications leave the list until shown", (await pg.$$("#pf-pubs tbody tr")).length === 1);
  await pg.check("#pf-showhidden");
  await pg.waitForTimeout(150);
  check("Show hidden brings them back", (await pg.$$("#pf-pubs tbody tr.hidden-pub")).length === 1);
  await pg.fill("#q-amb", "Lead a provenance project.");
  await pg.selectOption("#q-reloc", "yes");
  await pg.click('[data-pf="save-answers"]');
  await pg.waitForTimeout(300);
  prof = await stored("meta/profile");
  check("questionnaire answers are saved", prof.answers.ambitions === "Lead a provenance project." && prof.answers.relocation === "yes");
  await pg.click('[data-pf="draft-now"]');
  await pg.waitForTimeout(400);
  check("Claude's draft opens the editor", !!(await pg.$("#pf-editor")) && (await pg.inputValue("#e-head")) === "Drafted headline");
  check("the draft prompt carries the CV text", (await pg.evaluate(() => window.__prompt || "")).includes("PhD student in process mining"));
  await shot("profile-editor");
  await pg.click('[data-pf="save-confirm"]');
  await pg.waitForTimeout(300);
  prof = await stored("meta/profile");
  check("saving the draft confirms the profile", !!prof.confirmedAt && prof.researchAreas.some((r) => r.name === "Drafted area"));
  check("the draft keeps the hidden flag of known publications", prof.publications.find((x) => x.id === "an-early-workshop-paper-2024").hidden === true);
  await pg.fill("#pf-portfolio", "not a link");
  await pg.click('[data-pf="save-inputs"]');
  await pg.waitForTimeout(200);
  check("links are validated", (await pg.textContent('[data-msg="inputs"]')).includes("https://"));
  await pg.fill("#pf-portfolio", "https://alex.example.org");
  await pg.click('[data-pf="queue-derive"]');
  await pg.waitForTimeout(300);
  check("letting the scan read everything queues a profile request", (await stored("meta/control")).deriveProfile === true && (await stored("meta/profile")).inputs.portfolio === "https://alex.example.org");

  await pg.goto("file://" + page + "#settings");
  await pg.waitForTimeout(400);
  await shot("settings");
  check("checkbox labels in forms are not set as field captions", (await pg.$eval("#scope-form label.chk", (e) => getComputedStyle(e).textTransform)) === "none");
  check("the scope lists the Swiss universities", (await pg.$$('select[data-inst]')).length >= 15);
  check("the home institution is preselected", (await pg.inputValue('select[data-inst="unisg"]')) === "home");
  await pg.selectOption('select[data-inst="ethz"]', "target");
  await pg.selectOption('select[data-inst="epfl"]', "home");
  await pg.click('[data-st="save-scope"]');
  await pg.waitForTimeout(300);
  const conf = await stored("meta/config");
  check("saving the scope stores institutions with their roles", conf.institutions.length === 3 && conf.institutions.find((i) => i.id === "ethz").role === "target");
  check("a home institution without a known page is listed as to be found", (await pg.textContent("#st-sources")).includes("EPFL (internal funds)") && (await pg.$$("#st-sources .pill.amb")).length >= 1);
  check("unread sources are marked", (await pg.textContent("#st-sources")).includes("Not read last scan"));
  // Practical fit only: a different call should come first.
  await pg.evaluate(() => { for (const [k, v] of [["topical", 0], ["skills", 0], ["practical", 100]]) { const r = document.getElementById("w-" + k); r.value = String(v); r.dispatchEvent(new Event("input", { bubbles: true })); } });
  await pg.click('[data-st="save-weights"]');
  await pg.waitForTimeout(300);
  const w = await stored("meta/weights");
  check("weights are saved normalised", Math.abs(w.topical + w.skills + w.practical - 1) < 0.01 && w.practical === 1, JSON.stringify(w));
  await pg.check('input[name="st-mode"][value="rescore"]');
  await pg.click('[data-st="run-now"]');
  await pg.waitForTimeout(300);
  const fired = await pg.evaluate(() => window.__fired);
  check("Run now fires the scheduled task", fired.length === 1 && fired[0][1] === "fire_trigger" && fired[0][2].trigger_id === "trig_test");
  check("the request is written to meta/control", (await stored("meta/control")).mode === "rescore");
  check("the scan timeline lists the last scan", (await pg.$$(".tl-item")).length >= 1);
  await pg.click('[data-st="export"]');
  await pg.waitForTimeout(200);
  check("export downloads one file", (await pg.evaluate(() => window.__saved)).some((f) => /^fund-radar-.*\.json$/.test(f)));

  await pg.goto("file://" + page + "#calls");
  await pg.waitForTimeout(400);
  const wTop = { t: w.topical, s: w.skills, p: w.practical };
  const bestNow = calls.filter((c) => c.verdict !== "not_eligible" && c.status !== "closed").sort((a, b) => aff(b, wTop) - aff(a, wTop))[0];
  check("new weights re-rank the catalogue without a scan", bestNow.id !== best.id && (await pg.getAttribute(".crow", "data-id")) === bestNow.id, bestNow.id);

  await pg.setViewportSize({ width: 390, height: 844 });
  await pg.waitForTimeout(200);
  await shot("catalogue-mobile");
  check("no horizontal overflow on a phone", await pg.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth + 1));

  check("no page errors", errors.length === 0, errors.join(" | "));
  await browser.close();
  console.log(failed ? `\n${failed} check(s) failed` : "\nAll checks passed");
  process.exit(failed ? 1 : 0);
})();
