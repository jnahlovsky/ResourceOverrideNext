<template>
  <UApp>
    <div id="vue-root" class="flex flex-col bg-white w-[750px] h-[550px]">
      <AppHeader />

      <!-- Main View -->
      <div class="flex-1 flex flex-col overflow-hidden min-h-0">
        <UTabs v-model="activeTab" :items="tabItems" class="flex-1 flex flex-col pt-0 px-0 w-full min-h-0" :ui="{
            root: 'flex-1 flex flex-col min-h-0',
            list: 'flex w-full bg-white border-b border-slate-200 p-0 rounded-none shrink-0',
            indicator: 'absolute top-auto bottom-0 h-[2px] bg-primary-500 rounded-none',
            trigger: 'flex-1 rounded-none py-3.5 text-[13px] font-semibold transition-colors data-[state=active]:text-primary-600 data-[state=inactive]:text-slate-500 hover:data-[state=inactive]:text-slate-800 focus-visible:ring-0',
            content: 'flex-1 overflow-y-auto px-6 py-6 relative focus-visible:outline-none bg-white min-h-0'
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

          <UDropdownMenu 
            v-if="activeTab === 'injections'" 
            :items="[{ label: 'URL to File', onSelect: () => addEmptyRule('fileOverride') }, { label: 'Inject File', onSelect: () => addEmptyRule('fileInject') }]"
            :content="{ side: 'top', align: 'end', sideOffset: 8 }"
            :ui="{ content: 'z-[100]' }"
          >
            <UButton color="primary" class="font-semibold px-4 h-9 shadow-sm" icon="i-lucide-plus" trailing-icon="i-lucide-chevron-down">
              Add Rule
            </UButton>
          </UDropdownMenu>

          <UButton v-else color="primary" @click="addEmptyRule(activeTab === 'headers' ? 'headerRule' : 'normalOverride')" class="font-semibold px-4 h-9 shadow-sm" icon="i-lucide-plus">
            Add Rule
          </UButton>
        </div>
      </div>
      <input type="file" id="fileInput" accept=".json" class="hidden">
    </div>

    <!-- File Editor Modal -->
    <CodeEditorModal 
      v-model="isEditorOpen" 
      :initial-content="editorContent" 
      @save="handleEditorSave" 
    />

    <!-- Help Modal -->
    <HelpModal v-model="isHelpOpen" />

    <!-- Confirm/Alert Modal -->
    <ConfirmModal 
      v-model="isConfirmOpen"
      :title="confirmOptions.title"
      :message="confirmOptions.message"
      :isAlert="confirmOptions.isAlert"
      :confirmText="confirmOptions.confirmText"
      :confirmColor="confirmOptions.confirmColor"
      @confirm="handleConfirmSuccess"
      @cancel="handleConfirmCancel"
    />
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
import CodeEditorModal from './components/CodeEditorModal.vue';
import HelpModal from './components/HelpModal.vue';
import ConfirmModal from './components/ConfirmModal.vue';

const activeTab = ref('redirects');

const tabItems = [
  { label: 'URL Redirects', value: 'redirects' },
  { label: 'Custom Headers', value: 'headers' },
  { label: 'Inline/File Injection', value: 'injections' }
];

const { domains, globalDomain, isLoading, fetchDomains, saveGlobalRule, saveDomain, deleteRule, importRules, exportRules } = useRules();

// Editor state
const isEditorOpen = ref(false);
const editorContent = ref('');
const editingRuleId = ref(null);

// Help Modal state
const isHelpOpen = ref(false);

// Confirm Modal state
const isConfirmOpen = ref(false);
const confirmOptions = ref({
  title: '',
  message: '',
  isAlert: false,
  confirmText: 'OK',
  confirmColor: 'primary',
  onConfirm: null,
  onCancel: null
});

const showAlert = (message, title = 'Notification') => {
  confirmOptions.value = {
    title,
    message,
    isAlert: true,
    confirmText: 'OK',
    confirmColor: 'primary',
    onConfirm: null,
    onCancel: null
  };
  isConfirmOpen.value = true;
};

const showConfirm = (message, title = 'Confirm', confirmText = 'Confirm', confirmColor = 'red') => {
  return new Promise((resolve) => {
    confirmOptions.value = {
      title,
      message,
      isAlert: false,
      confirmText,
      confirmColor,
      onConfirm: () => resolve(true),
      onCancel: () => resolve(false)
    };
    isConfirmOpen.value = true;
  });
};

const handleConfirmSuccess = () => {
  if (confirmOptions.value.onConfirm) confirmOptions.value.onConfirm();
};

const handleConfirmCancel = () => {
  if (confirmOptions.value.onCancel) confirmOptions.value.onCancel();
};

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
                        showAlert("Rules successfully imported and applied.", "Import Successful");
                      });
                  } else {
                      showAlert("Invalid JSON format. Expected an array of domains.", "Import Failed");
                  }
              } catch (err) {
                  showAlert("Failed to parse the JSON file. Ensure it is a valid Resource Override export.", "Import Failed");
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

  if (isEmpty) {
    await deleteRule(domainId, ruleId);
  } else {
    const isConfirmed = await showConfirm('Are you sure you want to delete this rule? This action cannot be undone.', 'Delete Rule', 'Delete', 'red');
    if (isConfirmed) {
      await deleteRule(domainId, ruleId);
    }
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
  isHelpOpen.value = true;
};

const handleReset = () => {
    // In this context, reset usually reloads the domains.
    fetchDomains();
};

const openFileEditor = (rule) => {
  editingRuleId.value = rule.id;
  editorContent.value = rule.file || '';
  isEditorOpen.value = true;
};

const handleEditorSave = async (newContent) => {
  if (editingRuleId.value && globalDomain.value) {
    const rule = globalDomain.value.rules.find(r => r.id === editingRuleId.value);
    if (rule) {
      rule.file = newContent;
      await saveDomain(globalDomain.value);
    }
  }
};
</script>
