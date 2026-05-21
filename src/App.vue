<template>
  <div id="vue-root" class="flex flex-col h-full bg-[#f4f4f5] w-[750px] min-h-[550px]">
    <AppHeader />

    <!-- Main View -->
    <div v-show="!showAddRuleForm" class="flex-1 flex flex-col overflow-hidden">
      <Tabs v-model="activeTab" class="flex-1 flex flex-col pt-0 px-0">
        <TabsList class="flex w-full bg-white p-0 h-auto border-b border-slate-200">
          <TabsTrigger 
            value="redirects" 
            class="flex-1 rounded-none py-2.5 text-[13px] font-medium data-[state=active]:bg-[#2563eb] data-[state=active]:text-white data-[state=inactive]:bg-white data-[state=inactive]:text-slate-600 transition-none h-full shadow-none border-none data-[state=active]:shadow-none"
          >
            URL Redirects
            <Badge variant="secondary" class="ml-2 rounded-full px-2 py-0 text-xs font-semibold" :class="activeTab === 'redirects' ? 'bg-blue-800 text-white hover:bg-blue-800' : 'bg-slate-600 text-white hover:bg-slate-600'">{{ redirectRules.length }}</Badge>
          </TabsTrigger>
          <TabsTrigger 
            value="headers" 
            class="flex-1 rounded-none py-2.5 text-[13px] font-medium data-[state=active]:bg-[#2563eb] data-[state=active]:text-white data-[state=inactive]:bg-white data-[state=inactive]:text-slate-600 transition-none h-full shadow-none border-none data-[state=active]:shadow-none"
          >
            Headers
            <Badge variant="secondary" class="ml-2 rounded-full px-2 py-0 text-xs font-semibold" :class="activeTab === 'headers' ? 'bg-blue-800 text-white hover:bg-blue-800' : 'bg-slate-600 text-white hover:bg-slate-600'">{{ headerRules.length }}</Badge>
          </TabsTrigger>
          <TabsTrigger 
            value="injections" 
            class="flex-1 rounded-none py-2.5 text-[13px] font-medium data-[state=active]:bg-[#2563eb] data-[state=active]:text-white data-[state=inactive]:bg-white data-[state=inactive]:text-slate-600 transition-none h-full shadow-none border-none data-[state=active]:shadow-none"
          >
            CSS/JS Injection
            <Badge variant="secondary" class="ml-2 rounded-full px-2 py-0 text-xs font-semibold" :class="activeTab === 'injections' ? 'bg-blue-800 text-white hover:bg-blue-800' : 'bg-slate-600 text-white hover:bg-slate-600'">{{ injectionRules.length }}</Badge>
          </TabsTrigger>
        </TabsList>

        <div class="flex-1 overflow-y-auto px-6 py-6 relative">
          <div v-if="isLoading" class="absolute inset-0 flex items-center justify-center bg-[#f4f4f5]/50 z-10">
            <span class="text-slate-500">Loading rules...</span>
          </div>
          
          <TabsContent value="redirects" class="m-0 focus-visible:outline-none">
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
          </TabsContent>

          <TabsContent value="headers" class="m-0 focus-visible:outline-none">
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
          </TabsContent>

          <TabsContent value="injections" class="m-0 focus-visible:outline-none">
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
          </TabsContent>
        </div>
      </Tabs>
    </div>

    <!-- Add Rule View -->
    <div v-show="showAddRuleForm" class="flex-1 flex justify-center items-start pt-10 bg-[#f4f4f5]">
      <Card class="w-full max-w-[500px]">
        <CardHeader>
          <CardTitle class="text-xl text-blue-700">Add New Rule</CardTitle>
          <CardDescription>Select the type of rule you want to create.</CardDescription>
        </CardHeader>
        <CardContent class="space-y-4">
          <div class="space-y-2">
            <Label>Rule Type</Label>
            <Select v-model="newRuleType">
              <SelectTrigger>
                <SelectValue placeholder="Select type" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="normalOverride">URL Redirect</SelectItem>
                <SelectItem value="fileOverride">URL to File</SelectItem>
                <SelectItem value="fileInject">Inject File</SelectItem>
                <SelectItem value="headerRule">Modify Headers</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <!-- Dynamic fields based on type -->
          <template v-if="newRuleType === 'normalOverride'">
            <div class="space-y-2">
              <Label>Source URL Pattern</Label>
              <Input v-model="newRule.match" placeholder="/https:\/\/example\.com\/(.*)/" />
            </div>
            <div class="space-y-2">
              <Label>Destination URL</Label>
              <Input v-model="newRule.replace" placeholder="https://localhost:8081/$1" />
            </div>
          </template>
          
          <template v-else-if="newRuleType === 'fileOverride' || newRuleType === 'headerRule'">
             <div class="space-y-2">
              <Label>Match URL</Label>
              <Input v-model="newRule.match" placeholder="*://example.com/*" />
            </div>
          </template>

          <template v-else-if="newRuleType === 'fileInject'">
             <div class="space-y-2">
              <Label>File Name</Label>
              <Input v-model="newRule.fileName" placeholder="my-script.js" />
            </div>
          </template>

        </CardContent>
        <CardFooter class="flex justify-between border-t p-4 bg-slate-50">
          <Button variant="outline" @click="cancelAddRule">Cancel</Button>
          <Button @click="saveNewRule" class="bg-blue-600 hover:bg-blue-700 text-white">Add Rule</Button>
        </CardFooter>
      </Card>
    </div>

    <!-- Fixed Footer -->
    <div class="shrink-0 bg-[#e4e4e7] flex justify-between items-center p-3 px-6 z-50">
      <template v-if="!showAddRuleForm">
        <div class="flex gap-2">
          <Button variant="ghost" size="sm" class="text-slate-600 bg-transparent hover:bg-slate-300 font-medium" @click="handleReset">
            <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="mr-2 lucide lucide-refresh-cw"><path d="M3 12a9 9 0 1 0 9-9 9.75 9.75 0 0 0-6.74 2.74L3 8"/><path d="M3 3v5h5"/></svg>
            Reset
          </Button>
        </div>
        <div class="flex gap-2 items-center">
          <Button variant="ghost" size="sm" class="text-slate-600 bg-transparent hover:bg-slate-300 font-medium" @click="handleImport">Import</Button>
          <Button variant="ghost" size="sm" class="text-slate-600 bg-transparent hover:bg-slate-300 font-medium" @click="handleExport">Export</Button>
          <Button variant="ghost" size="sm" class="text-slate-600 bg-transparent hover:bg-slate-300 font-medium mr-2" @click="handleHelp">Help</Button>
          <Button @click="handleSave" class="bg-[#2563eb] hover:bg-blue-700 text-white shadow-sm font-medium h-9">
            <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="mr-2 lucide lucide-save"><path d="M19 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11l5 5v11a2 2 0 0 1-2 2z"/><polyline points="17 21 17 13 7 13 7 21"/><polyline points="7 3 7 8 15 8"/></svg>
            Save Changes
          </Button>
        </div>
      </template>
    </div>
    <input type="file" id="fileInput" accept=".json" class="hidden">
  </div>
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

// UI Primitives
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { Card, CardHeader, CardTitle, CardDescription, CardContent, CardFooter } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';

const activeTab = ref('redirects');
const showAddRuleForm = ref(false);
const newRuleType = ref('normalOverride');
const newRule = ref({ match: '', replace: '', fileName: '' });

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