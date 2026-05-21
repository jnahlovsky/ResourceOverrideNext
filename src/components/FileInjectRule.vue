<template>
  <RuleCard :rule="rule" @toggle="toggle" @delete="remove">
    <div class="grid grid-cols-[2fr_1fr_1fr_2fr] gap-4 items-end">
      <div class="space-y-1.5">
        <Label class="text-[13px] font-medium text-slate-700">File Name <span class="font-normal text-slate-500">(Optional)</span></Label>
        <Input v-model="localRule.fileName" @change="save" placeholder="File Name" class="text-[13px] bg-white border-slate-300 rounded-sm h-9 shadow-none" />
      </div>

      <div class="space-y-1.5">
        <Label class="text-[13px] font-medium text-slate-700">File Type</Label>
        <Select v-model="localRule.fileType" @update:modelValue="save">
          <SelectTrigger class="h-9 rounded-sm border-slate-300 bg-white shadow-none text-[13px]">
            <SelectValue placeholder="Select type" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="js">JS</SelectItem>
            <SelectItem value="css">CSS</SelectItem>
          </SelectContent>
        </Select>
      </div>

      <div class="space-y-1.5">
        <Label class="text-[13px] font-medium text-slate-700">Inject into</Label>
        <Select v-model="localRule.injectLocation" @update:modelValue="save">
          <SelectTrigger class="h-9 rounded-sm border-slate-300 bg-white shadow-none text-[13px]">
            <SelectValue placeholder="Select location" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="head">Head</SelectItem>
            <SelectItem value="body">Body</SelectItem>
          </SelectContent>
        </Select>
      </div>

      <div class="space-y-1.5">
        <Button variant="outline" class="w-full text-[13px] font-normal text-slate-700 bg-white border-slate-300 rounded-sm h-9 shadow-none hover:bg-slate-50" @click="editFile">
            Edit File Content
        </Button>
      </div>
    </div>
  </RuleCard>
</template>

<script setup>
import { ref, watch } from 'vue';
import RuleCard from './RuleCard.vue';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from '@/components/ui/select';
import { Button } from '@/components/ui/button';

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