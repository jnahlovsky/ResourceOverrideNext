<template>
  <div class="mb-2 rounded-md border border-slate-200 shadow-sm bg-white transition-colors" :class="!rule.on ? 'opacity-70 grayscale-[20%]' : ''">
    <!-- Header Area -->
    <div class="flex items-center justify-between px-2.5 py-1.5 bg-slate-200 rounded-t-md">
      <div class="flex items-center gap-2">
        <span class="text-[11px] font-bold tracking-wider uppercase text-slate-500">{{ ruleTitle }}</span>
      </div>
      <div class="flex items-center gap-3">
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
    <div class="p-2 w-full">
      <slot></slot>
    </div>
  </div>
</template>

<script setup>
import { computed } from 'vue';

const props = defineProps({
  rule: {
    type: Object,
    required: true
  }
});

defineEmits(['toggle', 'delete']);

const ruleTitle = computed(() => {
  switch (props.rule.type) {
    case 'normalOverride': return 'URL Redirect';
    case 'headerRule': return 'Custom Headers';
    case 'fileOverride': return 'File Override';
    case 'fileInject': return 'File Injection';
    default: return 'Rule';
  }
});
</script>
