// .vitepress/theme/index.ts
import DefaultTheme from 'vitepress/theme'
import './custom.css'
import SqlInjectionDemo from './components/SqlInjectionDemo.vue'
import XssDemo from './components/XssDemo.vue'
import CsrfDemo from './components/CsrfDemo.vue'
import IdorDemo from './components/IdorDemo.vue'
import EncryptionDemo from './components/EncryptionDemo.vue'
import RsaDemo from './components/RsaDemo.vue'
import GvrExplorerDemo from './components/GvrExplorerDemo.vue'
import RequestPipelineDemo from './components/RequestPipelineDemo.vue'
import ReconcileLoopDemo from './components/ReconcileLoopDemo.vue'
import SchemeResolverDemo from './components/SchemeResolverDemo.vue'
import NamespaceShareDemo from './components/NamespaceShareDemo.vue'
import CgroupMemoryDemo from './components/CgroupMemoryDemo.vue'
import OverlayfsDemo from './components/OverlayfsDemo.vue'
import CriCallSequenceDemo from './components/CriCallSequenceDemo.vue'
import RuncLifecycleDemo from './components/RuncLifecycleDemo.vue'
import type { Theme } from 'vitepress'

export default {
  ...DefaultTheme,
  enhanceApp({ app }) {
    app.component('SqlInjectionDemo', SqlInjectionDemo)
    app.component('XssDemo', XssDemo)
    app.component('CsrfDemo', CsrfDemo)
    app.component('IdorDemo', IdorDemo)
    app.component('EncryptionDemo', EncryptionDemo)
    app.component('RsaDemo', RsaDemo)
    app.component('GvrExplorerDemo', GvrExplorerDemo)
    app.component('RequestPipelineDemo', RequestPipelineDemo)
    app.component('ReconcileLoopDemo', ReconcileLoopDemo)
    app.component('SchemeResolverDemo', SchemeResolverDemo)
    app.component('NamespaceShareDemo', NamespaceShareDemo)
    app.component('CgroupMemoryDemo', CgroupMemoryDemo)
    app.component('OverlayfsDemo', OverlayfsDemo)
    app.component('CriCallSequenceDemo', CriCallSequenceDemo)
    app.component('RuncLifecycleDemo', RuncLifecycleDemo)
  },
} satisfies Theme
