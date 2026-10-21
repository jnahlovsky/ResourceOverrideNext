// Mock responses (mockRule) for the page's fetch() and XMLHttpRequest calls. Runs in the
// page's own world at document_start, before the page's scripts. The mocks come from the
// extension's side (src/inject/mockBridge.js), which also gets a report of each one used,
// for the activity log. Calls that match no mock go out unchanged.
// No imports and no extension APIs: this is a plain script in the page.
(function() {
    "use strict";

    if (window.__resourcedMockShim) return;
    Object.defineProperty(window, "__resourcedMockShim", { value: true });

    var CONFIG_EVENT = "resourced:mocks";
    var REQUEST_EVENT = "resourced:mocks-request";
    var USED_EVENT = "resourced:mock-used";
    // Calls made before the mocks arrive wait for them, at most this long.
    var CONFIG_TIMEOUT_MS = 1500;
    var NO_BODY_STATUSES = [204, 205, 304];
    var STATUS_TEXT = {
        200: "OK", 201: "Created", 202: "Accepted", 204: "No Content", 301: "Moved Permanently", 302: "Found",
        304: "Not Modified", 400: "Bad Request", 401: "Unauthorized", 403: "Forbidden", 404: "Not Found",
        409: "Conflict", 422: "Unprocessable Entity", 429: "Too Many Requests", 500: "Internal Server Error",
        502: "Bad Gateway", 503: "Service Unavailable", 504: "Gateway Timeout"
    };

    var mocks = null;
    var waiters = [];

    var setMocks = function(list) {
        mocks = (Array.isArray(list) ? list : []).map(function(mock) {
            var re = null;
            try {
                re = mock.regex ? new RegExp(mock.regex, "i") : null;
            } catch (e) {
                re = /$^/; // An invalid pattern matches nothing.
            }
            return Object.assign({}, mock, { re: re });
        });
        waiters.splice(0).forEach(function(resolve) {
            resolve();
        });
    };

    document.addEventListener(CONFIG_EVENT, function(event) {
        try {
            setMocks(JSON.parse(event.detail));
        } catch (e) {
            setMocks([]);
        }
    });
    document.dispatchEvent(new CustomEvent(REQUEST_EVENT));
    setTimeout(function() {
        if (!mocks) setMocks([]);
    }, CONFIG_TIMEOUT_MS);

    var whenReady = function() {
        return mocks ? Promise.resolve() : new Promise(function(resolve) {
            waiters.push(resolve);
        });
    };

    var hostMatches = function(host, domain) {
        return host === domain || host.endsWith("." + domain);
    };

    var findMock = function(url) {
        if (!mocks || mocks.length === 0) return null;
        var host;
        try {
            host = new URL(url).hostname;
        } catch (e) {
            return null;
        }
        for (var i = 0; i < mocks.length; i++) {
            var mock = mocks[i];
            if (mock.re && !mock.re.test(url)) continue;
            if ((mock.exclude || []).some(function(d) { return hostMatches(host, d); })) continue;
            if ((mock.include || []).length > 0 && !mock.include.some(function(d) { return hostMatches(host, d); })) continue;
            return mock;
        }
        return null;
    };

    var report = function(mock, url, method, status, error) {
        document.dispatchEvent(new CustomEvent(USED_EVENT, {
            detail: JSON.stringify({ ruleId: mock.id, url: url, method: method, status: status, delay: mock.delay, error: error || "" })
        }));
    };

    var sleep = function(ms) {
        return ms > 0 ? new Promise(function(resolve) { setTimeout(resolve, ms); }) : Promise.resolve();
    };

    var headersOf = function(mock) {
        var headers = { "Content-Type": mock.contentType || "text/plain" };
        (mock.headers || []).forEach(function(h) {
            headers[h.header] = h.value;
        });
        return headers;
    };

    var bodyFor = function(mock) {
        return NO_BODY_STATUSES.indexOf(mock.status) !== -1 ? null : mock.body;
    };

    // fetch()
    var originalFetch = window.fetch;
    if (typeof originalFetch === "function") {
        window.fetch = function(input, init) {
            var self = this;
            var args = arguments;
            var request;
            try {
                request = new Request(input, init);
            } catch (e) {
                return originalFetch.apply(self, args);
            }
            var proceed = function() {
                var mock = findMock(request.url);
                if (!mock) return originalFetch.apply(self, args);
                return sleep(mock.delay).then(function() {
                    if (mock.mode === "delay") {
                        return originalFetch.apply(self, args).then(function(response) {
                            report(mock, request.url, request.method, response.status);
                            return response;
                        }, function(error) {
                            report(mock, request.url, request.method, 0, String(error && error.message || error));
                            throw error;
                        });
                    }
                    report(mock, request.url, request.method, mock.status);
                    var response = new Response(bodyFor(mock), {
                        status: mock.status,
                        statusText: STATUS_TEXT[mock.status] || "",
                        headers: headersOf(mock)
                    });
                    Object.defineProperty(response, "url", { value: request.url });
                    return response;
                });
            };
            // Only calls made before the mocks arrive wait for them.
            return mocks ? proceed() : whenReady().then(proceed);
        };
    }

    // XMLHttpRequest
    var proto = XMLHttpRequest.prototype;
    var originalOpen = proto.open;
    var originalSend = proto.send;

    proto.open = function(method, url, async) {
        var absolute;
        try {
            absolute = new URL(url, location.href).href;
        } catch (e) {
            absolute = String(url);
        }
        this.__resourced = { method: String(method || "GET").toUpperCase(), url: absolute, async: async !== false };
        return originalOpen.apply(this, arguments);
    };

    var define = function(xhr, name, value) {
        Object.defineProperty(xhr, name, { configurable: true, get: function() { return value; } });
    };

    // Plays out a finished request on the XHR object, as if the server had answered.
    var answer = function(xhr, mock, info) {
        var body = bodyFor(mock) || "";
        var headers = headersOf(mock);
        var headerLines = Object.keys(headers).map(function(name) {
            return name.toLowerCase() + ": " + headers[name];
        }).join("\r\n");
        var response = body;
        if (xhr.responseType === "json") {
            try {
                response = JSON.parse(body);
            } catch (e) {
                response = null;
            }
        } else if (xhr.responseType === "blob") {
            response = new Blob([body], { type: headers["Content-Type"] });
        } else if (xhr.responseType === "arraybuffer") {
            response = new TextEncoder().encode(body).buffer;
        } else if (xhr.responseType === "document") {
            response = new DOMParser().parseFromString(body, "text/html");
        }
        define(xhr, "readyState", 4);
        define(xhr, "status", mock.status);
        define(xhr, "statusText", STATUS_TEXT[mock.status] || "");
        define(xhr, "responseURL", info.url);
        define(xhr, "response", response);
        if (xhr.responseType === "" || xhr.responseType === "text") define(xhr, "responseText", body);
        xhr.getAllResponseHeaders = function() {
            return headerLines + "\r\n";
        };
        xhr.getResponseHeader = function(name) {
            var key = Object.keys(headers).filter(function(h) { return h.toLowerCase() === String(name).toLowerCase(); })[0];
            return key ? headers[key] : null;
        };
        ["readystatechange", "load", "loadend"].forEach(function(type) {
            var event = type === "readystatechange" ? new Event(type) : new ProgressEvent(type, { lengthComputable: true, loaded: body.length, total: body.length });
            xhr.dispatchEvent(event);
        });
    };

    proto.send = function() {
        var xhr = this;
        var args = arguments;
        var info = xhr.__resourced;
        // A synchronous request can't wait for anything; it goes out unchanged.
        if (!info || !info.async) return originalSend.apply(xhr, args);
        var proceed = function() {
            var mock = findMock(info.url);
            if (!mock) return originalSend.apply(xhr, args);
            sleep(mock.delay).then(function() {
                if (mock.mode === "delay") {
                    xhr.addEventListener("loadend", function() {
                        report(mock, info.url, info.method, xhr.status);
                    });
                    originalSend.apply(xhr, args);
                    return;
                }
                report(mock, info.url, info.method, mock.status);
                answer(xhr, mock, info);
            });
        };
        if (mocks) proceed();
        else whenReady().then(proceed);
    };
})();
