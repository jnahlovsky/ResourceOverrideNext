// Which mock rules apply to a frame, in the form the page's mock script
// (src/inject/mockShim.js) uses. No extension APIs here, so it can be tested.
// Mocks answer fetch() / XMLHttpRequest calls inside the page: Chrome's rules can't return
// a custom status, headers or delay.
import { buildUrlMatch, urlMatchToRegex, getDomainFilters, siteIsEnabled } from '../extension/urlPattern.js';

// The status codes a Response can be built with, and the ones that can't have a body.
const MIN_STATUS = 200;
const MAX_STATUS = 599;
const MAX_DELAY_MS = 60000;

const hostOf = (url) => {
  try {
    return new URL(url).hostname;
  } catch (e) {
    return '';
  }
};

export function normalizeMockStatus(status) {
  const value = Math.round(Number(status));
  return value >= MIN_STATUS && value <= MAX_STATUS ? value : 200;
}

export function normalizeMockDelay(delay) {
  const value = Math.round(Number(delay));
  return value > 0 ? Math.min(value, MAX_DELAY_MS) : 0;
}

/**
 * The mocks for a frame at `frameUrl`: switched-on mock rules of switched-on domains, on a
 * site where the rules work (Settings → Sites). Each has the URL regex (case-insensitive)
 * and the rule's own domain filters, which the page script checks per request.
 */
export function selectMocks(domains, frameUrl, sites) {
  if (!siteIsEnabled(sites, hostOf(frameUrl))) return [];
  return (domains || [])
    .filter(domain => domain.on)
    .flatMap(domain => domain.rules || [])
    .filter(rule => rule.on && rule.type === 'mockRule')
    .map(rule => {
      const built = buildUrlMatch(rule);
      if (!built) return null;
      const { include, exclude } = getDomainFilters(rule);
      return {
        id: rule.id,
        regex: urlMatchToRegex(built),
        include,
        exclude,
        mode: rule.mockMode === 'delay' ? 'delay' : 'mock',
        status: normalizeMockStatus(rule.status),
        contentType: rule.contentType || 'application/json',
        body: String(rule.body ?? ''),
        headers: (rule.mockHeaders || []).filter(h => h.header && h.header.trim()).map(h => ({ header: h.header.trim(), value: String(h.value ?? '') })),
        delay: normalizeMockDelay(rule.delay)
      };
    })
    .filter(Boolean);
}
