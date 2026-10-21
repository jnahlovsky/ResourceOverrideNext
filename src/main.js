import { createApp } from 'vue'
import { createRouter, createWebHashHistory } from 'vue-router'
import ui from '@nuxt/ui/vue-plugin'
import { installTooltips } from './lib/tooltips.js'
import { connectDevReload } from './extension/devReload.js'
import App from './App.vue'
import './assets/main.css'

const app = createApp(App)
const router = createRouter({
  routes: [],
  history: createWebHashHistory()
})

app.use(router)
app.use(ui)
app.mount('#app')
installTooltips()

// `npm run watch` only; null in other builds.
if (__DEV_RELOAD__) connectDevReload(__DEV_RELOAD__, { reloadPage: () => location.reload() })
