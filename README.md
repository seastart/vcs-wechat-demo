## sdk使用帮助请阅读  
[微信小程序-RTC-SDK](https://www.yuque.com/docs/share/13b3a358-6792-421e-b992-06f6997f395b)  
[小程序RTC开发FAQ](https://www.yuque.com/docs/share/dc18bf20-dbcd-4ea6-8f5c-9c04b579007c)

## 体验步骤
* 新建`miniprogram/sdk`目录，并将sdk文件放置到目录下
* 新建`miniprogram/sdk_config.js`文件，填写内容
```javascript
module.exports = {
    appID: "分配给你的appid",
    appKey: "分配给你的appkey",
    serverPrefix: "服务地址，如 https://vcs.anyconf.cn:9001/vcs",
    dftUserName: "方便测试的默认登录用户名，不填则每次都要手动输入",
    dftPassword: "方便测试的默认登录密码，不填则每次都要手动输入",
    dftRoomNo: "方便测试的默认房间号，不填则每次都要手动输入"
};
```
* 根目录下运行`npm install`，小程序开发者工具`工具-构建npm`
* ☕️

## typescript工程无法识别sdk的d.ts声明
ts如果不能正确识别sdk的.d.ts定义的变量类型，请在tsconfig.json中配置  
```json
"moduleResolution": "node",
"typeRoots": [
    "./typings",
    "miniprogram/sdk"
]
```

## javascript写法
运行下typescript编译命令 `tsc`会生成对应js文件