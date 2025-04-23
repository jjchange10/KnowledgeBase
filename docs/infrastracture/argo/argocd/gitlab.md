# Gitlabと連携

## 背景
ArgoCDのユーザ管理は、デフォルトでは管理者アカウント（admin）のみが提供されています。
しかし、実運用では複数のユーザーやチームでArgoCDを利用することが一般的です。複数のユーザを作ることも可能ですが、外部のIDプロバイダー（例：GitLab、GitHub、LDAP、OIDC等）と連携してユーザー認証を行うことが推奨されています。とのことでやってみました。

## 導入方法
### Gitlab側の設定
User Settings => ApplicationからAppplicationを登録します。
Name, RedirectURL, Scopesを入力します。

|Name| RedirectURL | Scopes  |
|:--|--|--:|
|任意の名前| https://argocd.test.org/api/dex/callback| read_user, openid|


### ArgoCD側の設定
argo-helmで用意されているvaluesに以下の項目を追加します。
clientID, ClientSecretについてはGitLab側の設定をすることで取得できます。
```yaml
configs:
    cm:
        dex.config: |
            connectors:
              - type: gitlab
                id: gitlab
                name: Gitlab
                config:
                  clientID: <ClientID>
                  clientSecret: <Client Secret>
```

## 権限の付与
SSOログインするユーザの権限を付与することができます。デフォルトも指定可能です。
```yaml
configs:
  cm:
    create: true
    # admin loginを無効化
    admin.enabled: false
    # Gitlabとの連携のため、URLを設定
    url: https://argocd.test.org

  rbac:
    # GitLabユーザに権限を追加
    create: true
    policy.default: 'role:readonly'
    policy.csv: |
      g, <account_name>, role:admin
    scopes: "[email, groups]"
    policy.matchMode: "glob"
```


## まとめ
ここでは、GitLabとのSSOログイン連携の方法について説明しました。GitLab以外にもGithubのアカウントなど様々なアカウントとの連携が可能です。それでは、素晴らしいArgoCDライフを！！
