<template>
  <div
    v-if="isOpen"
    class="fixed inset-0 z-[100] flex items-center justify-center bg-slate-900/50 backdrop-blur-sm"
    @mousedown="onBackdropMousedown"
    @click="onBackdropClick"
  >
    <div
      role="dialog"
      aria-modal="true"
      aria-label="Settings"
      class="bg-white flex flex-col w-[960px] 2xl:w-[1120px] max-w-[92vw] h-[720px] 2xl:h-[840px] max-h-[90vh] shadow-2xl rounded-xl overflow-hidden"
    >
      <!-- Header -->
      <div class="flex items-center justify-between px-6 py-4 border-b border-slate-200 shrink-0 bg-white">
        <h3 class="text-base font-semibold leading-6 text-slate-900 flex items-center gap-2">
          <UIcon name="i-lucide-settings" class="w-5 h-5 text-primary-500" />
          Settings
        </h3>
        <UButton color="neutral" variant="ghost" icon="i-lucide-x" class="-my-1" @click="close" />
      </div>

      <!-- Content Area -->
      <div class="flex-1 overflow-y-auto p-8 bg-slate-50 text-[13px] text-slate-700 space-y-8">
        <section>
          <h4 class="text-lg font-bold text-slate-900 mb-1">Sites</h4>
          <p class="text-slate-500 mb-4">
            Where your rules work at all: redirects, header changes, file overrides and injections, and the HUD.
            A site is the page you're on: what it loads, its frames, and opening the page itself.
          </p>

          <div class="bg-white rounded-md border border-slate-200 divide-y divide-slate-200">
            <div v-for="list in SITE_LISTS" :key="list.key" class="px-4 py-3">
              <div class="flex items-start justify-between gap-6">
                <span class="shrink-0 w-56">
                  <span class="block font-semibold text-slate-800">{{ list.label }}</span>
                  <span class="block text-slate-500 text-[12px]">{{ list.description }}</span>
                </span>
                <UTextarea
                  v-model="siteDrafts[list.key]"
                  :placeholder="list.placeholder"
                  autoresize
                  :rows="1"
                  :maxrows="4"
                  size="sm"
                  class="font-mono flex-1"
                  :ui="{ base: 'bg-white border-slate-300 rounded-sm shadow-none py-1.5' }"
                  @change="saveSites(list.key)"
                />
              </div>
              <ul v-if="siteWarnings[list.key].length > 0" class="mt-2 ml-62 space-y-0.5 text-[12px]">
                <li v-for="warning in siteWarnings[list.key]" :key="warning.pattern" class="flex items-start gap-1.5 text-amber-700">
                  <UIcon name="i-lucide-triangle-alert" class="w-3.5 h-3.5 shrink-0 mt-px" />
                  <span><code class="font-mono font-semibold">{{ warning.pattern }}</code>: {{ warning.message }}</span>
                </li>
              </ul>
            </div>
          </div>
          <p class="mt-2 text-[12px] text-slate-500">
            <code class="font-mono">example.com</code> and <code class="font-mono">*.example.com</code> include all subdomains;
            in the blocklist <code class="font-mono">*</code> can stand anywhere, e.g. <code class="font-mono">prod-*.example.com</code>.
            The blocklist wins over the allowlist.
          </p>
        </section>

        <section>
          <h4 class="text-lg font-bold text-slate-900 mb-1">Notifications</h4>
          <p class="text-slate-500 mb-4">Messages on the page, in its top right corner, when something needs your attention.</p>
          <div class="bg-white rounded-md border border-slate-200">
            <label class="flex items-center justify-between gap-4 px-4 py-3 cursor-pointer">
              <span>
                <span class="block font-semibold text-slate-800">When a redirect's server fails</span>
                <span class="block text-slate-500 text-[12px]">E.g. "Server on localhost:8782 is not responding." Once per server and page; needs the activity log recording.</span>
              </span>
              <USwitch
                :model-value="settings.failureToasts"
                @update:model-value="(value) => update('failureToasts', value)"
                color="success"
                :ui="{ base: 'data-[state=unchecked]:bg-slate-400' }"
              />
            </label>
          </div>
        </section>

        <section>
          <h4 class="text-lg font-bold text-slate-900 mb-1">Page HUD</h4>
          <p class="text-slate-500 mb-4">
            A small overlay on every page that lists your URL redirects. Switch them on and off or change a port
            right there; drag it by its grip if it covers something.
          </p>

          <!-- Preview: your redirects, as the HUD would show them with these settings. -->
          <div class="mb-4 rounded-md border border-dashed border-slate-300 bg-[repeating-linear-gradient(45deg,#f1f5f9_0_10px,#e2e8f0_10px_20px)] min-h-24 relative overflow-hidden px-3 pt-3 pb-8">
            <span class="absolute bottom-2 left-3 text-[11px] font-semibold uppercase tracking-wider text-slate-400">
              Preview{{ previewRedirects.isExample ? ' · example redirects' : '' }}{{ settings.hudShowCounts || settings.hudOnlyUsed ? ' · example counts' : '' }}
            </span>
            <div
              v-if="settings.hudEnabled && previewRedirects.items.length > 0"
              class="mx-auto w-fit max-w-full flex items-stretch rounded-[15px] bg-slate-900/80 text-slate-50 text-[12px] leading-[18px] font-medium shadow-lg backdrop-blur-sm ring-1 ring-white/10 transition-opacity"
              :style="{ opacity: settings.hudOpacity }"
            >
              <span class="flex items-center justify-center w-[26px] shrink-0 rounded-l-[15px] bg-white/[0.07] border-r border-white/[0.12] text-slate-50/60">
                <UIcon name="i-lucide-move" class="w-3 h-3" />
              </span>
              <span class="flex flex-wrap items-center gap-y-0.5 py-[5px] pl-2.5 pr-3 min-w-0">
                <template v-for="(item, index) in previewRedirects.items" :key="item.id">
                  <span v-if="index > 0" class="w-px h-3.5 mx-2.5 bg-white/20"></span>
                  <span class="inline-flex items-center gap-1.5 whitespace-nowrap" :class="!item.on && 'opacity-50'">
                    <span
                      v-if="settings.hudShowSwitches"
                      class="relative w-6 h-3.5 rounded-full transition-colors"
                      :class="item.on ? 'bg-[#00c16a]' : 'bg-white/40'"
                    ><span class="absolute top-0.5 left-0.5 w-2.5 h-2.5 rounded-full bg-white shadow transition-transform" :class="item.on && 'translate-x-2.5'"></span></span>
                    <span>{{ item.name }}</span>
                    <span
                      v-if="settings.hudPortMode !== 'hide' && (item.port || (settings.hudPortMode === 'edit' && item.canEditPort))"
                      class="font-mono text-[11px] font-semibold leading-4 px-[5px] rounded-md"
                      :class="item.port ? 'bg-[#00dc82]/20 text-emerald-300' : 'text-slate-50/60 ring-1 ring-inset ring-white/25'"
                    >{{ item.port ? ':' + item.port : '+port' }}</span>
                    <template v-if="settings.hudShowCounts && item.count > 0">
                      <span class="font-mono text-[10.5px] font-semibold text-slate-50/55">×{{ item.count }}</span>
                      <span v-if="item.failed > 0" class="font-mono text-[10.5px] font-semibold text-red-300">✕{{ item.failed }}</span>
                    </template>
                  </span>
                </template>
              </span>
            </div>
            <p v-else class="text-center text-[12px] text-slate-400 pt-3">
              {{ settings.hudEnabled ? 'Nothing to show with these settings.' : 'The HUD is off.' }}
            </p>
          </div>

          <div class="bg-white rounded-md border border-slate-200 divide-y divide-slate-200">
            <label class="flex items-center justify-between gap-4 px-4 py-3 cursor-pointer">
              <span>
                <span class="block font-semibold text-slate-800">Show redirect HUD</span>
                <span class="block text-slate-500 text-[12px]">Only appears while at least one redirect rule is on.</span>
              </span>
              <USwitch
                :model-value="settings.hudEnabled"
                @update:model-value="(value) => update('hudEnabled', value)"
                color="success"
                :ui="{ base: 'data-[state=unchecked]:bg-slate-400' }"
              />
            </label>

            <div class="flex items-center justify-between gap-6 px-4 py-3" :class="!settings.hudEnabled && 'opacity-50'">
              <span class="shrink-0">
                <span class="block font-semibold text-slate-800">Opacity</span>
                <span class="block text-slate-500 text-[12px]">How see-through the HUD is.</span>
              </span>
              <div class="flex items-center gap-3 w-64">
                <USlider
                  :model-value="Math.round(settings.hudOpacity * 100)"
                  @update:model-value="(value) => update('hudOpacity', value / 100)"
                  :min="30"
                  :max="100"
                  :step="5"
                  :disabled="!settings.hudEnabled"
                  class="flex-1"
                />
                <span class="font-mono text-[12px] text-slate-500 w-9 text-right">{{ Math.round(settings.hudOpacity * 100) }}%</span>
              </div>
            </div>

            <div class="flex items-center justify-between gap-6 px-4 py-3" :class="!settings.hudEnabled && 'opacity-50'">
              <span>
                <span class="block font-semibold text-slate-800">Position</span>
                <span class="block text-slate-500 text-[12px]">Drag the HUD by its grip on any page. Double-clicking the grip also resets it.</span>
              </span>
              <UButton
                variant="outline"
                color="neutral"
                size="sm"
                icon="i-lucide-rotate-ccw"
                :disabled="!settings.hudEnabled"
                class="shrink-0"
                @click="resetHudPosition"
              >
                Reset to top center
              </UButton>
            </div>
          </div>

          <h5 class="mt-5 mb-2 text-[11px] font-bold uppercase tracking-wider text-slate-500">What it shows</h5>
          <div class="bg-white rounded-md border border-slate-200 divide-y divide-slate-200" :class="!settings.hudEnabled && 'opacity-50 pointer-events-none'">
            <label v-for="option in HUD_TOGGLES" :key="option.key" class="flex items-center justify-between gap-4 px-4 py-3 cursor-pointer">
              <span>
                <span class="block font-semibold text-slate-800">{{ option.label }}</span>
                <span class="block text-slate-500 text-[12px]">{{ option.description }}</span>
              </span>
              <USwitch
                :model-value="settings[option.key]"
                @update:model-value="(value) => update(option.key, value)"
                color="success"
                :ui="{ base: 'data-[state=unchecked]:bg-slate-400' }"
              />
            </label>

            <div class="flex items-center justify-between gap-6 px-4 py-3">
              <span>
                <span class="block font-semibold text-slate-800">Ports</span>
                <span class="block text-slate-500 text-[12px]">The destination port of each redirect; editable ones change the rule when you click them.</span>
              </span>
              <div role="radiogroup" aria-label="Ports" class="shrink-0 flex rounded-md bg-slate-100 p-0.5 ring-1 ring-slate-200">
                <button
                  v-for="option in PORT_MODES"
                  :key="option.value"
                  type="button"
                  role="radio"
                  :aria-checked="settings.hudPortMode === option.value"
                  class="h-7 px-3 rounded text-[12px] font-semibold transition-colors"
                  :class="settings.hudPortMode === option.value ? 'bg-white text-slate-800 shadow-sm' : 'text-slate-500 hover:text-slate-800'"
                  @click="update('hudPortMode', option.value)"
                >{{ option.label }}</button>
              </div>
            </div>

            <div class="flex items-center justify-between gap-6 px-4 py-3">
              <span class="shrink-0">
                <span class="block font-semibold text-slate-800">Only on these sites</span>
                <span class="block text-slate-500 text-[12px]">Domains, comma-separated; subdomains included. Empty = every site.</span>
              </span>
              <UInput
                v-model="hudSitesDraft"
                placeholder="e.g. stage.example.com, localhost"
                size="sm"
                class="font-mono w-72"
                @change="update('hudSites', hudSitesDraft.trim())"
              />
            </div>
          </div>
        </section>

        <section>
          <h4 class="text-lg font-bold text-slate-900 mb-1">Side Panel</h4>
          <p class="text-slate-500 mb-4">
            A panel docked next to the page with a quick on/off switch for every rule, grouped by type.
          </p>

          <div class="bg-white rounded-md border border-slate-200">
            <label class="flex items-center justify-between gap-4 px-4 py-3" :class="isSidePanelSupported ? 'cursor-pointer' : 'opacity-50'">
              <span>
                <span class="block font-semibold text-slate-800">Show side panel</span>
                <span class="block text-slate-500 text-[12px]">
                  {{ isSidePanelSupported ? 'Opens it in this window; switch off to close it.' : 'Not supported by this browser.' }}
                </span>
              </span>
              <USwitch
                :model-value="isSidePanelOpen"
                @update:model-value="setSidePanelOpen"
                :disabled="!isSidePanelSupported"
                color="success"
                :ui="{ base: 'data-[state=unchecked]:bg-slate-400' }"
              />
            </label>
          </div>
        </section>

        <!-- Sync, team presets and backups -->
        <RulesDataSettings />
      </div>
    </div>
  </div>
</template>

<script setup>
import { useModal } from '../composables/useModal.js';
import RulesDataSettings from './RulesDataSettings.vue';
import { ref, computed, watch, onMounted, onBeforeUnmount } from 'vue';
import { buildUrlMatch, getTargetPort, parseSiteList, isAllowlistSupported } from '../extension/urlPattern.js';
import { getRuleDisplayName, canEditRulePort } from '../lib/ruleLabels.js';

// Keep in sync with DEFAULTS in src/inject/hud.js.
const HUD_DEFAULTS = {
  hudEnabled: true,
  hudOpacity: 0.85,
  hudOnlyEnabled: false,
  hudOnlyUsed: false,
  hudShowCounts: true,
  hudShowSwitches: true,
  hudPortMode: 'edit',
  hudSites: '',
  failureToasts: true
};

const HUD_TOGGLES = [
  { key: 'hudOnlyEnabled', label: 'Only enabled redirects', description: 'Leave out the redirects that are switched off.' },
  { key: 'hudOnlyUsed', label: 'Only redirects used on the page', description: 'A redirect is listed once it has changed a request on the current page.' },
  { key: 'hudShowCounts', label: 'Request counts', description: 'How many requests each redirect changed on the page (×12), and how many of them failed (✕2).' },
  { key: 'hudShowSwitches', label: 'On/off switches', description: 'Switch redirects on and off from the HUD.' }
];

const PORT_MODES = [
  { value: 'edit', label: 'Editable' },
  { value: 'show', label: 'Read-only' },
  { value: 'hide', label: 'Hidden' }
];

const props = defineProps({
  modelValue: { type: Boolean, default: false },
  rules: { type: Array, default: () => [] }
});

const emit = defineEmits(['update:modelValue']);

const isOpen = ref(props.modelValue);
const settings = ref({ ...HUD_DEFAULTS });

const hasStorage = () => typeof chrome !== 'undefined' && chrome.storage?.local;

const load = () => {
  if (!hasStorage()) return;
  chrome.storage.local.get([...Object.keys(HUD_DEFAULTS), 'siteAllowlist', 'siteBlocklist', 'siteErrors'], (result) => {
    settings.value = { ...HUD_DEFAULTS, ...result };
    hudSitesDraft.value = settings.value.hudSites;
    siteDrafts.value = { siteAllowlist: result.siteAllowlist || '', siteBlocklist: result.siteBlocklist || '' };
    siteErrors.value = result.siteErrors || {};
  });
};

// The HUD content script listens for storage changes, so open pages update right away.
const update = (key, value) => {
  settings.value[key] = value;
  if (hasStorage()) chrome.storage.local.set({ [key]: value });
};

const hudSitesDraft = ref('');

const SITE_LISTS = [
  {
    key: 'siteAllowlist',
    label: 'Only on these sites',
    description: 'Allowlist. Empty = every site.',
    placeholder: 'e.g. *.stage.example.com, localhost'
  },
  {
    key: 'siteBlocklist',
    label: 'Never on these sites',
    description: 'Blocklist, e.g. production.',
    placeholder: 'e.g. www.example.com, prod-*.example.com'
  }
];
const siteDrafts = ref({ siteAllowlist: '', siteBlocklist: '' });
// Problems Chrome reported when applying the blocklist (written by updateDNRRules).
const siteErrors = ref({});

const siteWarnings = computed(() => ({
  // Chrome can only limit rules to whole domains, so other wildcards don't work here.
  siteAllowlist: parseSiteList(siteDrafts.value.siteAllowlist)
    .filter(site => !isAllowlistSupported(site))
    .map(site => ({ pattern: site.pattern, message: 'ignored: here * only works at the start (*.example.com). Use the domain it ends with instead.' })),
  siteBlocklist: parseSiteList(siteDrafts.value.siteBlocklist)
    .filter(site => siteErrors.value[site.pattern])
    .map(site => ({ pattern: site.pattern, message: siteErrors.value[site.pattern] }))
}));

// Saved as typed; the background turns the lists into Chrome rules right away.
const saveSites = (key) => {
  const value = siteDrafts.value[key].trim();
  if (value === (settings.value[key] || '')) return;
  update(key, value);
  if (typeof chrome !== 'undefined' && chrome.runtime) chrome.runtime.sendMessage({ action: 'updateDNRRules' }).catch(() => {});
};

// Counts in the preview are made up; the HUD counts real requests on each page.
const EXAMPLE_COUNTS = [[12, 0], [3, 1], [0, 0], [7, 0], [0, 0]];
const EXAMPLE_REDIRECTS = [
  { id: 'a', name: 'My app', port: '3000', canEditPort: true, on: true },
  { id: 'b', name: 'API', port: '', canEditPort: true, on: true },
  { id: 'c', name: 'Assets', port: '9000', canEditPort: true, on: false }
];

// The same filtering as the HUD (src/inject/hud.js), over your redirects.
const previewRedirects = computed(() => {
  const own = props.rules
    .filter(rule => rule.type === 'normalOverride' && buildUrlMatch(rule))
    .map(rule => ({ id: rule.id, name: getRuleDisplayName(rule), port: getTargetPort(rule.replace), canEditPort: canEditRulePort(rule), on: !!rule.on }));
  const isExample = own.length === 0;
  const items = (isExample ? EXAMPLE_REDIRECTS : own)
    .map((item, index) => {
      const [count, failed] = item.on ? EXAMPLE_COUNTS[index % EXAMPLE_COUNTS.length] : [0, 0];
      return { ...item, count, failed };
    })
    .filter(item => (!settings.value.hudOnlyEnabled || item.on) && (!settings.value.hudOnlyUsed || item.count > 0));
  return { items, isExample };
});

// Pages fall back to the default spot when the saved position is removed.
const resetHudPosition = () => {
  if (hasStorage()) chrome.storage.local.remove('hudPosition');
};

const isSidePanelSupported = typeof chrome !== 'undefined' && !!chrome.sidePanel;
const isSidePanelOpen = ref(false);
let windowId = null;

const refreshSidePanelState = async () => {
  if (!isSidePanelSupported || windowId === null) return;
  const contexts = await chrome.runtime.getContexts({ contextTypes: ['SIDE_PANEL'], windowIds: [windowId] });
  isSidePanelOpen.value = contexts.length > 0;
};

// sidePanel.open() needs the click's user gesture, so it is called right away with a
// window id fetched in advance.
const setSidePanelOpen = (open) => {
  if (!isSidePanelSupported || windowId === null) return;
  isSidePanelOpen.value = open;
  if (open) {
    chrome.sidePanel.open({ windowId }).catch((err) => {
      console.error('Could not open the side panel:', err);
      isSidePanelOpen.value = false;
    });
  } else {
    chrome.runtime.sendMessage({ action: 'closeSidePanel', windowId }).catch(() => {});
  }
};

// The panel announces itself when it opens and closes (also via its own × button).
const onMessage = (msg) => {
  if (msg.action === 'sidePanelState' && msg.windowId === windowId) {
    isSidePanelOpen.value = msg.open;
  }
};

const onStorageChanged = (changes, area) => {
  if (area === 'local' && changes.siteErrors) siteErrors.value = changes.siteErrors.newValue || {};
};

onMounted(() => {
  if (hasStorage()) chrome.storage.onChanged.addListener(onStorageChanged);
  if (!isSidePanelSupported) return;
  chrome.runtime.onMessage.addListener(onMessage);
  chrome.windows.getCurrent((win) => {
    windowId = win.id;
    refreshSidePanelState();
  });
});

onBeforeUnmount(() => {
  if (hasStorage()) chrome.storage.onChanged.removeListener(onStorageChanged);
  if (isSidePanelSupported) chrome.runtime.onMessage.removeListener(onMessage);
});

watch(() => props.modelValue, (newVal) => {
  isOpen.value = newVal;
  if (newVal) {
    load();
    refreshSidePanelState();
  }
});

watch(isOpen, (newVal) => {
  emit('update:modelValue', newVal);
});

const close = () => {
  isOpen.value = false;
};

// Backdrop click and Esc close it (shared with the other modals).
const { onBackdropMousedown, onBackdropClick } = useModal(isOpen, close);
</script>
