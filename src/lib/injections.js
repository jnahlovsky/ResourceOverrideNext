// Which file injections apply to a frame, and when they run. Used by the background
// (src/extension/fileInjection.js); no extension APIs here, so it can be tested.
import { hostPassesDomainFilters, siteIsEnabled } from '../extension/urlPattern.js';
import { match } from '../extension/match.js';

// When an injection runs, relative to the page loading.
export const INJECT_TIMINGS = [
  { value: 'start', label: 'Page start', phrase: 'page start', title: 'As early as possible while the page starts loading; a very small page may already have run its first scripts' },
  { value: 'ready', label: 'DOM ready', phrase: 'DOM ready', title: 'Once the HTML is parsed (DOMContentLoaded)' },
  { value: 'loaded', label: 'Loaded', phrase: 'page load', title: 'After the page and its images, styles and scripts loaded (load)' }
];

export function getInjectTiming(rule) {
  return INJECT_TIMINGS.some(timing => timing.value === rule.injectTiming) ? rule.injectTiming : 'start';
}

const hostOf = (url) => {
  try {
    return new URL(url).hostname;
  } catch (e) {
    return '';
  }
};

/**
 * The injections for a frame at `frameUrl`: switched-on fileInject rules of switched-on
 * domains whose URL pattern matches, on a site where the rules work (Settings → Sites),
 * that pass their own domain filters.
 */
export function selectInjections(domains, frameUrl, sites) {
  const host = hostOf(frameUrl);
  if (!siteIsEnabled(sites, host)) return [];
  return (domains || [])
    .filter(domain => domain.on && (!domain.matchUrl || domain.matchUrl === '*' || match(domain.matchUrl, frameUrl).matched))
    .flatMap(domain => domain.rules || [])
    .filter(rule => rule.on && rule.type === 'fileInject' && rule.file && hostPassesDomainFilters(rule, host))
    .map(rule => ({ id: rule.id, timing: getInjectTiming(rule) }));
}
