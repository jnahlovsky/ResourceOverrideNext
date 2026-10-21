// Shared helpers that turn rule patterns into Chrome declarativeNetRequest conditions.
// Kept free of extension APIs so the UI (Test Rules) and tests can use the same logic.

const escapeRegex = (str) => str.replace(/[.*+?^${}()|[\]\\\/]/g, "\\$&");

// Chrome regexSubstitution only supports \0 - \9.
const MAX_CAPTURE_GROUPS = 9;

export function isRegexPattern(pattern) {
    return !!pattern && pattern.length > 2 && pattern.startsWith('/') && pattern.endsWith('/');
}

// Rules created before matchMode existed marked regex patterns by wrapping them in slashes.
export function getMatchMode(rule) {
    if (rule.matchMode === 'regex' || rule.matchMode === 'wildcard') return rule.matchMode;
    return isRegexPattern(rule.match) ? 'regex' : 'wildcard';
}

// Regex rules may still be stored as /pattern/ from older versions.
export function getRegexSource(pattern) {
    if (!pattern) return "";
    return isRegexPattern(pattern) ? pattern.substring(1, pattern.length - 1) : pattern;
}

// Converts the literal (non-star) parts of a urlFilter-style pattern into regex,
// keeping urlFilter's special characters: leading `||` (domain anchor), leading or
// trailing `|` (start/end anchor) and `^` (separator).
function literalToRegex(literal, isFirst, isLast) {
    let prefix = "";
    let suffix = "";
    if (isFirst && literal.startsWith("||")) {
        prefix = "^[a-z][a-z0-9+.-]*:\\/\\/(?:[^\\/?#]*\\.)?";
        literal = literal.substring(2);
    } else if (isFirst && literal.startsWith("|")) {
        prefix = "^";
        literal = literal.substring(1);
    }
    if (isLast && literal.endsWith("|")) {
        suffix = "$";
        literal = literal.substring(0, literal.length - 1);
    }
    const body = literal.split("^").map(escapeRegex).join("(?:[^A-Za-z0-9_.%-]|$)");
    return prefix + body + suffix;
}

// Translates a wildcard pattern into an unanchored regex with one capture group per
// star group, numbered in order of appearance.
function wildcardToRegex(match) {
    const tokens = match.split(/(\*+)/g).filter(t => t !== "");
    const groupsByLength = {};
    let groupCount = 0;
    let regex = "";

    tokens.forEach((token, i) => {
        if (token.charAt(0) === "*") {
            groupCount++;
            (groupsByLength[token.length] = groupsByLength[token.length] || []).push(groupCount);
            // A trailing group takes the rest of the URL; inner groups stop at the next literal.
            regex += i === tokens.length - 1 ? "(.*)" : "(.*?)";
        } else {
            regex += literalToRegex(token, i === 0, i === tokens.length - 1);
        }
    });

    return { regex, groupsByLength, groupCount };
}

// Replaces each star group in a destination with a reference to the source group of the
// same star count (first `**` -> first `**`, ...). Unpaired stars stay literal.
function mapDestinationStars(replace, groupsByLength, toRef, escapeLiteral) {
    const available = {};
    Object.keys(groupsByLength).forEach(len => { available[len] = [...groupsByLength[len]]; });
    let usedGroups = 0;
    const result = replace
        .split(/(\*+)/g)
        .map(part => {
            if (part.charAt(0) !== "*") return escapeLiteral(part);
            const group = (available[part.length] || []).shift();
            if (group === undefined) return part;
            usedGroups++;
            return toRef(group);
        })
        .join("");
    return { result, usedGroups };
}

/**
 * Builds a regexFilter + regexSubstitution pair for a wildcard redirect so the text
 * matched by each star group in `match` is carried over into `replace`.
 *
 * Returns null when no substitution is needed (no shared star groups) or possible
 * (more than 9 groups).
 */
export function wildcardToRegexSubstitution(match, replace) {
    if (!match || !replace) return null;

    const { regex: unanchored, groupsByLength, groupCount } = wildcardToRegex(match);
    if (groupCount === 0 || groupCount > MAX_CAPTURE_GROUPS) return null;

    // Chrome replaces only the part of the URL the regex matched, so the regex has to
    // start at the beginning of the URL, or e.g. "example.com/**" would keep the
    // "https://" in front of the destination. Like urlFilter, the pattern itself may
    // still start anywhere in the URL.
    let regex = unanchored;
    if (match.charAt(0) === "*") {
        regex = "^" + regex;
    } else if (!regex.startsWith("^")) {
        regex = "^.*?" + regex;
    }

    const { result, usedGroups } = mapDestinationStars(
        replace, groupsByLength, group => "\\" + group, part => part.replace(/\\/g, "\\\\")
    );
    if (usedGroups === 0) return null;

    return { regexFilter: regex, regexSubstitution: result };
}

// Undoes escapeRegex for a regex literal; returns null if it uses real regex syntax.
function regexLiteralToWildcard(literal) {
    let out = "";
    for (let i = 0; i < literal.length; i++) {
        const ch = literal.charAt(i);
        if (ch === "\\") {
            const next = literal.charAt(i + 1);
            if (!next || /[A-Za-z0-9]/.test(next)) return null; // \d, \w, \1 ...
            out += next;
            i++;
        } else if (/[.*+?^${}()|[\]]/.test(ch)) {
            return null;
        } else {
            out += ch;
        }
    }
    return out;
}

/**
 * Returns the fields to change when a rule switches between wildcard and regex syntax,
 * translating the source pattern and, for redirects, the destination's group references.
 * A regex that can't be expressed with wildcards is kept as typed.
 */
export function convertMatchMode(rule, toMode) {
    const patch = { matchMode: toMode };
    if (getMatchMode(rule) === toMode || !rule.match) return patch;
    const isRedirect = rule.type === "normalOverride";

    if (toMode === "regex") {
        const { regex, groupsByLength } = wildcardToRegex(rule.match);
        patch.match = regex;
        if (isRedirect && rule.replace) {
            patch.replace = mapDestinationStars(rule.replace, groupsByLength, group => "$" + group, part => part).result;
        }
        return patch;
    }

    // regex -> wildcard: only patterns made of literals and (.*) / (.*?) groups translate.
    const parts = getRegexSource(rule.match).split(/(\(\.\*\??\))/g);
    let wildcard = "";
    let group = 0;
    for (const part of parts) {
        if (/^\(\.\*\??\)$/.test(part)) {
            group++;
            wildcard += "*".repeat(group);
        } else {
            const literal = regexLiteralToWildcard(part);
            if (literal === null) return patch;
            wildcard += literal;
        }
    }
    patch.match = wildcard;
    if (isRedirect && rule.replace) {
        patch.replace = rule.replace.replace(/\$([1-9])/g, (ref, n) => Number(n) <= group ? "*".repeat(Number(n)) : ref);
    }
    return patch;
}

// Rules that act on what they match: an empty pattern would mean every request, which is
// never what a new, half-filled rule means.
const NEEDS_PATTERN = new Set(["fileOverride", "blockRule", "queryRule", "mockRule"]);

// Query parameter rules redirect to the same URL with the parameters changed.
const finishNonRedirect = (rule, condition) => {
    if (rule.type !== "queryRule") return { condition };
    const queryTransform = buildQueryTransform(rule);
    return queryTransform ? { condition, redirect: { transform: { queryTransform } } } : null;
};

/**
 * Builds the DNR condition (and, for redirects, the redirect action) that matches a rule's
 * URL pattern. Returns null when the rule is incomplete and should not be registered.
 */
export function buildUrlMatch(rule) {
    const condition = {};
    const isRedirect = rule.type === "normalOverride";
    const match = rule.match || "";
    const replace = rule.replace || "";

    if (getMatchMode(rule) === "regex") {
        const source = getRegexSource(match);
        if (source) {
            condition.regexFilter = source;
        } else if (isRedirect || NEEDS_PATTERN.has(rule.type)) {
            return null;
        }
        if (!isRedirect) return finishNonRedirect(rule, condition);
        // DNR regexSubstitution requires a valid string; $1 becomes \1.
        if (!replace) return null;
        return { condition, redirect: { regexSubstitution: replace.replace(/\$([0-9])/g, "\\$1") } };
    }

    if (!isRedirect) {
        if (match && match !== "*") {
            condition.urlFilter = match;
        } else if (NEEDS_PATTERN.has(rule.type) && !match) {
            return null;
        }
        return finishNonRedirect(rule, condition);
    }

    // Chrome DNR strictly requires action.redirect.url to be a valid absolute URL
    // or a valid relative URL (starting with /). It cannot be empty.
    if (!match || !replace || (!replace.startsWith("http") && !replace.startsWith("/"))) return null;

    // A static redirect.url is used as-is, so wildcards in the destination have to
    // become a regex with capture groups to carry over the matched text.
    const substitution = wildcardToRegexSubstitution(match, replace);
    if (substitution) {
        condition.regexFilter = substitution.regexFilter;
        return { condition, redirect: { regexSubstitution: substitution.regexSubstitution } };
    }
    if (match !== "*") condition.urlFilter = match;
    return { condition, redirect: { url: replace } };
}

/**
 * Applies a DNR regexFilter/regexSubstitution pair the way Chrome does: the first match
 * of the filter is replaced by the substitution, the rest of the URL is kept.
 * Returns null if the filter does not match.
 */
export function applyRegexSubstitution(regexFilter, regexSubstitution, url) {
    let m;
    try {
        m = new RegExp(regexFilter, "i").exec(url);
    } catch (e) {
        return null;
    }
    if (!m) return null;
    const substituted = regexSubstitution.replace(/\\(\\|[0-9])/g, (_, ref) => ref === "\\" ? "\\" : (m[Number(ref)] ?? ""));
    return url.substring(0, m.index) + substituted + url.substring(m.index + m[0].length);
}

/**
 * Evaluates a buildUrlMatch result against a URL like Chrome would (case-insensitive).
 * Returns { matched, redirectUrl }.
 */
export function evaluateUrlMatch(built, url) {
    if (!built) return { matched: false };
    const { condition, redirect } = built;
    let regex;
    try {
        if (condition.regexFilter) {
            regex = new RegExp(condition.regexFilter, "i");
        } else if (condition.urlFilter) {
            regex = new RegExp(wildcardToRegex(condition.urlFilter).regex, "i");
        }
    } catch (e) {
        return { matched: false };
    }
    if (regex && !regex.test(url)) return { matched: false };
    if (!redirect) return { matched: true };
    if (redirect.url) return { matched: true, redirectUrl: redirect.url };
    if (redirect.transform) return { matched: true, redirectUrl: applyQueryTransform(url, redirect.transform.queryTransform) };
    return {
        matched: true,
        redirectUrl: applyRegexSubstitution(condition.regexFilter || ".*", redirect.regexSubstitution, url)
    };
}

// The explicit port of a redirect destination, e.g. "8082" for https://localhost:8082/x.
export function getTargetPort(url) {
    const m = /^[a-z][a-z0-9+.-]*:\/\/(?:[^\/?#@]*@)?(?:\[[^\]]*\]|[^\/?#:]*):(\d+)/i.exec(url || "");
    return m ? m[1] : "";
}

// Writes (or, with an empty port, removes) the explicit port of a redirect destination.
// Returns the URL unchanged if it has no scheme://host part to attach a port to.
export function setTargetPort(url, port) {
    const m = /^([a-z][a-z0-9+.-]*:\/\/(?:[^\/?#@]*@)?(?:\[[^\]]*\]|[^\/?#:]+))(?::\d*)?/i.exec(url || "");
    if (!m) return url;
    return m[1] + (port ? ":" + port : "") + url.substring(m[0].length);
}

// A port typed by the user ("3000" or ":3000"): "" clears the port, null means it isn't valid.
export function parsePortInput(value) {
    const port = String(value || "").trim().replace(/^:/, "");
    if (port === "") return "";
    return /^\d{1,5}$/.test(port) && Number(port) >= 1 && Number(port) <= 65535 ? port : null;
}

// The host of a redirect destination, e.g. "localhost" for https://localhost:8082/x.
export function getTargetHost(url) {
    const m = /^[a-z][a-z0-9+.-]*:\/\/(?:[^\/?#@]*@)?(\[[^\]]*\]|[^\/?#:]*)/i.exec(url || "");
    return m ? m[1] : "";
}

/**
 * Parses a user-entered domain list ("localhost, *.example.com https://cdn.foo.io/x")
 * into the bare, lowercase host names Chrome expects in requestDomains.
 * Subdomains are always included by Chrome, so a leading `*.` is dropped.
 */
export function parseDomainList(value) {
    if (!value) return [];
    const domains = String(value)
        .split(/[\s,;]+/)
        .map(entry => entry.trim().toLowerCase()
            .replace(/^[a-z][a-z0-9+.-]*:\/\//, "")
            .replace(/[\/?#].*$/, "")
            .replace(/:\d+$/, "")
            .replace(/^\*\./, "")
            .replace(/\.$/, ""))
        .filter(Boolean);
    return [...new Set(domains)];
}

export function getDomainFilters(rule) {
    if (!rule.domainFiltersOn) return { include: [], exclude: [] };
    return {
        include: parseDomainList(rule.includeDomains),
        exclude: parseDomainList(rule.excludeDomains)
    };
}

// Mirrors Chrome's requestDomains matching: the domain itself or any of its subdomains.
const hostMatchesDomain = (host, domain) => host === domain || host.endsWith("." + domain);

export function hostPassesDomainFilters(rule, host) {
    const { include, exclude } = getDomainFilters(rule);
    host = (host || "").toLowerCase();
    if (exclude.some(d => hostMatchesDomain(host, d))) return false;
    if (include.length > 0 && !include.some(d => hostMatchesDomain(host, d))) return false;
    return true;
}

// Adds requestDomains / excludedRequestDomains to a DNR condition.
export function applyDomainFilters(condition, rule) {
    const { include, exclude } = getDomainFilters(rule);
    if (include.length > 0) condition.requestDomains = include;
    if (exclude.length > 0) condition.excludedRequestDomains = exclude;
    return condition;
}

/*
 * Global site lists (Settings → Sites): where the rules apply at all. A site is the page
 * a request belongs to, i.e. the request's initiator, or the URL itself for a page load.
 * Entries are host patterns: "example.com" and "*.example.com" both mean the domain and
 * its subdomains (like Chrome's domain lists); a "*" elsewhere matches any characters,
 * e.g. "prod-*.example.com".
 */
export function parseSiteList(value) {
    if (!value) return [];
    const seen = new Set();
    return String(value)
        .split(/[\s,;]+/)
        .map(entry => entry.trim().toLowerCase()
            .replace(/^[a-z][a-z0-9+.-]*:\/\//, "")
            .replace(/[\/?#].*$/, "")
            .replace(/:\d+$/, "")
            .replace(/\.$/, ""))
        .filter(entry => entry && !seen.has(entry) && seen.add(entry))
        .map(entry => {
            const domain = entry.replace(/^\*\./, "");
            return domain.includes("*") ? { pattern: entry } : { pattern: entry, domain };
        });
}

// Only domains can limit Chrome's rules to some sites (initiatorDomains); see buildSiteVariants.
export function isAllowlistSupported(site) {
    return !!site.domain;
}

const siteHostRegex = (site) => (site.domain
    ? "(?:[^\\/?#@:]*\\.)?" + escapeRegex(site.domain)
    : escapeRegex(site.pattern).replace(/\\\*/g, "[^\\/?#@:]*"));

export function siteMatchesHost(site, host) {
    host = (host || "").toLowerCase();
    if (site.domain) return hostMatchesDomain(host, site.domain);
    return new RegExp("^" + siteHostRegex(site) + "$").test(host);
}

/** Whether the rules apply on a page with this host. The blocklist wins. */
export function siteIsEnabled(sites, host) {
    if (!host) return sites.allow.length === 0;
    if (sites.block.some(site => siteMatchesHost(site, host))) return false;
    return sites.allow.length === 0 || sites.allow.some(site => siteMatchesHost(site, host));
}

// Allowlist entries Chrome can't apply are left out everywhere, so the injections and the
// HUD follow the same lists as the network rules; Settings points them out.
export function getSiteLists(settings) {
    return {
        allow: parseSiteList(settings?.siteAllowlist).filter(isAllowlistSupported),
        block: parseSiteList(settings?.siteBlocklist)
    };
}

/**
 * DNR rules for the blocklist: pages on these sites, and everything they load, are
 * "allowed" above the extension's own rules (priority), so none of those apply there.
 * Works with any wildcard, because it matches the page URL with a regex.
 */
export function buildSiteBlockConditions(sites) {
    return sites.block.map(site => ({
        regexFilter: "^[a-z][a-z0-9+.-]*:\\/\\/(?:[^\\/?#@]*@)?" + siteHostRegex(site) + "(?::\\d+)?(?:[\\/?#]|$)",
        resourceTypes: ["main_frame", "sub_frame"]
    }));
}

// Domains in both lists, keeping the narrower of each overlapping pair.
const intersectDomains = (a, b) => [...new Set([
    ...a.filter(x => b.some(y => hostMatchesDomain(x, y))),
    ...b.filter(y => a.some(x => hostMatchesDomain(y, x)))
])];

/**
 * Splits a rule's DNR condition by where the site comes from: page loads (main_frame) are
 * matched on their own URL, everything else on the page that made the request.
 * Returns the conditions to register; an empty list when the rule can't apply anywhere.
 * The blocklist's domains are also excluded here, for requests that come from no frame
 * (e.g. a site's service worker), which the blocklist's page rules don't cover.
 */
export function buildSiteVariants(condition, sites) {
    const allow = sites.allow.map(site => site.domain);
    const blockDomains = sites.block.filter(site => site.domain).map(site => site.domain);
    if (allow.length === 0 && blockDomains.length === 0) return [condition];

    const types = condition.resourceTypes || [];
    const variants = [];
    if (types.includes("main_frame")) {
        const page = { ...condition, resourceTypes: ["main_frame"] };
        if (allow.length > 0) {
            page.requestDomains = condition.requestDomains ? intersectDomains(condition.requestDomains, allow) : allow;
        }
        if (!page.requestDomains || page.requestDomains.length > 0) variants.push(page);
    }
    const others = types.filter(type => type !== "main_frame");
    if (others.length > 0) {
        const rest = { ...condition, resourceTypes: others };
        if (allow.length > 0) rest.initiatorDomains = allow;
        if (blockDomains.length > 0) rest.excludedInitiatorDomains = blockDomains;
        variants.push(rest);
    }
    return variants;
}

/** The regex (case-insensitive) a buildUrlMatch result matches URLs with, as a string. */
export function urlMatchToRegex(built) {
    if (built.condition.regexFilter) return built.condition.regexFilter;
    if (built.condition.urlFilter) return wildcardToRegex(built.condition.urlFilter).regex;
    return "";
}

/**
 * The DNR queryTransform of a query parameter rule. Its params are rows of
 * { operation: "set" | "remove", key, value }: set ones are added or replaced, removed ones
 * dropped. Null when it changes nothing.
 */
export function buildQueryTransform(rule) {
    const params = (rule.params || []).filter(param => param.key && param.key.trim());
    const set = params
        .filter(param => param.operation !== "remove")
        .map(param => ({ key: param.key.trim(), value: String(param.value ?? "") }));
    const remove = params.filter(param => param.operation === "remove").map(param => param.key.trim());
    if (set.length === 0 && remove.length === 0) return null;
    const queryTransform = {};
    if (set.length > 0) queryTransform.addOrReplaceParams = set;
    if (remove.length > 0) queryTransform.removeParams = remove;
    return queryTransform;
}

/** Applies a DNR queryTransform to a URL the way Chrome does. */
export function applyQueryTransform(url, queryTransform) {
    let parsed;
    try {
        parsed = new URL(url);
    } catch (e) {
        return url;
    }
    (queryTransform?.removeParams || []).forEach(key => parsed.searchParams.delete(key));
    (queryTransform?.addOrReplaceParams || []).forEach(({ key, value }) => parsed.searchParams.set(key, value));
    return parsed.href;
}
