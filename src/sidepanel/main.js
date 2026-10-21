import { createApp } from 'vue'
import { createRouter, createWebHashHistory } from 'vue-router'
import ui from '@nuxt/ui/vue-plugin'
import { connectDevReload } from '../extension/devReload.js'
import SidePanel from './SidePanel.vue'
import '../assets/main.css'

// popup.html reuses this entry and marks itself on <body>.
const app = createApp(SidePanel, { context: document.body.dataset.context || 'sidepanel' })
const router = createRouter({
  routes: [],
  history: createWebHashHistory()
})

app.use(router)
app.use(ui)
app.mount('#app')

// `npm run watch` only; null in other builds.
if (__DEV_RELOAD__) connectDevReload(__DEV_RELOAD__, { reloadPage: () => location.reload() })
