<template>
  <UApp>
    <div id="vue-root" class="flex flex-col h-full bg-[#f4f4f5] w-[750px] min-h-[550px]">
      <AppHeader />

      <!-- Main View -->
      <div v-show="!showAddRuleForm" class="flex-1 flex flex-col overflow-hidden">
        <UTabs v-model="activeTab" :items="tabItems" class="flex-1 flex flex-col pt-0 px-0 w-full" :ui="{ root: 'flex-1 flex flex-col', list: 'flex w-full bg-white p-0 h-auto border-b border-slate-200 rounded-none space-x-0', indicator: 'bg-[#2563eb]', trigger: 'flex-1 rounded-none py-2.5 text-[13px] font-medium transition-none h-full shadow-none border-none data-[state=active]:bg-[#2563eb] data-[state=active]:text-white data-[state=inactive]:bg-white data-[state=inactive]:text-slate-600 focus-visible:ring-0', content: 'flex-1 overflow-y-auto px-6 py-6 relative focus-visible:outline-none' }">
          <template #default="{ item, index, selected }">
            <div class="flex items-center gap-2">
              <span>{{ item.label }}</span>
              <UBadge :color="selected ? 'primary' : 'neutral'" variant="solid" class="rounded-full px-2 py-0 text-xs font-semibold" :class="selected ? 'bg-blue-800 text-white hover:bg-blue-800' : 'bg-slate-600 text-white hover:bg-slate-600'">{{ getRuleCount(item.value) }}</UBadge>
            </div>
          </template>
          
          <template #content="{ item }">
              <div v-if="isLoading" class="absolute inset-0 flex items-center justify-center bg-[#f4f4f5]/50 z-10">
                <span class="text-slate-500">Loading rules...</span>
              </div>
              
              <div v-if="item.value === 'redirects'">
                <div class="mb-5">
                  <h2 class="text-xl font-bold mb-2">URL Redirects</h2>
                  <p class="text-[13px] text-slate-600">Configure URLs to be redirected to different destinations.</p>
                </div>
                
                <div v-if="redirectRules.length === 0" class="text-center py-8 text-slate-400">
                  No redirect rules configured.
                </div>
                
                <RedirectRule 
                  v-for="rule in redirectRules" 
                  :key="rule.id" 
                  :rule="rule" 
                  @update="updateRule(rule.id, $event)" 
                  @delete="deleteRuleFromDomain(globalDomain.id, rule.id)" 
                />
                
                <div class="pt-2 pb-6">
                  <button @click="openAddRuleForm('normalOverride')" class="text-blue-500 hover:text-blue-700 text-[13px] font-medium flex items-center gap-1">
                    + Add Redirect
                  </button>
                </div>
              </div>

              <div v-else-if="item.value === 'headers'">
                <div class="mb-5">
                  <h2 class="text-xl font-bold mb-2">Headers</h2>
                  <p class="text-[13px] text-slate-600">Modify request and response headers.</p>
                </div>

                <div v-if="headerRules.length === 0" class="text-center py-8 text-slate-400">
                  No header rules configured.
                </div>

                <HeaderRule 
                  v-for="rule in headerRules" 
                  :key="rule.id" 
                  :rule="rule" 
                  @update="updateRule(rule.id, $event)" 
                  @delete="deleteRuleFromDomain(globalDomain.id, rule.id)"
                  @edit-headers="openHeaderEditor"
                />
                
                <div class="pt-2 pb-6">
                  <button @click="openAddRuleForm('headerRule')" class="text-blue-500 hover:text-blue-700 text-[13px] font-medium flex items-center gap-1">
                    + Add Header Rule
                  </button>
                </div>
              </div>

              <div v-else-if="item.value === 'injections'">
                <div class="mb-5">
                  <h2 class="text-xl font-bold mb-2">CSS/JS Injection</h2>
                  <p class="text-[13px] text-slate-600">Inject custom CSS or JavaScript into pages or files.</p>
                </div>

                <div v-if="injectionRules.length === 0" class="text-center py-8 text-slate-400">
                  No injection rules configured.
                </div>

                <template v-for="rule in injectionRules" :key="rule.id">
                  <FileOverrideRule 
                    v-if="rule.type === 'fileOverride'" 
                    :rule="rule" 
                    @update="updateRule(rule.id, $event)" 
                    @delete="deleteRuleFromDomain(globalDomain.id, rule.id)"
                    @edit-file="openFileEditor"
                  />
                  <FileInjectRule 
                    v-else-if="rule.type === 'fileInject'" 
                    :rule="rule" 
                    @update="updateRule(rule.id, $event)" 
                    @delete="deleteRuleFromDomain(globalDomain.id, rule.id)"
                    @edit-file="openFileEditor"
                  />
                </template>
                
                <div class="pt-2 pb-6 flex gap-4">
                  <button @click="openAddRuleForm('fileOverride')" class="text-blue-500 hover:text-blue-700 text-[13px] font-medium flex items-center gap-1">
                    + Add URL to File
                  </button>
                  <button @click="openAddRuleForm('fileInject')" class="text-blue-500 hover:text-blue-700 text-[13px] font-medium flex items-center gap-1">
                    + Add Inject File
                  </button>
                </div>
              </div>
          </template>
        </UTabs>
      </div>

      <!-- Add Rule View -->
      <div v-show="showAddRuleForm" class="flex-1 flex justify-center items-start pt-10 bg-[#f4f4f5]">
        <UCard class="w-full max-w-[500px]">
          <template #header>
            <h3 class="text-xl font-semibold leading-none tracking-tight text-blue-700">Add New Rule</h3>
            <p class="text-sm text-slate-500 mt-1">Select the type of rule you want to create.</p>
          </template>
          <div class="space-y-4">
            <div class="space-y-2">
              <label class="text-sm font-medium block">Rule Type</label>
              <USelect v-model="newRuleType" :items="ruleTypeItems" />
            </div>

            <!-- Dynamic fields based on type -->
            <template v-if="newRuleType === 'normalOverride'">
              <div class="space-y-2">
                <label class="text-sm font-medium block">Source URL Pattern</label>
                <UInput v-model="newRule.match" placeholder="/https:\/\/example\.com\/(.*)/" />
              </div>
              <div class="space-y-2">
                <label class="text-sm font-medium block">Destination URL</label>
                <UInput v-model="newRule.replace" placeholder="https://localhost:8081/$1" />
              </div>
            </template>
            
            <template v-else-if="newRuleType === 'fileOverride' || newRuleType === 'headerRule'">
               <div class="space-y-2">
                <label class="text-sm font-medium block">Match URL</label>
                <UInput v-model="newRule.match" placeholder="*://example.com/*" />
              </div>
            </template>

            <template v-else-if="newRuleType === 'fileInject'">
               <div class="space-y-2">
                <label class="text-sm font-medium block">File Name</label>
                <UInput v-model="newRule.fileName" placeholder="my-script.js" />
              </div>
            </template>

          </div>
          <template #footer>
            <div class="flex justify-between">
              <UButton variant="outline" color="neutral" @click="cancelAddRule">Cancel</UButton>
              <UButton color="primary" @click="saveNewRule" class="bg-blue-600 hover:bg-blue-700 text-white">Add Rule</UButton>
            </div>
          </template>
        </UCard>
      </div>

      <!-- Fixed Footer -->
      <div class="shrink-0 bg-[#e4e4e7] flex justify-between items-center p-3 px-6 z-50">
        <template v-if="!showAddRuleForm">
          <div class="flex gap-2">
            <UButton variant="ghost" color="neutral" size="sm" class="font-medium" icon="i-lucide-refresh-cw" @click="handleReset">
              Reset
            </UButton>
          </div>
          <div class="flex gap-2 items-center">
            <UButton variant="ghost" color="neutral" size="sm" class="font-medium" @click="handleImport">Import</UButton>
            <UButton variant="ghost" color="neutral" size="sm" class="font-medium" @click="handleExport">Export</UButton>
            <UButton variant="ghost" color="neutral" size="sm" class="font-medium mr-2" @click="handleHelp">Help</UButton>
            <UButton color="primary" @click="handleSave" class="bg-[#2563eb] hover:bg-blue-700 text-white shadow-sm font-medium h-9" icon="i-lucide-save">
              Save Changes
            </UButton>
          </div>
        </template>
      </div>
      <input type="file" id="fileInput" accept=".json" class="hidden">
    </div>
  </UApp>
</template>

<script setup>
import { ref, computed, onMounted } from 'vue';
import { useRules } from './composables/useRules';

// Components
import AppHeader from './components/AppHeader.vue';
import RedirectRule from './components/RedirectRule.vue';
import HeaderRule from './components/HeaderRule.vue';
import FileOverrideRule from './components/FileOverrideRule.vue';
import FileInjectRule from './components/FileInjectRule.vue';

const activeTab = ref('redirects');
const showAddRuleForm = ref(false);
const newRuleType = ref('normalOverride');
const newRule = ref({ match: '', replace: '', fileName: '' });

const tabItems = [
  { label: 'URL Redirects', value: 'redirects' },
  { label: 'Headers', value: 'headers' },
  { label: 'CSS/JS Injection', value: 'injections' }
];

const ruleTypeItems = [
  { label: 'URL Redirect', value: 'normalOverride' },
  { label: 'URL to File', value: 'fileOverride' },
  { label: 'Inject File', value: 'fileInject' },
  { label: 'Modify Headers', value: 'headerRule' }
];

const { domains, globalDomain, isLoading, fetchDomains, saveGlobalRule, saveDomain, deleteRule, importRules, exportRules } = useRules();

onMounted(async () => {
  await fetchDomains();
  
  const fileInput = document.getElementById('fileInput');
  if (fileInput) {
      fileInput.addEventListener('change', (e) => {
          const file = e.target.files[0];
          if (!file) return;

          const reader = new FileReader();
          reader.onload = (event) => {
              try {
                  const data = JSON.parse(event.target.result);
                  if (Array.isArray(data)) {
                      importRules(data).then(() => {
                        alert("Rules imported successfully!");
                      });
                  } else {
                      alert("Invalid JSON format. Expected an array of domains.");
                  }
              } catch (err) {
                  alert("Failed to parse JSON file.");
              }
          };
          reader.readAsText(file);
          fileInput.value = "";
      });
  }
});

// Computed properties for rules (we are currently only using the global domain `*` for simplicity)
const globalRules = computed(() => {
  return globalDomain.value?.rules || [];
});

const redirectRules = computed(() => globalRules.value.filter(r => r.type === 'normalOverride'));
const headerRules = computed(() => globalRules.value.filter(r => r.type === 'headerRule'));
const injectionRules = computed(() => globalRules.value.filter(r => r.type === 'fileOverride' || r.type === 'fileInject'));

const getRuleCount = (type) => {
  if (type === 'redirects') return redirectRules.value.length;
  if (type === 'headers') return headerRules.value.length;
  if (type === 'injections') return injectionRules.value.length;
  return 0;
};

// Actions
const updateRule = async (ruleId, updatedRuleData) => {
  // Find rule in global domain and update it
  if (!globalDomain.value) return;
  const idx = globalDomain.value.rules.findIndex(r => r.id === ruleId);
  if (idx !== -1) {
    globalDomain.value.rules[idx] = updatedRuleData;
    await saveDomain(globalDomain.value);
  }
};

const deleteRuleFromDomain = async (domainId, ruleId) => {
  if(confirm('Are you sure you want to delete this rule?')) {
    await deleteRule(domainId, ruleId);
  }
};

const openAddRuleForm = (type) => {
  newRuleType.value = type;
  showAddRuleForm.value = true;
}

const cancelAddRule = () => {
  showAddRuleForm.value = false;
  newRule.value = { match: '', replace: '', fileName: '' };
};

const saveNewRule = async () => {
  const ruleToSave = {
    type: newRuleType.value,
    on: true,
  };

  if (newRuleType.value === 'normalOverride') {
    if (!newRule.value.match || !newRule.value.replace) return alert("Match and Replace URLs are required.");
    ruleToSave.match = newRule.value.match;
    ruleToSave.replace = newRule.value.replace;
  } else if (newRuleType.value === 'fileOverride') {
    if (!newRule.value.match) return alert("Match URL is required.");
    ruleToSave.match = newRule.value.match;
    ruleToSave.file = '';
  } else if (newRuleType.value === 'fileInject') {
    ruleToSave.fileName = newRule.value.fileName || '';
    ruleToSave.fileType = 'js';
    ruleToSave.injectLocation = 'head';
    ruleToSave.file = '';
  } else if (newRuleType.value === 'headerRule') {
    if (!newRule.value.match) return alert("Match URL is required.");
    ruleToSave.match = newRule.value.match;
    ruleToSave.requestRules = [];
    ruleToSave.responseRules = [];
  }

  await saveGlobalRule(ruleToSave);
  cancelAddRule();
};

const handleImport = () => {
  document.getElementById('fileInput')?.click();
};

const handleExport = () => {
  exportRules();
};

const handleHelp = () => {
  alert('Help section is coming soon!');
};

const handleReset = () => {
    // In this context, reset usually reloads the domains.
    fetchDomains();
};

const handleSave = () => {
    // We already auto-save, but this gives a nice visual queue that matches the screenshot
    alert("Changes are auto-saved successfully!");
};

// Editor placeholders
const openHeaderEditor = (rule) => {
  // TODO: Implement header editor modal
  alert('Header editor will be implemented in the next phase! For now it requires the legacy UI.');
};

const openFileEditor = (rule) => {
  // TODO: Implement file editor modal
  alert('File editor (Ace) will be implemented in the next phase! For now it requires the legacy UI.');
};
</script>