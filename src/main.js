import { createApp } from 'vue'
import { createRouter, createWebHashHistory } from 'vue-router'
import ui from '@nuxt/ui/vue-plugin'
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