import { ref } from 'vue';

export function useRules() {
  const domains = ref([]);
  const globalDomain = ref(null);
  const isLoading = ref(true);

  const fetchDomains = () => {
    return new Promise((resolve) => {
      isLoading.value = true;
      if (typeof chrome !== 'undefined' && chrome.runtime) {
        chrome.runtime.sendMessage({ action: "getDomains" }, (data) => {
          domains.value = data || [];
          globalDomain.value = domains.value.find(d => d.matchUrl === '*');
          isLoading.value = false;
          resolve(data);
        });
      } else {
        // Fallback for non-extension environment (dev)
        domains.value = [];
        globalDomain.value = null;
        isLoading.value = false;
        resolve([]);
      }
    });
  };

  const saveDomain = (domainData) => {
    return new Promise((resolve) => {
      if (typeof chrome !== 'undefined' && chrome.runtime) {
        chrome.runtime.sendMessage({ action: "saveDomain", data: domainData }, () => {
          // Tell legacy system (if it still exists somewhere in background) that data updated
          chrome.runtime.sendMessage({action: "dataUpdated"});
          fetchDomains().then(resolve);
        });
      } else {
        // Dev fallback
        const idx = domains.value.findIndex(d => d.id === domainData.id);
        if (idx !== -1) domains.value[idx] = domainData;
        else domains.value.push(domainData);
        resolve();
      }
    });
  };

  const saveGlobalRule = async (newRule) => {
    await fetchDomains();
    let currentGlobal = domains.value.find(d => d.matchUrl === "*");
    
    if (currentGlobal) {
      currentGlobal.rules = currentGlobal.rules || [];
      // If it has an id update it, else push
      if (newRule.id) {
          const idx = currentGlobal.rules.findIndex(r => r.id === newRule.id);
          if (idx !== -1) currentGlobal.rules[idx] = newRule;
          else currentGlobal.rules.push(newRule);
      } else {
          // generate temporary ID for UI, background saves might not care or handle it
          newRule.id = 'r' + Date.now();
          currentGlobal.rules.push(newRule);
      }
    } else {
      let maxId = 0;
      domains.value.forEach(d => {
          const num = parseInt(d.id.substring(1), 10);
          if (!isNaN(num) && num > maxId) {
              maxId = num;
          }
      });
      const nextId = "d" + (maxId + 1);

      currentGlobal = {
          id: nextId,
          matchUrl: "*",
          on: true,
          rules: [{ ...newRule, id: 'r' + Date.now() }]
      };
    }
    await saveDomain(currentGlobal);
  };

  const deleteRule = async (domainId, ruleId) => {
    const domain = domains.value.find(d => d.id === domainId);
    if (domain) {
      domain.rules = domain.rules.filter(r => r.id !== ruleId);
      await saveDomain(domain);
    }
  };

  const importRules = (data) => {
    return new Promise((resolve, reject) => {
      if (typeof chrome !== 'undefined' && chrome.runtime) {
        chrome.runtime.sendMessage({ action: "import", data: data }, () => {
          fetchDomains().then(resolve);
        });
      } else {
        resolve();
      }
    });
  };

  const exportRules = () => {
    if (typeof chrome !== 'undefined' && chrome.runtime) {
        chrome.runtime.sendMessage({ action: "getDomains" }, (exportDomains) => {
            const exportData = JSON.stringify(exportDomains, null, 4);
            const blob = new Blob([exportData], { type: "text/plain" });
            const downloadUrl = URL.createObjectURL(blob);

            const a = document.createElement("a");
            a.href = downloadUrl;
            a.download = "ResourceOverrideRules.json";
            document.body.appendChild(a);
            a.click();
            document.body.removeChild(a);
            URL.revokeObjectURL(downloadUrl);
        });
    }
  };

  return {
    domains,
    globalDomain,
    isLoading,
    fetchDomains,
    saveDomain,
    saveGlobalRule,
    deleteRule,
    importRules,
    exportRules
  };
}