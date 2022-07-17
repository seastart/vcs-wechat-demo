// index.ts

import { IAppOption } from "../../../typings";
import { LoginType, SdkError } from "../../sdk/index";

// 获取sdk实例
const vcsIns = getApp<IAppOption>().vcsIns!;
let SDK_CONFIG = require("../../sdk_config");

Page({
    data: {
        /**是否已登录 */
        logined: false,
        /**登录返回的昵称 */
        nickname: "",
        /**默认sdk配置，里面有默认的用户名密码房间号 */
        dft: {
            username: SDK_CONFIG.dftUserName,
            password: SDK_CONFIG.dftPassword,
            roomNo: SDK_CONFIG.dftRoomNo,
        },
    },
    onLoad() {
        let loginRsp = getApp<IAppOption>().globalData.loginRsp;
        if(loginRsp) {
            this.setData({
                logined: true,
                nickname: loginRsp.account.nickname,
            });
        }
    },
    /** 登录 */
    onLogin(evt: WechatMiniprogram.CustomEvent) {
        let { username, password } = evt.detail.value;
        if(!username || !password) {
            wx.showToast({
                icon: "none",
                title: '用户名或密码不能为空',
            });
            return;
        }
        wx.showLoading({title:'登录中'});
        vcsIns.login({
            loginname: username,
            password: password
        }, LoginType.ByUserName).then((rsp) => {
            console.log('sdk登录成功', rsp);
            // 可以将rsp.token缓存下来，下次用 LoginType.ByToken 自动登录
            getApp<IAppOption>().globalData.loginRsp = rsp;
            this.setData({
                logined: true,
                nickname: rsp.account.nickname,
            });
        }).catch((err: SdkError) => {
            wx.showModal({
                showCancel: false,
                content: err.msg
            });
        }).finally(() => {
            wx.hideLoading();
        });
    },
    /** 进入房间 */
    onEnterRoom(evt: WechatMiniprogram.CustomEvent) {
        let { room_no, nickname, password, enable_camera, enable_mic } = evt.detail.value;
        if(!room_no || !nickname) {
            wx.showToast({
                icon: "none",
                title: '会议号或入会昵称不能为空',
            });
            return;
        }
        wx.showLoading({title:'入会中'});
        vcsIns.enterRoom({
            roomNo: room_no,
            nickname: nickname,
            password: password,
            enableCamera: enable_camera,
            enableMic: enable_mic,
        }).then((info) => {
            // 入会成功进入会议页面
            wx.navigateTo({
                url: "../room/room",
                success: function (res) {
                    res.eventChannel.emit('sendRoomInfo', info);
                }
            });
        }).catch((err: SdkError) => {
            wx.showModal({
                showCancel: false,
                content: err.msg
            });
            // token失效，退出
            if (err.code == 401) {
                vcsIns.logout().catch((err: SdkError) => {
                    console.log('sdk退出报错', err);
                }).finally(() => {
                    getApp<IAppOption>().globalData.loginRsp = null;
                    this.setData({
                        logined: false,
                        nickname: '',
                    });
                });
            }
        }).finally(() => {
            wx.hideLoading();
        });
    }
})
