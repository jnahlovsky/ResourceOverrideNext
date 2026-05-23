<template>
  <RuleCard 
    :rule="rule" 
    @toggle="toggle" 
    @delete="remove"
    @update-collapse="(val) => { localRule.isCollapsed = val; save(); }"
    @update-name="(name) => { localRule.name = name; save(); }"
  >
    <div class="flex flex-col gap-1.5 w-full">
      <div class="flex items-start gap-2">
        <UIcon name="i-lucide-crosshair" class="text-slate-400 w-4 h-4 flex-shrink-0 mt-1.5" />
        <UTextarea
          v-model="localRule.match"
          @change="save"
          autoresize
          :rows="1"
          :maxrows="5"
          placeholder="Source URL Pattern (e.g. /https:\/\/example\.com\/(.*)/)"
          class="font-mono text-[11px] flex-1"
          :ui="{ base: 'bg-white border-slate-300 rounded-sm shadow-none py-1 min-h-[28px]', wrapper: 'flex-1' }"
        />
      </div>

      <div class="flex items-start gap-2">
        <UIcon name="i-lucide-corner-down-right" class="text-slate-400 w-4 h-4 flex-shrink-0 mt-1.5" />
        <UTextarea
          v-model="localRule.replace"
          @change="save"
          autoresize
          :rows="1"
          :maxrows="5"
          placeholder="Destination URL (e.g. https://localhost:8081/$1)"
          class="font-mono text-[11px] flex-1"
          :ui="{ base: 'bg-white border-slate-300 rounded-sm shadow-none py-1 min-h-[28px]', wrapper: 'flex-1' }"
        />
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
