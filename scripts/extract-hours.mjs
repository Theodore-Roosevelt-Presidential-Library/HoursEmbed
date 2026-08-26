#!/usr/bin/env node
/**
 * extract-hours.mjs
 * Fetches https://www.trlibrary.com/visit/eat, parses the .hours-block markup
 * and the page's JSON-LD, and writes docs/hours.json.
 *
 * Zero dependencies (Node 18+ — uses global fetch).
 *
 * Fails with a non-zero exit code if the page structure changes in a way we
 * can't parse, so the scheduled GitHub Action keeps the last-known-good
 * hours.json instead of publishing something broken.
 *
 * Usage:
 *   node scripts/extract-hours.mjs                 # fetch live page
 *   node scripts/extract-hours.mjs --fixture test/fixture.html   # parse local file
 */

import { readFileSync, writeFileSync, mkdirSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const SOURCE_URL = "https://www.trlibrary.com/visit/eat";
const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const OUT_FILE = join(ROOT, "docs", "hours.json");

// ---------------------------------------------------------------- helpers

const strip = (s) =>
  s
    .replace(/<[^>]+>/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&#039;|&apos;/g, "'")
    .replace(/&quot;/g, '"')
    .replace(/&nbsp;/g, " ")
    .replace(/\s+/g, " ")
    .trim();

function fail(msg) {
  console.error(`EXTRACTION FAILED: ${msg}`);
  process.exit(1);
}

/** Return the substring of `html` for the element that starts at the opening
 *  `<div` found at `startIdx`, using naive div-depth balancing. */
function balancedDiv(html, startIdx) {
  const re = /<div\b|<\/div>/g;
  re.lastIndex = startIdx;
  let depth = 0;
  let m;
  while ((m = re.exec(html))) {
    depth += m[0] === "</div>" ? -1 : 1;
    if (depth === 0) return html.slice(startIdx, m.index + 6);
  }
  return null;
}

// ---------------------------------------------------------------- parsing

function parseHoursBlock(html) {
  const collapsed = html.replace(/\s+/g, " ");

  const blockStart = collapsed.search(/<div[^>]*class="[^"]*hours-block[^"]*"/);
  if (blockStart === -1) fail("no element with class 'hours-block' found");
  const block = balancedDiv(collapsed, blockStart);
  if (!block) fail("could not isolate hours-block element");

  // --- tabs: label + machine-readable season date range
  const tabs = [];
  const tabRe =
    /<button[^>]*data-date-start="([^"]+)"[^>]*data-date-end="([^"]+)"[^>]*>([^<]+)<\/button>/g;
  let t;
  while ((t = tabRe.exec(block))) {
    tabs.push({ label: strip(t[3]), start: t[1], end: t[2] });
  }
  if (tabs.length === 0) fail("no season tab buttons found");

  // --- panels
  const seasons = [];
  const panelIdxRe = /<div[^>]*id="operating-hours-panel-(\d+)"/g;
  let p;
  const panelStarts = [];
  while ((p = panelIdxRe.exec(block))) {
    panelStarts.push({ n: Number(p[1]), idx: p.index });
  }
  if (panelStarts.length === 0) fail("no operating-hours panels found");

  for (const { n, idx } of panelStarts) {
    const panel = balancedDiv(block, idx);
    if (!panel) fail(`could not isolate panel ${n}`);

    const dateLabelM = panel.match(/<p[^>]*>([^<]+)<\/p>/);
    const dateLabel = dateLabelM ? strip(dateLabelM[1]) : null;

    // Split panel into venue/holiday cards on <h3> headings
    const cards = [];
    const h3Re = /<h3[^>]*>([\s\S]*?)<\/h3>/g;
    let h;
    const heads = [];
    while ((h = h3Re.exec(panel))) heads.push({ name: strip(h[1]), end: h3Re.lastIndex });
    for (let i = 0; i < heads.length; i++) {
      const from = heads[i].end;
      const to = i + 1 < heads.length ? heads[i + 1].end - 100 : panel.length;
      cards.push({ name: heads[i].name, html: panel.slice(from, to) });
    }

    const venues = [];
    const holidays = [];

    for (const card of cards) {
      if (/^holidays$/i.test(card.name)) {
        const holRe =
          /<div[^>]*class="[^"]*justify-between[^"]*"[^>]*> <span>([^<]+)<\/span> <span>([^<]+)<\/span>/g;
        let hm;
        while ((hm = holRe.exec(card.html))) {
          holidays.push({ date: strip(hm[1]), status: strip(hm[2]) });
        }
      } else {
        // rows: <div class="grid grid-cols-3 ..."> <div>days</div> <div>lite</div> <div ...>full</div> </div>
        const rowRe =
          /<div[^>]*class="[^"]*grid-cols-3[^"]*"[^>]*> <div[^>]*>([^<]*)<\/div> <div[^>]*>([^<]*)<\/div> <div[^>]*>([^<]*)<\/div>/g;
        let rm;
        let columns = null;
        const rows = [];
        while ((rm = rowRe.exec(card.html))) {
          const cells = [strip(rm[1]), strip(rm[2]), strip(rm[3])];
          if (cells[0] === "" && columns === null) {
            columns = [cells[1], cells[2]]; // header row: "Lite service" / "Full Service"
          } else if (cells[0] !== "") {
            rows.push({ days: cells[0], services: [cells[1], cells[2]] });
          }
        }
        if (rows.length > 0) {
          venues.push({
            name: card.name,
            columns: columns || ["Lite service", "Full Service"],
            rows,
          });
        }
      }
    }

    if (venues.length === 0) fail(`panel ${n} ('${dateLabel}') has no venue hours rows`);

    const tab = tabs[n] || {};
    seasons.push({
      label: tab.label || `Season ${n}`,
      dateLabel,
      start: tab.start || null,
      end: tab.end || null,
      venues,
      holidays,
    });
  }

  return seasons;
}

function parseJsonLd(html) {
  const out = { openingHoursSpecification: [], specialOpeningHoursSpecification: [] };
  const ldRe = /<script type="application\/ld\+json">([\s\S]*?)<\/script>/g;
  let m;
  while ((m = ldRe.exec(html))) {
    let data;
    try {
      data = JSON.parse(m[1]);
    } catch {
      continue;
    }
    const nodes = data["@graph"] ? data["@graph"] : [data];
    for (const node of nodes) {
      const ohs = node.openingHoursSpecification;
      if (Array.isArray(ohs)) {
        out.openingHoursSpecification.push(
          ...ohs.filter((s) => /restaurant|caf[eé]|dining/i.test(s.description || ""))
        );
      }
      const sohs = node.specialOpeningHoursSpecification;
      if (Array.isArray(sohs)) out.specialOpeningHoursSpecification.push(...sohs);
    }
  }
  return out;
}

// ---------------------------------------------------------------- main

async function main() {
  const fixtureIdx = process.argv.indexOf("--fixture");
  let html;
  if (fixtureIdx !== -1) {
    html = readFileSync(process.argv[fixtureIdx + 1], "utf8");
  } else {
    const res = await fetch(SOURCE_URL, {
      headers: { "User-Agent": "TRPL-HoursEmbed-sync (github.com/Theodore-Roosevelt-Presidential-Library/HoursEmbed)" },
    });
    if (!res.ok) fail(`fetch ${SOURCE_URL} returned HTTP ${res.status}`);
    html = await res.text();
  }

  const seasons = parseHoursBlock(html);
  const schema = parseJsonLd(html);

  // sanity checks
  if (!seasons.some((s) => s.venues.some((v) => /salt/i.test(v.name))))
    fail("no 'Salt + Scoria' venue found in any season panel");

  const payload = {
    source: SOURCE_URL,
    generated: new Date().toISOString(),
    seasons,
    schema,
  };

  mkdirSync(dirname(OUT_FILE), { recursive: true });

  // Only touch the file when the data (not the timestamp) changed, so the
  // Action doesn't create a commit every run.
  let previous = null;
  try {
    previous = JSON.parse(readFileSync(OUT_FILE, "utf8"));
  } catch {}
  const stable = (o) => JSON.stringify({ ...o, generated: null });
  if (previous && stable(previous) === stable(payload)) {
    console.log("hours.json unchanged — nothing to do.");
    return;
  }

  writeFileSync(OUT_FILE, JSON.stringify(payload, null, 2) + "\n");
  console.log(`Wrote ${OUT_FILE}: ${seasons.length} seasons, ` +
    `${schema.openingHoursSpecification.length} schema specs.`);
}

main().catch((e) => fail(e.message));
