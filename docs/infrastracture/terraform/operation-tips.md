# Operation Tips
内容が溜まってきたら個別の章として外出しします。

## terraformでStateLockエラーが発生したら
terraform apply,terraform state listなどのコマンドを実行した際にエラーが出るようになってしまいました。

```bash
│ Error: Error acquiring the state lock
│
│ Error message: operation error S3: PutObject, https response error StatusCode: 412, <RequestID>, api error PreconditionFailed:
│ At least one of the pre-conditions you specified did not hold
│ Lock Info:
│   ID:        ac6331a5-d474-0dc7-afe4-de4920f3cb88
│   Path:      terraform.tfstate
│   Operation: OperationTypeApply
│   Who:       test@test.local
│   Version:   1.11.3
│   Created:   2025-04-23 09:40:07.750821 +0000 UTC
│   Info:
│
│
│ Terraform acquires a state lock to protect the state from being written
│ by multiple users at the same time. Please resolve the issue above and try
│ again. For most commands, you can disable locking with the "-lock=false"
│ flag, but this is not recommended.
╵
```

これで解決しましょう
```bash
terraform force-unlock ac6331a5-d474-0dc7-afe4-de4920f3cb88
```


