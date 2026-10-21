<template>
  <RuleCard 
    :rule="localRule"
    @toggle="toggle" 
    @delete="remove"
    @update-collapse="(val) => { localRule.isCollapsed = val; save(); }"
    @update-name="(name) => { localRule.name = name; save(); }"
    @update-options="(patch) => { Object.assign(localRule, patch); save(); }"
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
          :placeholder="isRegex ? 'Source regex, e.g. https:\\/\\/example\\.com\\/app\\/(.*)' : 'Source URL, e.g. */app/** or example.com/main.js'"
          size="sm"
          class="font-mono flex-1"
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
          :placeholder="isRegex ? 'Destination URL, e.g. https://localhost:8081/app/$1' : 'Destination URL, e.g. https://localhost:8081/app/**'"
          size="sm"
          class="font-mono flex-1"
          :ui="{ base: 'bg-white border-slate-300 rounded-sm shadow-none py-1 min-h-[28px]', wrapper: 'flex-1' }"
        />
      </div>
    </div>
  </RuleCard>
</template>

<script setup>
import { ref, computed, watch } from 'vue';
import RuleCard from './RuleCard.vue';
import { getMatchMode } from '../extension/urlPattern.js';

const props = defineProps({
  rule: { type: Object, required: true }
});
const emit = defineEmits(['update', 'delete']);

const localRule = ref({ ...props.rule });
const isRegex = computed(() => getMatchMode(localRule.value) === 'regex');

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
