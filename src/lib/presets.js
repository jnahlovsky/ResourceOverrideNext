// Team presets: rules loaded from a URL and kept up to date. Their rules sit in the rule list
// tagged with the preset's URL (presetUrl) and a key (presetKey) that stays the same across
// updates, so a rule keeps its id and its on/off switch. No extension APIs here, so it can
// be tested; fetching and the hourly refresh are src/extension/presets.js.

/**
 * The rule list with a preset's rules replaced by `incoming` (already converted rules),
 * where the old ones were, or at the end for a new preset.
 */
export function mergePresetRules(rules, url, incoming) {
  const previous = new Map(rules.filter(rule => rule.presetUrl === url).map(rule => [rule.presetKey, rule]));
  const seen = {};
  const tagged = incoming.map(rule => {
    const base = `${rule.type}:${rule.name || ''}`;
    seen[base] = (seen[base] || 0) + 1;
    const key = `${base}:${seen[base]}`;
    const old = previous.get(key);
    return { ...rule, id: old ? old.id : rule.id, on: old ? old.on : rule.on, presetUrl: url, presetKey: key };
  });
  const firstIndex = rules.findIndex(rule => rule.presetUrl === url);
  const others = rules.filter(rule => rule.presetUrl !== url);
  const at = firstIndex === -1 ? others.length : Math.min(firstIndex, others.length);
  return [...others.slice(0, at), ...tagged, ...others.slice(at)];
}

/** A short name for a preset: its file name, or its host. */
export function presetName(url) {
  try {
    const parsed = new URL(url);
    const file = decodeURIComponent(parsed.pathname.split('/').filter(Boolean).pop() || '');
    return file || parsed.host;
  } catch (e) {
    return url;
  }
}
