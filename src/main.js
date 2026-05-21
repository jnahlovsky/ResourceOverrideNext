import { createApp } from 'vue'
import { createRouter, createWebHistory } from 'vue-router'
import ui from '@nuxt/ui/vue-plugin'
import App from './App.vue'
import './assets/legacy.css'

// Provide globals for legacy scripts
import $ from 'jquery';
window.$ = $;
window.jQuery = $;

// Note: Ace and Beautify might need specific imports depending on how legacy scripts expect them.

const app = createApp(App)
const router = createRouter({
  routes: [],
  history: createWebHistory()
})

app.use(router)
app.use(ui)
app.mount('#app')