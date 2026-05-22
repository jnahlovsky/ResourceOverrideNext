<template>
  <UApp>
    <div id="vue-root" class="flex flex-col bg-white w-[750px] h-[550px]">
      <AppHeader />

      <!-- Main View -->
      <div class="flex-1 flex flex-col overflow-hidden">
        <UTabs v-model="activeTab" :items="tabItems" class="flex-1 flex flex-col pt-0 px-0 w-full" :ui="{
            root: 'flex-1 flex flex-col',
            list: 'flex w-full bg-white border-b border-slate-200 p-0 rounded-none',
            indicator: 'absolute top-auto bottom-0 h-[2px] bg-primary-500 rounded-none',
            trigger: 'flex-1 rounded-none py-3.5 text-[13px] font-semibold transition-colors data-[state=active]:text-primary-600 data-[state=inactive]:text-slate-500 hover:data-[state=inactive]:text-slate-800 focus-visible:ring-0',
            content: 'flex-1 overflow-y-auto px-6 py-6 relative focus-visible:outline-none bg-white'
          }">
          <template #default="{ item, index, selected }">
            <div class="flex items-center gap-2">
              <span :class="selected ? 'text-primary-600' : ''">{{ item.label }}</span>
              <UBadge :color="selected ? 'primary' : 'neutral'" variant="subtle" class="rounded-md px-1.5 py-0 text-[11px] font-semibold transition-colors">{{ getRuleCount(item.value) }}</UBadge>
            </div>
          </template>

          <template #content="{ item }">
              <div v-if="isLoading" class="absolute inset-0 flex items-center justify-center bg-[#f4f4f5]/50 z-10">
                <span class="text-slate-500">Loading rules...</span>
              </div>

              <div v-if="item.value === 'redirects'">
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
              </div>

              <div v-else-if="item.value === 'headers'">
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
              </div>

              <div v-else-if="item.value === 'injections'">
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
              </div>
          </template>
        </UTabs>
      </div>

      <!-- Fixed Footer -->
      <div class="shrink-0 bg-white flex justify-between items-center p-3 px-6 z-50 border-t border-slate-100">
        <div class="flex gap-2 items-center">
          <UButton variant="ghost" color="neutral" size="sm" class="font-medium text-slate-600" icon="i-lucide-help-circle" @click="handleHelp">
            Help
          </UButton>
        </div>
        <div class="flex gap-2 items-center">
          <UButton variant="ghost" color="neutral" size="sm" class="font-medium text-slate-600" icon="i-lucide-download" @click="handleImport">Import</UButton>
          <UButton variant="ghost" color="neutral" size="sm" class="font-medium text-slate-600 mr-2" icon="i-lucide-upload" @click="handleExport">Export</UButton>

          <UDropdown v-if="activeTab === 'injections'" :items="[[{ label: 'URL to File', click: () => addEmptyRule('fileOverride') }, { label: 'Inject File', click: () => addEmptyRule('fileInject') }]]">
            <UButton color="primary" class="font-semibold px-4 h-9 shadow-sm" icon="i-lucide-plus" trailing-icon="i-lucide-chevron-down">
              Add Rule
            </UButton>
          </UDropdown>

          <UButton v-else color="primary" @click="addEmptyRule(activeTab === 'headers' ? 'headerRule' : 'normalOverride')" class="font-semibold px-4 h-9 shadow-sm" icon="i-lucide-plus">
            Add Rule
          </UButton>
        </div>
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

const tabItems = [
  { label: 'URL Redirects', value: 'redirects' },
  { label: 'Custom Headers', value: 'headers' },
  { label: 'Inline/File Injection', value: 'injections' }
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
  const rule = globalDomain.value?.rules.find(r => r.id === ruleId);
  const isEmpty = rule && (
    (rule.type === 'normalOverride' && !rule.match && !rule.replace) ||
    ((rule.type === 'fileOverride' || rule.type === 'headerRule') && !rule.match) ||
    (rule.type === 'fileInject' && !rule.fileName)
  );

  if(isEmpty || confirm('Are you sure you want to delete this rule?')) {
    await deleteRule(domainId, ruleId);
  }
};

const addEmptyRule = async (type) => {
  const newRule = { type, on: true };
  if (type === 'normalOverride') {
    newRule.match = '';
    newRule.replace = '';
  } else if (type === 'fileOverride') {
    newRule.match = '';
    newRule.file = '';
  } else if (type === 'fileInject') {
    newRule.fileName = '';
    newRule.fileType = 'js';
    newRule.injectLocation = 'head';
    newRule.file = '';
  } else if (type === 'headerRule') {
    newRule.match = '';
    newRule.requestRules = [];
    newRule.responseRules = [];
  }
  await saveGlobalRule(newRule);
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
