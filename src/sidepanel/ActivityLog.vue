<template>
  <!-- What the rules did to real requests, newest first, terminal style. Recorded by
       src/extension/activityLog.js into chrome.storage.session. -->
  <div class="activity @container flex flex-col min-h-0 h-full font-mono text-[12px] leading-[18px] text-[#c8f5d4] bg-[#0a0f14]">
    <!-- Toolbar -->
    <div class="shrink-0 space-y-2 border-b border-white/[0.06] bg-[#0d141b] px-2.5 py-2">
      <label class="flex items-center gap-2 h-8 rounded-md bg-black/40 px-2.5 ring-1 ring-white/10 focus-within:ring-emerald-400/50 transition-shadow">
        <span class="select-none text-emerald-400">❯</span>
        <input
          ref="searchInput"
          v-model="query"
          type="text"
          spellcheck="false"
          placeholder="filter: url, rule, status, method…"
          aria-label="Filter the activity log"
          class="flex-1 min-w-0 bg-transparent outline-none text-emerald-50 placeholder:text-emerald-100/25 caret-emerald-400"
          @keydown.esc="query = ''"
        />
        <kbd v-if="!query" class="hidden @xs:inline select-none rounded border border-white/10 px-1 text-[10px] leading-4 text-emerald-100/30">/</kbd>
        <button v-else type="button" class="text-emerald-100/40 hover:text-emerald-100" aria-label="Clear the filter" @click="query = ''">
          <UIcon name="i-lucide-x" class="w-3.5 h-3.5 block" />
        </button>
      </label>

      <!-- Type chips -->
      <div class="flex flex-wrap items-center gap-1">
        <button
          v-for="(info, type) in ACTIVITY_TYPES"
          :key="type"
          type="button"
          :aria-pressed="activeTypes.includes(type)"
          :title="`Show ${info.label.toLowerCase()} entries`"
          class="inline-flex items-center gap-1.5 h-6 rounded px-2 text-[10.5px] font-semibold tracking-wide ring-1 transition-colors"
          :class="activeTypes.includes(type) ? TYPE_STYLES[type].chip : 'text-emerald-100/35 ring-white/[0.08] hover:text-emerald-100/70'"
          @click="toggleType(type)"
        >
          <span class="w-1.5 h-1.5 rounded-full" :class="activeTypes.includes(type) ? TYPE_STYLES[type].dot : 'bg-white/20'"></span>
          {{ info.short }}
          <span class="tabular-nums opacity-60">{{ typeCounts[type] }}</span>
        </button>
      </div>

      <!-- Status, scope, sort and actions -->
      <div class="flex flex-wrap items-center gap-1.5 text-[10.5px]">
        <div role="radiogroup" aria-label="Status" class="flex rounded bg-black/40 p-0.5 ring-1 ring-white/[0.08]">
          <button
            v-for="option in STATUS_OPTIONS"
            :key="option.value"
            type="button"
            role="radio"
            :aria-checked="status === option.value"
            class="h-5 rounded-sm px-1.5 font-semibold tracking-wide transition-colors"
            :class="status === option.value ? 'bg-white/10 text-emerald-50' : 'text-emerald-100/40 hover:text-emerald-100/80'"
            @click="status = option.value"
          >{{ option.label }}</button>
        </div>
        <div role="radiogroup" aria-label="Tabs" class="flex rounded bg-black/40 p-0.5 ring-1 ring-white/[0.08]">
          <button
            v-for="option in SCOPE_OPTIONS"
            :key="option.value"
            type="button"
            role="radio"
            :aria-checked="scope === option.value"
            :title="option.title"
            class="h-5 rounded-sm px-1.5 font-semibold tracking-wide transition-colors"
            :class="scope === option.value ? 'bg-white/10 text-emerald-50' : 'text-emerald-100/40 hover:text-emerald-100/80'"
            @click="scope = option.value"
          >{{ option.label }}</button>
        </div>
        <label class="relative flex items-center">
          <span class="sr-only">Sort</span>
          <UIcon name="i-lucide-arrow-down-wide-narrow" class="pointer-events-none absolute left-1.5 w-3 h-3 text-emerald-100/40" />
          <select
            v-model="sort"
            style="color-scheme: dark"
            class="h-6 appearance-none rounded bg-black/40 pl-5 pr-2 font-semibold tracking-wide text-emerald-100/70 ring-1 ring-white/[0.08] outline-none hover:text-emerald-50 focus:ring-emerald-400/50 cursor-pointer"
          >
            <option v-for="option in SORT_OPTIONS" :key="option.value" :value="option.value">{{ option.label }}</option>
          </select>
        </label>
        <div class="flex-1"></div>
        <button
          type="button"
          :aria-pressed="isRecording"
          :title="isRecording ? 'Pause recording' : 'Resume recording'"
          class="inline-flex items-center gap-1.5 h-6 rounded px-2 font-semibold tracking-wide ring-1 transition-colors"
          :class="isRecording ? 'text-rose-300 ring-rose-400/30 bg-rose-500/10' : 'text-emerald-100/40 ring-white/[0.08] hover:text-emerald-100/80'"
          @click="toggleRecording"
        >
          <span class="w-1.5 h-1.5 rounded-full" :class="isRecording ? 'bg-rose-400 animate-pulse' : 'bg-white/30'"></span>
          {{ isRecording ? 'REC' : 'PAUSED' }}
        </button>
        <button
          type="button"
          title="Clear the log"
          class="inline-flex items-center justify-center w-6 h-6 rounded text-emerald-100/40 ring-1 ring-white/[0.08] hover:text-rose-300 hover:ring-rose-400/30 transition-colors"
          @click="clearLog"
        >
          <UIcon name="i-lucide-trash-2" class="w-3.5 h-3.5" />
        </button>
      </div>
    </div>

    <!-- Entries -->
    <div class="activity-scroll flex-1 min-h-0 overflow-y-auto" @wheel="onWheel">
      <!-- Zoomed as a whole (text, spacing and all), so smaller fits more entries. -->
      <ol v-if="visibleEntries.length > 0" :style="{ zoom }">
        <li
          v-for="entry in visibleEntries"
          :key="entry.id"
          class="border-b border-white/[0.04] border-l-2 transition-colors"
          :class="[
            expandedId === entry.id ? 'bg-white/[0.035]' : 'hover:bg-white/[0.02]',
            TYPE_STYLES[entry.type].border,
            isNew(entry) && 'entry-new'
          ]"
        >
          <button
            type="button"
            class="block w-full text-left px-2.5 py-1.5 outline-none focus-visible:bg-white/[0.04]"
            :aria-expanded="expandedId === entry.id"
            @click="expandedId = expandedId === entry.id ? null : entry.id"
          >
            <!-- time · type · method/resource · status · duration -->
            <span class="flex items-center gap-2 text-[10.5px] leading-4">
              <span class="tabular-nums text-emerald-100/35">{{ formatTime(entry.time) }}</span>
              <span class="font-bold tracking-wider" :class="TYPE_STYLES[entry.type].text">{{ ACTIVITY_TYPES[entry.type].short }}</span>
              <span class="truncate text-emerald-100/40">{{ [entry.method, entry.resourceType].filter(Boolean).join(' ') }}</span>
              <span v-if="entry.tabId < 0" class="shrink-0 rounded-sm bg-white/[0.06] px-1 text-[9.5px] font-bold tracking-wider text-emerald-100/50" title="Requested by the site's service worker, not a tab">SW</span>
              <span class="flex-1"></span>
              <span v-if="entry.duration !== undefined" class="tabular-nums text-emerald-100/35">{{ formatDuration(entry.duration) }}</span>
              <span class="font-bold tabular-nums" :class="STATUS_STYLES[statusBucket(entry)]">{{ statusLabel(entry) }}</span>
            </span>
            <!-- rule -->
            <span class="mt-0.5 flex items-center gap-1.5 min-w-0">
              <span class="text-emerald-400/70 select-none">▸</span>
              <span class="truncate font-semibold text-emerald-300">{{ entry.ruleName }}</span>
              <span v-if="portOf(entry)" class="shrink-0 rounded bg-emerald-400/15 px-1 text-[10.5px] font-semibold leading-4 text-emerald-300">:{{ portOf(entry) }}</span>
            </span>
            <!-- request -> result -->
            <span class="mt-0.5 block break-all pl-3.5" :class="expandedId !== entry.id && 'line-clamp-2'">
              <span class="text-emerald-100/40">{{ splitUrl(entry.url).origin }}</span><span class="text-emerald-50/90">{{ splitUrl(entry.url).rest }}</span>
            </span>
            <span v-if="entry.redirectUrl" class="mt-0.5 flex gap-1.5 pl-3.5 min-w-0">
              <span class="shrink-0 text-cyan-400/80 select-none">→</span>
              <span class="break-all" :class="[TYPE_STYLES[entry.type].target, expandedId !== entry.id && 'line-clamp-2']">{{ entry.type === 'file' ? 'inline file · ' + entry.redirectUrl.replace(/^data:/, '') : entry.redirectUrl }}</span>
            </span>
            <span v-if="entry.headers" class="mt-0.5 block pl-3.5 text-amber-200/80">
              <span v-for="change in entry.headers.request" :key="'q' + change" class="block truncate"><span class="text-amber-400/60">req </span>{{ change }}</span>
              <span v-for="change in entry.headers.response" :key="'s' + change" class="block truncate"><span class="text-amber-400/60">res </span>{{ change }}</span>
            </span>
            <span v-if="entry.detail" class="mt-0.5 block pl-3.5 text-violet-300/80">{{ entry.detail }}</span>
            <span v-if="entry.error" class="mt-0.5 flex gap-1.5 pl-3.5 text-rose-300">
              <span class="shrink-0 select-none">✕</span>
              <span class="[overflow-wrap:anywhere]">{{ entry.error }}<span v-if="hint(entry)" class="text-rose-200/50"> · {{ hint(entry) }}</span></span>
            </span>
          </button>

          <!-- Details -->
          <dl v-if="expandedId === entry.id" class="mx-2.5 mb-2 grid grid-cols-[auto_1fr] gap-x-3 gap-y-0.5 rounded-md bg-black/40 px-2.5 py-2 text-[11px] ring-1 ring-white/[0.06]">
            <template v-for="row in detailRows(entry)" :key="row.label">
              <dt class="text-emerald-100/35">{{ row.label }}</dt>
              <dd class="flex min-w-0 items-start gap-1.5 text-emerald-50/85">
                <span class="min-w-0 break-all">{{ row.value }}</span>
                <button
                  v-if="row.copy"
                  type="button"
                  class="shrink-0 mt-[3px] text-emerald-100/30 hover:text-emerald-300"
                  :title="`Copy ${row.label.toLowerCase()}`"
                  @click="copy(row.value, row.label)"
                >
                  <UIcon :name="copiedLabel === row.label ? 'i-lucide-check' : 'i-lucide-copy'" class="w-3 h-3 block" />
                </button>
              </dd>
            </template>
          </dl>
        </li>
      </ol>

      <!-- Empty -->
      <div v-else class="px-4 py-10 text-emerald-100/40">
        <p v-if="entries.length === 0">
          <span class="text-emerald-400">$</span> waiting for requests your rules change<span class="cursor-blink">▍</span>
        </p>
        <p v-else-if="inScope.length === 0">
          <span class="text-emerald-400">$</span> nothing in this tab yet · {{ entries.length }} in other tabs
          <button type="button" class="ml-1 text-emerald-300 underline decoration-emerald-300/30 underline-offset-2 hover:decoration-emerald-300" @click="scope = 'all'">show all tabs</button>
        </p>
        <p v-else>
          <span class="text-emerald-400">$</span> nothing matches the filters
          <button type="button" class="ml-1 text-emerald-300 underline decoration-emerald-300/30 underline-offset-2 hover:decoration-emerald-300" @click="resetFilters">reset</button>
        </p>
        <p v-if="entries.length === 0" class="mt-3 text-[11px] leading-5 text-emerald-100/25">
          Redirects, file overrides, header changes and injections show up here as pages load.
          The log starts empty when the browser or the extension restarts.
          <template v-if="!isRecording"> Recording is paused.</template>
        </p>
      </div>
    </div>

    <!-- Status bar -->
    <div class="shrink-0 flex items-center gap-3 h-6 px-2.5 border-t border-white/[0.06] bg-[#0d141b] text-[10.5px] text-emerald-100/40 tabular-nums">
      <span><span class="text-emerald-300">{{ visibleEntries.length }}</span>/{{ entries.length }}</span>
      <span v-if="errorCount > 0" class="text-rose-300/80">{{ errorCount }} failed</span>
      <span class="flex-1"></span>
      <span class="truncate">{{ scope === 'tab' ? 'this tab' : 'all tabs' }} · {{ SORT_OPTIONS.find(o => o.value === sort).label.toLowerCase() }}</span>
      <!-- Zoom: also Ctrl/⌘ + / − / 0 and Ctrl/⌘ + scroll over the log. -->
      <span class="shrink-0 flex items-center rounded ring-1 ring-white/[0.08]">
        <button
          type="button"
          class="w-5 h-4 flex items-center justify-center hover:text-emerald-200 disabled:opacity-30 disabled:hover:text-inherit"
          :disabled="zoom === ZOOM_LEVELS[0]"
          title="Smaller (Ctrl/⌘ −)"
          aria-label="Zoom out"
          @click="zoomBy(-1)"
        ><UIcon name="i-lucide-minus" class="w-3 h-3" /></button>
        <button
          type="button"
          class="min-w-[4ch] h-4 text-center hover:text-emerald-200"
          title="Reset to 100% (Ctrl/⌘ 0)"
          @click="zoom = 1"
        >{{ Math.round(zoom * 100) }}%</button>
        <button
          type="button"
          class="w-5 h-4 flex items-center justify-center hover:text-emerald-200 disabled:opacity-30 disabled:hover:text-inherit"
          :disabled="zoom === ZOOM_LEVELS[ZOOM_LEVELS.length - 1]"
          title="Larger (Ctrl/⌘ +)"
          aria-label="Zoom in"
          @click="zoomBy(1)"
        ><UIcon name="i-lucide-plus" class="w-3 h-3" /></button>
      </span>
    </div>
  </div>
</template>

<script setup>
import { ref, computed, watch, onMounted, onBeforeUnmount } from 'vue';
import { ACTIVITY_TYPES, statusBucket } from '../lib/activity.js';
import { getTargetPort } from '../extension/urlPattern.js';

const LOG_KEY = 'activityLog';
const RECORDING_KEY = 'activityRecording';
const FILTERS_KEY = 'resourced:activity-filters';

const TYPE_STYLES = {
  redirect: { text: 'text-emerald-400', dot: 'bg-emerald-400', chip: 'text-emerald-300 bg-emerald-400/10 ring-emerald-400/30', border: 'border-l-emerald-400/60', target: 'text-cyan-300' },
  file: { text: 'text-sky-400', dot: 'bg-sky-400', chip: 'text-sky-300 bg-sky-400/10 ring-sky-400/30', border: 'border-l-sky-400/60', target: 'text-sky-300' },
  headers: { text: 'text-amber-400', dot: 'bg-amber-400', chip: 'text-amber-300 bg-amber-400/10 ring-amber-400/30', border: 'border-l-amber-400/60', target: 'text-amber-300' },
  inject: { text: 'text-violet-400', dot: 'bg-violet-400', chip: 'text-violet-300 bg-violet-400/10 ring-violet-400/30', border: 'border-l-violet-400/60', target: 'text-violet-300' }
};
const STATUS_STYLES = { ok: 'text-emerald-400', error: 'text-rose-400', pending: 'text-amber-300 animate-pulse' };
const STATUS_OPTIONS = [
  { value: 'all', label: 'ALL' },
  { value: 'ok', label: 'OK' },
  { value: 'error', label: 'FAILED' },
  { value: 'pending', label: 'PENDING' }
];
const SCOPE_OPTIONS = [
  { value: 'tab', label: 'TAB', title: 'Only the current tab' },
  { value: 'all', label: 'ALL TABS', title: 'Every tab' }
];
const SORT_OPTIONS = [
  { value: 'newest', label: 'Newest' },
  { value: 'oldest', label: 'Oldest' },
  { value: 'slowest', label: 'Slowest' },
  { value: 'failed', label: 'Failed first' }
];

const hasChrome = typeof chrome !== 'undefined' && !!chrome.storage?.session;

const entries = ref([]);
const isRecording = ref(true);
const currentTabId = ref(null);
const currentTabOrigin = ref('');
const expandedId = ref(null);
const searchInput = ref(null);

// Filters are remembered for this browser profile.
const readFilters = () => {
  try {
    return JSON.parse(localStorage.getItem(FILTERS_KEY)) || {};
  } catch (e) {
    return {};
  }
};
const saved = readFilters();
const query = ref('');
const activeTypes = ref(Array.isArray(saved.types) ? saved.types : Object.keys(ACTIVITY_TYPES));
const status = ref(saved.status || 'all');
const scope = ref(saved.scope || 'tab');
const sort = ref(saved.sort || 'newest');

const ZOOM_LEVELS = [0.7, 0.8, 0.9, 1, 1.15, 1.3];
const zoom = ref(ZOOM_LEVELS.includes(saved.zoom) ? saved.zoom : 1);
const zoomBy = (step) => {
  const index = ZOOM_LEVELS.indexOf(zoom.value) + step;
  zoom.value = ZOOM_LEVELS[Math.min(Math.max(index, 0), ZOOM_LEVELS.length - 1)];
};
const onWheel = (e) => {
  if (!e.ctrlKey && !e.metaKey) return;
  e.preventDefault();
  zoomBy(e.deltaY < 0 ? 1 : -1);
};

watch([activeTypes, status, scope, sort, zoom], () => {
  try {
    localStorage.setItem(FILTERS_KEY, JSON.stringify({ types: activeTypes.value, status: status.value, scope: scope.value, sort: sort.value, zoom: zoom.value }));
  } catch (e) {
    // Storage unavailable; the filters just aren't remembered.
  }
}, { deep: true });

const toggleType = (type) => {
  activeTypes.value = activeTypes.value.includes(type)
    ? activeTypes.value.filter(t => t !== type)
    : [...activeTypes.value, type];
};

const resetFilters = () => {
  query.value = '';
  activeTypes.value = Object.keys(ACTIVITY_TYPES);
  status.value = 'all';
};

// Requests made by a site's service worker belong to no tab (-1); they count as the
// current tab's when they came from the site it shows.
const isInCurrentTab = (entry) =>
  entry.tabId === currentTabId.value || (entry.tabId < 0 && !!entry.initiator && entry.initiator === currentTabOrigin.value);
const inScope = computed(() => entries.value.filter(entry => scope.value === 'all' || isInCurrentTab(entry)));

const typeCounts = computed(() => Object.fromEntries(Object.keys(ACTIVITY_TYPES).map(type =>
  [type, inScope.value.filter(entry => entry.type === type).length]
)));

const matchesQuery = (entry, words) => {
  const haystack = [entry.url, entry.redirectUrl, entry.finalUrl, entry.ruleName, entry.rulePattern, entry.method,
    entry.resourceType, entry.error, entry.detail, String(entry.status ?? ''), ACTIVITY_TYPES[entry.type].label]
    .concat(entry.headers ? [...entry.headers.request, ...entry.headers.response] : [])
    .filter(Boolean).join(' ').toLowerCase();
  return words.every(word => haystack.includes(word));
};

const visibleEntries = computed(() => {
  const words = query.value.toLowerCase().split(/\s+/).filter(Boolean);
  const list = inScope.value.filter(entry =>
    activeTypes.value.includes(entry.type) &&
    (status.value === 'all' || statusBucket(entry) === status.value) &&
    (words.length === 0 || matchesQuery(entry, words))
  );
  const byTime = (a, b) => b.time - a.time;
  const sorters = {
    newest: byTime,
    oldest: (a, b) => a.time - b.time,
    slowest: (a, b) => (b.duration ?? -1) - (a.duration ?? -1) || byTime(a, b),
    failed: (a, b) => (statusBucket(b) === 'error') - (statusBucket(a) === 'error') || byTime(a, b)
  };
  return list.sort(sorters[sort.value] || byTime);
});

const errorCount = computed(() => inScope.value.filter(entry => statusBucket(entry) === 'error').length);

// Entries that arrive while the view is open flash once.
let shownSince = Date.now();
const isNew = (entry) => entry.time > shownSince;

const pad = (n, width = 2) => String(n).padStart(width, '0');
const formatTime = (time) => {
  const d = new Date(time);
  return `${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}.${pad(d.getMilliseconds(), 3)}`;
};
const formatDuration = (ms) => (ms >= 1000 ? `${(ms / 1000).toFixed(ms >= 10000 ? 0 : 1)}s` : `${ms}ms`);

const statusLabel = (entry) => {
  if (entry.error) return 'ERR';
  if (entry.type === 'inject') return 'DONE';
  if (entry.inline) return 'SERVED';
  if (entry.status === undefined || entry.status === null) return '···';
  return entry.fromCache ? `${entry.status}·c` : String(entry.status);
};

const splitUrl = (url) => {
  const m = /^([a-z][a-z0-9+.-]*:\/\/[^/?#]*)(.*)$/i.exec(url || '');
  return m ? { origin: m[1], rest: m[2] } : { origin: '', rest: url || '' };
};

const portOf = (entry) => (entry.type === 'redirect' ? getTargetPort(entry.redirectUrl) : '');

// The most common reason a redirect to a local server fails.
const hint = (entry) => {
  if (entry.type === 'redirect' && /CONNECTION_REFUSED|ADDRESS_UNREACHABLE/.test(entry.error || '')) return 'is the local server running?';
  if (/BLOCKED_BY_CLIENT/.test(entry.error || '')) return 'blocked by another extension';
  // A fetch/XHR redirected to another origin fails without CORS headers on the local server.
  if (entry.error === 'net::ERR_FAILED' && entry.resourceType === 'xmlhttprequest') return 'CORS? the local server must allow this site';
  return '';
};

const detailRows = (entry) => [
  { label: 'Rule', value: entry.ruleName },
  { label: 'Pattern', value: entry.rulePattern },
  { label: 'Request', value: entry.url, copy: true },
  entry.redirectUrl && entry.type === 'redirect' && { label: 'Redirected to', value: entry.redirectUrl, copy: true },
  entry.finalUrl && { label: 'Ended at', value: entry.finalUrl, copy: true },
  entry.initiator && { label: 'Page', value: entry.initiator },
  entry.ip && { label: 'Server IP', value: entry.ip },
  entry.fromCache !== undefined && { label: 'From cache', value: entry.fromCache ? 'yes' : 'no' },
  entry.duration !== undefined && { label: 'Time', value: formatDuration(entry.duration) },
  { label: 'Tab', value: entry.tabId < 0 ? 'none: made by the site\'s service worker or the browser' : `#${entry.tabId}` },
  { label: 'Logged', value: new Date(entry.time).toLocaleString() }
].filter(Boolean);

const copiedLabel = ref('');
const copy = async (text, label) => {
  try {
    await navigator.clipboard.writeText(text);
    copiedLabel.value = label;
    setTimeout(() => { if (copiedLabel.value === label) copiedLabel.value = ''; }, 1200);
  } catch (e) {
    // Clipboard not available here.
  }
};

const toggleRecording = () => {
  isRecording.value = !isRecording.value;
  if (hasChrome) chrome.storage.local.set({ [RECORDING_KEY]: isRecording.value });
};

const clearLog = () => {
  entries.value = [];
  expandedId.value = null;
  if (hasChrome) chrome.runtime.sendMessage({ action: 'activityClear' }).catch(() => {});
};

// "This tab" follows the active tab of the window the panel is in.
const refreshCurrentTab = async () => {
  if (!hasChrome) return;
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  currentTabId.value = tab?.id ?? null;
  try {
    currentTabOrigin.value = tab?.url ? new URL(tab.url).origin : '';
  } catch (e) {
    currentTabOrigin.value = '';
  }
};

// The current tab moving to another site changes what "this tab" covers.
const onTabUpdated = (tabId, changeInfo) => {
  if (tabId === currentTabId.value && changeInfo.url) refreshCurrentTab();
};

const onStorageChanged = (changes, area) => {
  if (area === 'session' && changes[LOG_KEY]) entries.value = changes[LOG_KEY].newValue || [];
  if (area === 'local' && changes[RECORDING_KEY]) isRecording.value = changes[RECORDING_KEY].newValue !== false;
};

// "/" jumps to the filter, like in most log viewers.
const onKeyDown = (e) => {
  // Instead of zooming the whole panel.
  if ((e.ctrlKey || e.metaKey) && ['-', '=', '+', '0'].includes(e.key)) {
    e.preventDefault();
    if (e.key === '0') zoom.value = 1;
    else zoomBy(e.key === '-' ? -1 : 1);
    return;
  }
  if (e.key === '/' && document.activeElement?.tagName !== 'INPUT' && document.activeElement?.tagName !== 'TEXTAREA') {
    e.preventDefault();
    searchInput.value?.focus();
  }
};

onMounted(async () => {
  window.addEventListener('keydown', onKeyDown);
  if (!hasChrome) return;
  chrome.storage.onChanged.addListener(onStorageChanged);
  chrome.tabs.onActivated.addListener(refreshCurrentTab);
  chrome.tabs.onUpdated.addListener(onTabUpdated);
  const [log, settings] = await Promise.all([
    chrome.storage.session.get(LOG_KEY),
    chrome.storage.local.get(RECORDING_KEY),
    refreshCurrentTab()
  ]);
  entries.value = log[LOG_KEY] || [];
  isRecording.value = settings[RECORDING_KEY] !== false;
  shownSince = Date.now();
});

onBeforeUnmount(() => {
  window.removeEventListener('keydown', onKeyDown);
  if (!hasChrome) return;
  chrome.storage.onChanged.removeListener(onStorageChanged);
  chrome.tabs.onActivated.removeListener(refreshCurrentTab);
  chrome.tabs.onUpdated.removeListener(onTabUpdated);
});
</script>

<style scoped>
.activity-scroll {
  scrollbar-width: thin;
  scrollbar-color: rgba(200, 245, 212, 0.15) transparent;
}

.entry-new {
  animation: entry-flash 1.2s ease-out;
}

@keyframes entry-flash {
  from {
    background-color: rgba(52, 211, 153, 0.14);
  }
}

.cursor-blink {
  margin-left: 2px;
  color: rgb(52, 211, 153);
  animation: cursor-blink 1.1s steps(1) infinite;
}

@keyframes cursor-blink {
  50% {
    opacity: 0;
  }
}
</style>
