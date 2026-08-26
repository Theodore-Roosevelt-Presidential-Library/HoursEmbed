/*!
 * TRPL HoursEmbed — Salt + Scoria seasonal hours widget
 * Data source: https://www.trlibrary.com/visit/eat (synced via GitHub Action)
 *
 * Usage (Squarespace code block):
 *   <div data-trpl-hours></div>
 *   <script src="https://theodore-roosevelt-presidential-library.github.io/HoursEmbed/embed.js" defer></script>
 *
 * Theming
 * -------
 * By default the widget looks at the background it sits on and at the host
 * page's fonts, and adapts:
 *   - dark/colored section  -> light text, translucent borders, cream active
 *     tab whose label is tinted with the section's own background color
 *   - light section         -> dark text with an oxblood accent
 *   - headings use the same font as the host page's headings; body text uses
 *     the host page's paragraph font
 *
 * Manual overrides on the container element:
 *   data-theme="auto|light|dark|scoria"  force a palette (default: auto)
 *   data-accent="#b63d25"                accent color for the light theme
 *   data-heading="hide"                  hide the venue name heading
 *   data-fonts="off"                     don't adopt host page fonts
 *
 * Finer control via CSS custom properties on the container:
 *   --trpl-text, --trpl-muted, --trpl-border, --trpl-accent,
 *   --trpl-tab-active-bg, --trpl-tab-active-text, --trpl-radius,
 *   --trpl-font, --trpl-heading-font
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
    "  color: var(--trpl-text);",
    "  font-size: 1rem;",
    "  line-height: 1.5;",
    "}",
    ".trpl-tabs { display: flex; flex-wrap: wrap; gap: 8px; margin: 0 0 16px; padding: 0; list-style: none; }",
    ".trpl-tab {",
    "  font-family: var(--trpl-heading-font, var(--trpl-font, inherit));",
    "  font-size: 1em; font-weight: 700; cursor: pointer;",
    "  text-transform: uppercase; letter-spacing: 0.06em;",
    "  padding: 6px 16px 5px; border-radius: var(--trpl-radius, 4px);",
    "  border: 1px solid var(--trpl-tab-border);",
    "  background: transparent; color: var(--trpl-text);",
    "}",
    ".trpl-tab[aria-selected='true'] {",
    "  background: var(--trpl-tab-active-bg);",
    "  color: var(--trpl-tab-active-text);",
    "  border-color: var(--trpl-tab-active-bg);",
    "}",
    ".trpl-tab:focus-visible { outline: 2px solid var(--trpl-text); outline-offset: 2px; }",
    ".trpl-panel { border-top: 1px solid var(--trpl-border); padding-top: 16px; }",
    ".trpl-panel[hidden] { display: none; }",
    ".trpl-daterange {",
    "  font-weight: 700; text-transform: uppercase; letter-spacing: 0.08em;",
    "  font-size: 0.8125em; margin: 0 0 12px; padding-bottom: 12px;",
    "  color: var(--trpl-muted);",
    "  border-bottom: 1px solid var(--trpl-border);",
    "}",
    ".trpl-card { border: 1px solid var(--trpl-border); border-radius: var(--trpl-radius, 4px); padding: 18px 20px; margin-bottom: 14px; }",
    ".trpl-venue {",
    "  font-family: var(--trpl-heading-font, var(--trpl-font, inherit));",
    "  font-weight: 700; text-transform: uppercase; letter-spacing: 0.04em;",
    "  font-size: 1.5em; line-height: 1.1; margin: 0 0 12px;",
    "  color: var(--trpl-accent);",
    "}",
    ".trpl-grid { display: grid; grid-template-columns: 1fr 1fr 1fr; column-gap: 16px; }",
    ".trpl-grid > div { padding: 4px 0; font-size: 0.9375em; }",
    ".trpl-colhead { font-style: italic; color: var(--trpl-muted); }",
    ".trpl-days { font-weight: 600; }",
    ".trpl-holiday { display: flex; justify-content: space-between; padding: 4px 0; font-size: 0.9375em; }",
    ".trpl-holiday span:last-child { color: var(--trpl-muted); }",
    "@media (max-width: 480px) {",
    "  .trpl-grid { grid-template-columns: 1fr; }",
    "  .trpl-grid > .trpl-colhead { display: none; }",
    "  .trpl-grid > .trpl-cell { padding: 0 0 2px; }",
    "  .trpl-grid > .trpl-cell::before { content: attr(data-label) ': '; font-style: italic; color: var(--trpl-muted); }",
    "  .trpl-grid > .trpl-days { margin-top: 8px; }",
    "}"
  ].join("\n");

  // ------------------------------------------------------------ theming

  /** Palettes. Values may be functions of the detected section bg color. */
  var THEMES = {
    light: {
      text: "#1a1a1a",
      muted: "#6b6560",
      border: "#d8d3cc",
      accent: "#8a3324",
      tabBorder: "#8a3324",
      tabActiveBg: "#8a3324",
      tabActiveText: "#ffffff"
    },
    dark: {
      text: "#fafafa",
      muted: "rgba(250,250,250,0.7)",
      border: "rgba(250,250,250,0.35)",
      accent: "#fafafa",
      tabBorder: "rgba(250,250,250,0.6)",
      tabActiveBg: "#fafafa",
      tabActiveText: "#242729" // replaced with detected section bg when known
    },
    // Salt + Scoria's scoria-red sections (#b63d25)
    scoria: {
      text: "#fafafa",
      muted: "rgba(250,250,250,0.72)",
      border: "rgba(250,250,250,0.35)",
      accent: "#fafafa",
      tabBorder: "rgba(250,250,250,0.6)",
      tabActiveBg: "#fafafa",
      tabActiveText: "#b63d25"
    }
  };

  /** Find the effective background color behind the container. Understands
   *  Squarespace's pattern of painting sections via a .section-background
   *  child rather than on the ancestor chain itself. */
  function detectBackground(container) {
    var n = container;
    while (n && n !== document.documentElement) {
      var bg = getComputedStyle(n).backgroundColor;
      if (bg && bg !== "transparent" && !/rgba\(\s*\d+\s*,\s*\d+\s*,\s*\d+\s*,\s*0\s*\)/.test(bg)) {
        return bg;
      }
      if (n.tagName === "SECTION") {
        var sb = n.querySelector(".section-background");
        if (sb) {
          var sbg = getComputedStyle(sb).backgroundColor;
          if (sbg && sbg !== "transparent" && !/,\s*0\s*\)$/.test(sbg)) return sbg;
        }
      }
      n = n.parentElement;
    }
    return null;
  }

  function parseRgb(str) {
    var m = /rgba?\(\s*(\d+)\s*,\s*(\d+)\s*,\s*(\d+)/.exec(str || "");
    return m ? [Number(m[1]), Number(m[2]), Number(m[3])] : null;
  }

  function luminance(rgb) {
    var a = rgb.map(function (v) {
      v /= 255;
      return v <= 0.03928 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4);
    });
    return 0.2126 * a[0] + 0.7152 * a[1] + 0.0722 * a[2];
  }

  /** Adopt the host page's fonts: headings from the nearest section heading
   *  (falling back to any h1/h2), body from the nearest paragraph. Works in
   *  Shadow DOM because document-registered @font-face applies there too. */
  function adoptFonts(container, wrap) {
    try {
      var scope = container.closest("section") || document;
      var h = scope.querySelector("h1, h2, h3, h4") ||
              document.querySelector("h1, h2, h3");
      if (h) wrap.style.setProperty("--trpl-heading-font", getComputedStyle(h).fontFamily);
      var p = scope.querySelector("p") || document.querySelector("main p, p");
      if (p) wrap.style.setProperty("--trpl-font", getComputedStyle(p).fontFamily);
    } catch (e) { /* fonts stay inherited */ }
  }

  function applyTheme(container, wrap) {
    var requested = (container.getAttribute("data-theme") || "auto").toLowerCase();
    var accentOverride = container.getAttribute("data-accent");
    var sectionBg = detectBackground(container);

    var theme;
    if (THEMES[requested]) {
      theme = THEMES[requested];
    } else {
      // auto: pick by background luminance
      var rgb = parseRgb(sectionBg);
      theme = rgb && luminance(rgb) < 0.35 ? THEMES.dark : THEMES.light;
    }

    var vars = {
      "--trpl-text": theme.text,
      "--trpl-muted": theme.muted,
      "--trpl-border": theme.border,
      "--trpl-accent": accentOverride || theme.accent,
      "--trpl-tab-border": theme.tabBorder,
      "--trpl-tab-active-bg": theme.tabActiveBg,
      "--trpl-tab-active-text": theme.tabActiveText
    };

    // On a dark/colored section, tint the active tab's label with the
    // section's own background so the tab reads as "cut out" of it.
    if (theme === THEMES.dark && sectionBg) {
      vars["--trpl-tab-active-text"] = sectionBg;
    }

    Object.keys(vars).forEach(function (k) {
      wrap.style.setProperty(k, vars[k]);
    });

    if (container.getAttribute("data-fonts") !== "off") {
      adoptFonts(container, wrap);
    }
  }

  // ------------------------------------------------------------ rendering

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
    var hideHeading = container.getAttribute("data-heading") === "hide";
    var root = container.shadowRoot ||
      (container.attachShadow ? container.attachShadow({ mode: "open" }) : container);
    while (root.firstChild) root.removeChild(root.firstChild);

    var style = document.createElement("style");
    style.textContent = STYLE;
    root.appendChild(style);

    var wrap = el("div", { class: "trpl-hours" });
    applyTheme(container, wrap);

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
