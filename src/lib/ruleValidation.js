// Mistakes in a rule, found while it's being typed, before Chrome would reject it (or the
// rule would quietly do something else). Shown on the rule cards and in the quick list.
// Each issue is { level: 'error' | 'warning', message }: errors keep the rule from working,
// warnings point at something that probably isn't meant.
import { getMatchMode, getRegexSource, parseDomainList } from '../extension/urlPattern.js';

// RFC 9110 token characters.
const HEADER_NAME = /^[!#$%&'*+.^_`|~0-9A-Za-z-]+$/;
const DOMAIN = /^[a-z0-9-]+(\.[a-z0-9-]+)*$/;

const starGroups = (pattern) => (pattern.match(/\*+/g) || []).map(stars => stars.length);

const validateRegex = (source, add) => {
  if (/\(\?<?[=!]/.test(source)) {
    add('error', "Chrome doesn't support lookahead or lookbehind ((?=…), (?!…), (?<=…)) in patterns.");
    return null;
  }
  if (/\\[1-9]/.test(source)) {
    add('error', "Chrome doesn't support backreferences (\\1, \\2…) in patterns.");
    return null;
  }
  try {
    // Matching "|" against "" gives one slot per capture group.
    return new RegExp(source + '|').exec('').length - 1;
  } catch (e) {
    add('error', `The pattern isn't a valid regular expression: ${e.message.replace(/^Invalid regular expression: /, '')}`);
    return null;
  }
};

const validateRedirect = (rule, add) => {
  const match = rule.match || '';
  const replace = rule.replace || '';
  if (!match && !replace) return;
  if (!match) add('warning', 'Add a source pattern; until then the rule does nothing.');
  if (!replace) {
    add('warning', 'Add a destination; until then the rule does nothing.');
    return;
  }

  const isRegex = getMatchMode(rule) === 'regex';
  if (!/^https?:\/\//i.test(replace) && !replace.startsWith('/')) {
    add('error', 'The destination has to be a full URL (http://… or https://…) or a path starting with /.');
  } else {
    // Group references stand in for text from the request.
    const sample = isRegex ? replace.replace(/\$\d/g, 'x') : replace.replace(/\*+/g, 'x');
    try {
      const url = new URL(sample, 'https://example.com');
      if (/^https?:\/\//i.test(replace) && !url.hostname) throw new Error('no host');
    } catch (e) {
      add('error', "The destination isn't a valid URL.");
    }
  }

  if (isRegex) {
    const groups = validateRegex(getRegexSource(match), add);
    if (groups === null) return;
    const refs = [...new Set((replace.match(/\$([1-9])/g) || []).map(ref => Number(ref.slice(1))))];
    const missing = refs.filter(n => n > groups);
    if (missing.length > 0) {
      add('error', `The destination uses $${missing[0]}, but the pattern has ${groups === 0 ? 'no groups' : `only ${groups} group${groups === 1 ? '' : 's'}`}.`);
    }
    return;
  }

  // Wildcards: each star group in the destination takes the next one of the same length.
  const available = {};
  starGroups(match).forEach(length => { available[length] = (available[length] || 0) + 1; });
  const used = starGroups(replace);
  if (used.length === 0) return;
  if (starGroups(match).length > 9) {
    add('warning', 'The pattern has more than 9 * groups, so Chrome can\'t carry any of them into the destination.');
    return;
  }
  const unmatched = used.find(length => !(available[length]-- > 0));
  if (unmatched) {
    const stars = '*'.repeat(unmatched);
    add('warning', `${stars} in the destination has no ${stars} left in the pattern to take text from, so it stays as literal ${stars}.`);
  }
};

const validateHeaders = (rule, add) => {
  [...(rule.requestRules || []), ...(rule.responseRules || [])].forEach(header => {
    const name = (header.header || '').trim();
    if (!name) {
      if (header.value) add('warning', 'A header without a name is ignored.');
      return;
    }
    if (!HEADER_NAME.test(name)) {
      add('error', `"${name}" isn't a valid header name (letters, digits and dashes; no spaces).`);
    }
    if (/[\r\n]/.test(header.value || '')) add('error', `The value of ${name} can't contain line breaks.`);
  });
};

const validateQuery = (rule, add) => {
  const params = (rule.params || []).filter(param => (param.key || '').trim() || param.value);
  if (!rule.match && params.length === 0) return;
  if (!rule.match) add('warning', 'Add a URL pattern; until then the rule does nothing.');
  if (params.length === 0) add('warning', 'Add a parameter to set or remove; until then the rule does nothing.');
  params.forEach(param => {
    const key = (param.key || '').trim();
    if (!key) add('warning', 'A parameter without a name is ignored.');
    else if (/[=&#?\s]/.test(key)) add('error', `"${key}" isn't a valid parameter name (no spaces, =, &, ? or #).`);
  });
};

const validateBlock = (rule, add) => {
  if (rule.match === '*' || rule.match === '**') add('warning', 'This blocks every request on every site. Use a narrower pattern.');
};

const validateMock = (rule, add) => {
  if (!rule.match) {
    if (rule.body || (rule.mockHeaders || []).length > 0) add('warning', 'Add a URL pattern; until then the mock answers nothing.');
    return;
  }
  const delay = Number(rule.delay);
  if (delay > 60000) add('warning', 'The delay is capped at 60 000 ms (one minute).');
  if (rule.mockMode === 'delay') {
    if (!(delay > 0)) add('warning', 'Set a delay; until then the real response comes as usual.');
    return;
  }
  const status = Number(rule.status);
  if (!(status >= 200 && status <= 599)) add('error', 'The status has to be between 200 and 599.');
  if ((rule.contentType || 'application/json') === 'application/json' && (rule.body || '').trim()) {
    try {
      JSON.parse(rule.body);
    } catch (e) {
      add('warning', "The body isn't valid JSON; it's sent as typed.");
    }
  }
  (rule.mockHeaders || []).forEach(header => {
    const name = (header.header || '').trim();
    if (name && !HEADER_NAME.test(name)) add('error', `"${name}" isn't a valid header name (letters, digits and dashes; no spaces).`);
  });
};

const validateDomainFilters = (rule, add) => {
  if (!rule.domainFiltersOn) return;
  const invalid = [...parseDomainList(rule.includeDomains), ...parseDomainList(rule.excludeDomains)]
    .filter(domain => !DOMAIN.test(domain));
  if (invalid.length > 0) {
    add('error', `"${invalid[0]}" isn't a domain. Use e.g. example.com; subdomains are included.`);
  }
};

export function validateRule(rule) {
  const issues = [];
  const add = (level, message) => issues.push({ level, message });
  if (rule.type === 'normalOverride') {
    validateRedirect(rule, add);
  } else if (rule.match && getMatchMode(rule) === 'regex' && rule.type !== 'fileInject') {
    validateRegex(getRegexSource(rule.match), add);
  }
  if (rule.type === 'queryRule') validateQuery(rule, add);
  if (rule.type === 'blockRule') validateBlock(rule, add);
  if (rule.type === 'mockRule') validateMock(rule, add);
  if (rule.type === 'headerRule') validateHeaders(rule, add);
  validateDomainFilters(rule, add);
  return issues;
}
