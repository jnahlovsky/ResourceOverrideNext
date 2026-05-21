<template>
  <RuleCard :rule="rule" @toggle="toggle" @delete="remove">
    <div class="grid grid-cols-2 gap-4">
      <div class="space-y-1.5">
        <Label class="text-[13px] font-medium text-slate-700">For Match URL</Label>
        <Input v-model="localRule.match" @change="save" placeholder="Match URL" class="font-mono text-[13px] bg-white border-slate-300 rounded-sm h-9 shadow-none" />
      </div>
      
      <div class="space-y-1.5 flex flex-col justify-end">
        <Button variant="outline" class="w-full text-[13px] font-normal text-slate-700 bg-white border-slate-300 rounded-sm h-9 shadow-none hover:bg-slate-50" @click="editHeaders">
            Edit Request/Response Headers ({{ reqCount }})
        </Button>
      </div>
    </div>
  </RuleCard>
</template>

<script setup>
import { ref, watch, computed } from 'vue';
import RuleCard from './RuleCard.vue';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';

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