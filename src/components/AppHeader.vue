<template>
  <div class="bg-[#f4f4f5] px-6 py-4 flex justify-between items-center relative z-10 border-b border-slate-200">
      <div class="flex flex-1 items-center">
          <h1 class="text-[#127db3] m-0 text-[22px] font-bold tracking-tight">Resourced</h1>
      </div>
      <div class="flex flex-1 justify-end items-center gap-2" v-if="isExtensionOn !== null">
          <span class="text-xs font-semibold uppercase tracking-wider" :class="isExtensionOn ? 'text-green-600' : 'text-slate-400'">
            {{ isExtensionOn ? 'ON' : 'OFF' }}
          </span>
          <USwitch :model-value="isExtensionOn" @update:model-value="toggleExtension" color="success" />
      </div>
  </div>
</template>

<script setup>
import { ref, onMounted } from 'vue';

const isExtensionOn = ref(null);

onMounted(() => {
    if (typeof chrome !== 'undefined' && chrome.runtime) {
        chrome.runtime.sendMessage({
            action: "getSetting",
            setting: "isExtensionOn"
        }, (data) => {
            isExtensionOn.value = data !== "false";
        });
    } else {
        isExtensionOn.value = true;
    }
});

const toggleExtension = (checked) => {
    isExtensionOn.value = checked;
    const newState = checked ? "true" : "false";

    if (typeof chrome !== 'undefined' && chrome.runtime) {
        chrome.runtime.sendMessage({
            action: "setSetting",
            setting: "isExtensionOn",
            value: newState
        }, () => {
            chrome.action.setTitle({
                title: checked ? "Resource Override (ON)" : "Resource Override (OFF)"
            });
            chrome.action.setBadgeText({ text: checked ? "" : "OFF" });
            chrome.action.setBadgeBackgroundColor({ color: checked ? "#22c55e" : "#94a3b8" });
            chrome.runtime.sendMessage({ action: "updateDNRRules" });
        });
    }
};
</script>
