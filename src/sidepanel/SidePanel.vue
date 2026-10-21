<template>
  <UApp>
    <!-- Sized as a container so the layout follows the panel's own width. Waits for the
         header's on/off states, so its controls don't animate from guessed values.
         The popup grows with its rules up to Chrome's 600px popup limit, then the list scrolls. -->
    <div v-if="isExtensionOn !== null" class="@container flex flex-col bg-slate-50 overflow-hidden" :class="isSidePanel ? 'h-full' : 'max-h-[600px]'">
      <!-- Header -->
      <header
        class="shrink-0 bg-linear-to-b to-white px-3 @max-2xs:px-2 py-2.5 flex items-center gap-2 border-b border-slate-200 transition-colors"
        :class="isExtensionOn ? 'from-primary-100' : 'from-slate-200'"
      >
        <img src="/icons/icon-48x48.png" alt="" class="w-5 h-5 shrink-0 transition-all" :class="!isExtensionOn && 'grayscale opacity-60'" />
        <span class="min-w-0 truncate text-[15px] font-extrabold tracking-tight @max-2xs:hidden" :class="isExtensionOn ? 'text-slate-900' : 'text-slate-400'">Resourced</span>
        <div class="flex-1"></div>
        <div class="flex items-center gap-0.5 shrink-0">
          <UButton
            variant="ghost"
            color="neutral"
            size="xs"
            :icon="isCompact ? 'i-lucide-unfold-vertical' : 'i-lucide-fold-vertical'"
            :title="isCompact ? 'Show details' : 'Compact list'"
            :aria-pressed="isCompact"
            class="text-slate-500 hover:text-slate-800"
            @click="toggleCompact"
          />
          <!-- Page HUD on/off; same setting as in the editor's Settings. -->
          <UButton
            variant="ghost"
            color="neutral"
            size="xs"
            icon="i-lucide-panel-top"
            :title="isHudEnabled ? 'Hide the page HUD' : 'Show the page HUD'"
            :aria-pressed="isHudEnabled"
            :class="isHudEnabled ? 'text-primary-600 hover:text-primary-700' : 'text-slate-400 hover:text-slate-700'"
            @click="toggleHud"
          />
          <!-- Opens the side panel from the popup, or closes it. -->
          <UButton
            v-if="isSidePanelSupported"
            variant="ghost"
            color="neutral"
            size="xs"
            :icon="isSidePanelOpen ? 'i-lucide-panel-right-close' : 'i-lucide-panel-right-open'"
            :title="isSidePanelOpen ? 'Close the side panel' : 'Open in the side panel'"
            :aria-pressed="isSidePanelOpen"
            :class="isSidePanelOpen ? 'text-primary-600 hover:text-primary-700' : 'text-slate-400 hover:text-slate-700'"
            @click="toggleSidePanel"
          />
        </div>
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
        <!-- Slides down from the top while its row opens (0fr -> 1fr), so the list below
             moves smoothly instead of jumping. Not animated when the panel opens paused. -->
        <Transition
          enter-active-class="transition-all duration-200 ease-out"
          enter-from-class="grid-rows-[0fr] opacity-0 -translate-y-2"
          enter-to-class="grid-rows-[1fr]"
          leave-active-class="transition-all duration-150 ease-in"
          leave-from-class="grid-rows-[1fr]"
          leave-to-class="grid-rows-[0fr] opacity-0 -translate-y-2"
        >
          <div v-if="!isExtensionOn" class="grid">
            <div class="min-h-0 overflow-hidden">
              <div class="mb-2 flex items-center gap-2 rounded-md bg-slate-200/70 px-3 py-2 text-[12px] text-slate-600">
                <UIcon name="i-lucide-pause" class="w-3.5 h-3.5 shrink-0" />
                <span class="truncate">All rules are paused.</span>
              </div>
            </div>
          </div>
        </Transition>

        <div v-if="!isLoading && visibleRules.length === 0" class="flex flex-col items-center text-center gap-2 text-slate-400 py-12 px-3">
          <UIcon :name="activeGroupInfo.icon" class="w-7 h-7" />
          <span class="text-[12px]">No {{ activeGroupInfo.label.toLowerCase() }} yet.</span>
        </div>

        <ul v-else :class="isCompact ? 'space-y-1' : 'space-y-1.5'">
          <li
            v-for="rule in visibleRules"
            :key="rule.id"
            class="group flex items-center bg-white rounded-md border border-slate-200 shadow-xs transition-opacity"
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
              <!-- Name and port are editable in place: click, type, Enter (Esc cancels). -->
              <div class="flex items-center gap-1.5 min-w-0">
                <input
                  v-if="isEditing(rule, 'name')"
                  v-model="editDraft"
                  data-inline-edit
                  :placeholder="getRuleDisplayName(rule)"
                  aria-label="Rule name"
                  class="min-w-0 flex-1 font-semibold leading-5 text-slate-800 bg-white border border-primary-300 rounded px-1 -mx-1 outline-none"
                  :class="isCompact ? 'text-[12px]' : 'text-[13px]'"
                  @blur="commitEdit"
                  @keydown.enter.prevent="commitEdit"
                  @keydown.esc.prevent="cancelEdit"
                />
                <button
                  v-else
                  type="button"
                  class="min-w-0 truncate text-left cursor-text font-semibold leading-5 text-slate-800 hover:text-slate-950"
                  :class="isCompact ? 'text-[12px]' : 'text-[13px]'"
                  title="Click to rename"
                  @click="startEdit(rule, 'name')"
                >{{ getRuleDisplayName(rule) }}</button>

                <UIcon
                  v-if="rule.on && ruleErrors[rule.id]"
                  name="i-lucide-triangle-alert"
                  class="shrink-0 w-3.5 h-3.5 text-red-500"
                  :title="`Not applied: ${ruleErrors[rule.id]} Open the editor to fix it.`"
                />
                <template v-if="canEditRulePort(rule)">
                  <input
                    v-if="isEditing(rule, 'port')"
                    v-model="editDraft"
                    data-inline-edit
                    inputmode="numeric"
                    maxlength="5"
                    placeholder="port"
                    aria-label="Destination port"
                    class="shrink-0 w-[7ch] font-mono text-[10px] font-semibold leading-4 px-1 rounded bg-white border border-primary-300 text-primary-700 outline-none"
                    @blur="commitEdit"
                    @keydown.enter.prevent="commitEdit"
                    @keydown.esc.prevent="cancelEdit"
                  />
                  <button
                    v-else-if="getRulePort(rule)"
                    type="button"
                    class="shrink-0 cursor-text font-mono text-[10px] font-semibold leading-4 px-1.5 rounded bg-primary-100 text-primary-700 hover:bg-primary-200 transition-colors"
                    :title="`Redirects to port ${getRulePort(rule)}. Click to change it.`"
                    @click="startEdit(rule, 'port')"
                  >:{{ getRulePort(rule) }}</button>
                  <button
                    v-else
                    type="button"
                    class="shrink-0 cursor-text font-mono text-[10px] font-semibold leading-4 px-1.5 rounded border border-dashed border-slate-300 text-slate-400 opacity-0 group-hover:opacity-100 focus-visible:opacity-100 hover:text-slate-700 transition-opacity"
                    title="Add a port to the destination URL"
                    @click="startEdit(rule, 'port')"
                  >+port</button>
                </template>
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
import { ref, computed, nextTick, onMounted, onBeforeUnmount } from 'vue';
import { useRules } from '../composables/useRules';
import { useRuleErrors } from '../composables/useRuleErrors.js';
import { RULE_GROUPS, getRuleDisplayName, getRuleSummary, getRulePort, getRuleTypeLabel, canEditRulePort } from '../lib/ruleLabels.js';
import { setTargetPort, parsePortInput } from '../extension/urlPattern.js';

// Also the toolbar popup (popup.html): both are for quick on/off, the editor is for edits.
const props = defineProps({
  context: { type: String, default: 'sidepanel' }
});
const isSidePanel = props.context === 'sidepanel';

const { globalDomain, isLoading, fetchDomains, saveDomain } = useRules();
const { ruleErrors } = useRuleErrors();

const hasChrome = typeof chrome !== 'undefined' && !!chrome.runtime;

const activeGroup = ref('redirects');
const isExtensionOn = ref(null);
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

// Quick edits of a rule's name or destination port; everything else is in the editor.
const editing = ref(null); // { id, field: 'name' | 'port' }
const editDraft = ref('');

const isEditing = (rule, field) => editing.value?.id === rule.id && editing.value.field === field;

const startEdit = (rule, field) => {
  editing.value = { id: rule.id, field };
  editDraft.value = field === 'name' ? (rule.name || '') : getRulePort(rule);
  nextTick(() => document.querySelector('[data-inline-edit]')?.select());
};

const cancelEdit = () => {
  editing.value = null;
};

const commitEdit = async () => {
  if (!editing.value) return;
  const { id, field } = editing.value;
  editing.value = null;
  // Looked up again: the list may have been reloaded while typing.
  const rule = rules.value.find(r => r.id === id);
  if (!rule) return;
  if (field === 'name') {
    const name = editDraft.value.trim();
    if (name === (rule.name || '')) return;
    rule.name = name;
  } else {
    const port = parsePortInput(editDraft.value);
    if (port === null || port === getRulePort(rule)) return;
    rule.replace = setTargetPort(rule.replace, port);
  }
  await saveDomain(globalDomain.value);
};

const toggleExtension = (checked) => {
  isExtensionOn.value = checked;
  if (!hasChrome) return;
  chrome.runtime.sendMessage({ action: 'setSetting', setting: 'isExtensionOn', value: checked ? 'true' : 'false' }, () => {
    chrome.runtime.sendMessage({ action: 'updateDNRRules' });
  });
};

const isHudEnabled = ref(true);
const toggleHud = () => {
  isHudEnabled.value = !isHudEnabled.value;
  // Open pages pick this up from storage (src/inject/hud.js).
  if (hasChrome) chrome.storage.local.set({ hudEnabled: isHudEnabled.value });
};

const isSidePanelSupported = hasChrome && !!chrome.sidePanel;
const isSidePanelOpen = ref(isSidePanel);

// sidePanel.open() needs the click's user gesture, so it uses the window id fetched on mount.
const toggleSidePanel = () => {
  if (isSidePanel) {
    window.close();
  } else if (isSidePanelOpen.value) {
    chrome.runtime.sendMessage({ action: 'closeSidePanel', windowId: windowId.value }).catch(() => {});
    isSidePanelOpen.value = false;
  } else {
    // The panel shows the same list, so the popup makes way for it.
    chrome.sidePanel.open({ windowId: windowId.value })
      .then(() => window.close())
      .catch((err) => console.error('Could not open the side panel:', err));
  }
};

const openEditor = () => {
  if (hasChrome) chrome.tabs.create({ url: chrome.runtime.getURL('index.html?tab=true') });
};

// Lets the Settings screen show whether the panel is open in its window.
const announce = (open) => {
  if (!hasChrome || !isSidePanel) return;
  chrome.runtime.sendMessage({ action: 'sidePanelState', open, windowId: windowId.value }).catch(() => {});
};

const onMessage = (msg) => {
  if (msg.action === 'dataUpdated') {
    fetchDomains();
  } else if (isSidePanel && msg.action === 'closeSidePanel' && msg.windowId === windowId.value) {
    // Sent by the Settings toggle or the popup.
    window.close();
  } else if (!isSidePanel && msg.action === 'sidePanelState' && msg.windowId === windowId.value) {
    isSidePanelOpen.value = msg.open;
  }
};

const onStorageChanged = (changes, area) => {
  if (area !== 'local') return;
  if (changes.isExtensionOn) isExtensionOn.value = changes.isExtensionOn.newValue !== 'false';
  if (changes.hudEnabled) isHudEnabled.value = changes.hudEnabled.newValue !== false;
};

const onPageHide = () => announce(false);

onMounted(async () => {
  if (!hasChrome) {
    isExtensionOn.value = true;
    fetchDomains();
    return;
  }
  chrome.runtime.onMessage.addListener(onMessage);
  chrome.storage.onChanged.addListener(onStorageChanged);
  window.addEventListener('pagehide', onPageHide);

  fetchDomains();
  const [settings, win] = await Promise.all([
    chrome.storage.local.get(['isExtensionOn', 'hudEnabled']),
    chrome.windows.getCurrent()
  ]);
  windowId.value = win.id;
  if (isSidePanelSupported && !isSidePanel) {
    const panels = await chrome.runtime.getContexts({ contextTypes: ['SIDE_PANEL'], windowIds: [win.id] });
    isSidePanelOpen.value = panels.length > 0;
  }
  isHudEnabled.value = settings.hudEnabled !== false;
  // Set last: the header renders once this is known.
  isExtensionOn.value = settings.isExtensionOn !== 'false';
  announce(true);
});

onBeforeUnmount(() => {
  if (!hasChrome) return;
  chrome.runtime.onMessage.removeListener(onMessage);
  chrome.storage.onChanged.removeListener(onStorageChanged);
  window.removeEventListener('pagehide', onPageHide);
});
</script>
