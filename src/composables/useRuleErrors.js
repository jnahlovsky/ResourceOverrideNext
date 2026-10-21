import { ref } from 'vue';

// Rules Chrome refused to register, by rule id, with the reason. Written by
// updateDNRRules (src/extension/netRequestRules.js) every time the rules are applied.
const ruleErrors = ref({});
let isListening = false;

const hasStorage = () => typeof chrome !== 'undefined' && !!chrome.storage?.local;

export function useRuleErrors() {
  if (!isListening && hasStorage()) {
    isListening = true;
    chrome.storage.local.get('ruleErrors', (result) => {
      ruleErrors.value = result.ruleErrors || {};
    });
    chrome.storage.onChanged.addListener((changes, area) => {
      if (area === 'local' && changes.ruleErrors) ruleErrors.value = changes.ruleErrors.newValue || {};
    });
  }
  return { ruleErrors };
}
