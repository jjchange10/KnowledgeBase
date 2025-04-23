# Helm plugin

## 背景
ArgoCDを常日頃使っているとは、必ず出てくる問題があります。そう、それはsecret情報の管理どうすればいいねん。
ということで、公式ページをのぞいてみました。
> Argo CD is un-opinionated about how secrets are managed. There are many ways to do it, and there's no one-size-fits-all solution.

[公式ページ](https://argo-cd.readthedocs.io/en/stable/operator-manual/config-management-plugins/)より引用

公式が指定する方法は特になく、pluginを利用する必要がありました。
そこで今回は、helm secretsを利用した秘匿情報の管理方法を紹介します。

他にも同じやり方で、helmfileなどのpluginをインストールして利用可能です。

今回は私が実施した、argo-helmを利用したインストール方法を記載します。他にもやり方はありますが、現場では公式のhelmチャートを使うことが多いのでそうします。
## initContainerによる、Pluginのインストール
ここではhelm, sops, helm-secretをインストールする方法を記載しています。これらをインストールし、volumeとして保存することで、他のcontainerから呼び出すことのできるように定義しています。
```yaml
repoServer:
  initContainers:
  # Helm
    - name: helm-installer
      image: alpine:latest
      command:
        - /bin/sh
        - -c
      # InitContainerにHelmをインストールする方法です。独自のVersionをインストールしたい場合利用します。
      args:
        - |
          set -ex
          apk --update add wget curl ca-certificates
          ARGOCD_VERSION=$(curl -s https://raw.githubusercontent.com/argoproj/argo-helm/argo-cd-7.0.0/charts/argo-cd/Chart.yaml | grep appVersion | sed -e 's/^[^: ]*: //')
          HELM_RECOMMENDED_VERSION=$(curl -s https://raw.githubusercontent.com/argoproj/argo-cd/"${ARGOCD_VERSION}"/hack/tool-versions.sh | grep helm3_version | sed -e 's/^[^=]*=//')
          wget -q https://get.helm.sh/helm-v"${HELM_RECOMMENDED_VERSION}"-linux-amd64.tar.gz
          tar -xvf helm-v"${HELM_RECOMMENDED_VERSION}"-linux-amd64.tar.gz
          cp -p ./linux-amd64/helm /custom-tools/
          chmod +x /custom-tools/*
      volumeMounts:
        # Podの共有VolumeにHelmを配置する。
        - name: custom-tools
          mountPath: /custom-tools
    # SOPS
    - name: sops-installer
      image: alpine:latest
      command:
        - /bin/sh
        - -c
      # InitContainerに、SOPSをインストールする。
      args:
        - |
          apk --update add wget
          wget -qO /custom-tools/sops https://github.com/mozilla/sops/releases/download/v3.7.3/sops-v3.7.3.linux
          chmod +x /custom-tools/sops
      volumeMounts:
        # Podの共有Volumeに、SOPSを配置する。
        - name: custom-tools
          mountPath: /custom-tools
    - name: helm-plugins-installer
      image: alpine:latest
      command:
        - /bin/sh
        - -c
      # InitContainerに、helmプラグインをインストールする。
      args:
        - |
          apk --update add wget
          wget -q https://github.com/jkroepke/helm-secrets/releases/download/v4.6.3/helm-secrets.tar.gz
          tar -xvf helm-secrets.tar.gz
          cp -R helm-secrets /helm-working-dir/plugins/
          chown -R 999 /helm-working-dir/plugins
          chmod -R u+rwx /helm-working-dir/plugins/
      volumeMounts:
        # Podの共有Volumeにhelmプラグインを配置する。
        - name: helm-working-dir
          mountPath: /helm-working-dir/plugins
```

## cmp(Config Management Plugins)設定
Config Management Plugins(CMP)は、ArgoCDのカスタムプラグイン機能です。
CMPを利用することで、ArgoCDのマニフェスト生成プロセスをカスタマイズすることができます。
やり方として、Sidecarを介してプラグインツールを設定できるので、その方法を説明します。


ここでは、pluginを利用した際の、動きを記載します。コメントしてるところは気にしないでください。
```yaml
configs:
  cmp:
    create: true
    annotations: {}
    plugins:
      helm-secrets:
        init:
          command: 
            - /bin/sh
            - -c
          args:
            - |
              set -euo pipefail
          # args:
          #   - |
          #     set -euo pipefail
          #     set -x

          #     export XDG_CONFIG_HOME=/tmp/.config
          #     export XDG_CACHE_HOME=/tmp/.cache

          #     if [ -n "$ARGOCD_ENV_HELM_EXTERNAL_REPO" ];then
          #       echo "[INFO] repo add"
          #       helm repo add $ARGOCD_ENV_HELM_REPO_NAME $ARGOCD_ENV_HELM_EXTERNAL_REPO
          #       echo "[INFO] repo update"
          #       helm repo update
          #       if [ -n "$ARGOCD_ENV_HELM_VERSION" ];then
          #         echo "[INFO] helm pull"
          #         helm pull $ARGOCD_ENV_HELM_REPO_NAME/$ARGOCD_ENV_HELM_CHART --version $ARGOCD_ENV_HELM_VERSION --untar
          #       else
          #         echo "[INFO] helm pull"
          #         helm pull $ARGOCD_ENV_HELM_REPO_NAME/$ARGOCD_ENV_HELM_CHART --untar
          #       fi
          #     fi

          #     echo "[INFO] cd $ARGOCD_ENV_HELM_CHART"
          #     cd $ARGOCD_ENV_HELM_CHART
          #     echo "[INFO] helm dependency build"
          #     helm dependency build
        generate:
          command: 
            - /bin/sh
            - -c
            # jkroepke製のhelm-secretsの場合
            # 暗号化されたvaluesファイル (SOPSのsecretsファイル) 、平文のvaluesファイル、を使用してhelmコマンドを実行する。
          args:
            - >
              set -euo pipefail;
              if [ -z "$ARGOCD_ENV_HELM_VALUES_FILE" ];then
                helm secrets template $ARGOCD_ENV_HELM_RELEASE_NAME . -n $ARGOCD_APP_NAMESPACE -f $ARGOCD_ENV_HELM_SECRETS_FILE;
              else              
                helm secrets template $ARGOCD_ENV_HELM_RELEASE_NAME . -n $ARGOCD_APP_NAMESPACE -f $ARGOCD_ENV_HELM_VALUES_FILE -f $ARGOCD_ENV_HELM_SECRETS_FILE;
              fi
```

sidecarを登録する。ここでは、initContainerなどで、インストールしたVolumeやcmpで作ったcmなどをマウントすることを忘れないでください。envをしているするとこで、PATH、HELM_PLUGINSを通すことができるので、指定しておくと良いです。
```yaml
repoServer:
    extraContainers: 
        - name: cmp-my-plugin
        command:
            - "/var/run/argocd/argocd-cmp-server"
        image: alpine:latest
        env:
            - name: PATH
            value: "/custom-tools:/usr/local/sbin:/usr/local/bin:/usr/sbin:/usr/bin:/sbin:/bin"
            # helmプラグインの場所を設定する
            - name: HELM_PLUGINS
            value: /helm-working-dir/plugins
        securityContext:
            runAsNonRoot: true
            runAsUser: 999
        volumeMounts:
            - name: tmp
            mountPath: /tmp
            - name: argocd-cmp-cm
            mountPath: /home/argocd/cmp-server/config/plugin.yaml
            subPath: helm-secrets.yaml
            - name: plugins
            mountPath: /home/argocd/cmp-server/plugins
            - name: custom-tools
            mountPath: /custom-tools
            - name: helm-working-dir
            mountPath: /helm-working-dir/plugins
            - name: var-files
            mountPath: /var/run/argocd
    volumeMounts:
        - name: custom-tools
        mountPath: /custom-tools
        - name: helm-working-dir
        mountPath: /helm-working-dir/plugins
    volumes:
        - name: custom-tools
        emptyDir: {}
        - name: argocd-cmp-cm
        configMap:
            name: argocd-cmp-cm
        - name: cmp-tmp
        emptyDir: {}

```

## まとめ
ここでは、CMPを利用して、Helm SecretのPluginを利用する方法を記載しました。個別にPluginのバイナリをインストールして、共有できるVolumeに保存することで、利用できるようになります。Helm Secrets以外にも他のPluginのインストールも可能なので、色々と試してみると楽しいと思います！
