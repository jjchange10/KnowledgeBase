# EKSを導入

## quickstart
 Terraformにて以下の公式モジュールを利用して、EKSクラスタを構築する
 以下の設定でどんな設定がされるか記載する
 ### 基本設定
- `terraform-aws-modules/eks/aws` モジュールを使用してEKSクラスターを構築
- クラスター名は変数 `var.name_prefix` から設定
- Kubernetesバージョンは変数 `var.eks_version` で指定
- IPv4ネットワークを使用
- 指定したVPCとサブネット（プライベート・パブリック）上にクラスターを構築

### 主要な機能設定
- IRSA (IAM Roles for Service Accounts) を有効化
  - Kubernetes ServiceAccountsにIAMロールを関連付け可能
- パブリックエンドポイントへのアクセスを特定のCIDRに制限
- 必要なアドオンを `local.cluster_addons` で設定

### ノードグループ設定
- x86_64アーキテクチャのマネージドノードグループを使用
- ノードグループのデフォルト設定は `local.eks_managed_node_group_defaults` で定義
- 具体的なノードグループ設定は `local.eks_managed_node_group` で指定

### アクセス制御
- クラスター作成者の自動管理者権限付与を無効化
- アクセス権限は `local.access_entries` で個別に設定

### タグ付け
- 全てのリソースに `local.common_tags` で指定された共通タグを付与

このコードにより、セキュアで管理しやすいEKSクラスターを構築することができます。


```bash
module "eks" {
  source  = "terraform-aws-modules/eks/aws"
  version = "20.35.0"

  # 基本設定
  cluster_name      = var.name_prefix
  cluster_version   = var.eks_version
  cluster_ip_family = "ipv4"
  vpc_id            = module.vpc.vpc_id
  subnet_ids        = concat(module.vpc.private_subnets, module.vpc.public_subnets)

  #Default有効　 wordpressをデプロイした後、DBに繋ぐときに使いそうのため有効化
  enable_irsa                    = true
  
  #外部公開リソース・エンドポイント社内VPNからのみアクセスできるようにIP制限を設定
  cluster_endpoint_public_access       = true
  cluster_endpoint_public_access_cidrs = local.endpoint_public_access
  
  #必要最低限のAddonsを設定する
  cluster_addons = local.cluster_addons

  # x86_64 の manged node group を利用、
  # その以外に、AL2_ARM_64 や Fargate なども利用が可能
  eks_managed_node_group_defaults = local.eks_managed_node_group_defaults
  
  # ノードグループ設定を修正 - 構造を簡素化し、正しく設定
  eks_managed_node_groups = local.eks_managed_node_group

  # クラスターアクセスエントリ
  # 現在の caller identity を管理者として追加,Access_entriesで個別設定したため不要とした。
  enable_cluster_creator_admin_permissions = false

  # 他に EKS にアクセスできる IAM Role/User はこちらで付与することも可能
  access_entries = local.access_entries

  # 作成するリソースに共通のtagの追加
  tags = local.common_tags
}
```

localの設定は以下となってます。
```bash
# EKS
# クラスタへのアクセス許可IPを設定
locals  {
    endpoint_public_access = [
        "10.0.0.1/32", #アクセス制御したいIPを記載
        ]
}

# EKS addon をこちらで install

locals {
    cluster_addons = {
        coredns = {
            most_recent = true
        }
        kube-proxy = {
            most_recent = true
        }
        vpc-cni = {
            most_recent    = true
            before_compute = true
        }
        aws-ebs-csi-driver = {
            most_recent = true
            service_account_role_arn = module.ebs_csi_irsa_role.iam_role_arn  # IAM Role for Service Account
        }
    }
}


# eks_managed_node_group_default設定
locals {
    eks_managed_node_group_defaults = {
        ami_type       = "AL2_x86_64"
        instance_types = ["t3.medium"]
    }
}

# eks_managed_node_group　設定
locals {
    eks_managed_node_group = {
        main_node_group = {
            subnet_ids   = module.vpc.private_subnets
            min_size     = 2
            max_size     = 4
            desired_size = 2
            disk_size    = 20
            
            schedules = {
                scale-out = {
                min_size     = 2
                max_size     = 4
                desired_size = 2
                time_zone    = "Asia/Tokyo"
                recurrence   = "00 9 * * 1-5"
                }
                scale-in = {
                min_size     = 0
                max_size     = 0
                desired_size = 0
                time_zone    = "Asia/Tokyo"
                recurrence   = "0 23 * * 1-5"
                }
            }
            iam_role_additional_policies = {
                AmazonEBSCSIDriverPolicy = "arn:aws:iam::aws:policy/service-role/AmazonEBSCSIDriverPolicy"
            }
        }
    }
}

# access_entries設定
locals {
    access_entries = {
        cluster_creator = {
        principal_arn     = local.admin_principal_arn
        policy_associations = {
            admin-policy = {
            policy_arn = "arn:aws:eks::aws:cluster-access-policy/AmazonEKSClusterAdminPolicy"
            access_scope = {
                type = "cluster"
            }
            }
        }
        },
        kubectl_viewer = {
        principal_arn     = aws_iam_role.cloudnative-entry-admin.arn
        policy_associations = {
            admin-policy = {
            policy_arn = "arn:aws:eks::aws:cluster-access-policy/AmazonEKSClusterAdminPolicy"
            access_scope = {
                type = "cluster"
            }
            }
        }
        },
    }
}
```

## まとめ
ここではEKSを構築する上で必要な設定を記載しました。まだまだ、たくさんの設定があるので公式ページや、Githubを参考に設定してみてください。今の設定でも十分運用はできますが、細かいところに届いていないこともあります。みなさんの力で完璧なEKSクラスタを構築していきましょう！



