<template>
  <div class="mb-3 rounded-md border border-slate-200 shadow-sm bg-white hover:border-slate-300 transition-colors">
    <div class="flex items-center p-2 gap-3">
      <!-- Drag Handle -->
      <!-- <div class="cursor-move text-slate-400 hover:text-slate-600 flex-shrink-0 px-1">
        <UIcon name="i-lucide-grip-vertical" class="w-4 h-4" />
      </div> -->

      <!-- Main Content Area -->
      <div class="flex-1 min-w-0">
        <slot></slot>
      </div>

      <!-- Actions Area -->
      <div class="flex items-center gap-3 pl-2 border-l border-slate-100 flex-shrink-0">
        <USwitch
          :model-value="rule.on"
          @update:model-value="$emit('toggle', $event)"
          size="sm"
          color="success"
        />
        <UButton
          variant="ghost"
          color="neutral"
          icon="i-lucide-trash-2"
          @click="$emit('delete')"
          class="text-slate-400 hover:text-red-500 hover:bg-red-50 rounded-md w-8 h-8 flex justify-center items-center transition-colors"
        />
      </div>
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
