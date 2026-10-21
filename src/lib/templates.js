// Ready-made rules, offered in each tab's empty state and its Add Rule menu, including the
// one-click helpers (CORS, CSP, User-Agent). `rule(site)` builds the rule; `site` is the
// current tab's host where it's known (popup / side panel), otherwise a placeholder to edit.

const sitePattern = (site) => `||${site || 'example.com'}^`;

const USER_AGENTS = [
  { id: 'iphone', label: 'iPhone (Safari)', value: 'Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.0 Mobile/15E148 Safari/604.1' },
  { id: 'android', label: 'Android (Chrome)', value: 'Mozilla/5.0 (Linux; Android 15; Pixel 9) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/140.0.0.0 Mobile Safari/537.36' },
  { id: 'ipad', label: 'iPad (Safari)', value: 'Mozilla/5.0 (iPad; CPU OS 18_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.0 Mobile/15E148 Safari/604.1' },
  { id: 'firefox', label: 'Firefox (Windows)', value: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:140.0) Gecko/20100101 Firefox/140.0' },
  { id: 'googlebot', label: 'Googlebot', value: 'Mozilla/5.0 (compatible; Googlebot/2.1; +http://www.google.com/bot.html)' }
];

export const RULE_TEMPLATES = [
  {
    id: 'proxy-bundle',
    group: 'redirects',
    icon: 'i-lucide-package',
    title: 'Proxy a JS bundle to localhost',
    description: 'Load your local build instead of the deployed one',
    rule: () => ({ type: 'normalOverride', name: 'Local bundle', match: '*/static/js/**', replace: 'http://localhost:3000/static/js/**' })
  },
  {
    id: 'proxy-api',
    group: 'redirects',
    icon: 'i-lucide-server',
    title: 'Point the API at a local server',
    description: 'Send API calls to your machine',
    rule: () => ({ type: 'normalOverride', name: 'Local API', match: '*/api/**', replace: 'http://localhost:8080/api/**' })
  },
  {
    id: 'debug-param',
    group: 'redirects',
    icon: 'i-lucide-bug',
    title: 'Add ?debug=1 to this site',
    description: 'Turn on a debug mode or feature flag',
    rule: (site) => ({ type: 'queryRule', name: 'Debug flag', match: sitePattern(site), params: [{ operation: 'set', key: 'debug', value: '1' }] })
  },
  {
    id: 'strip-tracking',
    group: 'redirects',
    icon: 'i-lucide-eraser',
    title: 'Remove tracking parameters',
    description: 'Drop utm_*, fbclid and gclid from URLs',
    rule: () => ({
      type: 'queryRule',
      name: 'No tracking parameters',
      match: '*',
      params: ['utm_source', 'utm_medium', 'utm_campaign', 'utm_term', 'utm_content', 'fbclid', 'gclid'].map(key => ({ operation: 'remove', key }))
    })
  },
  {
    id: 'cors',
    group: 'headers',
    icon: 'i-lucide-shield-check',
    title: 'Add CORS headers to local responses',
    description: 'Lets pages fetch from your local server (fixes net::ERR_FAILED)',
    rule: () => ({
      type: 'headerRule',
      name: 'CORS for localhost',
      match: '||localhost^',
      requestRules: [],
      responseRules: [
        { operation: 'set', header: 'Access-Control-Allow-Origin', value: '*' },
        { operation: 'set', header: 'Access-Control-Allow-Methods', value: 'GET, POST, PUT, PATCH, DELETE, OPTIONS' },
        { operation: 'set', header: 'Access-Control-Allow-Headers', value: '*' }
      ]
    })
  },
  {
    id: 'remove-csp',
    group: 'headers',
    icon: 'i-lucide-shield-off',
    title: "Remove this site's CSP",
    description: 'Lets injections run on strict sites; keep it to your own site',
    rule: (site) => ({
      type: 'headerRule',
      name: `No CSP${site ? ` on ${site}` : ''}`,
      match: sitePattern(site),
      requestRules: [],
      responseRules: [
        { operation: 'remove', header: 'Content-Security-Policy', value: '' },
        { operation: 'remove', header: 'Content-Security-Policy-Report-Only', value: '' }
      ]
    })
  },
  {
    id: 'user-agent',
    group: 'headers',
    icon: 'i-lucide-smartphone',
    title: 'Pretend to be another browser',
    description: 'Send another User-Agent header (scripts still see the real one)',
    variants: USER_AGENTS.map(agent => ({ id: agent.id, label: agent.label })),
    rule: (site, variant) => {
      const agent = USER_AGENTS.find(a => a.id === variant) || USER_AGENTS[0];
      return {
        type: 'headerRule',
        name: `User-Agent: ${agent.label}`,
        match: site ? sitePattern(site) : '*',
        requestRules: [{ operation: 'set', header: 'User-Agent', value: agent.value }],
        responseRules: []
      };
    }
  },
  {
    id: 'no-cache',
    group: 'headers',
    icon: 'i-lucide-refresh-ccw',
    title: 'Disable caching',
    description: 'Always load fresh files on this site',
    rule: (site) => ({
      type: 'headerRule',
      name: 'No cache',
      match: sitePattern(site),
      requestRules: [{ operation: 'set', header: 'Cache-Control', value: 'no-cache' }],
      responseRules: [{ operation: 'set', header: 'Cache-Control', value: 'no-store' }]
    })
  },
  {
    id: 'mock-api',
    group: 'responses',
    icon: 'i-lucide-reply',
    title: 'Mock an API endpoint',
    description: 'Answer a fetch / XHR call with your own JSON',
    rule: () => ({
      type: 'mockRule',
      name: 'Users mock',
      match: '*/api/users*',
      mockMode: 'mock',
      status: 200,
      contentType: 'application/json',
      body: '{\n  "users": [\n    { "id": 1, "name": "Ada Lovelace" },\n    { "id": 2, "name": "Alan Turing" }\n  ]\n}',
      mockHeaders: [],
      delay: 0
    })
  },
  {
    id: 'api-error',
    group: 'responses',
    icon: 'i-lucide-server-crash',
    title: 'Simulate a server error',
    description: 'Make an API call fail with 500',
    rule: () => ({
      type: 'mockRule',
      name: 'API error',
      match: '*/api/**',
      mockMode: 'mock',
      status: 500,
      contentType: 'application/json',
      body: '{ "error": "Internal Server Error" }',
      mockHeaders: [],
      delay: 0
    })
  },
  {
    id: 'slow-api',
    group: 'responses',
    icon: 'i-lucide-hourglass',
    title: 'Slow down an API',
    description: 'Delay the real response by 2 seconds',
    rule: () => ({ type: 'mockRule', name: 'Slow API', match: '*/api/**', mockMode: 'delay', status: 200, contentType: 'application/json', body: '', mockHeaders: [], delay: 2000 })
  },
  {
    id: 'block-analytics',
    group: 'responses',
    icon: 'i-lucide-ban',
    title: 'Block analytics',
    description: 'Google Analytics, Tag Manager, Hotjar and Segment',
    rule: () => ({
      type: 'blockRule',
      name: 'No analytics',
      matchMode: 'regex',
      match: '^https?:\\/\\/([^\\/]*\\.)?(google-analytics\\.com|googletagmanager\\.com|hotjar\\.com|segment\\.(io|com))\\/'
    })
  },
  {
    id: 'css-tweak',
    group: 'injections',
    icon: 'i-lucide-paintbrush',
    title: 'Inject a CSS tweak',
    description: 'Restyle pages, e.g. outline every element',
    rule: () => ({
      type: 'fileInject',
      name: 'CSS tweak',
      fileName: 'tweak.css',
      fileType: 'css',
      injectLocation: 'head',
      injectTiming: 'start',
      file: '/* Your CSS */\n* { outline: 1px solid rgb(255 0 0 / 0.3); }'
    })
  },
  {
    id: 'debug-script',
    group: 'injections',
    icon: 'i-lucide-terminal',
    title: 'Inject a debug script',
    description: 'Run your JS on every page load',
    rule: () => ({
      type: 'fileInject',
      name: 'Debug script',
      fileName: 'debug.js',
      fileType: 'js',
      injectLocation: 'head',
      injectTiming: 'ready',
      file: "console.log('[Resourced] injected into', location.href);"
    })
  }
];

/** The rule a template (and, for User-Agent, a variant) makes, ready to save. */
export function ruleFromTemplate(template, site = '', variant = '') {
  return { on: true, ...template.rule(site, variant) };
}
