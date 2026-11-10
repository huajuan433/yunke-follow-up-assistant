# 云客跟进助手

这是个人私有源码备份。源码目录已打包在 [yunke-follow-up-assistant-source.zip](./yunke-follow-up-assistant-source.zip) 中；下载并解压后可看到电脑端和手机端文件夹。

## 源码内容

- `desktop-extension/`：Chrome Manifest V3 扩展源码，版本 1.22.8。
- `mobile-app/`：手机端 APK 反编译后的 smali 与资源源码，改动版本 1.56。

## 桌面扩展密钥配置

为避免泄露，源码包没有包含中转服务鉴权密钥。扩展改为从云客 CRM 页面本地读取 `yk_relay_access_key`。部署前请在受信任的 CRM 页面控制台设置：

```js
localStorage.setItem('yk_relay_access_key', '你的中转服务密钥')
```

真实密钥不要提交到 Git。设置后，在 Chrome“扩展程序”页面开启开发者模式并加载解压后的 `desktop-extension/` 文件夹。

## 手机端说明

手机端提供 APK 反编译后的 smali 与资源，便于审阅和重建；没有包含 APK 成品、签名密钥库或签名密码。覆盖安装仍需使用原应用的签名证书。

仓库不包含客户名单、通话记录或手机签名材料。
