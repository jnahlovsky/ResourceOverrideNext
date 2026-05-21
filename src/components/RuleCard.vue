<template>
  <div class="mb-4 rounded-md border border-slate-400/60 shadow-none overflow-hidden bg-white">
    <div class="flex items-center justify-between px-4 pt-3 pb-1 bg-white border-b border-slate-100">
      <div class="flex items-center gap-2 cursor-move group">
        <UCheckbox :id="'enabled-' + rule.id" :model-value="rule.on" @update:model-value="$emit('toggle', $event)" />
        <label :for="'enabled-' + rule.id" class="text-sm font-medium text-slate-700 cursor-pointer select-none">
          Enabled
        </label>
      </div>
      <div class="flex items-center gap-4">
        <UButton variant="ghost" color="error" icon="i-lucide-trash-2" @click="$emit('delete')" class="hover:bg-red-50 text-red-500 rounded-full w-8 h-8 flex justify-center items-center" />
      </div>
    </div>
    <div class="px-4 pb-4 pt-2 bg-white">
      <slot></slot>
    </div>
  </div>
</template>

<script setup>
defineProps({
  rule: {
    type: Object,
    required: true
  }
});

defineEmits(['toggle', 'delete']);
</script>