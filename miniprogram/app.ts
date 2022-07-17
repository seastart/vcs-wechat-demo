import { IAppOption } from "../typings";
import { WeChat_VCSIns } from "./sdk/index";
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
        });
        // 可以监听会议外消息
    },
})