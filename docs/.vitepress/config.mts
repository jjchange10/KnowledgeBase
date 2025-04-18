import { defineConfig } from 'vitepress'

// https://vitepress.dev/reference/site-config
export default defineConfig({
  title: "My Knowledge DataBase",
  base: '/KnowledgeBase/',
  description: "this is my database",
  head: [
  ['meta', { name: 'keywords', content: 'vitepress, blog, docs' }],
  ['link', { rel: 'icon', href: './favicon.ico' }]
  ],
  themeConfig: {
    // https://vitepress.dev/reference/default-theme-config
    nav: [
      { text: 'Home', link: '/' },
      { text: 'Examples', link: '/markdown-examples' }
    ],

    sidebar: [
      {
        text: 'Examples',
        items: [
          { text: 'Markdown Examples', link: '/markdown-examples' },
          { text: 'Runtime API Examples', link: '/api-examples' }
        ]
      }
    ],

    socialLinks: [
      { 
        icon: 'github', link: 'https://github.com/jjchange10' }
    ],

  }
})
