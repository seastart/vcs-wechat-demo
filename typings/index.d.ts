/// <reference path="./types/index.d.ts" />

import { LoginRsp, WeChat_VCSIns } from "../miniprogram/sdk";

interface IAppOption {
    globalData: {
        /** sdk登录返回的信息 */
        loginRsp: null | LoginRsp,
    },
    /** 全局sdk实例 */
    vcsIns: WeChat_VCSIns | null,
}