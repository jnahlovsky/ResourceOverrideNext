<template>
  <UApp>
    <!-- Sized as a container so the layout follows the panel's own width. -->
    <div class="@container h-screen flex flex-col bg-slate-50 overflow-hidden">
      <!-- Header -->
      <header
        class="shrink-0 bg-linear-to-b to-white px-3 @max-2xs:px-2 py-2.5 flex items-center gap-2 border-b border-slate-200 transition-colors"
        :class="isExtensionOn ? 'from-primary-100' : 'from-slate-200'"
      >
        <img src="/icons/icon-48x48.png" alt="" class="w-5 h-5 shrink-0 transition-all" :class="!isExtensionOn && 'grayscale opacity-60'" />
        <span class="min-w-0 truncate text-[15px] font-extrabold tracking-tight @max-2xs:hidden" :class="isExtensionOn ? 'text-slate-900' : 'text-slate-400'">Resourced</span>
        <div class="flex-1"></div>
        <UButton
          variant="ghost"
          color="neutral"
          size="xs"
          :icon="isCompact ? 'i-lucide-unfold-vertical' : 'i-lucide-fold-vertical'"
          :title="isCompact ? 'Show details' : 'Compact list'"
          :aria-pressed="isCompact"
          class="shrink-0 text-slate-500 hover:text-slate-800"
          @click="toggleCompact"
        />
        <USwitch
          :model-value="isExtensionOn"
          @update:model-value="toggleExtension"
          color="success"
          size="sm"
          class="shrink-0"
          :ui="{ inactive: 'bg-slate-400' }"
          :aria-label="isExtensionOn ? 'Pause all rules' : 'Resume all rules'"
        />
      </header>

      <!-- Icon Tabs -->
      <nav role="tablist" aria-label="Rule types" class="shrink-0 flex bg-white border-b border-slate-200">
        <button
          v-for="group in RULE_GROUPS"
          :key="group.value"
          type="button"
          role="tab"
          :aria-selected="activeGroup === group.value"
          :aria-label="group.label"
          :title="group.label"
          @click="activeGroup = group.value"
          class="relative flex-1 min-w-0 flex items-center justify-center gap-1.5 py-2.5 transition-colors"
          :class="activeGroup === group.value ? 'text-primary-600' : 'text-slate-400 hover:text-slate-700'"
        >
          <UIcon :name="group.icon" class="w-[18px] h-[18px] shrink-0" />
          <span
            class="text-[10px] font-semibold leading-4 min-w-4 px-1 rounded-full tabular-nums @max-2xs:hidden"
            :class="activeGroup === group.value ? 'bg-primary-100 text-primary-700' : 'bg-slate-100 text-slate-500'"
          >{{ groupCounts[group.value] }}</span>
          <span v-if="activeGroup === group.value" class="absolute inset-x-3 @max-2xs:inset-x-1.5 bottom-0 h-[2px] rounded-full bg-primary-500"></span>
        </button>
      </nav>

      <!-- Rule List -->
      <main class="flex-1 overflow-y-auto p-2 @max-2xs:p-1.5 min-h-0">
        <div v-if="!isExtensionOn" class="mb-2 flex items-center gap-2 rounded-md bg-slate-200/70 px-3 py-2 text-[12px] text-slate-600">
          <UIcon name="i-lucide-pause" class="w-3.5 h-3.5 shrink-0" />
          <span class="truncate">All rules are paused.</span>
        </div>

        <div v-if="!isLoading && visibleRules.length === 0" class="flex flex-col items-center text-center gap-2 text-slate-400 py-12 px-3">
          <UIcon :name="activeGroupInfo.icon" class="w-7 h-7" />
          <span class="text-[12px]">No {{ activeGroupInfo.label.toLowerCase() }} yet.</span>
        </div>

        <ul v-else :class="isCompact ? 'space-y-1' : 'space-y-1.5'">
          <li
            v-for="rule in visibleRules"
            :key="rule.id"
            class="flex items-center bg-white rounded-md border border-slate-200 shadow-xs transition-opacity"
            :class="[
              isCompact ? 'gap-2 pl-2.5 pr-2 py-1.5' : 'gap-3 pl-3 pr-2.5 py-2 @max-2xs:gap-2 @max-2xs:pl-2 @max-2xs:pr-1.5',
              (!rule.on || !isExtensionOn) && 'opacity-60'
            ]"
            :title="`${getRuleDisplayName(rule)} · ${getRuleSummary(rule)}`"
          >
            <span
              class="w-1.5 h-1.5 rounded-full shrink-0 transition-colors @max-2xs:hidden"
              :class="rule.on && isExtensionOn ? 'bg-primary-500 ring-[3px] ring-primary-500/20' : 'bg-slate-300'"
            ></span>
            <div class="min-w-0 flex-1">
              <div class="flex items-center gap-1.5 min-w-0">
                <span class="min-w-0 truncate font-semibold text-slate-800" :class="isCompact ? 'text-[12px]' : 'text-[13px]'">{{ getRuleDisplayName(rule) }}</span>
                <span
                  v-if="getRulePort(rule)"
                  class="shrink-0 font-mono text-[10px] font-semibold leading-4 px-1.5 rounded bg-primary-100 text-primary-700"
                >:{{ getRulePort(rule) }}</span>
              </div>
              <div v-if="!isCompact" class="text-[11px] font-mono text-slate-400 truncate @max-xs:hidden">
                <span v-if="rule.type === 'fileOverride' || rule.type === 'fileInject'" class="font-sans font-medium text-slate-500">{{ getRuleTypeLabel(rule.type) }} · </span>{{ getRuleSummary(rule) }}
              </div>
            </div>
            <USwitch
              :model-value="rule.on"
              @update:model-value="(on) => toggleRule(rule, on)"
              color="success"
              size="sm"
              class="shrink-0"
              :ui="{ inactive: 'bg-slate-400' }"
              :aria-label="`Toggle ${getRuleDisplayName(rule)}`"
            />
          </li>
        </ul>
      </main>

      <!-- Footer -->
      <footer class="shrink-0 border-t border-slate-200 bg-white px-2 py-1.5">
        <UButton
          variant="ghost"
          color="neutral"
          size="sm"
          block
          icon="i-lucide-external-link"
          title="Open editor"
          class="text-slate-600 font-medium"
          @click="openEditor"
        >
          <span class="truncate @max-2xs:hidden">Open editor</span>
        </UButton>
      </footer>
    </div>
  </UApp>
</template>

<script setup>
import { ref, computed, onMounted, onBeforeUnmount } from 'vue';
import { useRules } from '../composables/useRules';
import { RULE_GROUPS, getRuleDisplayName, getRuleSummary, getRulePort, getRuleTypeLabel } from '../lib/ruleLabels.js';

const { globalDomain, isLoading, fetchDomains, saveDomain } = useRules();

const hasChrome = typeof chrome !== 'undefined' && !!chrome.runtime;

const activeGroup = ref('redirects');
const isExtensionOn = ref(true);
const windowId = ref(null);

const rules = computed(() => globalDomain.value?.rules || []);
const activeGroupInfo = computed(() => RULE_GROUPS.find(group => group.value === activeGroup.value));
const visibleRules = computed(() => rules.value.filter(rule => activeGroupInfo.value.types.includes(rule.type)));

// "enabled / total" per tab.
const groupCounts = computed(() => Object.fromEntries(RULE_GROUPS.map(group => {
  const groupRules = rules.value.filter(rule => group.types.includes(rule.type));
  const enabled = groupRules.filter(rule => rule.on).length;
  return [group.value, groupRules.length === 0 ? '0' : `${enabled}/${groupRules.length}`];
})));

// Compact rows: one line per rule, no details. Remembered per browser profile.
const COMPACT_KEY = 'resourced:sidepanel-compact';
const readCompact = () => {
  try {
    return localStorage.getItem(COMPACT_KEY) === 'true';
  } catch (e) {
    return false;
  }
};
const isCompact = ref(readCompact());
const toggleCompact = () => {
  isCompact.value = !isCompact.value;
  try {
    localStorage.setItem(COMPACT_KEY, String(isCompact.value));
  } catch (e) {
    // Storage unavailable; the choice just isn't remembered.
  }
};

const toggleRule = async (rule, on) => {
  rule.on = on;
  await saveDomain(globalDomain.value);
};

const toggleExtension = (checked) => {
  isExtensionOn.value = checked;
  if (!hasChrome) return;
  chrome.runtime.sendMessage({ action: 'setSetting', setting: 'isExtensionOn', value: checked ? 'true' : 'false' }, () => {
    chrome.runtime.sendMessage({ action: 'updateDNRRules' });
  });
};

const openEditor = () => {
  if (hasChrome) chrome.tabs.create({ url: chrome.runtime.getURL('index.html?tab=true') });
};

// Lets the Settings screen show whether the panel is open in its window.
const announce = (open) => {
  if (!hasChrome) return;
  chrome.runtime.sendMessage({ action: 'sidePanelState', open, windowId: windowId.value }).catch(() => {});
};

const onMessage = (msg) => {
  if (msg.action === 'dataUpdated') {
    fetchDomains();
  } else if (msg.action === 'closeSidePanel' && msg.windowId === windowId.value) {
    // Sent by the Settings toggle.
    window.close();
  }
};

const onStorageChanged = (changes, area) => {
  if (area === 'local' && changes.isExtensionOn) {
    isExtensionOn.value = changes.isExtensionOn.newValue !== 'false';
  }
};

const onPageHide = () => announce(false);

onMounted(async () => {
  if (!hasChrome) {
    fetchDomains();
    return;
  }
  chrome.runtime.onMessage.addListener(onMessage);
  chrome.storage.onChanged.addListener(onStorageChanged);
  window.addEventListener('pagehide', onPageHide);

  chrome.storage.local.get(['isExtensionOn'], (result) => {
    isExtensionOn.value = result.isExtensionOn !== 'false';
  });
  chrome.windows.getCurrent((win) => {
    windowId.value = win.id;
    announce(true);
  });
  fetchDomains();
});

onBeforeUnmount(() => {
  if (!hasChrome) return;
  chrome.runtime.onMessage.removeListener(onMessage);
  chrome.storage.onChanged.removeListener(onStorageChanged);
  window.removeEventListener('pagehide', onPageHide);
});
</script>
