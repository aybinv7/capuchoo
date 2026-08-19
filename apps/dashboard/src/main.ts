import { createApp } from 'vue'

import App from './App.vue'
import router from './router'

import i18n from './plugins/i18n.plugin'
import pinia from './plugins/pinia.plugin'
import { VueQueryPlugin } from './plugins/vue-query.plugin'

import './assets/styles/main.css'

const app = createApp(App)

app.use(router)
app.use(pinia)
app.use(i18n)
app.use(VueQueryPlugin)

app.mount('#app')
