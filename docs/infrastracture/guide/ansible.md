# Ansible

## ディレクトリ構造

```
ansible
├── ansible.cfg
├── inventory
│   ├── hosts
│   └── group_vars
├── playbook.yaml
└── roles
    ├── nginx
    └── mysql
```

## ファイル構造

```
nginx
├── tasks　
├── handlers
├── files
├── templates
├── vars
├── defaults
├── meta
└── README.md
```

## 実行方法

```
ansible-playbook -i inventory/hosts playbook.yaml
```

