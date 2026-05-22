<template>
  <RuleCard :rule="rule" @toggle="toggle" @delete="remove">
    <div class="flex items-center gap-3">
      <UTextarea 
        v-model="localRule.match" 
        @change="save" 
        autoresize
        :rows="1"
        :maxrows="5"
        placeholder="Match URL (e.g. *://example.com/*)" 
        class="font-mono text-[13px] flex-1" 
        :ui="{ base: 'bg-white border-slate-300 rounded-sm shadow-none py-1 min-h-[32px]', wrapper: 'flex-1' }" 
      />
      
      <UButton 
        variant="soft" 
        class="text-[13px] font-medium h-8 whitespace-nowrap self-start" 
        @click="editHeaders"
      >
        Headers ({{ reqCount }})
      </UButton>
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