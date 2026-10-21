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
        <SaveStatus compact class="shrink-0" />
        <div class="flex items-center gap-0.5 shrink-0">
          <UButton
            v-if="view === 'rules'"
            variant="ghost"
            color="neutral"
            size="xs"
            :icon="isExpandAll ? 'i-lucide-fold-vertical' : 'i-lucide-unfold-vertical'"
            :title="isExpandAll ? 'Back to one rule open at a time' : 'Open every rule for editing'"
            :aria-pressed="isExpandAll"
            :class="isExpandAll ? 'text-primary-600 hover:text-primary-700' : 'text-slate-500 hover:text-slate-800'"
            @click="toggleExpandAll"
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
          <!-- The activity log is a side panel view; from the popup it opens the panel. -->
          <UButton
            variant="ghost"
            color="neutral"
            size="xs"
            icon="i-lucide-square-terminal"
            :title="view === 'activity' ? 'Back to the rules' : 'Activity log'"
            :aria-pressed="view === 'activity'"
            :class="view === 'activity' ? 'text-primary-600 hover:text-primary-700' : 'text-slate-400 hover:text-slate-700'"
            @click="toggleActivity"
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
          <UButton
            variant="ghost"
            color="neutral"
            size="xs"
            icon="i-lucide-settings"
            title="Settings"
            class="text-slate-400 hover:text-slate-700"
            @click="openSettings"
          />
        </div>
        <USwitch
          :model-value="isExtensionOn"
          @update:model-value="toggleExtension"
          color="success"
          size="sm"
          class="shrink-0"
          :ui="{ base: 'data-[state=unchecked]:bg-slate-400' }"
          :aria-label="isExtensionOn ? 'Pause all rules' : 'Resume all rules'"
        />
      </header>

      <ActivityLog v-if="view === 'activity'" class="flex-1" :class="!isSidePanel && 'h-[540px]'" />

      <template v-else>
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

          <!-- Every tab's list sits in the same grid cell and only the active one is visible,
               so the area is as tall as the longest list and switching tabs doesn't resize it. -->
          <div class="grid">
            <section
              v-for="group in RULE_GROUPS"
              :key="group.value"
              role="tabpanel"
              :aria-label="group.label"
              :aria-hidden="activeGroup !== group.value"
              class="[grid-area:1/1] min-w-0"
              :class="activeGroup !== group.value && 'invisible'"
            >
              <div v-if="!isLoading && groupRules[group.value].length === 0" class="flex flex-col items-center text-center gap-2 text-slate-400 py-12 px-3">
                <UIcon :name="group.icon" class="w-7 h-7" />
                <span class="text-[12px]">No {{ group.label.toLowerCase() }} yet.</span>
              </div>

              <draggable
                v-else
                tag="ul"
                :model-value="groupRules[group.value]"
                @update:model-value="(list) => reorderGroup(group, list)"
                item-key="id"
                handle=".drag-handle"
                :animation="150"
                class="space-y-1"
              >
                <template #item="{ element: rule }">
                  <li class="group bg-white rounded-md border shadow-xs overflow-hidden transition-colors" :class="isExpanded(rule) ? 'border-slate-300' : 'border-slate-200'">
                    <!-- One line per rule; clicking it opens the rule's full fields below it, one
                         at a time, unless "open every rule" is on. -->
                    <div
                      class="flex items-center gap-1.5 pl-1 pr-2 py-1.5 transition-[opacity,background-color]"
                      :class="[
                        !isExpandAll && 'cursor-pointer',
                        // An open card's one-line header has the editor cards' grey and their
                        // filter / syntax controls; the fields follow on white (RuleCard bare).
                        isExpanded(rule) && 'bg-slate-200'
                      ]"
                      :title="`${getRuleDisplayName(rule)} · ${getRuleSummary(rule)}`"
                      @click="toggleExpanded(rule)"
                    >
                      <UIcon
                        name="i-lucide-grip-vertical"
                        class="drag-handle shrink-0 w-4 h-4 text-slate-400 hover:text-slate-600 cursor-grab active:cursor-grabbing"
                        title="Drag to reorder"
                        @click.stop
                      />
                      <!-- Switched-off rules fade their name, not the switch, which stays easy to see. -->
                      <div class="min-w-0 flex-1 transition-opacity" :class="(!rule.on || !isExtensionOn) && 'opacity-50'">
                        <!-- Name and port are editable in place: click, type, Enter (Esc cancels). -->
                        <div class="flex items-center gap-1.5 min-w-0">
                          <input
                            v-if="isEditing(rule, 'name')"
                            v-model="editDraft"
                            data-inline-edit
                            :placeholder="getRuleDisplayName(rule)"
                            aria-label="Rule name"
                            class="min-w-0 flex-1 text-[13px] font-semibold leading-5 text-slate-800 bg-white border border-primary-300 rounded px-1 -mx-1 outline-none"
                            @click.stop
                            @blur="commitEdit"
                            @keydown.enter.prevent="commitEdit"
                            @keydown.esc.prevent="cancelEdit"
                          />
                          <button
                            v-else
                            type="button"
                            class="min-w-0 truncate text-left cursor-text text-[13px] font-semibold leading-5 text-slate-800 hover:text-slate-950"
                            title="Click to rename"
                            @click.stop="startEdit(rule, 'name')"
                          >{{ getRuleDisplayName(rule) }}</button>

                          <UIcon
                            v-if="!isExpanded(rule) && hasActiveDomainFilters(rule)"
                            name="i-lucide-funnel"
                            class="shrink-0 w-3 h-3 text-slate-500"
                            title="Domain filters active"
                          />
                          <UIcon
                            v-if="rule.on && ruleErrors[rule.id]"
                            name="i-lucide-triangle-alert"
                            class="shrink-0 w-3.5 h-3.5 text-red-500"
                            :title="`Not applied: ${ruleErrors[rule.id]}`"
                          />
                          <UIcon
                            v-else-if="ruleIssues(rule).length > 0"
                            name="i-lucide-circle-alert"
                            class="shrink-0 w-3.5 h-3.5"
                            :class="ruleIssues(rule).some(issue => issue.level === 'error') ? 'text-red-500' : 'text-amber-500'"
                            :title="ruleIssues(rule).map(issue => issue.message).join('\n')"
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
                              @click.stop
                              @blur="commitEdit"
                              @keydown.enter.prevent="commitEdit"
                              @keydown.esc.prevent="cancelEdit"
                            />
                            <button
                              v-else-if="getRulePort(rule)"
                              type="button"
                              class="shrink-0 cursor-text font-mono text-[10px] font-semibold leading-4 px-1.5 rounded bg-primary-100 text-primary-700 hover:bg-primary-200 transition-colors"
                              :title="`Redirects to port ${getRulePort(rule)}. Click to change it.`"
                              @click.stop="startEdit(rule, 'port')"
                            >:{{ getRulePort(rule) }}</button>
                            <button
                              v-else
                              type="button"
                              class="shrink-0 cursor-text font-mono text-[10px] font-semibold leading-4 px-1.5 rounded border border-dashed border-slate-300 text-slate-400 opacity-0 group-hover:opacity-100 focus-visible:opacity-100 hover:text-slate-700 transition-opacity"
                              title="Add a port to the destination URL"
                              @click.stop="startEdit(rule, 'port')"
                            >+port</button>
                          </template>
                        </div>
                      </div>
                      <RuleControls
                        v-if="isExpanded(rule)"
                        class="shrink-0"
                        :rule="rule"
                        @update-options="(patch) => updateRuleOptions(rule, patch)"
                      />
                      <USwitch
                        :model-value="rule.on"
                        @update:model-value="(on) => toggleRule(rule, on)"
                        @click.stop
                        color="success"
                        size="sm"
                        class="shrink-0"
                        :ui="{ base: 'data-[state=unchecked]:bg-slate-400' }"
                        :aria-label="`Toggle ${getRuleDisplayName(rule)}`"
                      />
                      <button
                        type="button"
                        class="shrink-0 -mr-1 flex items-center justify-center w-6 h-6 rounded-md text-slate-500 enabled:hover:text-slate-700 disabled:opacity-40 transition-colors"
                        :class="isExpanded(rule) ? 'enabled:hover:bg-slate-300' : 'enabled:hover:bg-slate-100'"
                        :disabled="isExpandAll"
                        :aria-expanded="isExpanded(rule)"
                        :aria-label="`${isExpanded(rule) ? 'Hide' : 'Show'} the fields of ${getRuleDisplayName(rule)}`"
                        :title="isExpandAll ? 'Every rule stays open; turn it off in the header to collapse' : ''"
                        @click.stop="toggleExpanded(rule)"
                      >
                        <UIcon name="i-lucide-chevron-down" class="w-4 h-4 transition-transform" :class="isExpanded(rule) && 'rotate-180'" />
                      </button>
                    </div>

                    <div v-if="isExpanded(rule)">
                      <component
                        :is="RULE_EDITORS[rule.type]"
                        :rule="rule"
                        bare
                        @update="(updated) => updateRule(rule.id, updated)"
                        @edit-file="openEditor"
                      />
                    </div>
                  </li>
                </template>
              </draggable>
            </section>
          </div>
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
      </template>
    </div>
  </UApp>
</template>

<script setup>
import { ref, computed, watch, nextTick, onMounted, onBeforeUnmount } from 'vue';
import draggable from 'vuedraggable';
import RedirectRule from '../components/RedirectRule.vue';
import HeaderRule from '../components/HeaderRule.vue';
import FileOverrideRule from '../components/FileOverrideRule.vue';
import FileInjectRule from '../components/FileInjectRule.vue';
import { useRules } from '../composables/useRules';
import { useRuleErrors } from '../composables/useRuleErrors.js';
import ActivityLog from './ActivityLog.vue';
import RuleControls from '../components/RuleControls.vue';
import SaveStatus from '../components/SaveStatus.vue';
import { validateRule } from '../lib/ruleValidation.js';
import { RULE_GROUPS, getRuleDisplayName, getRuleSummary, getRulePort, canEditRulePort } from '../lib/ruleLabels.js';
import { setTargetPort, parsePortInput, getDomainFilters } from '../extension/urlPattern.js';

// Also the toolbar popup (popup.html): both are for quick on/off, the editor is for edits.
const props = defineProps({
  context: { type: String, default: 'sidepanel' }
});
const isSidePanel = props.context === 'sidepanel';

const { globalDomain, isLoading, fetchDomains, saveDomain } = useRules();
const { ruleErrors } = useRuleErrors();
const ruleIssues = (rule) => validateRule(rule);
const hasActiveDomainFilters = (rule) => {
  const { include, exclude } = getDomainFilters(rule);
  return include.length > 0 || exclude.length > 0;
};

const hasChrome = typeof chrome !== 'undefined' && !!chrome.runtime;

const activeGroup = ref('redirects');
const isExtensionOn = ref(null);
const windowId = ref(null);

const rules = computed(() => globalDomain.value?.rules || []);
const groupRules = computed(() => Object.fromEntries(RULE_GROUPS.map(group =>
  [group.value, rules.value.filter(rule => group.types.includes(rule.type))]
)));

// Same order handling as the editor: the dragged group goes after the other rules.
const reorderGroup = async (group, reordered) => {
  if (!globalDomain.value) return;
  const otherRules = rules.value.filter(rule => !group.types.includes(rule.type));
  globalDomain.value.rules = [...otherRules, ...reordered];
  await saveDomain(globalDomain.value);
};

// The editor's rule cards, without their header (the row has the name, port and switch).
const RULE_EDITORS = {
  normalOverride: RedirectRule,
  headerRule: HeaderRule,
  fileOverride: FileOverrideRule,
  fileInject: FileInjectRule
};

// Either one rule open at a time (accordion), or every rule open and staying open.
// The latter is remembered per browser profile.
const EXPAND_ALL_KEY = 'resourced:sidepanel-expand-all';
const readExpandAll = () => {
  try {
    return localStorage.getItem(EXPAND_ALL_KEY) === 'true';
  } catch (e) {
    return false;
  }
};
const isExpandAll = ref(readExpandAll());
const toggleExpandAll = () => {
  isExpandAll.value = !isExpandAll.value;
  try {
    localStorage.setItem(EXPAND_ALL_KEY, String(isExpandAll.value));
  } catch (e) {
    // Storage unavailable; the choice just isn't remembered.
  }
};

// The popup is as wide as Chrome allows while every rule is open, for room to edit, and
// the narrow list otherwise. Its size follows the page, so animating the page's width
// animates the popup. Opening it already wide doesn't animate. The width is on <html>, so
// a page scrollbar (on screens too short for the whole popup) narrows the content instead
// of pushing it past the edge.
const POPUP_WIDTH = 360;
const POPUP_WIDE_WIDTH = 800; // Chrome's maximum popup width
if (!isSidePanel) {
  const page = document.documentElement;
  page.style.width = `${isExpandAll.value ? POPUP_WIDE_WIDTH : POPUP_WIDTH}px`;
  watch(isExpandAll, (wide) => {
    page.style.transition = 'width 240ms cubic-bezier(0.2, 0, 0, 1)';
    page.style.width = `${wide ? POPUP_WIDE_WIDTH : POPUP_WIDTH}px`;
  });
}

const expandedId = ref(null);
const isExpanded = (rule) => isExpandAll.value || expandedId.value === rule.id;
const toggleExpanded = (rule) => {
  if (isExpandAll.value) return;
  expandedId.value = expandedId.value === rule.id ? null : rule.id;
};
watch(activeGroup, () => {
  expandedId.value = null;
});

// The open row's filter / syntax controls; its fields (RuleCard bare) follow the rule.
const updateRuleOptions = async (rule, patch) => {
  Object.assign(rule, patch);
  await saveDomain(globalDomain.value);
};

const updateRule = async (ruleId, updated) => {
  if (!globalDomain.value) return;
  const index = globalDomain.value.rules.findIndex(rule => rule.id === ruleId);
  if (index === -1) return;
  globalDomain.value.rules[index] = updated;
  await saveDomain(globalDomain.value);
};

// "enabled / total" per tab.
const groupCounts = computed(() => Object.fromEntries(RULE_GROUPS.map(group => {
  const groupRules = rules.value.filter(rule => group.types.includes(rule.type));
  const enabled = groupRules.filter(rule => rule.on).length;
  return [group.value, groupRules.length === 0 ? '0' : `${enabled}/${groupRules.length}`];
})));

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

// 'rules' or 'activity'. The side panel remembers it; the popup shows the activity log in
// the side panel, where there's room for it (or itself, where there's no side panel).
const VIEW_KEY = 'sidePanelView';
const view = ref('rules');
const toggleActivity = () => {
  if (isSidePanel || !isSidePanelSupported) {
    view.value = view.value === 'activity' ? 'rules' : 'activity';
    if (isSidePanel) chrome.storage.local.set({ [VIEW_KEY]: view.value });
    return;
  }
  // Both calls right away: sidePanel.open() needs the click's user gesture.
  chrome.storage.local.set({ [VIEW_KEY]: 'activity' });
  chrome.sidePanel.open({ windowId: windowId.value })
    .then(() => window.close())
    .catch((err) => console.error('Could not open the side panel:', err));
};
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

// Settings live in the editor; ?open=settings shows them when it loads (App.vue).
const openSettings = () => {
  if (hasChrome) chrome.tabs.create({ url: chrome.runtime.getURL('index.html?tab=true&open=settings') });
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
  if (isSidePanel && changes[VIEW_KEY]) view.value = changes[VIEW_KEY].newValue === 'activity' ? 'activity' : 'rules';
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
    chrome.storage.local.get(['isExtensionOn', 'hudEnabled', VIEW_KEY]),
    chrome.windows.getCurrent()
  ]);
  windowId.value = win.id;
  if (isSidePanelSupported && !isSidePanel) {
    const panels = await chrome.runtime.getContexts({ contextTypes: ['SIDE_PANEL'], windowIds: [win.id] });
    isSidePanelOpen.value = panels.length > 0;
  }
  isHudEnabled.value = settings.hudEnabled !== false;
  if (isSidePanel && settings[VIEW_KEY] === 'activity') view.value = 'activity';
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
