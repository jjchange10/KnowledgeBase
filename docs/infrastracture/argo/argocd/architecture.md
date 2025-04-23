# Architecture
まだ、勉強不足です。すみません。

## components
ArgoCDは、以下の主要なコンポーネントで構成されています：


|コンポーネント| 機能 |
|:--|:--|
|argocd-server(argocd-apiserver)|いわゆる、ArgoCDのダッシュボード。また、ArgoCDのAPIとしても機能する|
|application-controller, applicationset-controller|Clusterにマニフェストをデプロイ|
|repo-server|manifest/chartリポジトリからクローンを取得、chartの場合内部的にmanifestを作成|
|redis-server|application-controllerの処理結果のキャッシュを保管|
|dex-server|SSOを採用する場合、argocd-serverの代わりに認可リクエストを作成し、またIDプロバイダーに送信|


### **argocd-server(argocd-apiserver)**: 
   - 

### **application-controller, applicationset-controller**: 
   - 

### **repo-server**: 
   - 

### **repo-server**: 
   - 

### **dex-server**: 
   - 

