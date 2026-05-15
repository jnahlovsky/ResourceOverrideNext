import { createApp } from 'vue'
import App from './App.vue'
import './assets/legacy.css'

// Provide globals for legacy scripts
import $ from 'jquery';
window.$ = $;
window.jQuery = $;

// Note: Ace and Beautify might need specific imports depending on how legacy scripts expect them.

createApp(App).mount('#app')