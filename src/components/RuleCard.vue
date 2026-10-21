<template>
  <div class="group relative mb-2">
    <!-- Drag Handle -->
    <div class="absolute -left-5 top-1/2 -translate-y-1/2 w-5 flex justify-center flex-shrink-0 z-10">
      <UIcon name="i-lucide-grip-vertical" class="drag-handle w-4 h-4 text-slate-400 cursor-grab opacity-0 group-hover:opacity-100 transition-opacity" />
    </div>
    
    <div class="w-full rounded-md border border-slate-200 shadow-sm bg-white transition-colors overflow-hidden" :class="!rule.on ? 'opacity-70 grayscale-[20%]' : ''">
      <!-- Header Area -->
      <div class="flex items-center justify-between px-2.5 py-1.5 bg-slate-200 rounded-t-md">
        <div class="flex items-center gap-2">
          <!-- Title / Editor -->
          <input 
            v-if="isEditingTitle" 
            v-model="editableTitle" 
            @blur="saveTitle" 
            @keyup.enter="saveTitle"
            class="text-[11px] font-bold tracking-wider uppercase text-slate-700 bg-white border border-primary-300 rounded px-1 outline-none w-32"
            ref="titleInput"
          />
          <button
            v-else
            type="button"
            @click="startEditingTitle"
            class="cursor-text text-[11px] font-bold tracking-wider uppercase text-slate-500 hover:text-slate-700 transition-colors"
            title="Click to rename"
          >
            {{ rule.name || ruleTitle }}
          </button>

          <!-- Port (edits the destination URL's port) -->
          <template v-if="canEditPort">
            <input
              v-if="isEditingPort"
              ref="portInput"
              v-model="editablePort"
              @blur="savePort"
              @keydown.enter.prevent="savePort"
              @keydown.esc.prevent="isEditingPort = false"
              inputmode="numeric"
              maxlength="5"
              placeholder="port"
              aria-label="Destination port"
              class="font-mono text-[10px] font-semibold leading-4 w-[7ch] px-1 rounded bg-white border border-primary-300 text-primary-700 outline-none"
            />
            <button
              v-else-if="targetPort"
              type="button"
              @click="startEditingPort"
              class="cursor-text font-mono text-[10px] font-semibold leading-4 px-1.5 rounded bg-primary-100 text-primary-700 hover:bg-primary-200 transition-colors"
              :title="`Redirects to port ${targetPort}. Click to change it.`"
            >:{{ targetPort }}</button>
            <button
              v-else
              type="button"
              @click="startEditingPort"
              class="cursor-text font-mono text-[10px] font-semibold leading-4 px-1.5 rounded border border-dashed border-slate-400 text-slate-500 opacity-0 group-hover:opacity-100 focus-visible:opacity-100 hover:text-slate-700 transition-opacity"
              title="Add a port to the destination URL"
            >+port</button>
          </template>
          <UIcon
            v-if="hasActiveDomainFilters"
            name="i-lucide-funnel"
            class="w-3 h-3 text-slate-500"
            title="Domain filters active"
          />
        </div>
        <div class="flex items-center gap-3">
          <!-- Domain Filters Toggle -->
          <button
            type="button"
            :aria-pressed="!!rule.domainFiltersOn"
            :title="domainFiltersTitle"
            @click="emit('update-options', { domainFiltersOn: !rule.domainFiltersOn })"
            class="h-6 px-2 inline-flex items-center gap-1 rounded-md text-[10px] font-bold uppercase tracking-wider transition-colors"
            :class="rule.domainFiltersOn ? 'bg-white text-slate-700 shadow-sm' : 'text-slate-500 hover:text-slate-700 hover:bg-slate-300'"
          >
            <UIcon name="i-lucide-funnel" class="w-3 h-3" />
            Filter
          </button>
          <!-- Match Syntax -->
          <div
            v-if="hasUrlPattern"
            role="radiogroup"
            aria-label="Match syntax"
            class="flex items-center rounded-md bg-slate-300/70 p-0.5"
          >
            <button
              v-for="option in matchModeOptions"
              :key="option.value"
              type="button"
              role="radio"
              :aria-checked="matchMode === option.value"
              :title="option.title"
              @click="setMatchMode(option.value)"
              class="h-5 px-2 rounded text-[10px] font-bold uppercase tracking-wider transition-colors"
              :class="matchMode === option.value ? 'bg-white text-slate-700 shadow-sm' : 'text-slate-500 hover:text-slate-700'"
            >
              {{ option.label }}
            </button>
          </div>
          <div v-if="hasUrlPattern" class="w-px h-4 bg-slate-300"></div>
          <!-- Collapse Toggle -->
          <UButton
            variant="ghost"
            :icon="rule.isCollapsed ? 'i-lucide-chevron-down' : 'i-lucide-chevron-up'"
            @click="$emit('update-collapse', !rule.isCollapsed)"
            class="text-slate-500 hover:text-slate-700 hover:bg-slate-300 rounded-md w-6 h-6 p-0 flex justify-center items-center transition-colors"
          />
          <UButton
            variant="ghost"
            icon="i-lucide-trash-2"
            @click="$emit('delete')"
            class="text-slate-500 hover:text-red-500 hover:bg-slate-300 rounded-md w-6 h-6 p-0 flex justify-center items-center transition-colors"
          />
          <div class="w-px h-4 bg-slate-300"></div>
          <div class="flex items-center gap-2">
            <USwitch
              :model-value="rule.on"
              @update:model-value="$emit('toggle', $event)"
              size="sm"
              color="success"
              :ui="{ inactive: 'bg-slate-400' }"
            />
          </div>
        </div>
      </div>

      <!-- Main Content Area -->
      <div v-show="!rule.isCollapsed" class="p-2 w-full">
        <slot></slot>

        <!-- Domain Filters -->
        <div v-if="rule.domainFiltersOn" class="flex flex-col gap-1.5 mt-1.5 pt-1.5 border-t border-slate-200">
          <div class="flex items-start gap-2">
            <UIcon name="i-lucide-list-check" class="text-slate-400 w-4 h-4 flex-shrink-0 mt-1.5" title="Only on these domains" />
            <UInput
              v-model="includeDomains"
              @change="emit('update-options', { includeDomains })"
              :placeholder="`Only on domains, e.g. ${domainExample}stage.example.com, test.example.com (empty = all)`"
              size="sm"
              class="font-mono flex-1"
              :ui="{ base: 'bg-white border-slate-300 rounded-sm shadow-none h-7', root: 'flex-1' }"
            />
          </div>
          <div class="flex items-start gap-2">
            <UIcon name="i-lucide-ban" class="text-slate-400 w-4 h-4 flex-shrink-0 mt-1.5" title="Never on these domains" />
            <UInput
              v-model="excludeDomains"
              @change="emit('update-options', { excludeDomains })"
              :placeholder="`Exclude domains, e.g. ${domainExample}localhost, cdn.example.com`"
              size="sm"
              class="font-mono flex-1"
              :ui="{ base: 'bg-white border-slate-300 rounded-sm shadow-none h-7', root: 'flex-1' }"
            />
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, computed, watch, nextTick } from 'vue';
import { getDomainFilters, getMatchMode, convertMatchMode, getTargetPort, setTargetPort } from '../extension/urlPattern.js';

const props = defineProps({
  rule: {
    type: Object,
    required: true
  }
});

const emit = defineEmits(['toggle', 'delete', 'update-collapse', 'update-name', 'update-options']);

// File injections run in the page itself, so their filters check the page's domain.
const domainExample = computed(() => props.rule.type === 'fileInject' ? 'page ' : '');

const domainFiltersTitle = computed(() => props.rule.type === 'fileInject'
  ? 'Include / exclude page domains'
  : 'Include / exclude request domains');

// File injections have no URL pattern; every other rule matches request URLs.
const hasUrlPattern = computed(() => props.rule.type !== 'fileInject');
const matchMode = computed(() => getMatchMode(props.rule));

const matchModeOptions = [
  { value: 'wildcard', label: 'Wildcard', title: 'Match with * and **, and reuse them in the destination' },
  { value: 'regex', label: 'Regex', title: 'Match with a regular expression; use $1, $2… in the destination' }
];

// Switching syntax also translates the patterns, e.g. */app/** <-> (.*?)\/app\/(.*)
const setMatchMode = (mode) => {
  if (mode === matchMode.value) return;
  emit('update-options', convertMatchMode(props.rule, mode));
};

const targetPort = computed(() => props.rule.type === 'normalOverride' ? getTargetPort(props.rule.replace) : '');

// Only redirects to an absolute URL have a port to show or change.
const canEditPort = computed(() =>
  props.rule.type === 'normalOverride' && setTargetPort(props.rule.replace, '1') !== props.rule.replace
);

const isEditingPort = ref(false);
const editablePort = ref('');
const portInput = ref(null);

const startEditingPort = () => {
  editablePort.value = targetPort.value;
  isEditingPort.value = true;
  nextTick(() => portInput.value?.select());
};

// The label and the destination field stay in sync: this rewrites the URL, and the
// label is read back from it.
const savePort = () => {
  if (!isEditingPort.value) return;
  isEditingPort.value = false;
  const port = editablePort.value.trim().replace(/^:/, '');
  if (port === targetPort.value) return;
  if (port !== '' && !(/^\d{1,5}$/.test(port) && Number(port) >= 1 && Number(port) <= 65535)) return;
  emit('update-options', { replace: setTargetPort(props.rule.replace, port) });
};

const hasActiveDomainFilters = computed(() => {
  const { include, exclude } = getDomainFilters(props.rule);
  return include.length > 0 || exclude.length > 0;
});

const includeDomains = ref(props.rule.includeDomains || '');
const excludeDomains = ref(props.rule.excludeDomains || '');

watch(() => props.rule.includeDomains, (val) => { includeDomains.value = val || ''; });
watch(() => props.rule.excludeDomains, (val) => { excludeDomains.value = val || ''; });

const ruleTitle = computed(() => {
  switch (props.rule.type) {
    case 'normalOverride': return 'URL Redirect';
    case 'headerRule': return 'Custom Headers';
    case 'fileOverride': return 'File Override';
    case 'fileInject': return 'File Injection';
    default: return 'Rule';
  }
});

const isEditingTitle = ref(false);
const editableTitle = ref('');
const titleInput = ref(null);

const startEditingTitle = () => {
  editableTitle.value = props.rule.name || '';
  isEditingTitle.value = true;
  setTimeout(() => titleInput.value?.focus(), 50);
};

const saveTitle = () => {
  if (!isEditingTitle.value) return;
  isEditingTitle.value = false;
  if (editableTitle.value !== props.rule.name) {
    emit('update-name', editableTitle.value);
  }
};
</script>
