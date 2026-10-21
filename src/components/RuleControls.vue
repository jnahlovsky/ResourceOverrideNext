<template>
  <!-- A rule's domain filters toggle and match syntax switch, as icon buttons, for a
       card's one-line header: the editor cards (RuleCard) and the popup / side panel rows. -->
  <div class="flex items-center gap-1.5">
    <button
      type="button"
      :aria-pressed="!!rule.domainFiltersOn"
      :aria-label="rule.domainFiltersOn ? 'Hide the domain filters' : 'Domain filters'"
      :title="rule.domainFiltersOn ? `Domain filters on: ${filterScope}` : `Domain filters: ${filterScope}`"
      class="w-6 h-6 flex items-center justify-center rounded-md transition-colors"
      :class="rule.domainFiltersOn ? 'bg-white text-slate-700 shadow-sm' : 'text-slate-500 hover:text-slate-700 hover:bg-slate-300'"
      @click.stop="emit('update-options', { domainFiltersOn: !rule.domainFiltersOn })"
    >
      <UIcon name="i-lucide-funnel" class="w-3.5 h-3.5" />
    </button>
    <!-- File injections have no URL pattern; every other rule matches request URLs. -->
    <div
      v-if="rule.type !== 'fileInject'"
      role="radiogroup"
      aria-label="Match syntax"
      class="flex items-center rounded-md bg-slate-300/70 p-0.5"
    >
      <button
        v-for="option in MATCH_MODES"
        :key="option.value"
        type="button"
        role="radio"
        :aria-checked="matchMode === option.value"
        :aria-label="option.label"
        :title="`${option.label}: ${option.title}`"
        class="w-6 h-5 flex items-center justify-center rounded transition-colors"
        :class="matchMode === option.value ? 'bg-white text-slate-700 shadow-sm' : 'text-slate-500 hover:text-slate-700'"
        @click.stop="setMatchMode(option.value)"
      >
        <UIcon :name="option.icon" class="w-3.5 h-3.5" />
      </button>
    </div>
  </div>
</template>

<script setup>
import { computed } from 'vue';
import { getMatchMode, convertMatchMode } from '../extension/urlPattern.js';

const props = defineProps({
  rule: { type: Object, required: true }
});

const emit = defineEmits(['update-options']);

const MATCH_MODES = [
  { value: 'wildcard', label: 'Wildcard', icon: 'i-lucide-asterisk', title: 'match with * and **, and reuse them in the destination' },
  { value: 'regex', label: 'Regex', icon: 'i-lucide-regex', title: 'match with a regular expression; use $1, $2… in the destination' }
];

// File injections run in the page itself, so their filters check the page's domain.
const filterScope = computed(() => (props.rule.type === 'fileInject' ? 'include / exclude page domains' : 'include / exclude request domains'));

const matchMode = computed(() => getMatchMode(props.rule));

// Switching syntax also translates the patterns, e.g. */app/** <-> (.*?)\/app\/(.*)
const setMatchMode = (mode) => {
  if (mode === matchMode.value) return;
  emit('update-options', convertMatchMode(props.rule, mode));
};
</script>
