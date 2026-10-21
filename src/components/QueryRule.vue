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
        <UIcon name="i-lucide-crosshair" class="text-slate-400 w-4 h-4 flex-shrink-0 mt-1.5" title="Requests to change" />
        <UTextarea
          v-model="localRule.match"
          @change="save"
          autoresize
          :rows="1"
          :maxrows="5"
          :placeholder="isRegex ? 'Regex of URLs, e.g. https:\\/\\/stage\\.example\\.com\\/.*' : 'URLs to change, e.g. stage.example.com/* or */api/*'"
          size="sm"
          class="font-mono flex-1"
          :ui="{ base: 'bg-white border-slate-300 rounded-sm shadow-none py-1 min-h-[28px]', wrapper: 'flex-1' }"
        />
      </div>

      <!-- Parameters: set (add or replace) or remove -->
      <div class="@container flex flex-col gap-1.5 bg-slate-50 p-2 rounded-md border border-slate-200">
        <div v-if="params.length === 0" class="text-center text-slate-400 text-[11px] py-1">
          No parameters yet. Set one (e.g. debug = 1) or remove one (e.g. utm_source).
        </div>
        <div v-for="(param, index) in params" :key="param._id" class="flex flex-wrap items-center gap-1.5">
          <select
            v-model="param.operation"
            class="w-[90px] h-7 text-sm rounded-md border-0 ring-1 ring-inset ring-slate-300 bg-white pl-2 pr-6 appearance-none focus:outline-none focus:ring-2 focus:ring-inset focus:ring-primary-500 text-slate-700 shadow-sm bg-no-repeat bg-[right_0.4rem_center] bg-[length:12px_12px]"
            style="background-image: url('data:image/svg+xml;charset=US-ASCII,%3Csvg xmlns=%22http://www.w3.org/2000/svg%22 viewBox=%220 0 20 20%22 fill=%22%2364748b%22%3E%3Cpath fill-rule=%22evenodd%22 d=%22M5.293 7.293a1 1 0 011.414 0L10 10.586l3.293-3.293a1 1 0 111.414 1.414l-4 4a1 1 0 01-1.414 0l-4-4a1 1 0 010-1.414z%22 clip-rule=%22evenodd%22/%3E%3C/svg%3E');"
            aria-label="Set or remove"
          >
            <option value="set">Set</option>
            <option value="remove">Remove</option>
          </select>
          <UInput v-model="param.key" placeholder="Parameter" size="sm" class="flex-1 font-mono @max-md:basis-[calc(50%-3.25rem)]" />
          <span v-if="param.operation !== 'remove'" class="text-slate-400 text-sm">=</span>
          <UInput v-if="param.operation !== 'remove'" v-model="param.value" placeholder="Value" size="sm" class="flex-1 font-mono @max-md:basis-[calc(50%-3.25rem)]" />
          <UButton color="red" variant="ghost" icon="i-lucide-trash-2" size="2xs" class="w-6 h-6 p-0 flex justify-center items-center" title="Remove this row" @click="removeParam(index)" />
        </div>
        <div>
          <UButton variant="soft" color="primary" size="xs" icon="i-lucide-plus" class="text-[11px] px-2 py-0.5 font-medium" @click="addParam">Parameter</UButton>
        </div>
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

let nextId = 0;
const withIds = (list) => (list || []).map(param => ({ operation: 'set', key: '', value: '', ...param, _id: nextId++ }));
const params = ref(withIds(props.rule.params));

watch(() => props.rule, (newVal) => {
  localRule.value = { ...newVal };
}, { deep: true });

const save = () => {
  localRule.value.params = params.value.map(({ operation, key, value }) => (operation === 'remove' ? { operation, key } : { operation, key, value }));
  emit('update', { ...localRule.value });
};

// Rows save as they're edited, like the header rows.
watch(params, save, { deep: true });

const addParam = () => {
  params.value.push({ operation: 'set', key: '', value: '', _id: nextId++ });
};

const removeParam = (index) => {
  params.value.splice(index, 1);
};

const toggle = (val) => {
  localRule.value.on = val;
  save();
};

const remove = () => {
  emit('delete');
};
</script>
