<template>
  <!-- "Saving…" / "Saved" next to a header's controls; fades out when idle. -->
  <Transition
    enter-active-class="transition-opacity duration-150"
    enter-from-class="opacity-0"
    leave-active-class="transition-opacity duration-300"
    leave-to-class="opacity-0"
  >
    <span
      v-if="status !== 'idle'"
      role="status"
      class="inline-flex items-center gap-1 text-[11px] font-medium whitespace-nowrap"
      :class="status === 'error' ? 'text-red-600' : status === 'saved' ? 'text-primary-700' : 'text-slate-500'"
    >
      <UIcon
        :name="status === 'saving' ? 'i-lucide-loader-circle' : status === 'saved' ? 'i-lucide-check' : 'i-lucide-circle-x'"
        class="w-3.5 h-3.5"
        :class="status === 'saving' && 'animate-spin'"
      />
      <span v-if="!compact">{{ status === 'saving' ? 'Saving…' : status === 'saved' ? 'Saved' : 'Not saved' }}</span>
    </span>
  </Transition>
</template>

<script setup>
import { useSaveStatus } from '../composables/useSaveStatus.js';

defineProps({
  // Icon only, for tight headers.
  compact: { type: Boolean, default: false }
});

const { status } = useSaveStatus();
</script>
