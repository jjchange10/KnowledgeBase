# App of Apps
## 背景
ArgoCDでは、複数のアプリケーションを管理する際に、それぞれのアプリケーションを個別に定義・管理することができます。
しかし、アプリケーションの数が増えてくると、管理が煩雑になってきます。
そこで、App of Appsパターンを使用することで、複数のアプリケーションを一元管理することができます。

## App of Appsとは
App of Appsは、ArgoCDのアプリケーション管理パターンの1つです。
親となるApplicationリソースが、子となる複数のApplicationリソースを管理する構造を持ちます。
これにより、以下のようなメリットがあります：

- 複数のアプリケーションを一括でデプロイ・管理できる
- 環境ごとの設定を一元管理できる
- アプリケーション間の依存関係を明確に定義できる

## 導入方法
導入にあたって、私はディレクトリ構成を以下のように作成しました。
### ディレクトリ構成
```
├── apps
│   ├── awsLoadBalancerController
│   │   └── application.yaml
│   ├── eso
│   │   └── application.yaml
│   ├── eso-manifest
│   │   └── application.yaml
│   ├── externalDNS
│   │   └── application.yaml
│   └── wordpress
│       └── application.yaml
└── bootstrap
    └── apps.yaml
```
bootstrapディレクトリ配下にあるapps.yamlがまさにApp of Appsです。
それではファイルの中身を見ていきましょう

```yaml
apiVersion: argoproj.io/v1alpha1
kind: Application
metadata:
  name: apps
  namespace: argocd
spec:
  project: default
  destination:
    server: 'https://kubernetes.default.svc'
    namespace: argocd
  source:
    repoURL: <gitリポジトリ>
    targetRevision: <ブランチ>
    path: <gitリポジトリから見たPath>
    directory:
      recurse: true
  syncPolicy:
    automated:
      selfHeal: true
      prune: true
```

このように、ApplicationリソースのあるPathを指定することでまとめて、デプロイすることが可能です。また、これらのApplicationリソースはディレクトリの上から実行していくため、以下のように名前を変更するとこで依存関係を制御することが可能になります。
```
├── apps
│   ├── 01-awsLoadBalancerController
│   │   └── application.yaml
│   ├── 02-eso
│   │   └── application.yaml
│   ├── 02-1-eso-manifest
│   │   └── application.yaml
│   ├── 03-externalDNS
│   │   └── application.yaml
│   └── 04-wordpress
│       └── application.yaml
└── bootstrap
    └── apps.yaml
```

### 実行方法
以下のコマンドを打つだけでApplicationリソースが展開されます。
```bash
kubectl apply -f bootstrap/apps.yaml
```


## まとめ
ここではApp of Appsの実装方法について説明しました。
これで、Applicationリソースをまとめて実行できますね！それでは素晴らしい、ArgoCDライフを！！
