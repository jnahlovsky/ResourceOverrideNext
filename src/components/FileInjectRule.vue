<template>
  <RuleCard :rule="rule" @toggle="toggle" @delete="remove">
    <div class="flex items-center gap-2">
      <UInput 
        v-model="localRule.fileName" 
        @change="save" 
        placeholder="File Name (Optional - triggers blob injection to bypass strict CSP)" 
        class="text-[12px] flex-1 min-w-[200px]" 
        :ui="{ base: 'bg-white border-slate-300 rounded-sm shadow-none h-7', wrapper: 'flex-1' }" 
      />

      <select 
        v-model="localRule.fileType" 
        @change="save" 
        class="w-[70px] h-7 text-[12px] rounded-md border-0 ring-1 ring-inset ring-slate-300 bg-white pl-2 pr-6 appearance-none focus:outline-none focus:ring-2 focus:ring-inset focus:ring-primary-500 text-slate-700 shadow-sm bg-no-repeat bg-[right_0.4rem_center] bg-[length:12px_12px]"
        style="background-image: url('data:image/svg+xml;charset=US-ASCII,%3Csvg xmlns=%22http://www.w3.org/2000/svg%22 viewBox=%220 0 20 20%22 fill=%22%2364748b%22%3E%3Cpath fill-rule=%22evenodd%22 d=%22M5.293 7.293a1 1 0 011.414 0L10 10.586l3.293-3.293a1 1 0 111.414 1.414l-4 4a1 1 0 01-1.414 0l-4-4a1 1 0 010-1.414z%22 clip-rule=%22evenodd%22/%3E%3C/svg%3E');"
      >
        <option value="js">JS</option>
        <option value="css">CSS</option>
      </select>

      <select 
        v-model="localRule.injectLocation" 
        @change="save" 
        class="w-[80px] h-7 text-[12px] rounded-md border-0 ring-1 ring-inset ring-slate-300 bg-white pl-2 pr-6 appearance-none focus:outline-none focus:ring-2 focus:ring-inset focus:ring-primary-500 text-slate-700 shadow-sm bg-no-repeat bg-[right_0.4rem_center] bg-[length:12px_12px]"
        style="background-image: url('data:image/svg+xml;charset=US-ASCII,%3Csvg xmlns=%22http://www.w3.org/2000/svg%22 viewBox=%220 0 20 20%22 fill=%22%2364748b%22%3E%3Cpath fill-rule=%22evenodd%22 d=%22M5.293 7.293a1 1 0 011.414 0L10 10.586l3.293-3.293a1 1 0 111.414 1.414l-4 4a1 1 0 01-1.414 0l-4-4a1 1 0 010-1.414z%22 clip-rule=%22evenodd%22/%3E%3C/svg%3E');"
      >
        <option value="head">Head</option>
        <option value="body">Body</option>
      </select>

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