# Helm Quickstart

## インストール

Helmをローカル環境にインストールする手順です：

```bash
mise install helm
mise use helm
```

## リポジトリの登録
```bash
 helm repo add bitnami https://charts.bitnami.com/bitnami
```

リポジトリを登録すると、インストールできるチャートの一覧を表示できるようになります。
```bash
helm search repo bitnami
```


## Chartのインストール
チャートをインストールするには、helm installコマンドを実行します。
```bash
helm repo update              # Make sure we get the latest list of charts
helm install bitnami/mysql --generate-name
```

こちらの例ではbitnami/mysqlチャートがリリースされます
以下を実行することでチャートに関する情報を得ることができます
```bash
helm show chart bitnami/mysql
helm show all bitnami/mysql
```

## リリースについて
リリース状況については以下のコマンドで確認できます。これで何がリリースされているかを確認できます
```bash
helm list -A
```

また、リリースについてStatusを確認したい場合は以下になります。
```bash
helm status <Release name>
```


## アンインストール
アンインストールはつきものです。以下を使ってアンインストールしましょう
```bash
helm uninstall <Release name>
```


## まとめ
ここではHelmを利用する上で最低限の知識を説明しました。これ以外にもたくさんのhelmコマンドがありますので、興味があれば試してみてください。私も次のページからそういったコマンドを自分なりの使い方で記載していこうと思います！
