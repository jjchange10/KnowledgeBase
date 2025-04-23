import { defineConfig } from 'vitepress'

// https://vitepress.dev/reference/site-config
export default defineConfig({
  lang: 'ja',
  title: "My Docs",
  base: '/KnowledgeBase/',
  description: "this is my docs",
  head: [
    ['meta', { name: 'keywords', content: 'vitepress, blog, docs' }],
    ['link', { rel: 'icon', href: './favicon.ico' }],
    ['link', { rel: 'stylesheet', href: 'https://fonts.googleapis.com/css2?family=Noto+Sans+JP&display=swap' }]
  ],
  
  themeConfig: {
    // https://vitepress.dev/reference/default-theme-config
    nav: [
      { text: 'Home', link: '/' },
      {
        text: 'Infrastracture',
        items: [
          { text: 'AWS', link: '/infrastracture/aws/' },
          { text: 'Kubernetes', link: '/infrastracture/kubernetes/' },
          { text: 'ArgoProject', link: '/infrastracture/argo' },
          { text: 'Terraform', link: '/infrastracture/terraform' },
          { text: 'GoogleCloud', link: '/infrastracture/googlecloud' },
          { text: 'Opentelemetry', link: '/infrastracture/opentelemetry' },
          { text: 'GitLab', link: '/infrastracture/gitlab' },
          { text: 'GitHub', link: '/infrastracture/github' }
          
          // {
          //   text: '高度なトピック',
          //   items: [
          //     { text: '概要', link: '/infrastracture/kubernetes/advanced/' },
          //     { text: 'セキュリティ', link: '/infrastracture/kubernetes/advanced/security' },
          //     { text: 'モニタリング', link: '/infrastracture/kubernetes/advanced/monitoring' }
          //   ]
          // }
        ]
      },
      {
        text: 'Language',
        items: [
          { text: 'Python', link: '/language/python' },
          { text: 'Java', link: '/language/java' },
          { text: 'Rust', link: '/language/rust' },
          { text: 'Go', link: '/language/go' },
          
        ]
      },
      {
        text: 'book',
        items: [
          { text: 'SRE', link: '/book/sre/' },
        ]
      }
    ],

    search: {
      provider: 'local',
      options: {
        locales: {
          root: {
            translations: {
              button: {
                buttonText: '検索',
                buttonAriaLabel: 'ドキュメントを検索'
              },
              modal: {
                noResultsText: '結果が見つかりませんでした',
                resetButtonTitle: 'クリア',
                footer: {
                  selectText: '選択',
                  navigateText: '移動',
                  closeText: '閉じる'
                }
              }
            }
          }
        }
      }
    },

    sidebar: {
      '/infrastracture/aws': [
        {
          text: 'AWS',
          collapsed: false,
          items: [
            { text: 'はじめに', link: '/infrastracture/aws/' },
            { text: 'IAM', link: '/infrastracture/aws/iam'},
            { text: 'ネットワーキング', link: '/infrastracture/aws/networking' },
            { text: 'lambda', link: '/infrastracture/aws/lambda' },
            { text: 'EKS', link: '/infrastracture/aws/eks' },
          ]
        }
      ],

      '/infrastracture/aws/eks': [
        {
          text: 'EKS',
          collapsed: false,
          items: [
            { text: 'はじめに', link: '/infrastracture/aws/eks/quickstart' },
          ]
        }
      ],

      '/infrastracture/kubernetes': [
        {
          text: 'Kubernetes',
          collapsed: false,
          items: [
            { text: 'はじめに', link: '/infrastracture/kubernetes/quickstart' },
            { text: 'Helm', link: '/infrastracture/kubernetes/helm' },
          ]
        }
      ],
      '/infrastracture/argo': [
        {
          text: 'ArgoProject',
          collapsed: false,
          items: [
            { text: 'ArgoCD', link: '/infrastracture/argo/argocd' },
            { text: 'ArgoWorkflows', link: '/infrastracture/argo/argoworkflows' },
            { text: 'ArgoEvents', link: '/infrastracture/argo/argevents' },
            { text: 'ArgoRollouts', link: '/infrastracture/argo/arrogollouts' },
          ]
        }
      ],
      '/infrastracture/argo/argocd': [
        {
          text: 'ArgoCD',
          collapsed: false,
          items: [
            { text: 'はじめに', link: '/infrastracture/argo/argocd/quick_launch' },
            { text: 'Architecture', link: '/infrastracture/argo/argocd/architecture' },
            { text: 'HTTPS化', link: '/infrastracture/argo/argocd/https' },
            { text: 'Helm Pluginの利用方法', link: '/infrastracture/argo/argocd/helm-plugin' },
            { text: 'Gitlab連携', link: '/infrastracture/argo/argocd/gitlab' },
            { text: 'App of Apps', link: '/infrastracture/argo/argocd/app-of-apps' },
          ]
        }
      ],
      '/infrastracture/terraform': [
        {
          text: 'Terraform',
          collapsed: false,
          items: [
            { text: 'はじめに', link: '/infrastracture/terraform' },
          ]
        }
      ],
      '/infrastracture/googlecloud': [
        {
          text: 'Google Cloud',
          collapsed: false,
          items: [
            { text: 'はじめに', link: '/infrastracture/googlecloud' },
          ]
        }
      ],
      '/infrastracture/opentelemetry': [
        {
          text: 'OpenTelemetry',
          collapsed: false,
          items: [
            { text: 'はじめに', link: '/infrastracture/opentelemetry' },
          ]
        }
      ],
      '/infrastracture/gitlab': [
        {
          text: 'GitLab',
          collapsed: false,
          items: [
            { text: 'はじめに', link: '/infrastracture/gitlab' },
          ]
        }
      ],
      '/infrastracture/github': [
        {
          text: 'GitHub',
          collapsed: false,
          items: [
            { text: 'はじめに', link: '/infrastracture/github' },
          ]
        }
      ],
      '/language/python': [
        {
          text: 'Python',
          collapsed: false,
          items: [
            { text: 'はじめに', link: '/language/python' },
          ]
        }
      ],
      '/language/java': [
        {
          text: 'Java',
          collapsed: false,
          items: [
            { text: 'はじめに', link: '/language/java' },
          ]
        }
      ],
      '/language/rust': [
        {
          text: 'Rust',
          collapsed: false,
          items: [
            { text: 'はじめに', link: '/language/rust' },
          ]
        }
      ],
      '/books/sre': [
        {
          text: 'SRE',
          collapsed: false,
          items: [
            { text: 'はじめに', link: '/books/sre/base' },
          ]
        }
      ]
    },

    socialLinks: [
      { 
        icon: 'github', link: 'https://github.com/jjchange10' }
    ],

  }
})
