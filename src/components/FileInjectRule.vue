<template>
  <RuleCard :rule="rule" @toggle="toggle" @delete="remove">
    <div class="grid grid-cols-[2fr_1fr_1fr_2fr] gap-4 items-end">
      <div class="space-y-1.5">
        <label class="text-[13px] font-medium text-slate-700 block">File Name <span class="font-normal text-slate-500">(Optional)</span></label>
        <UInput v-model="localRule.fileName" @change="save" placeholder="File Name" class="text-[13px]" :ui="{ base: 'bg-white border-slate-300 rounded-sm shadow-none h-9' }" />
      </div>

      <div class="space-y-1.5">
        <label class="text-[13px] font-medium text-slate-700 block">File Type</label>
        <USelect v-model="localRule.fileType" @change="save" :items="[{ label: 'JS', value: 'js' }, { label: 'CSS', value: 'css' }]" class="h-9 rounded-sm border-slate-300 bg-white shadow-none text-[13px]" />
      </div>

      <div class="space-y-1.5">
        <label class="text-[13px] font-medium text-slate-700 block">Inject into</label>
        <USelect v-model="localRule.injectLocation" @change="save" :items="[{ label: 'Head', value: 'head' }, { label: 'Body', value: 'body' }]" class="h-9 rounded-sm border-slate-300 bg-white shadow-none text-[13px]" />
      </div>

      <div class="space-y-1.5">
        <UButton variant="outline" class="w-full justify-center text-[13px] font-normal text-slate-700 bg-white border-slate-300 rounded-sm h-9 shadow-none hover:bg-slate-50" @click="editFile">
            Edit File Content
        </UButton>
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