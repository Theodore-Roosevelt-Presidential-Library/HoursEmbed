/*!
 * TRPL HoursEmbed — Salt + Scoria seasonal hours widget
 * Data source: https://www.trlibrary.com/visit/eat (synced via GitHub Action)
 *
 * Usage (Squarespace code block):
 *   <div data-trpl-hours></div>
 *   <script src="https://theodore-roosevelt-presidential-library.github.io/HoursEmbed/embed.js" defer></script>
 *
 * Optional overrides on the container element:
 *   data-accent="#8a3324"   accent color (active tab, headings)
 *   data-heading="hide"     hide the venue name heading
 *
 * Styling can also be tuned from the host page via CSS custom properties
 * set on the container: --trpl-accent, --trpl-text, --trpl-muted,
 * --trpl-border, --trpl-radius, --trpl-font.
 */
(function () {
  "use strict";

  var script = document.currentScript;
  var base = "";
  if (script && script.src) {
    base = script.src.replace(/\/[^\/]*$/, "");
  }
  var DATA_URL = base + "/hours.json";

  var STYLE = [
    ":host { all: initial; display: block; }",
    ".trpl-hours {",
    "  display: block;",
    "  font-family: var(--trpl-font, inherit);",
    "  color: var(--trpl-text, #1a1a1a);",
    "  font-size: 1rem;",
    "  line-height: 1.5;",
    "}",
    ".trpl-tabs { display: flex; flex-wrap: wrap; gap: 8px; margin: 0 0 16px; padding: 0; list-style: none; }",
    ".trpl-tab {",
    "  font: inherit; font-size: 0.875em; cursor: pointer;",
    "  padding: 6px 14px; border-radius: var(--trpl-radius, 6px);",
    "  border: 1px solid var(--trpl-accent, #8a3324);",
    "  background: transparent; color: var(--trpl-accent, #8a3324);",
    "  letter-spacing: 0.02em;",
    "}",
    ".trpl-tab[aria-selected='true'] { background: var(--trpl-accent, #8a3324); color: #fff; }",
    ".trpl-tab:focus-visible { outline: 2px solid var(--trpl-accent, #8a3324); outline-offset: 2px; }",
    ".trpl-panel { border-top: 1px solid var(--trpl-border, #d8d3cc); padding-top: 16px; }",
    ".trpl-panel[hidden] { display: none; }",
    ".trpl-daterange {",
    "  font-weight: 700; text-transform: uppercase; letter-spacing: 0.05em;",
    "  font-size: 0.875em; margin: 0 0 12px; padding-bottom: 12px;",
    "  border-bottom: 1px solid var(--trpl-border, #d8d3cc);",
    "}",
    ".trpl-card { border: 1px solid var(--trpl-border, #d8d3cc); border-radius: var(--trpl-radius, 6px); padding: 16px; margin-bottom: 12px; }",
    ".trpl-venue { font-weight: 700; text-transform: uppercase; letter-spacing: 0.05em; font-size: 0.875em; margin: 0 0 10px; color: var(--trpl-accent, #8a3324); }",
    ".trpl-grid { display: grid; grid-template-columns: 1fr 1fr 1fr; column-gap: 12px; }",
    ".trpl-grid > div { padding: 4px 0; font-size: 0.9375em; }",
    ".trpl-colhead { font-style: italic; color: var(--trpl-muted, #6b6560); }",
    ".trpl-days { font-weight: 600; }",
    ".trpl-holiday { display: flex; justify-content: space-between; padding: 4px 0; font-size: 0.9375em; }",
    ".trpl-holiday span:last-child { color: var(--trpl-muted, #6b6560); }",
    ".trpl-note { font-size: 0.75em; color: var(--trpl-muted, #6b6560); margin-top: 10px; }",
    ".trpl-note a { color: inherit; }",
    "@media (max-width: 480px) {",
    "  .trpl-grid { grid-template-columns: 1fr; }",
    "  .trpl-grid > .trpl-colhead { display: none; }",
    "  .trpl-grid > .trpl-cell { padding: 0 0 2px; }",
    "  .trpl-grid > .trpl-cell::before { content: attr(data-label) ': '; font-style: italic; color: var(--trpl-muted, #6b6560); }",
    "  .trpl-grid > .trpl-days { margin-top: 8px; }",
    "}"
  ].join("\n");

  function el(tag, attrs, children) {
    var node = document.createElement(tag);
    if (attrs) {
      Object.keys(attrs).forEach(function (k) {
        if (k === "text") node.textContent = attrs[k];
        else node.setAttribute(k, attrs[k]);
      });
    }
    (children || []).forEach(function (c) { node.appendChild(c); });
    return node;
  }

  /** Pick the season whose [start, end] range contains today.
   *  Falls back to month/day comparison (year-agnostic, handles the
   *  Dec–Mar winter wrap) if the published years are stale. */
  function currentSeasonIndex(seasons, today) {
    for (var i = 0; i < seasons.length; i++) {
      var s = seasons[i];
      if (s.start && s.end && today >= s.start && today <= s.end) return i;
    }
    var md = today.slice(5); // "MM-DD"
    for (var j = 0; j < seasons.length; j++) {
      var t = seasons[j];
      if (!t.start || !t.end) continue;
      var a = t.start.slice(5), b = t.end.slice(5);
      if (a <= b ? (md >= a && md <= b) : (md >= a || md <= b)) return j;
    }
    return 0;
  }

  function render(container, data) {
    var accent = container.getAttribute("data-accent");
    var hideHeading = container.getAttribute("data-heading") === "hide";
    var root = container.attachShadow ? container.attachShadow({ mode: "open" }) : container;

    var style = document.createElement("style");
    style.textContent = STYLE;
    root.appendChild(style);

    var wrap = el("div", { class: "trpl-hours" });
    if (accent) wrap.style.setProperty("--trpl-accent", accent);

    var today = new Date().toISOString().slice(0, 10);
    var active = currentSeasonIndex(data.seasons, today);

    var tablist = el("ul", { class: "trpl-tabs", role: "tablist" });
    var panels = [];

    data.seasons.forEach(function (season, i) {
      var tabId = "trpl-tab-" + i, panelId = "trpl-panel-" + i;

      var btn = el("button", {
        class: "trpl-tab", id: tabId, role: "tab", type: "button",
        "aria-controls": panelId,
        "aria-selected": i === active ? "true" : "false",
        text: season.label
      });
      btn.addEventListener("click", function () { select(i); });
      tablist.appendChild(el("li", { role: "presentation" }, [btn]));

      var panel = el("div", {
        class: "trpl-panel", id: panelId, role: "tabpanel",
        "aria-labelledby": tabId
      });
      if (i !== active) panel.setAttribute("hidden", "");

      if (season.dateLabel) {
        panel.appendChild(el("p", { class: "trpl-daterange", text: season.dateLabel }));
      }

      season.venues.forEach(function (venue) {
        var card = el("div", { class: "trpl-card" });
        if (!hideHeading) {
          card.appendChild(el("h3", { class: "trpl-venue", text: venue.name }));
        }
        var grid = el("div", { class: "trpl-grid" });
        grid.appendChild(el("div", { class: "trpl-colhead" }));
        venue.columns.forEach(function (c) {
          grid.appendChild(el("div", { class: "trpl-colhead", text: c }));
        });
        venue.rows.forEach(function (row) {
          grid.appendChild(el("div", { class: "trpl-days", text: row.days }));
          row.services.forEach(function (svc, k) {
            grid.appendChild(el("div", {
              class: "trpl-cell", "data-label": venue.columns[k] || "", text: svc
            }));
          });
        });
        card.appendChild(grid);
        panel.appendChild(card);
      });

      if (season.holidays && season.holidays.length) {
        var hol = el("div", { class: "trpl-card" });
        hol.appendChild(el("h3", { class: "trpl-venue", text: "Holidays" }));
        season.holidays.forEach(function (h) {
          hol.appendChild(el("div", { class: "trpl-holiday" }, [
            el("span", { text: h.date }),
            el("span", { text: h.status })
          ]));
        });
        panel.appendChild(hol);
      }

      panels.push(panel);
    });

    function select(idx) {
      tablist.querySelectorAll(".trpl-tab").forEach(function (b, i) {
        b.setAttribute("aria-selected", i === idx ? "true" : "false");
      });
      panels.forEach(function (p, i) {
        if (i === idx) p.removeAttribute("hidden");
        else p.setAttribute("hidden", "");
      });
    }

    wrap.appendChild(tablist);
    panels.forEach(function (p) { wrap.appendChild(p); });
    root.appendChild(wrap);
  }

  function init() {
    var containers = document.querySelectorAll("[data-trpl-hours]");
    if (!containers.length) return;
    if (window.__TRPL_HOURS_DATA) { // test/dev hook: inline data, skip fetch
      containers.forEach(function (c) { render(c, window.__TRPL_HOURS_DATA); });
      return;
    }
    fetch(DATA_URL, { cache: "no-cache" })
      .then(function (r) {
        if (!r.ok) throw new Error("HTTP " + r.status);
        return r.json();
      })
      .then(function (data) {
        if (!data || !data.seasons || !data.seasons.length) throw new Error("empty data");
        containers.forEach(function (c) { render(c, data); });
      })
      .catch(function (e) {
        // Fail quietly on the public page; leave a breadcrumb for debugging.
        if (window.console) console.warn("TRPL HoursEmbed: could not load hours —", e.message);
      });
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init);
  } else {
    init();
  }
})();
