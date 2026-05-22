<template>
  <div v-if="isOpen" class="fixed inset-0 z-[100] bg-white flex flex-col w-[750px] h-[550px] shadow-2xl">
    <!-- Header -->
    <div class="flex items-center justify-between px-6 py-4 border-b border-slate-200 shrink-0 bg-white">
      <h3 class="text-base font-semibold leading-6 text-slate-900 flex items-center gap-2">
        <UIcon name="i-lucide-flask-conical" class="w-5 h-5 text-primary-500" />
        Test Rules
      </h3>
      <UButton color="neutral" variant="ghost" icon="i-lucide-x" class="-my-1" @click="close" />
    </div>

    <!-- Content Area -->
    <div class="flex-1 flex flex-col min-h-0 bg-slate-50">

      <!-- Input Area -->
      <div class="p-6 border-b border-slate-200 bg-white shrink-0">
        <label class="block text-sm font-medium text-slate-700 mb-2">Test URL</label>
        <UInput
          v-model="testUrl"
          class="w-full"
          placeholder="https://example.com/api/v1/users"
          icon="i-lucide-link"
          size="lg"
          autofocus
        />
      </div>

      <!-- Results Area -->
      <div class="flex-1 overflow-y-auto p-6 space-y-4">
        <div v-if="!testUrl" class="text-center text-slate-400 py-10">
          Enter a URL above to see which rules apply.
        </div>
        <div v-else-if="matchingRules.length === 0" class="text-center text-slate-500 py-10">
          No active rules match this URL.
        </div>
        <div v-else class="space-y-4">
          <div v-for="result in matchingRules" :key="result.rule.id" class="bg-white rounded-md border border-slate-200 p-4 shadow-sm">

            <div class="flex items-center gap-2 mb-3">
              <UBadge :color="getTypeColor(result.rule.type)" variant="subtle" class="text-[10px] uppercase font-bold">{{ getTypeLabel(result.rule.type) }}</UBadge>
              <span class="text-xs text-slate-500 font-mono truncate" title="Match Pattern">{{ result.rule.match || '*' }}</span>
            </div>

            <div class="text-sm">
              <!-- Redirect Results -->
              <div v-if="result.rule.type === 'normalOverride'">
                <div class="flex items-center gap-2 text-slate-600">
                  <UIcon name="i-lucide-corner-down-right" class="w-4 h-4 text-primary-500" />
                  <span>Redirects to:</span>
                </div>
                <div class="mt-1 p-2 bg-slate-100 rounded font-mono text-[12px] text-slate-800 break-all">
                  {{ result.details.redirectUrl }}
                </div>
              </div>

              <!-- Header Results -->
              <div v-else-if="result.rule.type === 'headerRule'" class="space-y-3">
                <div v-if="result.rule.requestRules?.length > 0">
                  <div class="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-1">Request Headers</div>
                  <div v-for="h in result.rule.requestRules" class="flex items-center gap-2 text-[12px] font-mono">
                    <span :class="h.operation === 'remove' ? 'text-red-500' : 'text-primary-600'">[{{ h.operation.toUpperCase() }}]</span>
                    <span class="font-semibold text-slate-800">{{ h.header }}</span>
                    <span v-if="h.operation !== 'remove'" class="text-slate-500">: {{ h.value }}</span>
                  </div>
                </div>

                <div v-if="result.rule.responseRules?.length > 0">
                  <div class="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-1">Response Headers</div>
                  <div v-for="h in result.rule.responseRules" class="flex items-center gap-2 text-[12px] font-mono">
                    <span :class="h.operation === 'remove' ? 'text-red-500' : 'text-primary-600'">[{{ h.operation.toUpperCase() }}]</span>
                    <span class="font-semibold text-slate-800">{{ h.header }}</span>
                    <span v-if="h.operation !== 'remove'" class="text-slate-500">: {{ h.value }}</span>
                  </div>
                </div>
              </div>

              <!-- Injection Results -->
              <div v-else-if="result.rule.type === 'fileOverride' || result.rule.type === 'fileInject'">
                <div class="flex items-center gap-2 text-slate-600">
                  <UIcon name="i-lucide-file-code-2" class="w-4 h-4 text-primary-500" />
                  <span v-if="result.rule.type === 'fileOverride'">Overrides response with custom file.</span>
                  <span v-else>Injects custom {{ result.rule.fileType?.toUpperCase() }} into page {{ result.rule.injectLocation }}.</span>
                </div>
              </div>

            </div>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, computed, watch } from 'vue';
import { match, matchReplace } from '../extension/match.js';

const props = defineProps({
  modelValue: { type: Boolean, default: false },
  rules: { type: Array, default: () => [] }
});

const emit = defineEmits(['update:modelValue']);

const isOpen = ref(props.modelValue);
const testUrl = ref('');

watch(() => props.modelValue, (newVal) => {
  isOpen.value = newVal;
  if (!newVal) {
    testUrl.value = '';
  }
});

watch(isOpen, (newVal) => {
  emit('update:modelValue', newVal);
});

const close = () => {
  isOpen.value = false;
};

const matchingRules = computed(() => {
  if (!testUrl.value) return [];

  const results = [];

  for (const rule of props.rules) {
    if (!rule.on) continue;

    // fileInject rules don't use the standard match logic, they are injected on all domains matching the parent domain.
    // In our simplified UI where domain is '*' global, fileInject applies everywhere.
    if (rule.type === 'fileInject') {
      results.push({ rule, details: {} });
      continue;
    }

    const matchPattern = rule.match || '*';
    const matchData = match(matchPattern, testUrl.value);

    if (matchData && matchData.matched) {
      let details = {};

      if (rule.type === 'normalOverride') {
        details.redirectUrl = matchReplace(matchData, rule.replace || '', testUrl.value);
      }

      results.push({ rule, details });
    }
  }

  return results;
});

const getTypeLabel = (type) => {
  switch (type) {
    case 'normalOverride': return 'URL Redirect';
    case 'headerRule': return 'Custom Headers';
    case 'fileOverride': return 'File Override';
    case 'fileInject': return 'File Injection';
    default: return 'Rule';
  }
};

const getTypeColor = (type) => {
  switch (type) {
    case 'normalOverride': return 'blue';
    case 'headerRule': return 'orange';
    case 'fileOverride': return 'purple';
    case 'fileInject': return 'green';
    default: return 'neutral';
  }
};
</script>
