<template>
  <div v-if="isOpen" class="fixed inset-0 z-[100] flex items-center justify-center bg-slate-900/50 backdrop-blur-sm">
    <div class="bg-white flex flex-col w-[750px] max-w-[90vw] h-[550px] max-h-[90vh] shadow-2xl rounded-xl overflow-hidden">
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
          <h4 class="text-lg font-bold text-slate-900 mb-1">Page HUD</h4>
          <p class="text-slate-500 mb-4">
            A small overlay at the top of every page that lists your URL redirects with their ports.
            Switch them on and off or change a port right there; drag it by its grip if it covers something.
          </p>

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
                :ui="{ inactive: 'bg-slate-400' }"
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
                :ui="{ inactive: 'bg-slate-400' }"
              />
            </label>
          </div>
        </section>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, watch, onMounted, onBeforeUnmount } from 'vue';

// Keep in sync with DEFAULTS in src/inject/hud.js.
const HUD_DEFAULTS = { hudEnabled: true, hudOpacity: 0.85 };

const props = defineProps({
  modelValue: { type: Boolean, default: false }
});

const emit = defineEmits(['update:modelValue']);

const isOpen = ref(props.modelValue);
const settings = ref({ ...HUD_DEFAULTS });

const hasStorage = () => typeof chrome !== 'undefined' && chrome.storage?.local;

const load = () => {
  if (!hasStorage()) return;
  chrome.storage.local.get(Object.keys(HUD_DEFAULTS), (result) => {
    settings.value = { ...HUD_DEFAULTS, ...result };
  });
};

// The HUD content script listens for storage changes, so open pages update right away.
const update = (key, value) => {
  settings.value[key] = value;
  if (hasStorage()) chrome.storage.local.set({ [key]: value });
};

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

onMounted(() => {
  if (!isSidePanelSupported) return;
  chrome.runtime.onMessage.addListener(onMessage);
  chrome.windows.getCurrent((win) => {
    windowId = win.id;
    refreshSidePanelState();
  });
});

onBeforeUnmount(() => {
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
</script>
