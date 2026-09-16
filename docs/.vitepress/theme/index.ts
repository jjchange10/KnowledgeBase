// .vitepress/theme/index.ts
import DefaultTheme from 'vitepress/theme'
import './custom.css'
import SqlInjectionDemo from './components/SqlInjectionDemo.vue'
import XssDemo from './components/XssDemo.vue'
import CsrfDemo from './components/CsrfDemo.vue'
import IdorDemo from './components/IdorDemo.vue'
import type { Theme } from 'vitepress'

export default {
  ...DefaultTheme,
  enhanceApp({ app }) {
    app.component('SqlInjectionDemo', SqlInjectionDemo)
    app.component('XssDemo', XssDemo)
    app.component('CsrfDemo', CsrfDemo)
    app.component('IdorDemo', IdorDemo)
  },
} satisfies Theme
