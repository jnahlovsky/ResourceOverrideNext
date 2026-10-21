// Imports rules exported by Resourced itself, the original Resource Override, Requestly and
// Redirector. Everything becomes Resourced rules; what can't be carried over is listed with
// the reason, so nothing goes missing silently. No extension APIs here, so it can be tested.
import { newRule } from './ruleLabels.js';

const escapeRegex = (text) => text.replace(/[.*+?^${}()|[\]\\/]/g, '\\$&');

let idCounter = 0;
const newId = () => `r${Date.now().toString(36)}${(idCounter++).toString(36)}`;

const make = (type, fields) => ({ ...newRule(type), ...fields, id: newId() });

/* Resourced and Resource Override: [{ matchUrl, on, rules: [...] }] */

// Resource Override's header rules: "set Name: value;remove Name", parts URI-encoded.
const parseHeaderString = (text) => String(text || '').split(';').map(part => part.trim()).filter(Boolean).map(part => {
  const [head, ...rest] = part.split(': ');
  const decode = (value) => {
    try {
      return decodeURIComponent(value);
    } catch (e) {
      return value;
    }
  };
  if (head.startsWith('remove')) return { operation: 'remove', header: decode(head.slice(7).trim()), value: '' };
  if (head.startsWith('set')) return { operation: 'set', header: decode(head.slice(4).trim()), value: decode(rest.join(': ')) };
  return null;
}).filter(Boolean);

// A domain's page pattern ("*.example.com/*") becomes the rule's own domain filter.
const domainOfMatchUrl = (matchUrl) => {
  const host = String(matchUrl || '').replace(/^[a-z*]+:\/\//i, '').split(/[/?#]/)[0].replace(/:\d+$/, '').replace(/^\*\./, '');
  return host && !host.includes('*') ? host : '';
};

function fromDomains(domains, result) {
  domains.forEach(domain => {
    const pageDomain = domain.matchUrl && domain.matchUrl !== '*' ? domainOfMatchUrl(domain.matchUrl) : '';
    if (domain.matchUrl && domain.matchUrl !== '*' && !pageDomain) {
      result.notes.push(`The rules of "${domain.matchUrl}" now apply on every site; that page pattern can't be turned into a domain.`);
    }
    (domain.rules || []).forEach(rule => {
      const copy = { ...rule, id: newId() };
      if (domain.on === false) copy.on = false;
      if (copy.type === 'headerRule') {
        if (typeof copy.requestRules === 'string') copy.requestRules = parseHeaderString(copy.requestRules);
        if (typeof copy.responseRules === 'string') copy.responseRules = parseHeaderString(copy.responseRules);
      }
      if (pageDomain && !copy.domainFiltersOn) {
        copy.domainFiltersOn = true;
        copy.includeDomains = pageDomain;
      }
      if (!['normalOverride', 'queryRule', 'headerRule', 'mockRule', 'fileOverride', 'blockRule', 'fileInject'].includes(copy.type)) {
        result.skipped.push({ name: copy.name || copy.type || 'Rule', reason: `Unknown rule type "${copy.type}".` });
        return;
      }
      result.rules.push(copy);
    });
  });
}

/* Requestly: [{ ruleType, name, status, pairs: [...] }] (groups are left out) */

// Requestly's source condition as a Resourced pattern.
const requestlySource = (source = {}) => {
  const key = String(source.key || 'Url').toLowerCase();
  const operator = String(source.operator || 'Contains').toLowerCase();
  const value = String(source.value || '');
  if (!value) return null;
  if (operator === 'matches') {
    const m = /^\/(.*)\/[a-z]*$/s.exec(value);
    return { matchMode: 'regex', match: m ? m[1] : value };
  }
  if (operator === 'wildcard_matches') {
    // Requestly's * become $1, $2… in order; a regex keeps that numbering.
    const regex = value.split('*').map(escapeRegex).join('(.*)');
    return { matchMode: 'regex', match: key === 'url' ? `^${regex}$` : regex };
  }
  if (operator === 'equals') {
    if (key === 'host') return { matchMode: 'wildcard', match: `||${value}^` };
    return { matchMode: 'wildcard', match: key === 'url' ? `|${value}|` : value };
  }
  return { matchMode: 'wildcard', match: value };
};

const requestlyHost = (source = {}) => (String(source.key || '').toLowerCase() === 'host' ? String(source.value || '').replace(/^\*\./, '') : '');

const headerModification = (modification) => {
  const type = String(modification.type || '').toLowerCase();
  if (!modification.header) return null;
  return type === 'remove'
    ? { operation: 'remove', header: modification.header, value: '' }
    : { operation: 'set', header: modification.header, value: String(modification.value ?? '') };
};

function fromRequestly(items, result) {
  items.filter(item => item && item.ruleType).forEach(item => {
    const name = item.name || item.ruleType;
    const on = String(item.status || '').toLowerCase() === 'active';
    const pairs = Array.isArray(item.pairs) ? item.pairs : [];
    const skip = (reason) => result.skipped.push({ name, reason });
    const type = String(item.ruleType).toLowerCase();
    let added = 0;
    pairs.forEach((pair, index) => {
      const label = pairs.length > 1 ? `${name} (${index + 1})` : name;
      const source = requestlySource(pair.source);
      if (!source && type !== 'useragent' && type !== 'script') return skip('It has no URL condition.');
      const push = (rule) => {
        result.rules.push(rule);
        added++;
      };
      if (type === 'redirect') {
        if (!pair.destination) return skip('It has no destination.');
        push(make('normalOverride', { name: label, on, ...source, replace: pair.destination }));
      } else if (type === 'cancel') {
        push(make('blockRule', { name: label, on, ...source }));
      } else if (type === 'queryparam') {
        const params = (pair.modifications || [])
          .filter(m => m.param && String(m.type).toLowerCase() !== 'remove all')
          .map(m => (String(m.type).toLowerCase() === 'remove' ? { operation: 'remove', key: m.param } : { operation: 'set', key: m.param, value: String(m.value ?? '') }));
        if ((pair.modifications || []).some(m => String(m.type).toLowerCase() === 'remove all')) {
          result.notes.push(`"${label}": "Remove all parameters" isn't supported; list the parameters to remove instead.`);
        }
        push(make('queryRule', { name: label, on, ...source, params }));
      } else if (type === 'headers') {
        // Version 2 groups modifications per direction; version 1 lists them with a target.
        const mods = pair.modifications;
        const request = Array.isArray(mods?.Request) ? mods.Request : (pair.target === 'Request' ? [pair] : []);
        const response = Array.isArray(mods?.Response) ? mods.Response : (pair.target === 'Response' ? [pair] : []);
        push(make('headerRule', {
          name: label,
          on,
          ...source,
          requestRules: request.map(headerModification).filter(Boolean),
          responseRules: response.map(headerModification).filter(Boolean)
        }));
      } else if (type === 'useragent') {
        if (!pair.userAgent) return skip('It has no User-Agent.');
        push(make('headerRule', {
          name: label,
          on,
          ...(source || { match: '*' }),
          requestRules: [{ operation: 'set', header: 'User-Agent', value: pair.userAgent }],
          responseRules: []
        }));
      } else if (type === 'script') {
        const host = requestlyHost(pair.source);
        if (!host && pair.source?.value) result.notes.push(`"${label}" now runs on every page; injections can be limited to domains only.`);
        (pair.scripts || []).forEach(script => {
          if (script.type !== 'code') return skip(`Script from a URL (${script.value}) isn't supported; paste its code into a file injection.`);
          push(make('fileInject', {
            name: label,
            on,
            fileType: script.codeType === 'css' ? 'css' : 'js',
            injectTiming: script.loadTime === 'afterPageLoad' ? 'loaded' : 'start',
            file: script.value || '',
            ...(host ? { domainFiltersOn: true, includeDomains: host } : {})
          }));
        });
      } else if (type === 'response') {
        const response = pair.response || {};
        if (response.type === 'code') return skip('A response computed by code isn\'t supported; use a fixed body.');
        let contentType = 'text/plain';
        try {
          JSON.parse(response.value);
          contentType = 'application/json';
        } catch (e) {
          // Not JSON; sent as text.
        }
        push(make('mockRule', { name: label, on, ...source, mockMode: 'mock', status: Number(response.statusCode) || 200, contentType, body: String(response.value ?? '') }));
      } else {
        skip(`${item.ruleType} rules aren't supported.`);
      }
    });
    if (pairs.length === 0) skip('It has no conditions.');

  });
}

/* Redirector: { redirects: [{ description, includePattern, redirectUrl, patternType, ... }] } */

function fromRedirector(data, result) {
  (data.redirects || []).forEach(redirect => {
    const name = redirect.description || redirect.includePattern || 'Redirect';
    if (!redirect.includePattern || !redirect.redirectUrl) {
      result.skipped.push({ name, reason: 'It has no pattern or destination.' });
      return;
    }
    // Redirector replaces the whole URL; Chrome only the matched part, so the regex has to
    // cover it all. Wildcards (*) become groups in order, like Redirector's $1, $2…
    const match = redirect.patternType === 'R'
      ? `^.*?(?:${redirect.includePattern}).*$`
      : `^${redirect.includePattern.split('*').map(escapeRegex).join('(.*)')}$`;
    if (redirect.excludePattern) result.notes.push(`"${name}": its exclude pattern (${redirect.excludePattern}) isn't supported.`);
    if (redirect.processMatches && redirect.processMatches !== 'noProcessing') {
      result.notes.push(`"${name}": "${redirect.processMatches}" processing of matches isn't supported.`);
    }
    result.rules.push(make('normalOverride', {
      name,
      on: !redirect.disabled,
      matchMode: 'regex',
      match,
      replace: redirect.redirectUrl
    }));
  });
}

/** Recognizes the format and converts it: { source, rules, skipped: [{ name, reason }], notes }. */
export function importRulesFrom(data) {
  const result = { source: '', rules: [], skipped: [], notes: [] };
  if (data && !Array.isArray(data) && Array.isArray(data.redirects)) {
    result.source = 'Redirector';
    fromRedirector(data, result);
  } else if (Array.isArray(data) && data.some(item => item && item.ruleType)) {
    result.source = 'Requestly';
    fromRequestly(data, result);
  } else if (data && !Array.isArray(data) && Array.isArray(data.rules) && data.rules.some(item => item && item.ruleType)) {
    result.source = 'Requestly';
    fromRequestly(data.rules, result);
  } else if (Array.isArray(data) && data.every(item => item && Array.isArray(item.rules))) {
    const legacy = data.some(domain => domain.rules.some(rule => typeof rule.requestRules === 'string' || typeof rule.responseRules === 'string'));
    result.source = legacy ? 'Resource Override' : 'Resourced';
    fromDomains(data, result);
  } else {
    throw new Error('This file isn\'t a rules export of Resourced, Resource Override, Requestly or Redirector.');
  }
  return result;
}
