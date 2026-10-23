<template>
  <!-- Settings for the rules as a whole: sync across computers, team presets and backups.
       The work happens in the background (src/extension/sync.js, presets.js, backups.js). -->
  <div class="space-y-8">
    <section>
      <h4 class="text-lg font-bold text-slate-900 mb-1">Sync</h4>
      <p class="text-slate-500 mb-4">
        Your rules and team preset links on every computer you're signed in to Chrome with. Chrome keeps about 100 KB for it,
        so very long file contents may not fit.
      </p>
      <div class="bg-white rounded-md border border-slate-200 divide-y divide-slate-200">
        <label class="flex items-center justify-between gap-4 px-4 py-3 cursor-pointer">
          <span>
            <span class="block font-semibold text-slate-800">Sync rules across your computers</span>
            <span class="block text-slate-500 text-[12px]">Turning it on where rules were already synced replaces this computer's rules; they're kept in Backups.</span>
          </span>
          <USwitch
            :model-value="syncEnabled"
            @update:model-value="setSyncEnabled"
            color="success"
            :ui="{ base: 'data-[state=unchecked]:bg-slate-400' }"
          />
        </label>
        <div v-if="syncEnabled" class="flex items-center justify-between gap-4 px-4 py-3">
          <span class="text-[12px]" :class="syncState.error ? 'text-red-600' : 'text-slate-500'">
            <template v-if="syncState.error">{{ syncState.error }}</template>
            <template v-else-if="syncState.lastSyncedAt">
              {{ syncState.direction === 'down' ? 'Updated from another computer' : 'Sent' }} {{ relativeTime(syncState.lastSyncedAt) }}
              · {{ Math.ceil((syncState.bytes || 0) / 1024) }} KB of about 100 KB
            </template>
            <template v-else>Not synced yet.</template>
          </span>
          <UButton variant="outline" color="neutral" size="sm" icon="i-lucide-refresh-cw" :loading="isSyncing" class="shrink-0" @click="syncNow">Sync now</UButton>
        </div>
      </div>
    </section>

    <section>
      <h4 class="text-lg font-bold text-slate-900 mb-1">Team presets</h4>
      <p class="text-slate-500 mb-4">
        Rules from a link your team keeps up to date (an export of Resourced, Resource Override, Requestly or Redirector).
        They're added to your rules and refreshed every hour; changes you make to them are replaced on refresh.
      </p>
      <form class="flex gap-2 mb-3" @submit.prevent="addPreset">
        <UInput v-model="presetUrl" placeholder="https://example.com/team-rules.json" size="sm" class="flex-1 font-mono" :disabled="isAddingPreset" />
        <UButton type="submit" color="primary" size="sm" icon="i-lucide-plus" :loading="isAddingPreset" :disabled="!presetUrl.trim()">Add</UButton>
      </form>
      <p v-if="presetError" class="mb-3 text-[12px] text-red-600">{{ presetError }}</p>
      <ul v-if="presets.length > 0" class="bg-white rounded-md border border-slate-200 divide-y divide-slate-200">
        <li v-for="preset in presets" :key="preset.url" class="flex items-center gap-3 px-4 py-2.5">
          <UIcon name="i-lucide-link" class="w-4 h-4 shrink-0 text-slate-400" />
          <span class="min-w-0 flex-1">
            <a :href="preset.url" target="_blank" rel="noopener" class="block truncate font-semibold text-slate-800 hover:underline" :title="preset.url">{{ preset.name }}</a>
            <span class="block text-[12px]" :class="preset.error ? 'text-red-600' : 'text-slate-500'">
              <template v-if="preset.error">{{ preset.error }}</template>
              <template v-else-if="preset.updatedAt">
                {{ preset.ruleCount }} rule{{ preset.ruleCount === 1 ? '' : 's' }}{{ preset.skipped ? ` (${preset.skipped} skipped)` : '' }} · updated {{ relativeTime(preset.updatedAt) }}
              </template>
              <template v-else>Loading…</template>
            </span>
          </span>
          <UButton variant="ghost" color="neutral" size="xs" icon="i-lucide-refresh-cw" title="Refresh now" :loading="refreshingUrl === preset.url" @click="refreshPreset(preset.url)" />
          <UButton variant="ghost" color="neutral" size="xs" icon="i-lucide-trash-2" title="Remove the preset and its rules" class="hover:text-red-600" @click="removePreset(preset.url)" />
        </li>
      </ul>
    </section>

    <section>
      <div class="flex items-end justify-between gap-4 mb-1">
        <h4 class="text-lg font-bold text-slate-900">Backups</h4>
        <UButton variant="outline" color="neutral" size="sm" icon="i-lucide-archive" :loading="isBackingUp" @click="backUpNow">Back up now</UButton>
      </div>
      <p class="text-slate-500 mb-4">
        Earlier versions of your rules: taken automatically before changes (at most every 10 minutes), and before an import,
        a restore or a sync. The last 30 are kept.
      </p>
      <p v-if="backups.length === 0" class="text-[12px] text-slate-400">No backups yet. One is made before your next change.</p>
      <ul v-else class="bg-white rounded-md border border-slate-200 divide-y divide-slate-200">
        <li v-for="backup in backups" :key="backup.id" class="flex items-center gap-3 px-4 py-2">
          <UIcon name="i-lucide-history" class="w-4 h-4 shrink-0 text-slate-400" />
          <span class="min-w-0 flex-1">
            <span class="block font-semibold text-slate-800">{{ new Date(backup.time).toLocaleString() }}</span>
            <span class="block text-[12px] text-slate-500">{{ backup.label }} · {{ backup.ruleCount }} rule{{ backup.ruleCount === 1 ? '' : 's' }}</span>
          </span>
          <template v-if="confirmingId === backup.id">
            <span class="text-[12px] text-slate-600">Replace your current rules?</span>
            <UButton color="primary" size="xs" :loading="restoringId === backup.id" @click="restore(backup.id)">Restore</UButton>
            <UButton variant="ghost" color="neutral" size="xs" @click="confirmingId = null">Cancel</UButton>
          </template>
          <template v-else>
            <UButton variant="ghost" color="neutral" size="xs" icon="i-lucide-rotate-ccw" @click="confirmingId = backup.id">Restore</UButton>
            <UButton variant="ghost" color="neutral" size="xs" icon="i-lucide-download" title="Download (can be imported)" @click="download(backup)" />
            <UButton variant="ghost" color="neutral" size="xs" icon="i-lucide-trash-2" title="Delete this backup" class="hover:text-red-600" @click="removeBackup(backup.id)" />
          </template>
        </li>
      </ul>
      <p v-if="restoredMessage" class="mt-2 text-[12px] text-primary-700">{{ restoredMessage }}</p>
    </section>
  </div>
</template>

<script setup>
import { ref, onMounted, onBeforeUnmount } from 'vue';
import { BACKUPS_INDEX_KEY, snapshotRules, restoreBackup, getBackup, deleteBackup } from '../composables/useBackups.js';

const PRESETS_KEY = 'rulePresets';
const SYNC_ENABLED_KEY = 'syncEnabled';
const SYNC_STATE_KEY = 'syncState';

const hasChrome = typeof chrome !== 'undefined' && !!chrome.storage?.local;

const send = (message) => new Promise(resolve => {
  if (!hasChrome) return resolve({});
  chrome.runtime.sendMessage(message, response => resolve(response || {}));
});

const relativeTime = (time) => {
  const seconds = Math.round((Date.now() - time) / 1000);
  if (seconds < 45) return 'just now';
  const minutes = Math.round(seconds / 60);
  if (minutes < 60) return `${minutes} min ago`;
  const hours = Math.round(minutes / 60);
  if (hours < 24) return `${hours} h ago`;
  return new Date(time).toLocaleDateString();
};

// Sync
const syncEnabled = ref(false);
const syncState = ref({});
const isSyncing = ref(false);

const setSyncEnabled = (value) => {
  syncEnabled.value = value;
  if (hasChrome) chrome.storage.local.set({ [SYNC_ENABLED_KEY]: value });
};

const syncNow = async () => {
  isSyncing.value = true;
  syncState.value = await send({ action: 'syncNow' });
  isSyncing.value = false;
};

// Team presets
const presets = ref([]);
const presetUrl = ref('');
const presetError = ref('');
const isAddingPreset = ref(false);
const refreshingUrl = ref('');

const addPreset = async () => {
  presetError.value = '';
  isAddingPreset.value = true;
  const result = await send({ action: 'presetAdd', url: presetUrl.value.trim() });
  isAddingPreset.value = false;
  if (result.error && !presets.value.some(preset => preset.url === presetUrl.value.trim())) presetError.value = result.error;
  else presetUrl.value = '';
};

const refreshPreset = async (url) => {
  refreshingUrl.value = url;
  await send({ action: 'presetRefresh', url });
  refreshingUrl.value = '';
};

const removePreset = (url) => send({ action: 'presetRemove', url });

// Backups
const backups = ref([]);
const isBackingUp = ref(false);
const confirmingId = ref(null);
const restoringId = ref(null);
const restoredMessage = ref('');

const backUpNow = async () => {
  isBackingUp.value = true;
  await snapshotRules('Manual');
  isBackingUp.value = false;
};

const restore = async (id) => {
  restoringId.value = id;
  const result = await restoreBackup(id);
  restoringId.value = null;
  confirmingId.value = null;
  restoredMessage.value = result.error ? result.error : `Restored ${result.ruleCount} rules. The rules from just before are the newest backup.`;
};

const download = async (backup) => {
  const { domains } = await getBackup(backup.id);
  if (!domains) return;
  const url = URL.createObjectURL(new Blob([JSON.stringify(domains, null, 2)], { type: 'application/json' }));
  const link = document.createElement('a');
  link.href = url;
  link.download = `resourced-backup-${new Date(backup.time).toISOString().slice(0, 16).replace(/[:T]/g, '-')}.json`;
  link.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
};

const removeBackup = (id) => deleteBackup(id);

const onStorageChanged = (changes, area) => {
  if (area !== 'local') return;
  if (changes[BACKUPS_INDEX_KEY]) backups.value = changes[BACKUPS_INDEX_KEY].newValue || [];
  if (changes[PRESETS_KEY]) presets.value = changes[PRESETS_KEY].newValue || [];
  if (changes[SYNC_STATE_KEY]) syncState.value = changes[SYNC_STATE_KEY].newValue || {};
  if (changes[SYNC_ENABLED_KEY]) syncEnabled.value = changes[SYNC_ENABLED_KEY].newValue === true;
};

onMounted(async () => {
  if (!hasChrome) return;
  chrome.storage.onChanged.addListener(onStorageChanged);
  const result = await chrome.storage.local.get([BACKUPS_INDEX_KEY, PRESETS_KEY, SYNC_ENABLED_KEY, SYNC_STATE_KEY]);
  backups.value = result[BACKUPS_INDEX_KEY] || [];
  presets.value = result[PRESETS_KEY] || [];
  syncEnabled.value = result[SYNC_ENABLED_KEY] === true;
  syncState.value = result[SYNC_STATE_KEY] || {};
});

onBeforeUnmount(() => {
  if (hasChrome) chrome.storage.onChanged.removeListener(onStorageChanged);
});
</script>
