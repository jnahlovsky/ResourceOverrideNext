/* global chrome */
// Small overlay listing the URL redirects, each with an on/off switch and its port, which
// can be changed in place. Its handle drags it out of the way.
// The list is published to storage by updateDNRRules (src/extension/netRequestRules.js) and
// changes go back through the background ("hudUpdateRule" in messageListener.js); the
// settings are written by the Settings screen (src/components/SettingsModal.vue).
(function() {
    "use strict";

    if (window.top !== window) return;

    // After an extension update or reload the background injects this script into open tabs
    // again (see reinjectHud in src/extension/background.js). A copy already on the page has
    // lost its connection to the extension and would ignore Settings, so it removes itself.
    var REPLACE_EVENT = "resourced-hud:replace";
    document.dispatchEvent(new CustomEvent(REPLACE_EVENT));

    // Keep in sync with HUD_DEFAULTS in src/components/SettingsModal.vue.
    var DEFAULTS = {
        hudEnabled: true,
        hudOpacity: 0.85,
        hudPosition: null,
        // What the HUD lists and shows for each redirect.
        hudOnlyEnabled: false,
        hudOnlyUsed: false,
        hudShowCounts: true,
        hudShowSwitches: true,
        hudPortMode: "edit", // "edit" | "show" | "hide"
        // Comma-separated domains the HUD is limited to; empty = every site.
        hudSites: "",
        // Settings → Sites: where the extension works at all.
        siteAllowlist: "",
        siteBlocklist: ""
    };
    // Distance kept from the viewport edges; also the default distance from the top.
    var EDGE_GAP = 10;
    // Drops this close to an edge (or the horizontal centre) snap onto it.
    var SNAP_DISTANCE = 24;
    // Pointer travel below this is a click on the handle, not a drag.
    var DRAG_THRESHOLD = 3;

    var state = Object.assign({}, DEFAULTS, { hudRedirects: [] });
    var host = null;
    var hud = null;
    var handle = null;
    var list = null;
    var drag = null;
    var isDestroyed = false;
    // Switching off the last redirect from the HUD keeps it on this page, so it can be
    // switched back on; otherwise the HUD only shows while a redirect is on.
    var keepVisible = false;
    // The redirect whose port is being typed; updates wait until it's done.
    var editingId = null;
    // Redirects switched from the HUD stay listed on this page, even where the settings
    // would hide them now (e.g. "only enabled"), so they can be switched back.
    var sticky = {};
    // Requests each redirect changed on this page, from the activity log
    // (src/extension/activityLog.js), by log entry id.
    var activity = {};
    var pageStart = performance.timeOrigin || Date.now();
    var renderQueued = false;

    // The top layer (popover API) keeps the HUD above every page element, whatever the
    // page's z-indexes, transforms or overflow are.
    var supportsPopover = typeof HTMLElement.prototype.showPopover === "function";

    var css = [
        ":host { all: initial !important; }",
        ".hud { position: fixed; inset: auto; margin: 0; border: 0; overflow: visible; width: auto; height: auto;",
        "  z-index: 2147483647; display: flex; align-items: stretch; box-sizing: border-box; padding: 0;",
        "  border-radius: 15px; background: rgba(15, 23, 42, 0.78); color: #f8fafc;",
        "  -webkit-backdrop-filter: blur(6px); backdrop-filter: blur(6px);",
        "  box-shadow: 0 4px 16px rgba(0, 0, 0, 0.25), inset 0 0 0 1px rgba(255, 255, 255, 0.08);",
        "  font: 500 12px/18px system-ui, -apple-system, 'Segoe UI', Roboto, sans-serif;",
        "  user-select: none; -webkit-user-select: none; cursor: default; transition: opacity 0.15s ease; }",
        ".hud.is-dragging { transition: none; box-shadow: 0 8px 28px rgba(0, 0, 0, 0.35), inset 0 0 0 1px rgba(255, 255, 255, 0.14); }",
        // The handle is the whole left end of the pill, tinted so it reads as its own part, and
        // there is no gap to cross before reaching it.
        ".handle { flex: none; display: flex; align-items: center; justify-content: center; width: 26px;",
        "  border-radius: 15px 0 0 15px; background: rgba(255, 255, 255, 0.07);",
        "  border-right: 1px solid rgba(255, 255, 255, 0.12); color: rgba(248, 250, 252, 0.6);",
        "  cursor: grab; touch-action: none; transition: background 0.15s ease, color 0.15s ease; }",
        ".handle:hover { color: #f8fafc; background: rgba(255, 255, 255, 0.16); }",
        ".is-dragging .handle { color: #00dc82; background: rgba(0, 220, 130, 0.16); }",
        ".is-dragging, .is-dragging .handle { cursor: grabbing; }",
        ".content { display: flex; align-items: center; min-width: 0; padding: 5px 12px 5px 10px; }",
        ".list { display: flex; flex-wrap: wrap; align-items: center; gap: 2px 0; min-width: 0; }",
        ".item { display: inline-flex; align-items: center; gap: 6px; white-space: nowrap; min-width: 0; max-width: 100%; }",
        ".sep { flex: none; width: 1px; height: 14px; margin: 0 10px; background: rgba(255, 255, 255, 0.18); }",
        ".name { min-width: 0; max-width: 220px; overflow: hidden; text-overflow: ellipsis; transition: opacity 0.15s ease; }",
        ".is-off .name, .is-off .port { opacity: 0.5; }",
        ".count { flex: none; font: 600 10.5px/16px ui-monospace, SFMono-Regular, Menlo, monospace; color: rgba(248, 250, 252, 0.55); }",
        ".count.failed { color: #fca5a5; }",
        ".has-error .name { color: #fca5a5; text-decoration: underline wavy rgba(252, 165, 165, 0.7); text-underline-offset: 3px; }",
        "button { all: unset; box-sizing: border-box; }",
        "button:focus-visible, input:focus-visible { outline: 2px solid #00dc82; outline-offset: 1px; }",
        // On/off switch, like the ones in the extension's UI.
        ".switch { flex: none; position: relative; width: 24px; height: 14px; border-radius: 7px; cursor: pointer;",
        "  background: rgba(255, 255, 255, 0.25); transition: background 0.15s ease; }",
        ".switch::after { content: ''; position: absolute; top: 2px; left: 2px; width: 10px; height: 10px; border-radius: 50%;",
        "  background: #fff; box-shadow: 0 1px 2px rgba(0, 0, 0, 0.3); transition: transform 0.15s ease; }",
        ".switch[aria-checked='true'] { background: #00c16a; }",
        ".switch[aria-checked='true']::after { transform: translateX(10px); }",
        ".port { flex: none; font: 600 11px/16px ui-monospace, SFMono-Regular, Menlo, monospace; padding: 0 5px;",
        "  border-radius: 6px; background: rgba(0, 220, 130, 0.2); color: #6ee7b7; cursor: text; transition: background 0.15s ease; }",
        "button.port:hover { background: rgba(0, 220, 130, 0.32); }",
        ".add-port { background: none; color: rgba(248, 250, 252, 0.6); box-shadow: inset 0 0 0 1px rgba(248, 250, 252, 0.25);",
        "  opacity: 0.6; transition: opacity 0.15s ease; }",
        ".item:hover .add-port, .add-port:focus-visible { opacity: 1; }",
        "button.add-port:hover { background: rgba(255, 255, 255, 0.1); }",
        "input.port { width: 7ch; border: 0; outline: 0; margin: 0; background: #f8fafc; color: #0f172a;",
        "  user-select: text; -webkit-user-select: text; }",
        ".counts { display: inline-flex; align-items: center; gap: 5px; cursor: help; border-radius: 4px; padding: 0 2px; margin: 0 -2px; }",
        ".counts:hover, .counts.is-open { background: rgba(255, 255, 255, 0.12); }",
        // The log of one redirect, opened by hovering its count; terminal style like the
        // side panel's activity log (src/sidepanel/ActivityLog.vue).
        ".log { position: fixed; inset: auto; margin: 0; border: 0; padding: 0; overflow: hidden; z-index: 2147483647;",
        "  display: flex; flex-direction: column; box-sizing: border-box; border-radius: 12px; background: #0a0f14; color: #c8f5d4;",
        "  box-shadow: 0 18px 50px rgba(0, 0, 0, 0.45), inset 0 0 0 1px rgba(255, 255, 255, 0.09);",
        "  font: 500 11.5px/17px ui-monospace, SFMono-Regular, Menlo, Consolas, monospace; user-select: text; -webkit-user-select: text; }",
        ".log-head { flex: none; display: flex; align-items: center; gap: 8px; padding: 8px 12px; background: #0d141b;",
        "  border-bottom: 1px solid rgba(255, 255, 255, 0.06); }",
        ".log-title { font-weight: 700; color: #6ee7b7; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }",
        ".log-port { flex: none; padding: 0 5px; border-radius: 5px; background: rgba(52, 211, 153, 0.15); color: #6ee7b7; font-weight: 600; }",
        ".log-sum { margin-left: auto; flex: none; color: rgba(200, 245, 212, 0.45); font-size: 10.5px; }",
        ".log-sum b { color: #fda4af; font-weight: 600; }",
        ".log-body { flex: 1 1 auto; min-height: 0; overflow-y: auto; scrollbar-width: thin; scrollbar-color: rgba(200, 245, 212, 0.15) transparent; }",
        ".log-row { padding: 6px 12px; border-bottom: 1px solid rgba(255, 255, 255, 0.04); border-left: 2px solid rgba(52, 211, 153, 0.55); }",
        ".log-row.failed { border-left-color: rgba(251, 113, 133, 0.7); background: rgba(251, 113, 133, 0.04); }",
        ".log-meta { display: flex; align-items: center; gap: 8px; font-size: 10.5px; line-height: 16px; color: rgba(200, 245, 212, 0.4); }",
        ".log-meta .grow { flex: 1; }",
        ".log-sw { padding: 0 4px; border-radius: 3px; background: rgba(255, 255, 255, 0.06); font-size: 9.5px; font-weight: 700; letter-spacing: 0.04em; }",
        ".log-status { font-weight: 700; color: #34d399; }",
        ".log-status.err { color: #fb7185; }",
        ".log-status.pending { color: #fcd34d; }",
        ".log-url, .log-target, .log-error { margin-top: 1px; word-break: break-all; }",
        ".log-url { color: rgba(236, 253, 245, 0.9); }",
        ".log-url .dim { color: rgba(200, 245, 212, 0.4); }",
        ".log-target { color: #67e8f9; }",
        ".log-target::before { content: '→ '; color: rgba(103, 232, 249, 0.7); }",
        ".log-error { color: #fda4af; overflow-wrap: anywhere; word-break: normal; }",
        ".log-error .hint { color: rgba(253, 164, 175, 0.55); }",
        ".log-empty { padding: 14px 12px; color: rgba(200, 245, 212, 0.45); }",
        ".log-empty::before { content: '$ '; color: #34d399; }"
    ].join("\n");

    // Lucide "move" icon (ISC licence).
    var moveIconSvg = '<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.25" ' +
        'stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">' +
        '<path d="M12 2v20"/><path d="m15 19-3 3-3-3"/><path d="m19 9 3 3-3 3"/>' +
        '<path d="M2 12h20"/><path d="m5 9-3 3 3 3"/><path d="m9 5 3-3 3 3"/></svg>';

    var clamp = function(value, min, max) {
        return Math.min(Math.max(value, min), Math.max(min, max));
    };

    // The visible viewport, without scrollbars.
    var viewport = function() {
        var root = document.documentElement;
        return { width: root.clientWidth || window.innerWidth, height: root.clientHeight || window.innerHeight };
    };

    /*
     * A position is anchored to the nearest edges, e.g. { h: "right", x: 10, v: "bottom", y: 10 }
     * for the bottom-right corner, so it stays in that corner when the window is resized and the
     * pill grows away from the edge when more redirects are listed. h can also be "center".
     * null is the default: top centre.
     */
    var isValidPosition = function(p) {
        return !!p && (p.h === "left" || p.h === "right" || p.h === "center") &&
            (p.v === "top" || p.v === "bottom") && typeof p.x === "number" && typeof p.y === "number";
    };

    var applyPosition = function() {
        if (!hud) return;
        var p = isValidPosition(state.hudPosition) ? state.hudPosition : { h: "center", x: 0, v: "top", y: EDGE_GAP };
        var vp = viewport();
        var style = hud.style;

        style.maxWidth = Math.max(vp.width - EDGE_GAP * 2, 0) + "px";
        style.left = style.right = style.top = style.bottom = "auto";
        style.transform = "none";

        // Keep it fully on screen even when the window got smaller since it was placed.
        var x = clamp(p.x, EDGE_GAP, vp.width - hud.offsetWidth - EDGE_GAP);
        var y = clamp(p.y, EDGE_GAP, vp.height - hud.offsetHeight - EDGE_GAP);

        if (p.h === "center") {
            style.left = "50%";
            style.transform = "translateX(-50%)";
        } else {
            style[p.h] = x + "px";
        }
        style[p.v] = y + "px";
        positionLog();
    };

    // Converts where the HUD was dropped into an edge-anchored position.
    var positionFromRect = function(rect) {
        var vp = viewport();
        var centerX = rect.left + rect.width / 2;
        var centerY = rect.top + rect.height / 2;
        var snap = function(offset) {
            return offset - EDGE_GAP <= SNAP_DISTANCE ? EDGE_GAP : Math.round(offset);
        };

        var position = centerY < vp.height / 2
            ? { v: "top", y: snap(rect.top) }
            : { v: "bottom", y: snap(vp.height - rect.bottom) };

        if (Math.abs(centerX - vp.width / 2) <= SNAP_DISTANCE) {
            position.h = "center";
            position.x = 0;
        } else if (centerX < vp.width / 2) {
            position.h = "left";
            position.x = snap(rect.left);
        } else {
            position.h = "right";
            position.x = snap(vp.width - rect.right);
        }

        // Back at the default spot: forget the custom position.
        return position.h === "center" && position.v === "top" && position.y === EDGE_GAP ? null : position;
    };

    var savePosition = function(position) {
        state.hudPosition = position;
        applyPosition();
        if (position) {
            chrome.storage.local.set({ hudPosition: position });
        } else {
            chrome.storage.local.remove("hudPosition");
        }
    };

    var onDragStart = function(e) {
        if (e.button !== 0 || drag) return;
        if (logRuleId !== null) closeLog();
        e.preventDefault();
        var rect = hud.getBoundingClientRect();
        drag = {
            pointerId: e.pointerId,
            startX: e.clientX,
            startY: e.clientY,
            offsetX: e.clientX - rect.left,
            offsetY: e.clientY - rect.top,
            moved: false
        };
        handle.setPointerCapture(e.pointerId);
    };

    var onDragMove = function(e) {
        if (!drag || e.pointerId !== drag.pointerId) return;
        if (!drag.moved) {
            if (Math.abs(e.clientX - drag.startX) < DRAG_THRESHOLD && Math.abs(e.clientY - drag.startY) < DRAG_THRESHOLD) return;
            drag.moved = true;
            hud.classList.add("is-dragging");
        }
        // While dragging, place by the top-left corner and keep the whole pill on screen.
        var vp = viewport();
        var style = hud.style;
        style.right = style.bottom = "auto";
        style.transform = "none";
        style.left = clamp(e.clientX - drag.offsetX, EDGE_GAP, vp.width - hud.offsetWidth - EDGE_GAP) + "px";
        style.top = clamp(e.clientY - drag.offsetY, EDGE_GAP, vp.height - hud.offsetHeight - EDGE_GAP) + "px";
    };

    var endDrag = function(e, cancelled) {
        if (!drag || e.pointerId !== drag.pointerId) return;
        var moved = drag.moved;
        drag = null;
        hud.classList.remove("is-dragging");
        if (handle.hasPointerCapture(e.pointerId)) handle.releasePointerCapture(e.pointerId);
        if (!moved || cancelled) {
            applyPosition();
            return;
        }
        savePosition(positionFromRect(hud.getBoundingClientRect()));
    };

    var onDragEnd = function(e) {
        endDrag(e, false);
    };

    var onDragCancel = function(e) {
        endDrag(e, true);
    };

    // Escape while dragging puts the HUD back where it was.
    var onKeyDown = function(e) {
        if (e.key === "Escape" && drag) {
            onDragCancel({ pointerId: drag.pointerId });
        } else if (e.key === "Escape" && logRuleId !== null) {
            closeLog();
        }
    };

    /*
     * Hovering a redirect's count opens its requests on this page, newest first, from the
     * activity log (src/extension/activityLog.js). It stays open while the pointer is on
     * the count or the log, and follows new requests.
     */
    var logPanel = null;
    var logRuleId = null;
    var logEntries = null; // null while loading
    var logCloseTimer = null;
    var logFetchTimer = null;
    var LOG_CLOSE_DELAY = 250;
    var LOG_GAP = 6;

    var el = function(tag, className, text) {
        var node = document.createElement(tag);
        if (className) node.className = className;
        // Always text: URLs come from the page's requests.
        if (text !== undefined) node.textContent = text;
        return node;
    };

    var pad = function(n, width) {
        return String(n).padStart(width || 2, "0");
    };

    var formatTime = function(time) {
        var d = new Date(time);
        return pad(d.getHours()) + ":" + pad(d.getMinutes()) + ":" + pad(d.getSeconds()) + "." + pad(d.getMilliseconds(), 3);
    };

    var formatDuration = function(ms) {
        return ms >= 1000 ? (ms / 1000).toFixed(1) + "s" : ms + "ms";
    };

    var logAnchor = function() {
        return logRuleId === null || !list ? null : list.querySelector('.counts[data-rule-id="' + CSS.escape(String(logRuleId)) + '"]');
    };

    var positionLog = function() {
        if (!logPanel || logRuleId === null) return;
        var vp = viewport();
        var hudRect = hud.getBoundingClientRect();
        var anchor = logAnchor();
        var anchorRect = anchor ? anchor.getBoundingClientRect() : hudRect;
        var width = Math.min(640, vp.width - EDGE_GAP * 2);
        var style = logPanel.style;
        style.width = width + "px";
        style.left = clamp(anchorRect.left - 16, EDGE_GAP, vp.width - width - EDGE_GAP) + "px";
        // Below the HUD in the top half of the window, above it in the bottom half.
        if (hudRect.top + hudRect.height / 2 < vp.height / 2) {
            style.top = hudRect.bottom + LOG_GAP + "px";
            style.bottom = "auto";
            style.maxHeight = Math.max(vp.height - hudRect.bottom - LOG_GAP - EDGE_GAP, 120) + "px";
        } else {
            style.top = "auto";
            style.bottom = vp.height - hudRect.top + LOG_GAP + "px";
            style.maxHeight = Math.max(hudRect.top - LOG_GAP - EDGE_GAP, 120) + "px";
        }
        style.height = "auto";
    };

    var hintFor = function(entry) {
        if (/CONNECTION_REFUSED|ADDRESS_UNREACHABLE/.test(entry.error || "")) return "is the local server running?";
        if (/BLOCKED_BY_CLIENT/.test(entry.error || "")) return "blocked by another extension";
        // A fetch/XHR redirected to another origin fails without CORS headers on the local server.
        if (entry.error === "net::ERR_FAILED" && entry.resourceType === "xmlhttprequest") return "CORS? the local server must allow this site";
        return "";
    };

    var renderLogRow = function(entry) {
        var failed = !!entry.error || entry.status >= 400;
        var row = el("div", "log-row" + (failed ? " failed" : ""));
        var meta = el("div", "log-meta");
        meta.appendChild(el("span", "", formatTime(entry.time)));
        meta.appendChild(el("span", "", [entry.method, entry.resourceType].filter(Boolean).join(" ")));
        if (entry.tabId < 0) {
            var sw = el("span", "log-sw", "SW");
            sw.title = "Requested by the site's service worker";
            meta.appendChild(sw);
        }
        meta.appendChild(el("span", "grow"));
        if (entry.duration !== undefined) meta.appendChild(el("span", "", formatDuration(entry.duration)));
        var pending = !entry.error && (entry.status === undefined || entry.status === null);
        var label = entry.error ? "ERR" : pending ? "···" : String(entry.status) + (entry.fromCache ? "·c" : "");
        meta.appendChild(el("span", "log-status" + (failed ? " err" : pending ? " pending" : ""), label));
        row.appendChild(meta);

        var url = el("div", "log-url");
        var m = /^([a-z][a-z0-9+.-]*:\/\/[^\/?#]*)(.*)$/i.exec(entry.url || "");
        url.appendChild(el("span", "dim", m ? m[1] : ""));
        url.appendChild(document.createTextNode(m ? m[2] : entry.url || ""));
        row.appendChild(url);
        if (entry.redirectUrl) row.appendChild(el("div", "log-target", entry.redirectUrl));
        if (entry.error) {
            var error = el("div", "log-error", "✕ " + entry.error);
            var hint = hintFor(entry);
            if (hint) error.appendChild(el("span", "hint", " · " + hint));
            row.appendChild(error);
        }
        return row;
    };

    var renderLog = function() {
        if (!logPanel || logRuleId === null) return;
        var redirect = (state.hudRedirects || []).filter(function(r) { return r.id === logRuleId; })[0];
        logPanel.textContent = "";

        var head = el("div", "log-head");
        head.appendChild(el("span", "log-title", redirect ? redirect.name : "Redirect"));
        if (redirect && redirect.port) head.appendChild(el("span", "log-port", ":" + redirect.port));
        var sum = el("span", "log-sum");
        if (logEntries) {
            var failedCount = logEntries.filter(function(e) { return !!e.error || e.status >= 400; }).length;
            sum.textContent = logEntries.length + " request" + (logEntries.length === 1 ? "" : "s") + " on this page";
            if (failedCount) {
                sum.appendChild(document.createTextNode(" · "));
                sum.appendChild(el("b", "", failedCount + " failed"));
            }
        }
        head.appendChild(sum);
        logPanel.appendChild(head);

        var body = el("div", "log-body");
        if (!logEntries) {
            body.appendChild(el("div", "log-empty", "loading…"));
        } else if (logEntries.length === 0) {
            body.appendChild(el("div", "log-empty", "no requests on this page yet"));
        } else {
            logEntries.slice().reverse().forEach(function(entry) {
                body.appendChild(renderLogRow(entry));
            });
        }
        logPanel.appendChild(body);
        positionLog();
    };

    var fetchLog = function() {
        var ruleId = logRuleId;
        chrome.runtime.sendMessage({ action: "hudGetRuleActivity", ruleId: ruleId, since: pageStart - 1 }).then(function(entries) {
            if (logRuleId !== ruleId) return;
            logEntries = entries || [];
            renderLog();
        }).catch(function() {});
    };

    // Requests can arrive in bursts; refresh the open log a few times a second at most.
    var refreshLogSoon = function() {
        if (logFetchTimer) return;
        logFetchTimer = setTimeout(function() {
            logFetchTimer = null;
            if (logRuleId !== null) fetchLog();
        }, 300);
    };

    var markAnchor = function() {
        if (!list) return;
        Array.prototype.forEach.call(list.querySelectorAll(".counts.is-open"), function(node) {
            node.classList.remove("is-open");
        });
        var anchor = logAnchor();
        if (anchor) anchor.classList.add("is-open");
    };

    var openLog = function(redirect) {
        clearTimeout(logCloseTimer);
        if (logRuleId === redirect.id) return;
        logRuleId = redirect.id;
        logEntries = null;
        logPanel.style.display = "flex";
        if (supportsPopover && !logPanel.matches(":popover-open")) logPanel.showPopover();
        renderLog();
        markAnchor();
        fetchLog();
        document.addEventListener("pointermove", onLogPointerMove, { capture: true, passive: true });
    };

    var closeLog = function() {
        clearTimeout(logCloseTimer);
        logRuleId = null;
        logEntries = null;
        markAnchor();
        document.removeEventListener("pointermove", onLogPointerMove, true);
        if (!logPanel) return;
        if (supportsPopover && logPanel.matches(":popover-open")) logPanel.hidePopover();
        logPanel.style.display = "none";
    };

    var isInside = function(rect, x, y, margin) {
        return x >= rect.left - margin && x <= rect.right + margin && y >= rect.top - margin && y <= rect.bottom + margin;
    };

    // Checked by position: the HUD re-renders its items as requests come in, so the count
    // under the pointer may be a new element that never saw the pointer enter.
    var onLogPointerMove = function(e) {
        var anchor = logAnchor();
        var overAnchor = anchor && isInside(anchor.getBoundingClientRect(), e.clientX, e.clientY, 4);
        var overLog = isInside(logPanel.getBoundingClientRect(), e.clientX, e.clientY, LOG_GAP);
        if (overAnchor || overLog) {
            clearTimeout(logCloseTimer);
            logCloseTimer = null;
        } else if (!logCloseTimer) {
            logCloseTimer = setTimeout(closeLog, LOG_CLOSE_DELAY);
        }
    };

    var ensureHud = function() {
        if (host) return;
        host = document.createElement("resourced-hud");
        // Inline !important beats page rules that might hide unknown elements.
        host.style.setProperty("display", "block", "important");
        host.style.setProperty("visibility", "visible", "important");
        host.style.setProperty("opacity", "1", "important");
        var shadow = host.attachShadow({ mode: "closed" });
        var style = document.createElement("style");
        style.textContent = css;

        hud = document.createElement("div");
        hud.className = "hud";
        hud.setAttribute("role", "region");
        hud.setAttribute("aria-label", "Resourced: URL redirects");
        if (supportsPopover) hud.setAttribute("popover", "manual");

        handle = document.createElement("span");
        handle.className = "handle";
        handle.title = "Drag to move the HUD · double-click to reset";
        handle.setAttribute("aria-label", "Move the HUD");
        handle.innerHTML = moveIconSvg;
        handle.addEventListener("pointerdown", onDragStart);
        handle.addEventListener("pointermove", onDragMove);
        handle.addEventListener("pointerup", onDragEnd);
        handle.addEventListener("pointercancel", onDragCancel);
        handle.addEventListener("lostpointercapture", onDragEnd);
        handle.addEventListener("dblclick", function() {
            savePosition(null);
        });

        var content = document.createElement("span");
        content.className = "content";
        list = document.createElement("span");
        list.className = "list";
        content.appendChild(list);

        logPanel = document.createElement("div");
        logPanel.className = "log";
        logPanel.style.display = "none";
        logPanel.setAttribute("role", "dialog");
        logPanel.setAttribute("aria-label", "Requests of this redirect on the page");
        if (supportsPopover) logPanel.setAttribute("popover", "manual");

        // Clicks and typing in the HUD are the HUD's own; the page shouldn't react to them
        // (shortcuts, "click outside" handlers). Its capture listeners still see them.
        ["click", "pointerdown", "mousedown", "keydown", "keyup", "keypress"].forEach(function(type) {
            [hud, logPanel].forEach(function(node) {
                node.addEventListener(type, function(e) {
                    e.stopPropagation();
                });
            });
        });

        hud.appendChild(handle);
        hud.appendChild(content);

        shadow.appendChild(style);
        shadow.appendChild(hud);
        shadow.appendChild(logPanel);

        document.addEventListener("keydown", onKeyDown, true);
        window.addEventListener("resize", applyPosition);
    };

    // Settings → Sites; same as getSiteLists / siteIsEnabled in src/extension/urlPattern.js.
    var parseSites = function(value) {
        return String(value || "").split(/[\s,;]+/).map(function(entry) {
            return entry.trim().toLowerCase()
                .replace(/^[a-z][a-z0-9+.-]*:\/\//, "")
                .replace(/[\/?#].*$/, "")
                .replace(/:\d+$/, "")
                .replace(/\.$/, "");
        }).filter(Boolean);
    };

    var siteMatchesHost = function(pattern, host) {
        var domain = pattern.replace(/^\*\./, "");
        if (domain.indexOf("*") === -1) return host === domain || host.endsWith("." + domain);
        var regex = "^" + pattern.replace(/[.+?^${}()|[\]\\\/]/g, "\\$&").replace(/\*/g, "[^/?#@:]*") + "$";
        return new RegExp(regex).test(host);
    };

    var siteIsEnabled = function(allowList, blockList, host) {
        host = String(host || "").toLowerCase();
        // Only plain domains can limit the network rules, so only those count here too.
        var allow = parseSites(allowList).filter(function(pattern) {
            return pattern.replace(/^\*\./, "").indexOf("*") === -1;
        });
        var matches = function(pattern) {
            return siteMatchesHost(pattern, host);
        };
        if (parseSites(blockList).some(matches)) return false;
        return allow.length === 0 || allow.some(matches);
    };

    // Same parsing as the rules' domain filters (parseDomainList in urlPattern.js).
    var siteAllowed = function() {
        var sites = String(state.hudSites || "").split(/[\s,;]+/).map(function(entry) {
            return entry.trim().toLowerCase()
                .replace(/^[a-z][a-z0-9+.-]*:\/\//, "")
                .replace(/[\/?#].*$/, "")
                .replace(/:\d+$/, "")
                .replace(/^\*\./, "")
                .replace(/\.$/, "");
        }).filter(Boolean);
        var host = location.hostname.toLowerCase();
        return sites.length === 0 || sites.some(function(domain) {
            return host === domain || host.endsWith("." + domain);
        });
    };

    var countsFor = function(ruleId) {
        var counts = { total: 0, failed: 0 };
        Object.keys(activity).forEach(function(id) {
            if (activity[id].ruleId !== ruleId) return;
            counts.total++;
            if (activity[id].failed) counts.failed++;
        });
        return counts;
    };

    var addActivity = function(entry) {
        // Only this page's requests, not the ones of earlier pages in the tab.
        if (entry && entry.time >= pageStart - 1) activity[entry.id] = entry;
    };

    var visibleRedirects = function() {
        var redirects = Array.isArray(state.hudRedirects) ? state.hudRedirects : [];
        return redirects.filter(function(redirect) {
            if (sticky[redirect.id]) return true;
            if (state.hudOnlyEnabled && !redirect.on) return false;
            if (state.hudOnlyUsed && countsFor(redirect.id).total === 0) return false;
            return true;
        });
    };

    var shouldShow = function() {
        var redirects = Array.isArray(state.hudRedirects) ? state.hudRedirects : [];
        return state.hudEnabled && siteAllowed() && siteIsEnabled(state.siteAllowlist, state.siteBlocklist, location.hostname) &&
            visibleRedirects().length > 0 &&
            (keepVisible || redirects.some(function(redirect) { return redirect.on; }));
    };

    // Applied here right away; the background saves it and publishes the list again.
    var updateRule = function(redirect, change) {
        change.action = "hudUpdateRule";
        change.ruleId = redirect.id;
        chrome.runtime.sendMessage(change).catch(function() {});
    };

    var toggleRedirect = function(redirect, e) {
        // Only the user can switch rules, not the page's scripts.
        if (!e.isTrusted) return;
        redirect.on = !redirect.on;
        keepVisible = true;
        sticky[redirect.id] = true;
        render();
        updateRule(redirect, { on: redirect.on });
    };

    var startPortEdit = function(redirect, button, e) {
        if (!e.isTrusted || editingId !== null) return;
        editingId = redirect.id;
        var input = document.createElement("input");
        input.className = "port";
        input.value = redirect.port;
        input.placeholder = "port";
        input.inputMode = "numeric";
        input.maxLength = 6;
        input.setAttribute("aria-label", "Destination port");
        var done = false;
        var finish = function(save) {
            if (done) return;
            done = true;
            editingId = null;
            var port = input.value.trim().replace(/^:/, "");
            // The background checks the range too; this just avoids a round trip for typos.
            if (save && port !== redirect.port && /^\d{0,5}$/.test(port) && (port === "" || (+port >= 1 && +port <= 65535))) {
                redirect.port = port;
                updateRule(redirect, { port: port });
            }
            render();
        };
        input.addEventListener("keydown", function(ev) {
            if (ev.key === "Enter") {
                ev.preventDefault();
                finish(true);
            } else if (ev.key === "Escape") {
                ev.preventDefault();
                finish(false);
            }
        });
        input.addEventListener("blur", function() {
            finish(true);
        });
        button.replaceWith(input);
        input.focus();
        input.select();
        applyPosition();
    };

    var renderItem = function(redirect) {
        var counts = countsFor(redirect.id);
        var item = document.createElement("span");
        item.className = "item" + (redirect.on ? "" : " is-off") + (redirect.error ? " has-error" : "");
        item.title = redirect.error
            ? redirect.name + ": not applied. " + redirect.error
            : redirect.name + (redirect.port ? " → :" + redirect.port : "") + (redirect.on ? "" : " (off)") +
                (counts.total ? " · " + counts.total + " request" + (counts.total === 1 ? "" : "s") + " on this page" +
                    (counts.failed ? ", " + counts.failed + " failed" : "") : "");

        if (state.hudShowSwitches) item.appendChild(renderSwitch(redirect));

        var name = document.createElement("span");
        name.className = "name";
        name.textContent = redirect.name;
        item.appendChild(name);

        var portMode = state.hudPortMode === "hide" || state.hudPortMode === "show" ? state.hudPortMode : "edit";
        var canEdit = portMode === "edit" && redirect.canEditPort;
        if (portMode !== "hide" && (redirect.port || canEdit)) {
            var port = document.createElement(canEdit ? "button" : "span");
            port.className = "port" + (redirect.port ? "" : " add-port");
            port.textContent = redirect.port ? ":" + redirect.port : "+port";
            if (canEdit) {
                port.type = "button";
                port.title = redirect.port ? "Click to change the port" : "Add a port to the destination URL";
                port.addEventListener("click", function(e) {
                    startPortEdit(redirect, port, e);
                });
            } else {
                port.style.cursor = "default";
            }
            item.appendChild(port);
        }

        if (state.hudShowCounts && counts.total > 0) {
            var countsEl = document.createElement("span");
            countsEl.className = "counts" + (logRuleId === redirect.id ? " is-open" : "");
            countsEl.setAttribute("data-rule-id", String(redirect.id));
            // No item tooltip over the log it opens.
            countsEl.title = "";
            var count = document.createElement("span");
            count.className = "count";
            count.textContent = "×" + counts.total;
            countsEl.appendChild(count);
            if (counts.failed > 0) {
                var failed = document.createElement("span");
                failed.className = "count failed";
                failed.textContent = "✕" + counts.failed;
                countsEl.appendChild(failed);
            }
            countsEl.addEventListener("mouseenter", function() {
                openLog(redirect);
            });
            item.appendChild(countsEl);
        }
        return item;
    };

    var renderSwitch = function(redirect) {
        var toggle = document.createElement("button");
        toggle.type = "button";
        toggle.className = "switch";
        toggle.setAttribute("role", "switch");
        toggle.setAttribute("aria-checked", String(!!redirect.on));
        toggle.setAttribute("aria-label", (redirect.on ? "Switch off " : "Switch on ") + redirect.name);
        toggle.addEventListener("click", function(e) {
            toggleRedirect(redirect, e);
        });
        return toggle;
    };

    var attach = function() {
        if (host.isConnected) return;
        (document.documentElement || document.body).appendChild(host);
        if (supportsPopover && !hud.matches(":popover-open")) hud.showPopover();
    };

    var render = function() {
        if (isDestroyed) return;
        // Finishing the edit renders whatever changed meanwhile.
        if (editingId !== null) return;
        if (!shouldShow()) {
            if (logRuleId !== null) closeLog();
            if (host) host.remove();
            return;
        }

        ensureHud();
        list.textContent = "";
        hud.style.opacity = String(state.hudOpacity);

        visibleRedirects().forEach(function(redirect, index) {
            if (index > 0) {
                var sep = document.createElement("span");
                sep.className = "sep";
                list.appendChild(sep);
            }
            list.appendChild(renderItem(redirect));
        });

        attach();
        // Measured after the content changed, so a wider pill still fits on screen.
        if (!drag) applyPosition();
        // The count it hangs from was re-created and may have moved.
        if (logRuleId !== null) {
            if (logAnchor()) positionLog();
            else closeLog();
        }
    };

    // Some apps (e.g. React hydrating the whole document) drop nodes they didn't render;
    // put the HUD back when that happens.
    var observer = new MutationObserver(function() {
        if (host && !host.isConnected && shouldShow()) {
            attach();
            applyPosition();
        }
    });
    observer.observe(document.documentElement, { childList: true });

    var destroy = function() {
        isDestroyed = true;
        observer.disconnect();
        document.removeEventListener(REPLACE_EVENT, destroy);
        document.removeEventListener("keydown", onKeyDown, true);
        document.removeEventListener("pointermove", onLogPointerMove, true);
        window.removeEventListener("resize", applyPosition);
        if (host) host.remove();
    };
    // Registered after the dispatch above, so this copy only hears the next one.
    document.addEventListener(REPLACE_EVENT, destroy);

    var keys = Object.keys(DEFAULTS).concat("hudRedirects");

    // Many requests can arrive at once; one render per frame is enough.
    var scheduleRender = function() {
        if (renderQueued) return;
        renderQueued = true;
        requestAnimationFrame(function() {
            renderQueued = false;
            render();
        });
    };

    chrome.runtime.sendMessage({ action: "hudGetActivity" }).then(function(entries) {
        (entries || []).forEach(addActivity);
        scheduleRender();
    }).catch(function() {});

    chrome.runtime.onMessage.addListener(function(msg) {
        if (msg && msg.action === "hudActivity" && !isDestroyed) {
            addActivity(msg.entry);
            scheduleRender();
            if (msg.entry && msg.entry.ruleId === logRuleId) refreshLogSoon();
        }
    });

    chrome.storage.local.get(keys, function(result) {
        keys.forEach(function(key) {
            if (result[key] !== undefined) state[key] = result[key];
        });
        // Rules registered before the HUD existed were never published; ask for it once.
        if (result.hudRedirects === undefined) {
            chrome.runtime.sendMessage({ action: "updateDNRRules" }).catch(function() {});
        }
        render();
    });

    // Also keeps every open tab in step when the HUD is moved in one of them.
    chrome.storage.onChanged.addListener(function(changes, area) {
        if (area !== "local") return;
        var changed = false;
        keys.forEach(function(key) {
            if (changes[key]) {
                state[key] = changes[key].newValue !== undefined ? changes[key].newValue : (key === "hudRedirects" ? [] : DEFAULTS[key]);
                changed = true;
            }
        });
        if (changed) render();
    });
})();
