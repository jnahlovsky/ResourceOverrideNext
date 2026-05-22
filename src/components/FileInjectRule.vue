<template>
  <RuleCard :rule="rule" @toggle="toggle" @delete="remove">
    <div class="flex items-center gap-2">
      <UInput 
        v-model="localRule.fileName" 
        @change="save" 
        placeholder="File Name (Optional)" 
        class="text-[12px] flex-1 min-w-[120px]" 
        :ui="{ base: 'bg-white border-slate-300 rounded-sm shadow-none h-7', wrapper: 'flex-1' }" 
      />

      <USelect 
        v-model="localRule.fileType" 
        @change="save" 
        :items="[{ label: 'JS', value: 'js' }, { label: 'CSS', value: 'css' }]" 
        class="h-7 rounded-sm border-slate-300 bg-white shadow-none text-[12px] w-[70px]" 
      />

      <USelect 
        v-model="localRule.injectLocation" 
        @change="save" 
        :items="[{ label: 'Head', value: 'head' }, { label: 'Body', value: 'body' }]" 
        class="h-7 rounded-sm border-slate-300 bg-white shadow-none text-[12px] w-[80px]" 
      />

      <UButton 
        variant="soft" 
        class="text-[12px] px-3 font-medium h-7 whitespace-nowrap" 
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