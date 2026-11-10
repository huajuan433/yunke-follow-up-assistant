# 云客跟进助手

这是云客 CRM 跟进助手的个人备份仓库，包含电脑浏览器扩展和联动手机端源码。仓库按私有项目准备。

## 目录

- `desktop-extension/`：Chrome Manifest V3 扩展源码，当前版本 1.22.8。
- `mobile-app/`：手机端 APK 反编译后的 smali 与资源源码，当前改动版本 1.56。

## 桌面扩展本地配置

出于安全考虑，仓库不包含中转服务鉴权密钥。扩展从云客 CRM 页面自己的 `localStorage` 读取 `yk_relay_access_key`。部署前请在受信任的 CRM 页面控制台本地设置：

```js
localStorage.setItem('yk_relay_access_key', '你的中转服务密钥')
```

不要把真实密钥提交到 Git，也不要在公开问题或截图中分享。检查服务端地址和权限后，再在 Chrome 的“扩展程序”页面开启开发者模式并加载 `desktop-extension/`。

## 手机端源码

`mobile-app/` 保存 APK 的 smali 与资源，用于后续审阅和重建。仓库不包含已签名 APK、密钥库或签名密码。重建需要 Android apktool 及适配的 Android 构建工具；最终 APK 必须使用原应用的签名证书签名，换证书会导致覆盖安装失败。

## 注意

此仓库不保存客户名单、通话记录、手机签名材料或构建产物。请在上传后确认 GitHub 仓库保持为 Private。
