<template>
  <RuleCard :rule="rule" @toggle="toggle" @delete="remove">
    <div class="flex items-center gap-3">
      <UInput 
        v-model="localRule.match" 
        @change="save" 
        placeholder="Source URL Pattern (e.g. /https:\/\/example\.com\/(.*)/)" 
        class="font-mono text-[13px] flex-1" 
        :ui="{ base: 'bg-white border-slate-300 rounded-sm shadow-none h-8', wrapper: 'flex-1' }" 
      />
      
      <UIcon name="i-lucide-arrow-right" class="text-slate-400 w-4 h-4 flex-shrink-0" />
      
      <UInput 
        v-model="localRule.replace" 
        @change="save" 
        placeholder="Destination URL (e.g. https://localhost:8081/$1)" 
        class="font-mono text-[13px] flex-1" 
        :ui="{ base: 'bg-white border-slate-300 rounded-sm shadow-none h-8', wrapper: 'flex-1' }" 
      />
    </div>
  </RuleCard>
</template>

<script setup>
import { ref, watch } from 'vue';
import RuleCard from './RuleCard.vue';

const props = defineProps({
  rule: { type: Object, required: true }
});
const emit = defineEmits(['update', 'delete']);

const localRule = ref({ ...props.rule });

watch(() => props.rule, (newVal) => {
  localRule.value = { ...newVal };
}, { deep: true });

const save = () => {
  emit('update', { ...localRule.value });
};

const toggle = (val) => {
  localRule.value.on = val;
  save();
};

const remove = () => {
  emit('delete');
};
</script>