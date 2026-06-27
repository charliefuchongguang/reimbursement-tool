// Polyfill: Uint8Array.prototype.toHex / toBase64
// pdfjs-dist 5.7+ 内部使用了 TC39 Uint8Array hex/base64 提案的方法，
// 该特性仅在 Chrome 140+/Firefox 145+ 等较新浏览器中原生支持，
// 在较旧浏览器中会抛出 "hashOriginal.toHex is not a function" 错误。
if (typeof Uint8Array.prototype.toHex !== 'function') {
  Uint8Array.prototype.toHex = function () {
    let s = ''
    for (let i = 0; i < this.length; i++) {
      s += this[i].toString(16).padStart(2, '0')
    }
    return s
  }
}
if (typeof Uint8Array.prototype.toBase64 !== 'function') {
  Uint8Array.prototype.toBase64 = function () {
    let s = ''
    for (let i = 0; i < this.length; i++) {
      s += String.fromCharCode(this[i])
    }
    return btoa(s)
  }
}

import { createApp } from 'vue'
import ElementPlus from 'element-plus'
import 'element-plus/dist/index.css'
import { createPinia } from 'pinia'
import App from './App.vue'

const app = createApp(App)
app.use(ElementPlus)
app.use(createPinia())
app.mount('#app')
