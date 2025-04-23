# ArgoCDのHttps接続

## 背景
Https接続できるようにしたい！！そう思い立ったので記載することにしました。
ArgoCDはDefaultの場合portforwardなどを利用して, localhostにアクセスするようになっています。
これはいけてないので、DomainをAWSで利用可能にし、SSL証明書を適用できるようにする方法をまとめようと思います。

## 利用ツール
* ArgoCD(argo-helmでインストールします。)
* EKS
* AWS LoadBalancerController
* ExternalDNS
* Route53
* ACM(Certification Manager)

## 導入方法
### 1. EKSをデプロイしてください。
詳しい説明はどこかで記載します。

### 2. Domainを用意してください。
AWSにはRoute53でドメインを登録できます。お金がかかります。

### 3. ホストゾーンを設定します。
terraform.tfvarsなどにあらかじめ、varを登録してください。直接記載でも構いません。
```
resource "aws_route53_zone" "test" {
  name = var.domain_name
}
```

### 4. ACMを作成
証明書を発行します。
```
module "acm_argocd" {
  source  = "terraform-aws-modules/acm/aws"
  version = "~> 5.0"

  domain_name = "argocd.${var.domain_name}"
  zone_id = aws_route53_zone.test.zone_id

  # DNS検証
  validation_method = "DNS"

  wait_for_validation = true
}
```

### 4. AWSController, ExternalDNSをデプロイ
* AWSControllerのデプロイ
```bash
helm upgrade --install aws-load-balancer-controller eks/aws-load-balancer-controller -n kube-system -f <values.fileの場所を指定>
```

```yaml
serviceAccount:
  create: true
  annotations:
    eks.amazonaws.com/role-arn: <roleのarn>
  name: aws-load-balancer-controller
clusterName: kose-eks-welcomestudy
```

```
# aws-load-balancer-controller
module "aws_load_balancer_controller_irsa" {
  source  = "terraform-aws-modules/iam/aws//modules/iam-role-for-service-accounts-eks"
  version = "~> 5.44.0"

  role_name = "${var.name_prefix}-aws-load-balancer-controller"

  attach_load_balancer_controller_policy = true

  oidc_providers = {
    main = {
      provider_arn               = module.eks.oidc_provider_arn
      namespace_service_accounts = ["kube-system:aws-load-balancer-controller"]
    }
  }

  tags = local.common_tags
}

## aws_load_balancer_controller_irsaだけだと必要な権限が付与できなかったため、追加で設定
resource "aws_iam_policy" "alb_extra_policy" {
  name = "custom-alb-policy"

  policy = jsonencode({
    Version = "2012-10-17",
    Statement = [
      {
        Effect = "Allow",
        Action = [
          "elasticloadbalancing:DescribeListenerAttributes",
          "elasticloadbalancing:DescribeRules",
          "elasticloadbalancing:ModifyListener",
          "elasticloadbalancing:ModifyRule"
        ],
        Resource = "*"
      }
    ]
  })

  tags = local.common_tags
}

resource "aws_iam_role_policy_attachment" "attach_alb_extra" {
  role       = module.aws_load_balancer_controller_irsa.iam_role_name
  policy_arn = aws_iam_policy.alb_extra_policy.arn
}
```


* ExternalDNSをデプロイ
```bash
helm upgrade --install external-dns external-dns/external-dns -n kube-system -f <values.fileの場所を指定>
```

```yaml
serviceAccount:
  create: true
  annotations:
    eks.amazonaws.com/role-arn: <roleのarn>
# -- Log level.
logLevel: debug  # @schema enum:[panic, debug, info, warning, error, fatal]; type:string; default: "info"
policy: sync # @schema enum:[sync, upsert-only]; type:string; default: "upsert-only"
txtOwnerId: test # @schema type:[string, null]; default: null
domainFilters:
  - test.org
## AAAAも作られると、helm uninstall時にSkipされる
managedRecordTypes:
  - A
  - CNAME
```

```
# ExternalDNSのIAMロール
resource "aws_iam_role" "externaldns_role" {
  name = "external-dns-irsa-role"

  assume_role_policy = jsonencode({
    Version ="2012-10-17"
    Statement = [
      {
        Effect = "Allow"
        Action = "sts:AssumeRoleWithWebIdentity"
        Principal = {
          Federated = module.eks.oidc_provider_arn
        }
        Condition = {
          StringEquals = {
            "${replace(module.eks.cluster_oidc_issuer_url, "https://", "")}:sub": "system:serviceaccount:kube-system:external-dns"
            "${replace(module.eks.cluster_oidc_issuer_url, "https://", "")}:aud": "sts.amazonaws.com"
          }
        }
      }
    ]
  })

  tags = local.common_tags
}

resource "aws_iam_role_policy" "externaldns_policy" {
  name = "external-dns-policy"
  role = aws_iam_role.externaldns_role.id

  policy = jsonencode({
    "Version": "2012-10-17",
    "Statement": [
      {
        "Effect": "Allow",
        "Action": [
          "route53:ChangeResourceRecordSets"
        ],
        "Resource": [
          "arn:aws:route53:::hostedzone/*"
        ]
      },
      {
        "Effect": "Allow",
        "Action": [
          "route53:ListHostedZones",
          "route53:ListResourceRecordSets",
          "route53:ListTagsForResources"
        ],
        "Resource": [
          "*"
        ]
      }
    ]
  })
}
```

### 5. Ingressをデプロイ
IngressをデプロイすることでALBCが検知をして、ELBを構築します。その後、Ingressの設定を検知し、ExternalDNSがドメインをRoute53にDNS登録することにより、アクセスできるようになります。
```yaml
configs:
  params:
    server.insecure: true
server:
  # HTTPSにてアクセスできるように、Ingressを設定
  ingress:
    enabled: true
    annotations:
      alb.ingress.kubernetes.io/load-balancer-name: test-ingress
      alb.ingress.kubernetes.io/scheme: internet-facing
      alb.ingress.kubernetes.io/target-type: ip
      alb.ingress.kubernetes.io/listen-ports: '[{"HTTP":80}, {"HTTPS":443}]'
      alb.ingress.kubernetes.io/certificate-arn: <ACMのARN>
      alb.ingress.kubernetes.io/ssl-redirect: "443"
      external-dns.alpha.kubernetes.io/hostname: argocd.test.org
      alb.ingress.kubernetes.io/healthcheck-path: /healthz?full=true
      nginx.ingress.kubernetes.io/force-ssl-redirect: "true"
      nginx.ingress.kubernetes.io/ssl-passthrough: "true"
    ingressClassName: "alb"
    hostname: argocd.test.org
    extraPaths:
      - backend:
          service:
            name: argocd-server
            port:
              number: 80
        path: /
        pathType: Prefix
```

#### 注意点
* ヘルスチェックページは/healthz?full=trueをしてください。デフォルトの/ では/loginにリダイレクトされてしまうため、ヘルスチェックエラーとなります。（Status：307）
*  ArgoCDはデフォルトでinsecureがfalseとなっているため、portforwardなどでアクセスした場合安全なページではないとエラーになります。これは、ヘルスチェックも同じのためnsecureをtrueに設定してください


## まとめ
ここでは、ArgoCDをhttpsに変更する方法を記載しました。
安全な通信でArgoCDをどんどん運用していきましょう！！

