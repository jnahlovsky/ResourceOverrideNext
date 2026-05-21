<template>
  <RuleCard :rule="rule" @toggle="toggle" @delete="remove">
    <div class="grid grid-cols-2 gap-4">
      <div class="space-y-1.5">
        <label class="text-[13px] font-medium text-slate-700 block">For Match URL</label>
        <UInput v-model="localRule.match" @change="save" placeholder="Match URL" class="font-mono text-[13px]" :ui="{ base: 'bg-white border-slate-300 rounded-sm shadow-none h-9' }" />
      </div>
      
      <div class="space-y-1.5 flex flex-col justify-end">
        <UButton variant="outline" class="w-full justify-center text-[13px] font-normal text-slate-700 bg-white border-slate-300 rounded-sm h-9 shadow-none hover:bg-slate-50" @click="editHeaders">
            Edit Request/Response Headers ({{ reqCount }})
        </UButton>
      </div>
    </div>
  </RuleCard>
</template>

<script setup>
import { ref, watch, computed } from 'vue';
import RuleCard from './RuleCard.vue';

const props = defineProps({
  rule: { type: Object, required: true }
});
const emit = defineEmits(['update', 'delete', 'edit-headers']);

const localRule = ref({ ...props.rule });

watch(() => props.rule, (newVal) => {
  localRule.value = { ...newVal };
}, { deep: true });

const reqCount = computed(() => localRule.value.requestRules ? localRule.value.requestRules.length : 0);

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

const editHeaders = () => {
    emit('edit-headers', localRule.value);
};
</script>