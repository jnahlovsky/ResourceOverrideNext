// Light or dark for the extension's pages (editor, popup, side panel): Settings → Appearance
// picks System, Light or Dark (chrome.storage.local "theme"). Dark mode is the class
// theme-dark on <html> (src/assets/dark.css). A copy in localStorage, read before the page
// renders, keeps pages from flashing light while chrome.storage answers.
const THEME_KEY = 'theme';
const CACHE_KEY = 'resourced:theme';

export const THEMES = [
  { value: 'system', label: 'System' },
  { value: 'light', label: 'Light' },
  { value: 'dark', label: 'Dark' }
];

const readCache = () => {
  try {
    return localStorage.getItem(CACHE_KEY) || 'system';
  } catch (e) {
    return 'system';
  }
};

export function installTheme() {
  const media = window.matchMedia('(prefers-color-scheme: dark)');
  let mode = readCache();

  const apply = () => {
    document.documentElement.classList.toggle('theme-dark', mode === 'dark' || (mode === 'system' && media.matches));
  };
  const setMode = (value) => {
    mode = THEMES.some(theme => theme.value === value) ? value : 'system';
    try {
      localStorage.setItem(CACHE_KEY, mode);
    } catch (e) {
      // Not cached; the page may briefly show the other theme next time.
    }
    apply();
  };

  apply();
  media.addEventListener('change', apply);
  if (typeof chrome === 'undefined' || !chrome.storage?.local) return;
  chrome.storage.local.get(THEME_KEY).then(result => setMode(result[THEME_KEY]));
  chrome.storage.onChanged.addListener((changes, area) => {
    if (area === 'local' && changes[THEME_KEY]) setMode(changes[THEME_KEY].newValue);
  });
}
