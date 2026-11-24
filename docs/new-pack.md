# Adding a country pack

Fund Radar is country-agnostic: a country is scanned once it has a pack. A pack is one JSON file that lists the country's national research funders and its main universities. Adding one needs no code.

1. Copy `packs/countries/_template.json` to `packs/countries/<code>.json`, where `<code>` is the two-letter ISO code in lower case (`de.json` for Germany).
2. Fill in `id` (the same code), `country` (upper case) and `label` (the country's English name).
3. Under `sources`, add one entry per national funder:
   - `id`: unique across all packs, prefixed with the code (`de-dfg`);
   - `url`: the page where the scan starts, usually the funder's overview of funding schemes or open calls;
   - `how`: what the scan should read there and what to watch out for (rolling deadlines, schemes being replaced, a separate page for each scheme);
   - `types`: the opportunity types the funder offers (`project`, `fellowship`, `mobility`, `networking`, `infrastructure`, `prize`);
   - `default`: whether the source is on when a user picks the country.
4. Under `institutions`, list the country's main universities and universities of applied sciences: `id` (short, unique), `name`, `kind`, `site` (home page) and `fundingUrl`.
   - Put a `fundingUrl` only when you have opened the page yourself and it lists funding opportunities (the grants office, research services, or an internal funding database).
   - Otherwise leave it `null`. The first scan of a user who picks that university as home institution finds the page and stores it in their own radar.
5. Every `url` must start with `https://`. Run `python -m pytest`: the tests check that ids are unique and every entry is well formed.
6. Rebuild the page (`python site/build.py`) so the Scope page lists the new country, and re-render the scan prompt (`python pipeline/render_prompt.py`) so the scan knows the new sources. The update prompt does both for installed radars.

Propose the pack to the shared repository as a pull request, so other researchers in that country can use it.

## Community channels

`packs/community.json` lists announcement channels of research communities (mailing lists, task forces, society news). Each entry has `fields`, the research areas it serves, which the Scope page shows next to it. Add channels that regularly announce funding calls, grants or prizes for a field.
