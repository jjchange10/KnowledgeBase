## CODEOWNERS
ファイルの場所は、.github/CODEOWNERSに配置する

```
config/production @username1 @username2
```

## workflow

```.github/workflows/main.yml
on:
  push:
    branches:
      - main

jobs:
  build:
    runs-on: cicd-pf-runner-small
  container:
    image: ansible/ansible:latest
  steps:
    - name: Checkout
      uses: actions/checkout@v3
    - name: install jq
      run: |
        curl -L https://github.com/stedolan/jq/releases/download/jq-1.7.1/jq-linux-amd64
        chmod +x jq
    - name: ansible
      run: |
        ansible-playbook main.yml
```

