<template>
  <RuleCard 
    :rule="rule" 
    @toggle="toggle" 
    @delete="remove"
    @update-collapse="(val) => { localRule.isCollapsed = val; save(); }"
    @update-name="(name) => { localRule.name = name; save(); }"
  >
    <div class="flex items-center gap-2">
      <UTextarea 
        v-model="localRule.match" 
        @change="save" 
        autoresize
        :rows="1"
        :maxrows="5"
        placeholder="Match URL (e.g. *://example.com/*)" 
        class="font-mono text-[12px] flex-1" 
        :ui="{ base: 'bg-white border-slate-300 rounded-sm shadow-none py-1 min-h-[28px]', wrapper: 'flex-1' }" 
      />
      
      <UButton 
        variant="soft" 
        class="text-[12px] px-3 font-medium h-7 whitespace-nowrap self-start" 
        @click="editFile"
      >
        File Content
      </UButton>
    </div>
  </RuleCard>
</template>

<script setup>
import { ref, watch } from 'vue';
import RuleCard from './RuleCard.vue';

const props = defineProps({
  rule: { type: Object, required: true }
});
const emit = defineEmits(['update', 'delete', 'edit-file']);

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

const editFile = () => {
    emit('edit-file', localRule.value);
};
</script>