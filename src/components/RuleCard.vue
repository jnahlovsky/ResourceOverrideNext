<template>
  <Card class="mb-4 rounded-md border-slate-400/60 shadow-none overflow-hidden">
    <div class="flex items-center justify-between px-4 pt-3 pb-1 bg-white">
      <div class="flex items-center gap-2 cursor-move group">
        <Checkbox :id="'enabled-' + rule.id" :checked="rule.on" @update:checked="$emit('toggle', $event)" />
        <label :for="'enabled-' + rule.id" class="text-sm font-medium text-slate-700 cursor-pointer select-none">
          Enabled
        </label>
      </div>
      <div class="flex items-center gap-4">
        <Button variant="ghost" size="icon" class="text-red-500 hover:text-red-600 hover:bg-red-50 h-8 w-8 rounded-full" @click="$emit('delete')">
          <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><path d="M3 6h18"/><path d="M19 6v14c0 1-1 2-2 2H7c-1 0-2-1-2-2V6"/><path d="M8 6V4c0-1 1-2 2-2h4c1 0 2 1 2 2v2"/></svg>
        </Button>
      </div>
    </div>
    <CardContent class="px-4 pb-4 pt-2 bg-white">
      <slot></slot>
    </CardContent>
  </Card>
</template>

<script setup>
import { Card, CardContent } from '@/components/ui/card';
import { Checkbox } from '@/components/ui/checkbox';
import { Button } from '@/components/ui/button';

defineProps({
  rule: {
    type: Object,
    required: true
  }
});

defineEmits(['toggle', 'delete']);
</script>