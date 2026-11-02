declare const process: { env: Record<string, string | undefined> }

export default defineNuxtConfig({
    compatibilityDate: '2026-10-10',
    modules: [(_options, nuxt) => {
        // Nuxt adds an optional vue-router Volar route-block plugin that is not exported by the installed Vue Router 4 build.
        nuxt.hook('modules:done', () => {
            nuxt.hook('prepare:types', ({tsConfig}) => {
                const vueOptions = tsConfig.vueCompilerOptions ?? {}
                const plugins = vueOptions.plugins
                if (Array.isArray(plugins)) vueOptions.plugins = plugins.filter(plugin => plugin !== 'vue-router/volar/sfc-route-blocks')
                tsConfig.vueCompilerOptions = vueOptions
            })
        })
    }, '@pinia/nuxt'],
    css: ['~/assets/css/main.css'],
    runtimeConfig: {
        public: {
            apiBase: process.env.NUXT_PUBLIC_API_BASE || 'http://localhost:8010/api',
            recaptchaSiteKey: '',
        },
    },
    app: {
        head: {
            htmlAttrs: {lang: 'fa', dir: 'rtl'},
            titleTemplate: '%s | دکتر الهام سلیمی',
            meta: [{
                name: 'viewport',
                content: 'width=device-width, initial-scale=1, viewport-fit=cover'
            }, {name: 'theme-color', content: '#f8faf8'}],
            link: [{rel: 'manifest', href: '/manifest.webmanifest'}, {
                rel: 'icon',
                type: 'image/png',
                href: '/images/logo.png'
            }],
            script: [{
                id: 'appearance-init',
                innerHTML: `try{const m=localStorage.getItem('appearance-mode');const d=m==='dark'||(m!=='light'&&matchMedia('(prefers-color-scheme: dark)').matches);document.documentElement.dataset.theme=d?'dark':'light';document.documentElement.style.colorScheme=d?'dark':'light'}catch{}`
            }],
        }
    }
})
