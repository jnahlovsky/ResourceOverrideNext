<template>
  <div v-if="isOpen" class="fixed inset-0 z-[200] flex items-center justify-center bg-slate-900/40 backdrop-blur-[2px]">
    <div class="bg-white rounded-lg shadow-xl border border-slate-200 w-[400px] max-w-[90%] overflow-hidden flex flex-col transform transition-all">
      <!-- Header -->
      <div class="px-5 py-3.5 border-b border-slate-100 flex justify-between items-center bg-slate-50">
        <h3 class="text-sm font-bold text-slate-800">{{ title }}</h3>
        <UButton v-if="!isAlert" color="neutral" variant="ghost" icon="i-lucide-x" class="-my-1 w-7 h-7 p-0 flex items-center justify-center" @click="cancel" />
      </div>

      <!-- Content -->
      <div class="px-5 py-6 text-[13px] text-slate-600 leading-relaxed whitespace-pre-wrap">
        {{ message }}
      </div>

      <!-- Footer -->
      <div class="px-5 py-3 border-t border-slate-100 flex justify-end gap-2 bg-slate-50">
        <UButton v-if="!isAlert" color="neutral" variant="ghost" @click="cancel">Cancel</UButton>
        <UButton :color="confirmColor" @click="confirm">{{ confirmText }}</UButton>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, watch } from 'vue';

const props = defineProps({
  modelValue: { type: Boolean, default: false },
  title: { type: String, default: 'Confirm' },
  message: { type: String, default: '' },
  isAlert: { type: Boolean, default: false },
  confirmText: { type: String, default: 'OK' },
  confirmColor: { type: String, default: 'primary' }
});

const emit = defineEmits(['update:modelValue', 'confirm', 'cancel']);

const isOpen = ref(props.modelValue);

watch(() => props.modelValue, (newVal) => {
  isOpen.value = newVal;
});

watch(isOpen, (newVal) => {
  emit('update:modelValue', newVal);
});

const cancel = () => {
  isOpen.value = false;
  emit('cancel');
};

const confirm = () => {
  isOpen.value = false;
  emit('confirm');
};
</script>