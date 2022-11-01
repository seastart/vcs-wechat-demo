import { IAppOption } from "../typings";
import { LogLevel, WeChat_VCSIns } from "./sdk/index";
let SDK_CONFIG = require("./sdk_config");

// app.ts
App<IAppOption>({
    globalData: {
        loginRsp: null,
    },
    vcsIns: null,
    onLaunch() {
        this.vcsIns = new WeChat_VCSIns({
            appID: SDK_CONFIG.appID,
            appKey: SDK_CONFIG.appKey,
            serverPrefix: SDK_CONFIG.serverPrefix || "https://vcs.anyconf.cn:9001/vcs",
            logLevel: LogLevel.DEBUG,
        });
        // 可以监听会议外消息
        // 设备信息
        // wx.getSystemInfo().then((info) => {
        //     console.log(info);
        // });
        // console.log(wx.getDeviceInfo());
        // console.log(wx.getAppBaseInfo());
    },
})