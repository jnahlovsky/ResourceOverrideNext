<template>
  <div id="vue-root">
    <h1>Resource Override Next</h1>
    <div id="legacy-ui-container">
        <!-- Legacy DevToolsTab HTML will be injected here during hybrid phase -->
    </div>
  </div>
</template>

<script setup>
import { onMounted } from 'vue';
import $ from 'jquery';

onMounted(() => {
    console.log("Vue root mounted.");
    // In hybrid phase, we will load legacy scripts here.
});
</script>
<style>
/* Base styles */
body { font-family: sans-serif; }
</style>