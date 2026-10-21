<template>
  <div v-if="isOpen" class="fixed inset-0 z-[100] flex items-center justify-center bg-slate-900/50 backdrop-blur-sm">
    <div class="bg-white flex flex-col w-[750px] max-w-[90vw] h-[550px] max-h-[90vh] shadow-2xl rounded-xl overflow-hidden">
      <!-- Header -->
    <div class="flex items-center justify-between px-6 py-4 border-b border-slate-200 shrink-0 bg-white">
      <h3 class="text-base font-semibold leading-6 text-slate-900 flex items-center gap-2">
        <UIcon name="i-lucide-book-open" class="w-5 h-5 text-primary-500" />
        Resourced Guide
      </h3>
      <UButton color="neutral" variant="ghost" icon="i-lucide-x" class="-my-1" @click="close" />
    </div>

    <!-- Content Area -->
    <div class="flex-1 overflow-y-auto p-8 bg-slate-50 text-[13px] text-slate-700 space-y-8">

      <section>
        <h4 class="text-lg font-bold text-slate-900 mb-2 border-b border-slate-200 pb-2">1. URL Redirects</h4>
        <p class="mb-3">Redirects network requests from one URL to another. Useful for testing local code on a production website.</p>
        <ul class="list-disc pl-5 space-y-2">
          <li><strong>Wildcard / Regex:</strong> Pick the pattern syntax with the switch in the card header. Switching converts the patterns for you where possible.</li>
          <li><strong>Wildcard:</strong> A substring where <code class="bg-slate-200 px-1 py-0.5 rounded text-[11px] font-mono text-slate-800">*</code> matches anything (e.g., <code class="bg-slate-200 px-1 py-0.5 rounded text-[11px] font-mono text-slate-800">example.com/api</code>). Use <code class="bg-slate-200 px-1 py-0.5 rounded text-[11px] font-mono text-slate-800">*</code> or <code class="bg-slate-200 px-1 py-0.5 rounded text-[11px] font-mono text-slate-800">**</code> in both fields to carry the matched part over (e.g. <code class="bg-slate-200 px-1 py-0.5 rounded text-[11px] font-mono text-slate-800">*/app/**</code> → <code class="bg-slate-200 px-1 py-0.5 rounded text-[11px] font-mono text-slate-800">http://localhost:8080/app/**</code>). Groups pair up by star count, in order.</li>
          <li><strong>Regex:</strong> A regular expression (e.g., <code class="bg-slate-200 px-1 py-0.5 rounded text-[11px] font-mono text-slate-800">https:\/\/example\.com\/(.*)</code>); use capture groups like <code class="bg-slate-200 px-1 py-0.5 rounded text-[11px] font-mono text-slate-800">$1</code> in the destination (e.g., <code class="bg-slate-200 px-1 py-0.5 rounded text-[11px] font-mono text-slate-800">http://localhost:8080/$1</code>).</li>
          <li><strong>Destination URL:</strong> The URL to redirect to. Its port is shown next to the rule name.</li>
        </ul>
      </section>

      <section>
        <h4 class="text-lg font-bold text-slate-900 mb-2 border-b border-slate-200 pb-2">2. Custom Headers</h4>
        <p class="mb-3">Add, modify, or remove HTTP headers for matched requests.</p>
        <ul class="list-disc pl-5 space-y-2">
          <li><strong>Source URL Pattern:</strong> The URL match criteria (supports Regex like above). Use <code class="bg-slate-200 px-1 py-0.5 rounded text-[11px] font-mono text-slate-800">*</code> to match all URLs.</li>
          <li><strong>Request Headers:</strong> Outgoing headers sent to the server. Use <em>Set</em> to add/overwrite, or <em>Remove</em> to strip them out.</li>
          <li><strong>Response Headers:</strong> Incoming headers from the server. Use <em>Set</em> to append new headers (e.g., adding CORS headers like <code class="bg-slate-200 px-1 py-0.5 rounded text-[11px] font-mono text-slate-800">Access-Control-Allow-Origin</code>).</li>
        </ul>
      </section>

      <section>
        <h4 class="text-lg font-bold text-slate-900 mb-2 border-b border-slate-200 pb-2">3. Inline & File Injection</h4>
        <p class="mb-3">Inject custom JavaScript or CSS directly into webpages, or override existing files.</p>
        <ul class="list-disc pl-5 space-y-4">
          <li>
            <strong>URL to File (File Override):</strong> Intercepts a network request for a specific file and responds with your custom code instead. <br>
            <span class="text-slate-500 italic mt-1 block">Example: Match <code class="bg-slate-200 px-1 py-0.5 rounded not-italic text-[11px] font-mono text-slate-800">styles.css</code>, click "File Content" and write your own CSS. The browser will load your CSS instead of the website's.</span>
          </li>
          <li>
            <strong>Inject File:</strong> Forces the browser to load your custom code into the page's DOM (Head or Body).
            <ul class="list-[circle] pl-5 mt-2 space-y-1">
              <li><strong>Inline vs Blob:</strong> By default, code is injected inline directly into the page. However, many sites block this due to strict Content Security Policies (CSP).</li>
              <li><strong>Bypass CSP:</strong> If you provide a <strong>File Name</strong> in the UI, the extension packages your code into an external "Blob" and links it to the page, effectively bypassing "unsafe-inline" CSP restrictions!</li>
            </ul>
          </li>
        </ul>
      </section>

      <section>
        <h4 class="text-lg font-bold text-slate-900 mb-2 border-b border-slate-200 pb-2">Tips & Tricks</h4>
        <ul class="list-disc pl-5 space-y-2">
          <li><strong>Live Editing:</strong> To develop locally without constantly pasting code into the extension, run a local server (e.g., <code class="bg-slate-200 px-1 py-0.5 rounded text-[11px] font-mono text-slate-800">npx serve</code>) and use a <strong>URL Redirect</strong> rule to point the production file to your localhost.</li>
          <li><strong>Domain Filters:</strong> Enable <em>Domain filters</em> in a card's <strong>⋮</strong> menu to limit a rule to some request domains or exclude others (comma separated, subdomains included), e.g. exclude <code class="bg-slate-200 px-1 py-0.5 rounded text-[11px] font-mono text-slate-800">localhost</code> so a redirect never re-applies to its own destination.</li>
          <li><strong>Page HUD:</strong> Your redirects are listed in a small overlay at the top of each page, where you can switch them on and off and click a port to change it; drag it by its grip to move it out of the way. Turn it off or change its opacity in <strong>Settings</strong>.</li>
          <li><strong>Master Switch:</strong> Use the toggle in the top right of the header to quickly disable all rules at once without deleting them.</li>
        </ul>
      </section>

    </div>
    </div>
  </div>
</template>

<script setup>
import { ref, watch } from 'vue';

const props = defineProps({
  modelValue: { type: Boolean, default: false }
});

const emit = defineEmits(['update:modelValue']);

const isOpen = ref(props.modelValue);

watch(() => props.modelValue, (newVal) => {
  isOpen.value = newVal;
});

watch(isOpen, (newVal) => {
  emit('update:modelValue', newVal);
});

const close = () => {
  isOpen.value = false;
};
</script>
