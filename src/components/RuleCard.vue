<template>
  <!-- `bare`: just the fields, for the quick list's open card (popup / side panel), whose
       own row is the one-line header. -->
  <div class="group relative" :class="!bare && 'mb-2'">
    <div
      class="w-full bg-white transition-colors"
      :class="bare ? '' : 'rounded-md border border-slate-200 shadow-sm overflow-hidden'"
    >
      <!-- One-line header: grip, name, port, state icons · filters, syntax · delete · on/off, open/close -->
      <div v-if="!bare" class="flex items-center gap-2 pl-1 pr-2 py-1.5 bg-slate-200">
        <UIcon
          name="i-lucide-grip-vertical"
          class="drag-handle shrink-0 w-4 h-4 text-slate-400 hover:text-slate-600 cursor-grab active:cursor-grabbing"
          title="Drag to reorder"
        />
        <!-- Switched-off rules fade their name and fields, not the controls. -->
        <div class="flex items-center gap-2 min-w-0 flex-1 transition-opacity" :class="!rule.on && 'opacity-50'">
          <!-- Title / Editor -->
          <input 
            v-if="isEditingTitle" 
            v-model="editableTitle" 
            @blur="saveTitle" 
            @keyup.enter="saveTitle"
            :placeholder="ruleTitle"
            aria-label="Rule name"
            class="min-w-0 w-56 text-[13px] font-semibold leading-5 text-slate-800 bg-white border border-primary-300 rounded px-1 -mx-1 outline-none"
            ref="titleInput"
          />
          <button
            v-else
            type="button"
            @click="startEditingTitle"
            class="min-w-0 truncate text-left cursor-text text-[13px] font-semibold leading-5 text-slate-800 hover:text-slate-950 transition-colors"
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
              class="shrink-0 font-mono text-[10px] font-semibold leading-4 w-[7ch] px-1 rounded bg-white border border-primary-300 text-primary-700 outline-none"
            />
            <button
              v-else-if="targetPort"
              type="button"
              @click="startEditingPort"
              class="shrink-0 cursor-text font-mono text-[10px] font-semibold leading-4 px-1.5 rounded bg-primary-100 text-primary-700 hover:bg-primary-200 transition-colors"
              :title="`Redirects to port ${targetPort}. Click to change it.`"
            >:{{ targetPort }}</button>
            <button
              v-else
              type="button"
              @click="startEditingPort"
              class="shrink-0 cursor-text font-mono text-[10px] font-semibold leading-4 px-1.5 rounded border border-dashed border-slate-400 text-slate-500 opacity-0 group-hover:opacity-100 focus-visible:opacity-100 hover:text-slate-700 transition-opacity"
              title="Add a port to the destination URL"
            >+port</button>
          </template>
          <UIcon
            v-if="ruleError"
            name="i-lucide-triangle-alert"
            class="shrink-0 w-3.5 h-3.5 text-red-500"
            :title="`Not applied: ${ruleError}`"
          />
          <UIcon
            v-else-if="issues.length > 0"
            name="i-lucide-circle-alert"
            class="shrink-0 w-3.5 h-3.5"
            :class="hasIssueErrors ? 'text-red-500' : 'text-amber-500'"
            :title="issues.map(issue => issue.message).join('\n')"
          />
        </div>

        <RuleControls class="shrink-0" :rule="rule" @update-options="(patch) => emit('update-options', patch)" />
        <div class="shrink-0 w-px h-4 bg-slate-300"></div>
        <UButton
          variant="ghost"
          icon="i-lucide-trash-2"
          title="Delete rule"
          @click="$emit('delete')"
          class="shrink-0 text-slate-500 hover:text-red-500 hover:bg-slate-300 rounded-md w-6 h-6 p-0 flex justify-center items-center transition-colors"
        />
        <div class="shrink-0 w-px h-4 bg-slate-300"></div>
        <USwitch
          :model-value="rule.on"
          @update:model-value="$emit('toggle', $event)"
          size="sm"
          color="success"
          class="shrink-0"
          :ui="{ base: 'data-[state=unchecked]:bg-slate-400' }"
          :aria-label="rule.on ? 'Switch the rule off' : 'Switch the rule on'"
        />
        <!-- Open / close, the same arrow as in the popup and side panel -->
        <button
          type="button"
          class="shrink-0 -mr-0.5 flex items-center justify-center w-6 h-6 rounded-md text-slate-500 hover:text-slate-700 hover:bg-slate-300 transition-colors"
          :aria-expanded="!rule.isCollapsed"
          :title="rule.isCollapsed ? 'Show the fields' : 'Hide the fields'"
          @click="$emit('update-collapse', !rule.isCollapsed)"
        >
          <UIcon name="i-lucide-chevron-down" class="w-4 h-4 transition-transform" :class="!rule.isCollapsed && 'rotate-180'" />
        </button>
      </div>

      <!-- Main Content Area -->
      <!-- Bare: roomier, and the fields' own rows spaced a bit wider ([&>div]). -->
      <div v-show="bare || !rule.isCollapsed" class="w-full transition-opacity" :class="[bare ? 'p-2.5 [&>div]:gap-2' : 'p-2', !bare && !rule.on && 'opacity-60 grayscale-[20%]']">
        <div v-if="ruleError" class="mb-2 flex items-start gap-1.5 rounded-sm bg-red-50 px-2 py-1.5 text-[12px] text-red-700">
          <UIcon name="i-lucide-triangle-alert" class="w-3.5 h-3.5 shrink-0 mt-px" />
          <span><strong class="font-semibold">Chrome rejected this rule, so it isn't applied.</strong> {{ ruleError }}</span>
        </div>
        <!-- Mistakes found while typing (src/lib/ruleValidation.js). -->
        <ul v-if="issues.length > 0" class="mb-2 space-y-1">
          <li
            v-for="issue in issues"
            :key="issue.message"
            class="flex items-start gap-1.5 rounded-sm px-2 py-1.5 text-[12px]"
            :class="issue.level === 'error' ? 'bg-red-50 text-red-700' : 'bg-amber-50 text-amber-800'"
          >
            <UIcon :name="issue.level === 'error' ? 'i-lucide-circle-x' : 'i-lucide-circle-alert'" class="w-3.5 h-3.5 shrink-0 mt-px" />
            <span>{{ issue.message }}</span>
          </li>
        </ul>
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
import { getTargetPort, setTargetPort, parsePortInput } from '../extension/urlPattern.js';
import { canEditRulePort } from '../lib/ruleLabels.js';
import RuleControls from './RuleControls.vue';
import { useRuleErrors } from '../composables/useRuleErrors.js';
import { validateRule } from '../lib/ruleValidation.js';

const props = defineProps({
  rule: {
    type: Object,
    required: true
  },
  bare: {
    type: Boolean,
    default: false
  }
});

const emit = defineEmits(['toggle', 'delete', 'update-collapse', 'update-name', 'update-options']);

// File injections run in the page itself, so their filters check the page's domain.
const domainExample = computed(() => props.rule.type === 'fileInject' ? 'page ' : '');

const targetPort = computed(() => props.rule.type === 'normalOverride' ? getTargetPort(props.rule.replace) : '');

const canEditPort = computed(() => canEditRulePort(props.rule));

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
  const port = parsePortInput(editablePort.value);
  if (port === null || port === targetPort.value) return;
  emit('update-options', { replace: setTargetPort(props.rule.replace, port) });
};

const { ruleErrors } = useRuleErrors();

// Checked as you type: the cards edit a reactive copy of the rule.
const issues = computed(() => validateRule(props.rule));
const hasIssueErrors = computed(() => issues.value.some(issue => issue.level === 'error'));
const ruleError = computed(() => (props.rule.on ? ruleErrors.value[props.rule.id] : '') || '');

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
