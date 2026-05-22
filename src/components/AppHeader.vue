<template>
  <div class="bg-gradient-to-b from-primary-50 to-white px-6 py-4 flex justify-between items-center relative z-10">
      <div class="flex flex-1 items-center">
          <h1 class="m-0 text-[24px] font-extrabold tracking-tight text-slate-900" :class="!isExtensionOn && 'text-slate-400'">
            Resourced <span class="text-primary-500">v1</span>
          </h1>
      </div>
      <div class="flex flex-1 justify-end items-center gap-3" v-if="isExtensionOn !== null">
          <span class="text-xs font-bold uppercase tracking-wider" :class="isExtensionOn ? 'text-primary-600' : 'text-slate-400'">
            {{ isExtensionOn ? 'Active' : 'Disabled' }}
          </span>
          <USwitch :model-value="isExtensionOn" @update:model-value="toggleExtension" color="success" size="lg" />
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
            // chrome.action.setTitle({
            //     title: checked ? "Resource Override (ON)" : "Resource Override (OFF)"
            // });
            // chrome.action.setBadgeText({ text: checked ? "" : "OFF" });
            // chrome.action.setBadgeBackgroundColor({ color: checked ? "#22c55e" : "#94a3b8" });
            chrome.runtime.sendMessage({ action: "updateDNRRules" });
        });
    }
};
</script>
