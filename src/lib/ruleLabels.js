import { getTargetHost, getTargetPort, setTargetPort } from '../extension/urlPattern.js';

export const RULE_GROUPS = [
  { value: 'redirects', label: 'URL Redirects', icon: 'i-lucide-shuffle', types: ['normalOverride'] },
  { value: 'headers', label: 'Custom Headers', icon: 'i-lucide-list', types: ['headerRule'] },
  { value: 'injections', label: 'Inline/File Injection', icon: 'i-lucide-syringe', types: ['fileOverride', 'fileInject'] }
];

export function getRuleTypeLabel(type) {
  switch (type) {
    case 'normalOverride': return 'URL Redirect';
    case 'headerRule': return 'Custom Headers';
    case 'fileOverride': return 'File Override';
    case 'fileInject': return 'File Injection';
    default: return 'Rule';
  }
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
    return `${(rule.fileType || 'js').toUpperCase()} into ${rule.injectLocation || 'head'}`;
  }
  return rule.match || 'No pattern yet';
}

export function getRulePort(rule) {
  return rule.type === 'normalOverride' ? getTargetPort(rule.replace) : '';
}

// Only redirects to an absolute URL have a port to show or change.
export function canEditRulePort(rule) {
  return rule.type === 'normalOverride' && setTargetPort(rule.replace, '1') !== rule.replace;
}
