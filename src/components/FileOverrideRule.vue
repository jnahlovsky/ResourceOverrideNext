<template>
  <RuleCard :rule="rule" @toggle="toggle" @delete="remove">
    <div class="grid grid-cols-2 gap-4">
      <div class="space-y-1.5">
        <Label class="text-[13px] font-medium text-slate-700">From Match URL</Label>
        <Input v-model="localRule.match" @change="save" placeholder="Match URL" class="font-mono text-[13px] bg-white border-slate-300 rounded-sm h-9 shadow-none" />
      </div>

      <div class="space-y-1.5 flex flex-col justify-end">
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