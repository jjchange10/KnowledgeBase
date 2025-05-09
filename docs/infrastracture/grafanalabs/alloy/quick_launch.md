# はじめに
Alloyを利用する上で必要な項目を記載します。

それでは、Alloyの第一歩を一緒に進みましょう！

## QuickStart
インストールから基本的なログ収集、メトリック収集、トレースデータの収集の方法を記載します。

### インストール
前提：
+ helmがインストールされていること
+ Alloy に使用できる Kubernetes クラスターが構成されていること
+ クラスターを指すようにローカル Kubernetes コンテキストが構成されていること

1. リポジトリ追加
```bash
helm repo add grafana https://grafana.github.io/helm-charts
```

2. Values.yamlの取得
```bash
helm show values grafana/alloy > <values.yamlのpathを指定>
```

3. Values.yamlを変更
以下はkubernetesのログを収集するものになっていて、HCLチックにかけることが特徴です。
```yaml
alloy:
  configMap:
    content: |-
        discovery.kubernetes "pod" {
            role = "pod"
        }

        loki.source.kubernetes "pod" {
            targets = discovery.kubernetes.pod.targets
            forward_to = [loki.write.loki.receiver]
        }

        loki.write "loki" {
            endpoint {
            url = "http://loki-distributor.loki.svc.cluster.local:3100/loki/api/v1/push" #lokiのエンドポイントを記載
            }

            external_labels = { cluster = "my cluster name" }
        }
```


4. Alloy をインストール
```bash
helm upgrade --install alloy grafana/alloy --create-namespace --namespace alloy -f <values.yamlのpathを指定>
```
