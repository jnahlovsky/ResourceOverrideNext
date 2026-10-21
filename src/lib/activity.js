// Works out which rule caused what Chrome did to a request, for the activity log.
// Chrome applies the rules itself (declarativeNetRequest) and doesn't say which one
// matched, so requests are checked against the rules the same way the rules are built.
// No extension APIs here, so it can be tested; the recording is src/extension/activityLog.js.
import { buildUrlMatch, evaluateUrlMatch, hostPassesDomainFilters } from '../extension/urlPattern.js';
import { getRuleDisplayName } from './ruleLabels.js';

export const ACTIVITY_TYPES = {
  redirect: { label: 'Redirect', short: 'REDIR' },
  query: { label: 'Query parameters', short: 'QUERY' },
  mock: { label: 'Mock response', short: 'MOCK' },
  file: { label: 'File override', short: 'FILE' },
  block: { label: 'Blocked', short: 'BLOCK' },
  headers: { label: 'Headers', short: 'HEAD' },
  inject: { label: 'Injection', short: 'INJECT' }
};

const hostOf = (url) => {
  try {
    return new URL(url).hostname;
  } catch (e) {
    return '';
  }
};

// The URL as Chrome would report it (e.g. "http://localhost:3000" -> "http://localhost:3000/").
const normalizeUrl = (url) => {
  try {
    return new URL(url).href;
  } catch (e) {
    return url;
  }
};

/** Prepares the switched-on rules for matching; incomplete rules are left out. */
export function compileRules(rules) {
  return (rules || [])
    .filter(rule => rule.on)
    .map(rule => ({ rule, built: buildUrlMatch(rule), name: getRuleDisplayName(rule) }))
    .filter(entry => entry.built);
}

const matches = (entry, url) =>
  hostPassesDomainFilters(entry.rule, hostOf(url)) && evaluateUrlMatch(entry.built, url).matched;

/**
 * The rule behind a redirect Chrome reported, or null when none of ours explains it
 * (e.g. a server's own 301). Redirects to a data: URL are file overrides.
 */
export function attributeRedirect(compiled, url, redirectUrl) {
  if (redirectUrl.startsWith('data:')) {
    const entry = compiled.find(e => e.rule.type === 'fileOverride' && matches(e, url));
    return entry ? { type: 'file', entry } : null;
  }
  const candidates = compiled.filter(e => e.rule.type === 'normalOverride' && matches(e, url));
  if (candidates.length === 0) {
    const query = compiled.find(e => e.rule.type === 'queryRule' && matches(e, url));
    return query ? { type: 'query', entry: query } : null;
  }
  // Prefer the rule whose destination is exactly where Chrome went.
  const target = normalizeUrl(redirectUrl);
  const exact = candidates.find(e => {
    const expected = evaluateUrlMatch(e.built, url).redirectUrl;
    return expected && normalizeUrl(expected) === target;
  });
  return { type: 'redirect', entry: exact || candidates[0] };
}

/** The block rule that cancelled a request (Chrome reports net::ERR_BLOCKED_BY_CLIENT). */
export function attributeBlock(compiled, url) {
  return compiled.find(e => e.rule.type === 'blockRule' && matches(e, url)) || null;
}

/** Header rules that apply to a request. */
export function matchHeaderRules(compiled, url) {
  return compiled.filter(e => e.rule.type === 'headerRule' && matches(e, url));
}

/** The header changes a rule makes, e.g. ["set X-Debug: 1", "remove Cookie"], per direction. */
export function describeHeaderChanges(rule) {
  const describe = (headerRules) => (headerRules || [])
    .filter(h => h.header)
    .map(h => (h.operation === 'remove' ? `remove ${h.header}` : `${h.operation || 'set'} ${h.header}: ${h.value || ''}`));
  return { request: describe(rule.requestRules), response: describe(rule.responseRules) };
}

/** "200", "ERR", "…" style status bucket for filtering and colours. */
export function statusBucket(entry) {
  if (entry.error) return 'error';
  if (entry.type === 'inject' || entry.type === 'block' || entry.inline || entry.mocked) return 'ok';
  if (entry.status === undefined || entry.status === null) return 'pending';
  if (entry.status >= 400) return 'error';
  return 'ok';
}

const shellQuote = (value) => `'${String(value).replace(/'/g, `'\\''`)}'`;

/**
 * A curl command for an entry's request: the original URL, or with `target` the URL it was
 * sent to instead (redirects, query rewrites). Header rules add the headers they set.
 */
export function toCurl(entry, target = false) {
  const url = target && entry.redirectUrl && !entry.redirectUrl.startsWith('data:') ? entry.redirectUrl : entry.url;
  const parts = ['curl'];
  if (entry.method && entry.method !== 'GET') parts.push('-X', entry.method);
  (entry.headers?.request || [])
    .filter(change => change.startsWith('set ') || change.startsWith('append '))
    .forEach(change => parts.push('-H', shellQuote(change.replace(/^(set|append) /, ''))));
  parts.push(shellQuote(url));
  return parts.join(' ');
}

/**
 * The entries as a HAR 1.2 log, for DevTools and other HAR viewers. Only what the activity
 * log knows: URLs, method, status, timing; the comment says which rule did what.
 */
export function toHar(entries, version = '') {
  return {
    log: {
      version: '1.2',
      creator: { name: 'Resourced', version },
      entries: entries.map(entry => ({
        startedDateTime: new Date(entry.time).toISOString(),
        time: entry.duration || 0,
        request: {
          method: entry.method || 'GET',
          url: entry.url,
          httpVersion: '',
          headers: [],
          queryString: [],
          cookies: [],
          headersSize: -1,
          bodySize: -1
        },
        response: {
          status: typeof entry.status === 'number' ? entry.status : 0,
          statusText: entry.error || '',
          httpVersion: '',
          headers: [],
          cookies: [],
          content: { size: -1, mimeType: '' },
          redirectURL: entry.redirectUrl && !entry.redirectUrl.startsWith('data:') ? entry.redirectUrl : '',
          headersSize: -1,
          bodySize: -1
        },
        cache: {},
        timings: { send: 0, wait: entry.duration || 0, receive: 0 },
        _resourcedType: entry.type,
        _resourcedRule: entry.ruleName,
        comment: `${ACTIVITY_TYPES[entry.type]?.label || entry.type} by rule "${entry.ruleName}"${entry.error ? `; failed: ${entry.error}` : ''}`
      }))
    }
  };
}
