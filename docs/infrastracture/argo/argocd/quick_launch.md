# はじめに
ArgoCDを利用する上で必要な項目を記載します。

それでは、ArgoCDの第一歩を一緒に進みましょう！

## quickstart
インストールから基本的なAppilcationを利用するまでを記載します。

### インストール
1. Create namespace
   ```bash
   kubectl create namespace argocd
   ```

2. Install ArgoCD
   ::: code-group
   ```bash [kubectl]
   #インストールコマンド
   kubectl apply -n argocd -f https://raw.githubusercontent.com/argoproj/argo-cd/stable/manifests/install.yaml
   ```
   ```bash [helm]
   #リポジトリ追加
   helm repo add argo https://argoproj.github.io/argo-helm
   #インストールコマンド
   helm upgrade --install -n argocd argocd argo/argo-cd

   #vaulesを指定する場合
    helm upgrade --install -n argocd argocd argo/argo-cd -f <valuesfile_path>/vaules.yaml
   ```
   ```bash [helmfile]
   #インストールコマンド
   helmfile -f <helmfile_path>/<helmfile_name> apply
   ```
   :::
   
3. Download Argo CD CLI　※必要に応じて（argocdコマンドがどうしても使いたい場合はインストールしましょう）
   ArgoCDをCLIで操作できるようにargocdコマンドをインストールする
   ```bash
   brew install argocd
   ```
   
4. Access The Argo CD API Server
   以下の方法を使ってhttpアクセスできるように設定し、該当のURLでログインする
   + 初期パスワードの確認
   ```
   kubectl -n argocd get secret argocd-initial-admin-secret -o jsonpath="{.data.password}" | base64 -d
   ```

   + PordForwarding
   ```bash
   kubectl port-forward svc/argocd-server -n argocd 8080:443
   ```
   + Ingress
    Ingressリソースを個別に追加する。もしくはhelmの場合はvalues.yamlにてargocd-serverのServiceを変更する
   
   + LoadBalancer
   ```bash
   kubectl patch svc argocd-server -n argocd -p '{"spec": {"type": "LoadBalancer"}}'
   ```
   helmの場合は、values.yamlにてargocd-serverのServiceを変更する
   
5. Login Using The CLI（4とほとんど同じことをやってる。3でargocdをインストールしていれば実行可能）
    + ArgoCDへのログインパスワードは自動で生成される（argocd-initial-admin-secretという名前でsecretリソースとして登録）
    ```bash
    argocd admin initial-password -n argocd
    ```

    + ログイン
    adminユーザでログインする
    ```bash
    argocd login <ARGOCD_SERVER>
    ```
    
    + パスワード変更
    任意でパスワード変更可能
    ```bash
    argocd account update-password
    ```

### Application登録
 ArgoCDのCRDであるAppilcationリソースを使ってApplicationを登録する
 ```yaml
apiVersion: argoproj.io/v1alpha1
kind: Application
metadata:
  name: <applcation_name>
  namespace: argocd ##argocdにすると、argocdが読み込んでくれる
spec:
  project: default
  source:
    repoURL: <リポジトリのパス>
    path: <chartのパス>
    targetRevision: HEAD ## branch名、HEADであればデフォルトブランチ
  destination:
    server: https://kubernetes.default.svc
    namespace: default
  syncPolicy:
    automated:
      selfHeal: true
      prune: true
 ```
 
 yamlファイルを作成後、デプロイする
 ```bash
 kubectl apply -f <Applicationリソースのファイル>
 ```
 
 ### Gitリポジトリの設定
 Gitリポジトリの設定は、GUI操作での登録と、secretリソースを登録するやり方があります。
 ここでは、argo-helmを利用した、values.yamlの書き方を説明していきます！
 といっても簡単で、以下をvalues.yamlに記載すればOK

 ```yaml
 configs:
   repositories:
     private-repo:
       url: <gitリポジトリのパス>
       type: git
       username: <gitのユーザ名>
       password: <PAT>
       # SSHによる接続方法もあると思いますが、試してないので簡単なPATによる認証を採用しました
 ```

### 正常性の確認
ArgoCDで、ApplicationリソースのすべてのリソースにてStatusがHealtyかつSyncedになっていることを確認する


### まとめ
ここでは、初めてのArgoCDを導入する上で、最低限の導入方法を記載しました。
ここから、実環境で必要な設定を組み込んでいき、みなさん独自のArgoCDライフを築いていって欲しいです。
次のページからは私が学んだ、ArgoCDの実践的な知識を残していきますので、誰かの参考となれば幸いです。

