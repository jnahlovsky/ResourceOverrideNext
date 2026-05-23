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
          <span 
            v-else 
            @click="startEditingTitle" 
            class="text-[11px] font-bold tracking-wider uppercase text-slate-500 cursor-pointer hover:text-slate-700 transition-colors"
            title="Click to rename"
          >
            {{ rule.name || ruleTitle }}
          </span>
        </div>
        <div class="flex items-center gap-3">
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
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, computed } from 'vue';

const props = defineProps({
  rule: {
    type: Object,
    required: true
  }
});

const emit = defineEmits(['toggle', 'delete', 'update-collapse', 'update-name']);

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
