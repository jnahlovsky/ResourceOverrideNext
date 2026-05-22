<template>
  <RuleCard :rule="rule" @toggle="toggle" @delete="remove">
    <div class="flex flex-col gap-1.5">
      <!-- Top Row: Match URL -->
      <div class="flex items-center gap-2">
        <UTextarea 
          v-model="localRule.match" 
          @change="save" 
          autoresize
          :rows="1"
          :maxrows="5"
          placeholder="Source URL Pattern (e.g. example.com or /.*example.*\.com/.*/)" 
          class="font-mono text-[12px] flex-1" 
          :ui="{ base: 'bg-white border-slate-300 rounded-sm shadow-none py-1 min-h-[28px]', wrapper: 'flex-1' }" 
        />
      </div>

      <!-- Action Bar -->
      <div class="flex justify-between items-center mt-1">
        <span class="text-[12px] font-semibold text-slate-700">Header Key-Value Pairs</span>
        <div class="flex gap-1.5">
          <UButton 
            variant="soft" 
            color="primary"
            size="xs"
            class="text-[11px] px-2 py-0.5 font-medium" 
            icon="i-lucide-arrow-up"
            @click="addRule('request')"
          >
            Request
          </UButton>
          <UButton 
            variant="soft" 
            color="primary"
            size="xs"
            class="text-[11px] px-2 py-0.5 font-medium" 
            icon="i-lucide-arrow-down"
            @click="addRule('response')"
          >
            Response
          </UButton>
        </div>
      </div>

      <!-- Headers List -->
      <div class="flex flex-col gap-1.5 bg-slate-50 p-2 rounded-md border border-slate-200 min-h-[40px]">
        <div v-if="combinedRules.length === 0" class="text-center text-slate-400 text-[11px] py-1">
          No headers configured. Add a request or response header above.
        </div>
        
        <div 
          v-for="(headerRow, index) in combinedRules" 
          :key="headerRow._id" 
          class="flex items-center gap-1.5"
          :style="{ zIndex: combinedRules.length - index }"
        >
          <!-- Type Select -->
          <select 
            v-model="headerRow.type" 
            class="w-[100px] h-7 text-[12px] rounded-md border-0 ring-1 ring-inset ring-slate-300 bg-white pl-2 pr-6 appearance-none focus:outline-none focus:ring-2 focus:ring-inset focus:ring-primary-500 text-slate-700 shadow-sm bg-no-repeat bg-[right_0.4rem_center] bg-[length:12px_12px]"
            style="background-image: url('data:image/svg+xml;charset=US-ASCII,%3Csvg xmlns=%22http://www.w3.org/2000/svg%22 viewBox=%220 0 20 20%22 fill=%22%2364748b%22%3E%3Cpath fill-rule=%22evenodd%22 d=%22M5.293 7.293a1 1 0 011.414 0L10 10.586l3.293-3.293a1 1 0 111.414 1.414l-4 4a1 1 0 01-1.414 0l-4-4a1 1 0 010-1.414z%22 clip-rule=%22evenodd%22/%3E%3C/svg%3E');"
          >
            <option value="request">Request</option>
            <option value="response">Response</option>
          </select>

          <!-- Operation Select -->
          <select 
            v-model="headerRow.operation" 
            class="w-[85px] h-7 text-[12px] rounded-md border-0 ring-1 ring-inset ring-slate-300 bg-white pl-2 pr-6 appearance-none focus:outline-none focus:ring-2 focus:ring-inset focus:ring-primary-500 text-slate-700 shadow-sm bg-no-repeat bg-[right_0.4rem_center] bg-[length:12px_12px]"
            style="background-image: url('data:image/svg+xml;charset=US-ASCII,%3Csvg xmlns=%22http://www.w3.org/2000/svg%22 viewBox=%220 0 20 20%22 fill=%22%2364748b%22%3E%3Cpath fill-rule=%22evenodd%22 d=%22M5.293 7.293a1 1 0 011.414 0L10 10.586l3.293-3.293a1 1 0 111.414 1.414l-4 4a1 1 0 01-1.414 0l-4-4a1 1 0 010-1.414z%22 clip-rule=%22evenodd%22/%3E%3C/svg%3E');"
          >
            <option value="set">Set</option>
            <option value="remove">Remove</option>
          </select>

          <!-- Header Name Input -->
          <UInput 
            v-model="headerRow.header" 
            placeholder="Name" 
            class="flex-1"
            size="sm"
          />

          <!-- Header Value Input -->
          <UInput 
            v-model="headerRow.value" 
            :placeholder="headerRow.operation === 'remove' ? 'Not needed' : 'Value'" 
            :disabled="headerRow.operation === 'remove'"
            class="flex-1"
            size="sm"
          />

          <!-- Delete Row Button -->
          <UButton 
            color="red" 
            variant="ghost" 
            icon="i-lucide-trash-2" 
            size="2xs"
            class="w-6 h-6 p-0 flex justify-center items-center"
            @click="removeRule(index)"
          />
        </div>
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

// Internal state to hold combined rules for the UI
const combinedRules = ref([]);

// Helper to generate a unique ID for Vue loop keys
const generateId = () => Math.random().toString(36).substr(2, 9);

// Map from rule object to internal state
const initializeCombinedRules = (rule) => {
  const reqRules = (rule.requestRules || []).map(r => ({ ...r, type: 'request', _id: generateId() }));
  const resRules = (rule.responseRules || []).map(r => ({ ...r, type: 'response', _id: generateId() }));
  combinedRules.value = [...reqRules, ...resRules];
};

// Initial load
initializeCombinedRules(props.rule);

watch(() => props.rule, (newVal) => {
  localRule.value = { ...newVal };
  // Only re-initialize if the underlying data completely changed from outside to avoid jumping inputs
  // We'll trust our internal `combinedRules` state during active editing
}, { deep: true });

// Watch internal combinedRules array to trigger save whenever ANY row changes
watch(combinedRules, () => {
  save();
}, { deep: true });

const save = () => {
  // Map combined rules back to request/response arrays
  const requestRules = [];
  const responseRules = [];

  combinedRules.value.forEach(r => {
    // Strip internal properties like _id and type
    const ruleData = { operation: r.operation, header: r.header, value: r.operation === 'remove' ? '' : r.value };
    if (r.type === 'request') {
      requestRules.push(ruleData);
    } else {
      responseRules.push(ruleData);
    }
  });

  localRule.value.requestRules = requestRules;
  localRule.value.responseRules = responseRules;

  emit('update', { ...localRule.value });
};

const addRule = (type) => {
  combinedRules.value.push({
    _id: generateId(),
    type: type,
    operation: 'set',
    header: '',
    value: ''
  });
  save();
};

const removeRule = (index) => {
  combinedRules.value.splice(index, 1);
  save();
};

const toggle = (val) => {
  localRule.value.on = val;
  save();
};

const remove = () => {
  emit('delete');
};
</script>