<template>
  <div v-if="isOpen" class="fixed inset-0 z-[100] flex items-center justify-center bg-slate-900/50 backdrop-blur-sm">
    <div class="bg-white flex flex-col w-[750px] max-w-[90vw] h-[550px] max-h-[90vh] shadow-2xl rounded-xl overflow-hidden">
      <!-- Header -->
    <div class="flex items-center justify-between px-6 py-4 border-b border-slate-100 shrink-0 bg-white">
      <h3 class="text-base font-semibold leading-6 text-slate-900">
        File Content Editor
      </h3>
      <UButton color="neutral" variant="ghost" icon="i-lucide-x" class="-my-1" @click="close" />
    </div>

    <!-- Editor Area -->
    <div class="flex-1 flex flex-col p-4 bg-slate-50 min-h-0">
      <textarea
        v-model="localContent"
        class="flex-1 w-full h-full p-4 font-mono text-[13px] bg-slate-900 text-slate-100 rounded-md shadow-inner border border-slate-700 focus:outline-none focus:ring-2 focus:ring-primary-500 resize-none whitespace-pre"
        placeholder="Paste or type your custom CSS/JS content here..."
        spellcheck="false"
      ></textarea>
    </div>

    <!-- Footer -->
    <div class="flex justify-between items-center px-6 py-4 border-t border-slate-100 shrink-0 bg-white">
      <div class="flex items-center gap-3">
        <input type="file" ref="fileInput" class="hidden" @change="handleFileUpload" />
        <UButton
          color="neutral"
          variant="outline"
          icon="i-lucide-folder-open"
          @click="triggerFileInput"
        >
          Load Local File
        </UButton>
        <span class="text-xs text-slate-500 max-w-[200px] truncate" v-if="loadedFileName">
          Loaded: {{ loadedFileName }}
        </span>
      </div>

      <div class="flex gap-2">
        <UButton color="neutral" variant="ghost" @click="close">Cancel</UButton>
        <UButton color="primary" @click="save">Save Content</UButton>
      </div>
    </div>
  </div>
  </div>
</template>

<script setup>
import { ref, watch } from 'vue';

const props = defineProps({
  modelValue: { type: Boolean, default: false },
  initialContent: { type: String, default: '' }
});

const emit = defineEmits(['update:modelValue', 'save']);

const isOpen = ref(props.modelValue);
const localContent = ref(props.initialContent);
const fileInput = ref(null);
const loadedFileName = ref('');

watch(() => props.modelValue, (newVal) => {
  isOpen.value = newVal;
  if (newVal) {
    localContent.value = props.initialContent;
    loadedFileName.value = '';
  }
});

watch(isOpen, (newVal) => {
  emit('update:modelValue', newVal);
});

const close = () => {
  isOpen.value = false;
};

const save = () => {
  emit('save', localContent.value);
  close();
};

const triggerFileInput = () => {
  fileInput.value?.click();
};

const handleFileUpload = (event) => {
  const file = event.target.files[0];
  if (!file) return;

  loadedFileName.value = file.name;

  const reader = new FileReader();
  reader.onload = (e) => {
    localContent.value = e.target.result;
  };
  reader.readAsText(file);

  // Reset input so the same file can be selected again if needed
  event.target.value = '';
};
</script>
