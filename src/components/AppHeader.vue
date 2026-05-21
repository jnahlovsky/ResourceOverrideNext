<template>
  <div class="bg-[#f4f4f5] px-6 py-4 flex justify-between items-center relative z-10 border-b border-slate-200">
      <div class="flex-1">
          <!-- spacer -->
      </div>
      <div class="flex flex-1 justify-center items-center gap-3">
          <h1 class="text-[#2563eb] m-0 text-[22px] font-bold tracking-tight">Resource Override (MV3)</h1>
      </div>
      <div class="flex flex-1 justify-end items-center gap-2">
          <span class="text-xs font-semibold text-slate-500 uppercase tracking-wider">
            {{ isExtensionOn ? 'ON' : 'OFF' }}
          </span>
          <USwitch :model-value="isExtensionOn" @update:model-value="toggleExtension" />
      </div>
  </div>
</template>

<script setup>
import { ref, onMounted } from 'vue';

const isExtensionOn = ref(true);

onMounted(() => {
    if (typeof chrome !== 'undefined' && chrome.runtime) {
        chrome.runtime.sendMessage({
            action: "getSetting",
            setting: "isExtensionOn"
        }, (data) => {
            isExtensionOn.value = data !== "false";
        });
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
            chrome.action.setBadgeBackgroundColor({ color: "#FF0000" });
            chrome.runtime.sendMessage({ action: "updateDNRRules" });
        });
    }
};
</script>