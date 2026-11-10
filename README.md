# 云客跟进助手

这是公开源码仓库。完整源码包在 [`yunke-follow-up-assistant-source-v1.22.9.zip`](./yunke-follow-up-assistant-source-v1.22.9.zip) 中，下载并解压后可看到桌面扩展和手机端源码。觉得有用的话，欢迎在 GitHub 点 Star。

## 源码内容

- `desktop-extension/`：Chrome Manifest V3 扩展源码，版本 1.22.9。手动挂断不再被 CRM 客户匹配阻断；客户页未唯一匹配时暂停跟进录入，避免写错客户。
- `mobile-app/`：手机端 APK 反编译后的 smali 与资源源码，改动版本 1.56。

## 桌面扩展密钥配置

出于安全考虑，源码包不包含中转服务鉴权密钥。扩展从云客 CRM 页面自己的 `localStorage` 读取 `yk_relay_access_key`。部署前请在受信任的 CRM 页面控制台设置：

```js
localStorage.setItem('yk_relay_access_key', '你的中转服务密钥')
```

真实密钥不要提交到 Git。设置后，在 Chrome“扩展程序”页面开启开发者模式并加载解压后的 `desktop-extension/` 文件夹。

## 手机端说明

手机端源码是 APK 反编译后的 smali 与资源，便于审阅和重建；没有包含 APK 成品、签名密钥库或签名密码。覆盖安装仍需使用原应用的签名证书。

仓库没有包含客户名单、通话记录、APK 成品或签名材料。目前未附开源许可证；公开可见和 Star 不等于授权他人独立复制、修改、再发布或商用。手机端反编译代码的授权范围也尚需确认。
