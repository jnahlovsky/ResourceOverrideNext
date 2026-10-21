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
