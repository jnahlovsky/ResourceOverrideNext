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
    var DEFAULTS = { hudEnabled: true, hudOpacity: 0.85, hudPosition: null };
    // Distance kept from the viewport edges; also the default distance from the top.
    var EDGE_GAP = 10;
    // Drops this close to an edge (or the horizontal centre) snap onto it.
    var SNAP_DISTANCE = 24;
    // Pointer travel below this is a click on the handle, not a drag.
    var DRAG_THRESHOLD = 3;

    var state = { hudEnabled: DEFAULTS.hudEnabled, hudOpacity: DEFAULTS.hudOpacity, hudPosition: null, hudRedirects: [] };
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
        "  user-select: text; -webkit-user-select: text; }"
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

        // Clicks and typing in the HUD are the HUD's own; the page shouldn't react to them
        // (shortcuts, "click outside" handlers). Its capture listeners still see them.
        ["click", "pointerdown", "mousedown", "keydown", "keyup", "keypress"].forEach(function(type) {
            hud.addEventListener(type, function(e) {
                e.stopPropagation();
            });
        });

        hud.appendChild(handle);
        hud.appendChild(content);
        shadow.appendChild(style);
        shadow.appendChild(hud);

        document.addEventListener("keydown", onKeyDown, true);
        window.addEventListener("resize", applyPosition);
    };

    var shouldShow = function() {
        var redirects = Array.isArray(state.hudRedirects) ? state.hudRedirects : [];
        return state.hudEnabled && redirects.length > 0 &&
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
        var item = document.createElement("span");
        item.className = "item" + (redirect.on ? "" : " is-off") + (redirect.error ? " has-error" : "");
        item.title = redirect.error
            ? redirect.name + ": not applied. " + redirect.error
            : redirect.name + (redirect.port ? " → :" + redirect.port : "") + (redirect.on ? "" : " (off)");

        var toggle = document.createElement("button");
        toggle.type = "button";
        toggle.className = "switch";
        toggle.setAttribute("role", "switch");
        toggle.setAttribute("aria-checked", String(!!redirect.on));
        toggle.setAttribute("aria-label", (redirect.on ? "Switch off " : "Switch on ") + redirect.name);
        toggle.addEventListener("click", function(e) {
            toggleRedirect(redirect, e);
        });
        item.appendChild(toggle);

        var name = document.createElement("span");
        name.className = "name";
        name.textContent = redirect.name;
        item.appendChild(name);

        if (redirect.port || redirect.canEditPort) {
            var port = document.createElement(redirect.canEditPort ? "button" : "span");
            port.className = "port" + (redirect.port ? "" : " add-port");
            port.textContent = redirect.port ? ":" + redirect.port : "+port";
            if (redirect.canEditPort) {
                port.type = "button";
                port.title = redirect.port ? "Click to change the port" : "Add a port to the destination URL";
                port.addEventListener("click", function(e) {
                    startPortEdit(redirect, port, e);
                });
            }
            item.appendChild(port);
        }
        return item;
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
            if (host) host.remove();
            return;
        }

        ensureHud();
        list.textContent = "";
        hud.style.opacity = String(state.hudOpacity);

        state.hudRedirects.forEach(function(redirect, index) {
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
        window.removeEventListener("resize", applyPosition);
        if (host) host.remove();
    };
    // Registered after the dispatch above, so this copy only hears the next one.
    document.addEventListener(REPLACE_EVENT, destroy);

    var keys = ["hudEnabled", "hudOpacity", "hudPosition", "hudRedirects"];

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
                state[key] = changes[key].newValue !== undefined ? changes[key].newValue : DEFAULTS[key];
                changed = true;
            }
        });
        if (changed) render();
    });
})();
