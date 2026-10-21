<template>
  <RuleCard
    :rule="localRule"
    @toggle="toggle"
    @delete="remove"
    @update-collapse="(val) => { localRule.isCollapsed = val; save(); }"
    @update-name="(name) => { localRule.name = name; save(); }"
    @update-options="(patch) => { Object.assign(localRule, patch); save(); }"
  >
    <div class="@container flex flex-col gap-1.5 w-full">
      <div class="flex items-start gap-2">
        <UIcon name="i-lucide-crosshair" class="text-slate-400 w-4 h-4 flex-shrink-0 mt-1.5" title="Calls to answer" />
        <UTextarea
          v-model="localRule.match"
          @change="save"
          autoresize
          :rows="1"
          :maxrows="5"
          :placeholder="isRegex ? 'Regex of API URLs, e.g. https:\\/\\/api\\.example\\.com\\/users.*' : 'API URLs to answer, e.g. */api/users or */api/**'"
          size="sm"
          class="font-mono flex-1"
          :ui="{ base: 'bg-white border-slate-300 rounded-sm shadow-none py-1 min-h-[28px]', wrapper: 'flex-1' }"
        />
      </div>

      <div class="flex flex-wrap items-center gap-2 pl-6">
        <select
          v-model="localRule.mockMode"
          @change="save"
          aria-label="What to do"
          :class="selectClass"
          class="w-[190px]"
          :style="selectArrow"
        >
          <option value="mock">Mock the response</option>
          <option value="delay">Delay the real response</option>
        </select>

        <template v-if="localRule.mockMode !== 'delay'">
          <label class="inline-flex items-center gap-1.5 text-[12px] text-slate-500">
            Status
            <UInput v-model="localRule.status" @change="save" type="number" min="200" max="599" size="sm" class="w-20 font-mono" />
          </label>
          <select
            v-model="localRule.contentType"
            @change="save"
            aria-label="Content type"
            :class="selectClass"
            class="w-[150px]"
            :style="selectArrow"
          >
            <option v-for="type in CONTENT_TYPES" :key="type.value" :value="type.value">{{ type.label }}</option>
          </select>
        </template>

        <label class="inline-flex items-center gap-1.5 text-[12px] text-slate-500">
          Delay
          <UInput v-model="localRule.delay" @change="save" type="number" min="0" max="60000" step="100" size="sm" class="w-24 font-mono" />
          ms
        </label>
      </div>

      <template v-if="localRule.mockMode !== 'delay'">
        <div class="flex items-start gap-2">
          <UIcon name="i-lucide-reply" class="text-slate-400 w-4 h-4 flex-shrink-0 mt-1.5" title="Response body" />
          <UTextarea
            v-model="localRule.body"
            @change="save"
            autoresize
            :rows="3"
            :maxrows="14"
            :placeholder="bodyPlaceholder"
            size="sm"
            class="font-mono flex-1"
            :ui="{ base: 'bg-white border-slate-300 rounded-sm shadow-none py-1', wrapper: 'flex-1' }"
          />
        </div>

        <!-- Extra response headers -->
        <div class="flex flex-col gap-1.5 pl-6">
          <div v-for="(header, index) in headers" :key="header._id" class="flex flex-wrap items-center gap-1.5">
            <UInput v-model="header.header" placeholder="Header" size="sm" class="flex-1 font-mono" />
            <UInput v-model="header.value" placeholder="Value" size="sm" class="flex-1 font-mono" />
            <UButton color="red" variant="ghost" icon="i-lucide-trash-2" size="2xs" class="w-6 h-6 p-0 flex justify-center items-center" title="Remove this header" @click="headers.splice(index, 1)" />
          </div>
          <div>
            <UButton variant="soft" color="primary" size="xs" icon="i-lucide-plus" class="text-[11px] px-2 py-0.5 font-medium" @click="addHeader">Response header</UButton>
          </div>
        </div>
      </template>

      <p class="pl-6 text-[11px] text-slate-400">
        Answers the page's <code class="font-mono">fetch()</code> and <code class="font-mono">XMLHttpRequest</code> calls.
        To replace a script, stylesheet or image, use a File override.
      </p>
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

const CONTENT_TYPES = [
  { value: 'application/json', label: 'JSON' },
  { value: 'text/plain', label: 'Text' },
  { value: 'text/html', label: 'HTML' },
  { value: 'application/javascript', label: 'JavaScript' },
  { value: 'text/css', label: 'CSS' },
  { value: 'application/xml', label: 'XML' }
];

const selectClass = 'h-7 text-sm rounded-md border-0 ring-1 ring-inset ring-slate-300 bg-white pl-2 pr-6 appearance-none focus:outline-none focus:ring-2 focus:ring-inset focus:ring-primary-500 text-slate-700 shadow-sm bg-no-repeat bg-[right_0.4rem_center] bg-[length:12px_12px]';
const selectArrow = "background-image: url('data:image/svg+xml;charset=US-ASCII,%3Csvg xmlns=%22http://www.w3.org/2000/svg%22 viewBox=%220 0 20 20%22 fill=%22%2364748b%22%3E%3Cpath fill-rule=%22evenodd%22 d=%22M5.293 7.293a1 1 0 011.414 0L10 10.586l3.293-3.293a1 1 0 111.414 1.414l-4 4a1 1 0 01-1.414 0l-4-4a1 1 0 010-1.414z%22 clip-rule=%22evenodd%22/%3E%3C/svg%3E');";

const localRule = ref({ mockMode: 'mock', status: 200, contentType: 'application/json', body: '', delay: 0, ...props.rule });
const isRegex = computed(() => getMatchMode(localRule.value) === 'regex');

const bodyPlaceholder = computed(() => (localRule.value.contentType === 'application/json'
  ? 'Response body, e.g. { "users": [{ "id": 1, "name": "Ada" }] }'
  : 'Response body'));

let nextId = 0;
const headers = ref((props.rule.mockHeaders || []).map(h => ({ ...h, _id: nextId++ })));

watch(() => props.rule, (newVal) => {
  localRule.value = { mockMode: 'mock', status: 200, contentType: 'application/json', body: '', delay: 0, ...newVal };
}, { deep: true });

const save = () => {
  localRule.value.status = Number(localRule.value.status) || 200;
  localRule.value.delay = Math.max(0, Number(localRule.value.delay) || 0);
  localRule.value.mockHeaders = headers.value.map(({ header, value }) => ({ header, value }));
  emit('update', { ...localRule.value });
};

watch(headers, save, { deep: true });

const addHeader = () => {
  headers.value.push({ header: '', value: '', _id: nextId++ });
};

const toggle = (val) => {
  localRule.value.on = val;
  save();
};

const remove = () => {
  emit('delete');
};
</script>
