<template>
  <div class="main-header">
      <div class="header-left">
          <img src="../../icons/icon-48x48.png" alt="Icon" class="header-icon">
          <h1 class="main-title">Resource Override (MV3)</h1>
      </div>
      <div class="header-right">
          <div class="onoffswitch">
              <input type="checkbox" class="onoffswitch-checkbox" id="globalToggle" v-model="isExtensionOn" @change="toggleExtension" :class="{'no-transition': isInitialLoad}">
              <label class="onoffswitch-label" for="globalToggle" :class="{'no-transition': isInitialLoad}">
                  <span class="onoffswitch-inner">
                      <div class="onoffswitch-on">ON</div>
                      <div class="onoffswitch-off">OFF</div>
                  </span>
                  <span class="onoffswitch-switch"></span>
              </label>
          </div>
      </div>
  </div>
</template>

<script setup>
import { ref, onMounted } from 'vue';

const isExtensionOn = ref(true);
const isInitialLoad = ref(true);

onMounted(() => {
    // Initialize toggle state from background
    chrome.runtime.sendMessage({
        action: "getSetting",
        setting: "isExtensionOn"
    }, (data) => {
        isExtensionOn.value = data !== "false";
        
        // Remove no-transition class slightly after rendering to allow state to settle without animation
        setTimeout(() => {
            isInitialLoad.value = false;
        }, 50);
    });
});

const toggleExtension = () => {
    const newState = isExtensionOn.value ? "true" : "false";

    chrome.runtime.sendMessage({
        action: "setSetting",
        setting: "isExtensionOn",
        value: newState
    }, () => {
        chrome.action.setTitle({
            title: isExtensionOn.value ? "Resource Override (ON)" : "Resource Override (OFF)"
        });
        chrome.action.setBadgeText({ text: isExtensionOn.value ? "" : "OFF" });
        chrome.action.setBadgeBackgroundColor({ color: "#FF0000" });
        chrome.runtime.sendMessage({ action: "updateDNRRules" });
    });
};
</script>

<style scoped>
.main-header {
  background-color: #f5f6f8;
  padding: 16px 20px;
  display: flex;
  justify-content: space-between;
  align-items: center;
  border-bottom: 1px solid #e2e8f0;
}

.header-left {
  display: flex;
  align-items: center;
  gap: 12px;
}

.header-icon {
  width: 24px;
  height: 24px;
}

.main-title {
  color: #2b6cb0;
  margin: 0;
  font-size: 20px;
}

/* Prevent animation on load */
.no-transition,
.no-transition::before,
.no-transition::after,
.no-transition *,
.no-transition *::before,
.no-transition *::after {
    transition: none !important;
}

/* Local copy of the specific scaled toggle CSS for the header */
.onoffswitch {
    width: 60px;
    position: relative;
    user-select: none;
}
.onoffswitch-checkbox {
    display: none !important;
}
.onoffswitch-label {
    display: block;
    overflow: hidden;
    cursor: pointer;
    border: 2px solid #999999;
    border-radius: 20px;
    margin: 0;
}
.onoffswitch-inner {
    display: block;
    width: 200%;
    margin-left: -100%;
    transition: margin 0.3s ease-in 0s;
}
.onoffswitch-inner > div {
    display: block;
    float: left;
    width: 50%;
    height: 20px;
    padding: 0;
    line-height: 20px;
    font-size: 10px;
    color: white;
    font-family: Trebuchet, Arial, sans-serif;
    font-weight: bold;
    box-sizing: border-box;
}
.onoffswitch-inner .onoffswitch-on {
    background-color: #34A7C1;
    color: #FFFFFF;
    padding-left: 10px;
    text-align: left;
}
.onoffswitch-inner .onoffswitch-off {
    background-color: #EEEEEE;
    color: #999999;
    padding-right: 10px;
    text-align: right;
}
.onoffswitch-switch {
    display: block;
    width: 14px;
    margin: 3px;
    background: #FFFFFF;
    position: absolute;
    top: 0;
    bottom: 0;
    right: 36px;
    border: 2px solid #999999;
    border-radius: 20px;
    transition: all 0.3s ease-in 0s; 
}
.onoffswitch-checkbox:checked + .onoffswitch-label .onoffswitch-inner {
    margin-left: 0;
}
.onoffswitch-checkbox:checked + .onoffswitch-label .onoffswitch-switch {
    right: 0px; 
}
</style>