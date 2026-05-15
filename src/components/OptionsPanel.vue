<template>
  <div id="helpAndOptions">
      <div class="optionsBtnContainer"><button id="optionsBtn" class="btn" @click.stop="toggleOptions">Options</button></div>
      <div class="helpBtnContainer"><button id="helpBtn" class="btn" @click.stop="toggleHelp">Help</button></div>

      <div id="optionsPopOver" v-show="showOptions">
          <div class="optionRow">
              <div class="optionText">Show DevTools Tab:</div>
              <div class="optionCheckbox"><input type="checkbox" id="showDevTools"></div>
          </div>
          <div class="optionRow">
              <div class="optionText" id="showSuggestionsText">Show Suggestions:</div>
              <div class="optionCheckbox"><input type="checkbox" id="showSuggestions"></div>
          </div>
          <div class="optionRow">
              <div class="optionText">Show Logs:</div>
              <div class="optionCheckbox"><input type="checkbox" id="showLogs"></div>
          </div>
          <div class="optionRow">
              <div class="left"><a id="saveRulesLink" href="#">Save Rules</a></div>
              <div class="right"><a id="loadRulesLink" href="#">Load Rules</a></div>
              <input type="file" class="fileInput" id="loadRulesInput">
          </div>
      </div>
  </div>
</template>
<script setup>
import { ref, onMounted, onUnmounted } from 'vue';
import $ from 'jquery';

const showOptions = ref(false);

const toggleOptions = () => {
    showOptions.value = !showOptions.value;
    $('#helpContent').parent().hide(); // Legacy overlay hide
};

const toggleHelp = () => {
    $('#helpContent').parent().toggle(); // Legacy overlay toggle
};

// Click outside to close
const closeOptions = (e) => {
    if (!$(e.target).closest('#helpAndOptions').length) {
        showOptions.value = false;
    }
};

onMounted(() => {
    window.addEventListener('click', closeOptions);
});

onUnmounted(() => {
    window.removeEventListener('click', closeOptions);
});
</script>
