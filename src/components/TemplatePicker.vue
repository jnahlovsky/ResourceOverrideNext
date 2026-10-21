<template>
  <!-- Starter templates for one tab, for its empty state (src/lib/templates.js). -->
  <div class="@container">
    <p class="mb-2 text-[11px] font-semibold uppercase tracking-wider text-slate-400">Start from a template</p>
    <div class="grid gap-2" :class="compact ? 'grid-cols-1' : 'grid-cols-1 @md:grid-cols-2'">
      <template v-for="template in templates" :key="template.id">
        <!-- A template with variants (User-Agent) opens a menu of them. -->
        <UDropdownMenu
          v-if="template.variants"
          :items="template.variants.map(variant => ({ label: variant.label, onSelect: () => emit('use', template, variant.id) }))"
          :content="{ align: 'start', sideOffset: 4 }"
          :ui="{ content: 'z-[100]' }"
        >
          <button type="button" :class="cardClass">
            <UIcon :name="template.icon" class="shrink-0 w-4 h-4 mt-0.5 text-primary-600" />
            <span class="min-w-0 flex-1">
              <span class="flex items-center gap-1 text-[13px] font-semibold text-slate-800">
                <span class="truncate">{{ template.title }}</span>
                <UIcon name="i-lucide-chevron-down" class="shrink-0 w-3.5 h-3.5 text-slate-400" />
              </span>
              <span v-if="!compact" class="block text-[12px] text-slate-500">{{ template.description }}</span>
            </span>
          </button>
        </UDropdownMenu>
        <button v-else type="button" :class="cardClass" :title="compact ? template.description : ''" @click="emit('use', template, '')">
          <UIcon :name="template.icon" class="shrink-0 w-4 h-4 mt-0.5 text-primary-600" />
          <span class="min-w-0 flex-1">
            <span class="block truncate text-[13px] font-semibold text-slate-800">{{ template.title }}</span>
            <span v-if="!compact" class="block text-[12px] text-slate-500">{{ template.description }}</span>
          </span>
        </button>
      </template>
    </div>
  </div>
</template>

<script setup>
import { computed } from 'vue';
import { RULE_TEMPLATES } from '../lib/templates.js';

const props = defineProps({
  group: { type: String, required: true },
  // One column of one-line cards, for the popup / side panel.
  compact: { type: Boolean, default: false }
});

const emit = defineEmits(['use']);

const templates = computed(() => RULE_TEMPLATES.filter(template => template.group === props.group));

const cardClass = computed(() => [
  'w-full flex items-start gap-2.5 text-left rounded-md border border-slate-200 bg-white hover:border-primary-300 hover:bg-primary-50 transition-colors',
  props.compact ? 'px-2.5 py-2' : 'px-3 py-2.5'
]);
</script>
