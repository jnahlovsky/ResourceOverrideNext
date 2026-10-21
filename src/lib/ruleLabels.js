import { getTargetHost, getTargetPort, setTargetPort } from '../extension/urlPattern.js';
import { INJECT_TIMINGS, getInjectTiming } from './injections.js';

// Every kind of rule: its name, icon and the fields of a new, empty one.
export const RULE_TYPES = {
  normalOverride: { label: 'URL redirect', icon: 'i-lucide-shuffle', description: 'Send matching requests to another URL', fields: () => ({ match: '', replace: '' }) },
  queryRule: { label: 'Query parameters', icon: 'i-lucide-list-plus', description: 'Add, change or remove query parameters', fields: () => ({ match: '', params: [] }) },
  headerRule: { label: 'Headers', icon: 'i-lucide-list', description: 'Set or remove request and response headers', fields: () => ({ match: '', requestRules: [], responseRules: [] }) },
  mockRule: { label: 'Mock response', icon: 'i-lucide-reply', description: 'Answer fetch / XHR calls with your own response', fields: () => ({ match: '', mockMode: 'mock', status: 200, contentType: 'application/json', body: '', mockHeaders: [], delay: 0 }) },
  fileOverride: { label: 'File override', icon: 'i-lucide-file-code', description: 'Replace a file with your own content', fields: () => ({ match: '', file: '' }) },
  blockRule: { label: 'Block', icon: 'i-lucide-ban', description: 'Cancel matching requests', fields: () => ({ match: '' }) },
  fileInject: { label: 'File injection', icon: 'i-lucide-syringe', description: 'Add your JS or CSS to pages', fields: () => ({ fileName: '', fileType: 'js', injectLocation: 'head', injectTiming: 'start', file: '' }) }
};

// The tabs of the editor and of the popup / side panel, and the rule types in each.
export const RULE_GROUPS = [
  { value: 'redirects', label: 'Redirects', icon: 'i-lucide-shuffle', types: ['normalOverride', 'queryRule'] },
  { value: 'headers', label: 'Headers', icon: 'i-lucide-list', types: ['headerRule'] },
  { value: 'responses', label: 'Responses', icon: 'i-lucide-reply', types: ['mockRule', 'fileOverride', 'blockRule'] },
  { value: 'injections', label: 'Injections', icon: 'i-lucide-syringe', types: ['fileInject'] }
];

export function newRule(type) {
  return { type, on: true, ...RULE_TYPES[type].fields() };
}

export function getRuleTypeLabel(type) {
  return RULE_TYPES[type]?.label || 'Rule';
}

// A rule nothing has been filled in for yet; deleting it needs no confirmation.
export function isRuleEmpty(rule) {
  if (rule.type === 'fileInject') return !rule.fileName && !rule.file;
  if (rule.type === 'normalOverride') return !rule.match && !rule.replace;
  return !rule.match;
}

// A short name for lists where the rule's fields aren't visible.
export function getRuleDisplayName(rule) {
  if (rule.name) return rule.name;
  if (rule.type === 'normalOverride') return getTargetHost(rule.replace) || getRuleTypeLabel(rule.type);
  if (rule.type === 'fileInject') return rule.fileName || getRuleTypeLabel(rule.type);
  return getRuleTypeLabel(rule.type);
}

// One line of detail shown under the name.
export function getRuleSummary(rule) {
  if (rule.type === 'headerRule') {
    const request = (rule.requestRules || []).length;
    const response = (rule.responseRules || []).length;
    return `${rule.match || 'All URLs'} · ${request} req / ${response} res`;
  }
  if (rule.type === 'fileInject') {
    const timing = INJECT_TIMINGS.find(t => t.value === getInjectTiming(rule)).phrase;
    return rule.fileType === 'css' ? `CSS at ${timing}` : `JS into ${rule.injectLocation || 'head'} at ${timing}`;
  }
  const pattern = rule.match || 'No pattern yet';
  if (rule.type === 'queryRule') {
    const changes = (rule.params || []).filter(p => p.key)
      .map(p => (p.operation === 'remove' ? `-${p.key}` : `${p.key}=${p.value ?? ''}`));
    return `${pattern} · ${changes.join(' ') || 'no changes yet'}`;
  }
  if (rule.type === 'mockRule') {
    const delay = Number(rule.delay) > 0 ? `, ${rule.delay} ms` : '';
    return rule.mockMode === 'delay' ? `${pattern} · delay${delay}` : `${pattern} · ${rule.status || 200}${delay}`;
  }
  if (rule.type === 'blockRule') return `${pattern} · blocked`;
  return pattern;
}

export function getRulePort(rule) {
  return rule.type === 'normalOverride' ? getTargetPort(rule.replace) : '';
}

// Only redirects to an absolute URL have a port to show or change.
export function canEditRulePort(rule) {
  return rule.type === 'normalOverride' && setTargetPort(rule.replace, '1') !== rule.replace;
}
