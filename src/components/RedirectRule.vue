<template>
  <RuleCard :rule="rule" @toggle="toggle" @delete="remove">
    <div class="grid grid-cols-2 gap-4">
      <div class="space-y-1.5">
        <label class="text-[13px] font-medium text-slate-700 block">Source URL Pattern <span class="font-normal text-slate-500">(Can be a URL substring or regex enclosed in /.../)</span></label>
        <UInput v-model="localRule.match" @change="save" placeholder="Match URL" class="font-mono text-[13px]" :ui="{ base: 'bg-white border-slate-300 rounded-sm shadow-none h-9' }" />
      </div>
      <div class="space-y-1.5">
        <label class="text-[13px] font-medium text-slate-700 block">Destination URL</label>
        <UInput v-model="localRule.replace" @change="save" placeholder="Replace URL" class="font-mono text-[13px]" :ui="{ base: 'bg-white border-slate-300 rounded-sm shadow-none h-9' }" />
      </div>
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