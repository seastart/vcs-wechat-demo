//  let {WeChat_VCSIns} = require("../../sdk/index.js")
import createRecycleContext from 'miniprogram-recycle-view';
import { IAppOption } from "../../../typings/index";
import { AccountInfo, DeviceState, RoomEvent, RoomEventType, RoomInfo, TrackDesc, WeChat_VCSIns } from "../../sdk/index";

let vcsIns: WeChat_VCSIns = (getApp() as IAppOption).vcsIns!;
/** 当前渲染的account信息 */
interface RenderAccounts {
    /** 左大格 */
    leftBig?: AccountInfo | null,
    /** 右上 */
    right1?: AccountInfo | null,
    /** 右中 */
    right2?: AccountInfo | null,
    /** 右下 */
    right3?: AccountInfo | null,
}
// pages/sdk.ts
Page({

    /**
     * 页面的初始数据
     */
    data: {
        /**我自己的id */
        meID: '',
        /**是否开启麦克风 */
        enableMic: false,
        /**是否开启视频 */
        enableCamera: false,
        /**是否开启美颜 */
        enableBeauty: true,
        /**是否显示底部工具栏 */
        showToolbar: true,
        /**是否显示成员列表 */
        showMemberList: false,
        /**是否要重推 */
        repush: false,
        /**是否要重拉 */
        replay: {} as Record<string, boolean>,
        /**是否断线重连中 */
        reconnecting: false,
        /**当前显示的成员信息 */
        renderAccounts: {} as RenderAccounts,
        /**房间成员数 */
        memberNum: 1,
        /**混音流播放地址 */
        amixer: '',
    },
    /** 房间总信息 */
    roomInfo: {} as RoomInfo,
    /** 成员列表recycleContext */
    memberlistCtx: null as any,
    /** 自动隐藏toolbar定时器 */
    hideToolbarIntervalId: -1,
    /**是否最小化 */
    isHide: false,
    /**是否因为最小化关闭了摄像头 */
    isCameraCloseByHide: false,
    /**
     * 生命周期函数--监听页面加载
     */
    onLoad(query) {
        const eventChannel = this.getOpenerEventChannel()
        eventChannel.on('sendRoomInfo', (data: RoomInfo) => {
            // 刷新渲染
            this.refreshRender(data);
            // 监听事件
            vcsIns.onNotifyRoomEvent = this.onRoomEvent.bind(this);
        });
    },

    /**
     * 生命周期函数--监听页面初次渲染完成
     */
    onReady() {
        // 定时隐藏工具栏
        this.hideToolbarIntervalId = setInterval(() => this.setData({
            showToolbar: false,
        }), 5000);
        // 保持高亮
        wx.setKeepScreenOn({
            keepScreenOn: true
        });
        // 离会提醒
        wx.enableAlertBeforeUnload({
            message: "确定离开会议？"
        });
        // 成员列表recyclelist context
        this.memberlistCtx = createRecycleContext<AccountInfo>({
            id: 'member_list',
            dataKey: 'members',
            page: this,
            itemSize: {
                width: 100,
                height: 50,
            },
        });
    },

    /**
     * 生命周期函数--监听页面卸载
     */
    onUnload() {
        // 离开页面，退会
        vcsIns.leaveRoom();
        wx.setKeepScreenOn({
            keepScreenOn: false
        });
    },

    /**
     * 回到上一页
     * 如果是从分享的连接打开，没有页面栈，回到首页
     */
    navigateBack: function (delay: number = 0) {
        wx.disableAlertBeforeUnload();
        setTimeout(() => {
            if (getCurrentPages().length > 1) {
                //have pages on stack
                wx.navigateBack({});
            } else {
                //no page on stack, usually means start from shared links
                wx.redirectTo({
                    url: '../index/index',
                });
            }
        }, delay);
    },

    /**
     * 房间内事件响应
     * @param evt 
     */
    onRoomEvent(evt: RoomEvent) {
        console.log('收到事件', evt.type, evt.data);
        switch (evt.type) {
            case RoomEventType.RECONNECT_START:
                this.setData({ reconnecting: true });
                break;
            case RoomEventType.RECONNECT_SUCCESS:
                this.setData({ reconnecting: false });
                this.refreshRender(evt.data);
                break;
            case RoomEventType.MEETING_CLOSE:
                wx.showModal({
                    content: "会议已结束",
                    showCancel: false,
                    success: () => {
                        this.navigateBack();
                    }
                });
                break;
            case RoomEventType.KICKED_OUT:
                wx.showModal({
                    content: "你被踢出房间",
                    showCancel: false,
                    success: () => {
                        this.navigateBack();
                    }
                });
                break;
            case RoomEventType.IMPOSED_EXIT:
                wx.showModal({
                    content: `抱歉，发生异常(${evt.data})离会`,
                    showCancel: false,
                    success: () => {
                        this.navigateBack();
                    }
                });
                break;
            case RoomEventType.PEER_ENTER:
                this.tryRender(evt.data);
                this.setData({ memberNum: this.data.memberNum + 1 });
                break;
            case RoomEventType.PEER_LEAVE:
                this.tryRemoveRender(evt.data);
                this.setData({ memberNum: this.data.memberNum - 1 });
                break;
            case RoomEventType.PEER_INFO_CHANGE:
                this.tryUpdateRender(evt.data);
                break;
            case RoomEventType.PEER_PUSH_VIDEO: {
                // 如果正在渲染且没有拉视频流，自动拉流
                let account: AccountInfo = evt.data.person;
                let grid = this.getRenderingGrid(account);
                if (grid != '' && account.rtmp == '') {
                    vcsIns.pullPeerStream(evt.data.id, grid == 'leftBig' ? TrackDesc.CAMERAL_BIG : TrackDesc.CAMERAL_SMALL).then((rtmp) => {
                        this.tryUpdateRender(account);
                    }).catch((err) => {
                        console.error('自动尝试取流失败', err);
                    });
                }
                break;
            }
            case RoomEventType.PEER_STOP_PUSH_VIDEO:
                // 如果当前在拉此视频流，sdk内部会自动取消拉流，这里只用刷新渲染
                this.tryUpdateRender(evt.data.person);
                break;
            case RoomEventType.SHARING_START: {
                // 共享开始
                let account: AccountInfo = evt.data.person;
                let grid = this.getRenderingGrid(account);
                if (grid == '') {
                    // 当前没在显示，需要挤掉一个当前渲染的用户
                    let renderAccounts = this.data.renderAccounts;
                    if (renderAccounts.leftBig && renderAccounts.leftBig.id != this.data.meID) {
                        grid = 'leftBig';
                    } else if (renderAccounts.right1 && renderAccounts.right1.id != this.data.meID) {
                        grid = 'right1';
                    } else if (renderAccounts.right2 && renderAccounts.right2.id != this.data.meID) {
                        grid = 'right2';
                    } else if (renderAccounts.right3 && renderAccounts.right3.id != this.data.meID) {
                        grid = 'right3';
                    }
                }
                vcsIns.pullPeerStream(account.id, TrackDesc.SHARE).catch((err) => {
                    console.error('自动尝试取流失败', err);
                }).finally(() => {
                    this.tryRender(account, grid);
                    // 切到左侧大格子
                    if (grid !== 'leftBig') {
                        this.toggleLeftBig(grid);
                    }
                });
                break;
            }
            case RoomEventType.SHARING_CLOSE: {
                let account: AccountInfo = evt.data.person;
                let grid = this.getRenderingGrid(account);
                // 尝试切到摄像头
                if (grid !== '') {
                    // 如果当前在拉此共享流，sdk内部会自动取消拉流，这里只用刷新渲染
                    if(account.vstate === DeviceState.DS_Active) {
                        vcsIns.pullPeerStream(account.id, grid == 'leftBig' ? TrackDesc.CAMERAL_BIG : TrackDesc.CAMERAL_SMALL).catch((err) => {
                            console.log('尝试从共享切回视频流失败', err);
                        }).finally(() => {
                            this.tryUpdateRender(account);
                        });
                    } else {
                        this.tryUpdateRender(account);
                    }
                }
                break;
            }
            case RoomEventType.ME_INFO_CHANGE:
                this.tryUpdateRender(evt.data);
                break;
            case RoomEventType.VIDEO_ACTIVE:
                wx.showModal({
                    content: "主持人请求开启您的摄像头，是否同意？",
                    showCancel: true,
                    success: (res) => {
                        if (res.confirm) {
                            this.setCameraState(DeviceState.DS_Active);
                        }
                    }
                });
                break;
            case RoomEventType.VIDEO_CLOSE:
            case RoomEventType.VIDEO_DISABLED:
                wx.showToast({
                    icon: "none",
                    title: evt.type == RoomEventType.VIDEO_CLOSE ? '主持人已关闭您的摄像头' : '主持人已禁用您的摄像头',
                });
                this.setCameraState(evt.type == RoomEventType.VIDEO_CLOSE ? DeviceState.DS_Closed : DeviceState.DS_Disabled);
                break;
            case RoomEventType.AUDIO_ACTIVE:
                wx.showModal({
                    content: "主持人请求开启您的麦克风，是否同意？",
                    showCancel: true,
                    success: (res) => {
                        if (res.confirm) {
                            this.setMicState(DeviceState.DS_Active);
                        }
                    }
                });
                break;
            case RoomEventType.AUDIO_CLOSE:
            case RoomEventType.AUDIO_DISABLED:
                wx.showToast({
                    icon: "none",
                    title: evt.type == RoomEventType.AUDIO_CLOSE ? '主持人已关闭您的麦克风' : '主持人已禁用您的麦克风',
                });
                this.setMicState(evt.type == RoomEventType.AUDIO_CLOSE ? DeviceState.DS_Closed : DeviceState.DS_Disabled);
                break;
            case RoomEventType.UP_WEAKNET:
                // 上行带宽不足，建议关闭摄像头
                // 关闭摄像头
                if (this.data.enableCamera) {
                    wx.showToast({
                        icon: "none",
                        title: "网络较差，已自动为您关闭摄像头",
                    });
                    this.setCameraState(DeviceState.DS_Closed);
                    // 摄像头关闭后建议重新推流下，减少延时
                    this.repush('上行不足自动关闭摄像头');
                }
                break;
            case RoomEventType.UP_WEAKNET_RECOVER:
                // 上行带宽已恢复，建议恢复摄像头
                // 提示用户可以恢复摄像头
                wx.showToast({
                    icon: "none",
                    title: "上行网络已恢复，建议您打开摄像头",
                });
                // 摄像头恢复后建议重新推流下，减少延时
                // this.repush('自动恢复摄像头');
                break;
            case RoomEventType.UP_PUSH_FAIL:
                // 推流失败
                wx.showToast({
                    icon: "none",
                    title: `推流失败${evt.data}，将自动重试`,
                });
                this.repush(evt.data);
                break;
            case RoomEventType.DOWN_WEAKNET:
                // 您的下行带宽不足或视频播放卡顿，建议关闭获取视频画面
                // 非共享流
                if (vcsIns.getPullingTrackDesc(evt.data.id) !== TrackDesc.SHARE) {
                    wx.showToast({
                        icon: "none",
                        title: `您的网络较差，观看视频可能会出现卡顿，将自动为你关闭视频`,
                    });
                    vcsIns.stopPullPeerStream(evt.data.id).then(() => {
                        this.tryUpdateRender(vcsIns.getPeerInfo(evt.data.id));
                    });
                } else {
                    wx.showToast({
                        icon: "none",
                        title: `您的网络较差，观看视频可能会出现卡顿`,
                    });
                }
                break;
            case RoomEventType.DOWN_WEAKNET_RECOVER:
                // 下行带宽已恢复，恢复获取视频画面
                vcsIns.pullPeerStream(evt.data.id, TrackDesc.CAMERAL_SMALL).then((rtmp) => {
                    this.tryUpdateRender(vcsIns.getPeerInfo(evt.data.id));
                }).catch((err) => {
                    console.error('自动尝试取流失败', err);
                });
                break;
            case RoomEventType.DOWN_PLAY_FAIL:
                // 播放失败
                wx.showToast({
                    icon: "none",
                    title: `播放视频失败，将自动为您重试`,
                });
                this.replay(evt.data.id, evt.data.detail);
                break;
        }
    },
    /**
     * 开关摄像头
     * @param evt 
     */
    onTapCameraBtn(evt: any) {
        this.setCameraState(this.data.enableCamera ? DeviceState.DS_Closed : DeviceState.DS_Active);
    },
    /**
     * 设置摄像头设备状态
     * @param state 
     */
    setCameraState(state: DeviceState) {
        // 设置state
        vcsIns.setCameraEnable(state).then(() => {
            this.setData({
                enableCamera: state == DeviceState.DS_Active,
            });
        });
    },
    /**
     * 开关麦克风
     * @param evt 
     */
    onTapMicBtn(evt: any) {
        this.setMicState(this.data.enableMic ? DeviceState.DS_Closed : DeviceState.DS_Active);
    },
    /**
     * 设置麦克风设备状态
     * @param state 
     */
    setMicState(state: DeviceState) {
        // 设置state
        vcsIns.setMicroEnable(state).then(() => {
            this.setData({
                enableMic: state == DeviceState.DS_Active,
            });
        });
    },
    /**
     * 开关美颜
     * @param evt 
     */
    onTapBeautyBtn(evt: any) {
        let enable = !this.data.enableBeauty;
        this.setData({
            enableBeauty: enable,
        });
    },
    /**
     * 显示成员列表
     */
    onTapMembersBtn(evt: any) {
        console.log('当前在线成员', this.roomInfo);
        this.setData({
            showMemberList: true,
        })
    },
    onShowMemberList() {
        this.memberlistCtx.append([this.roomInfo.me]);
        this.memberlistCtx.append(this.roomInfo.persons);
    },
    onHideMemberList() {
        this.memberlistCtx.deleteList(0, this.memberlistCtx.getList().length);
    },
    /**
     * 点击某成员格子
     * @param evt 
     */
    onTapMemberGrid(evt: any) {
        let grid: string = evt.currentTarget.dataset.id;
        // 先显示工具栏
        clearInterval(this.hideToolbarIntervalId);
        this.setData({
            showToolbar: true,
        });
        this.hideToolbarIntervalId = setInterval(() => this.setData({
            showToolbar: false,
        }), 5000);
        // 开始切换大小格子
        if (grid !== 'leftBig' && this.data.memberNum > 2) {
            this.toggleLeftBig(grid);
        }
    },
    /**
     * 刷新渲染，在入会时以及room_info_refresh事件时需刷新渲染
     * @param info 
     */
    refreshRender(info: RoomInfo) {
        console.log('refresh with room info', info);
        wx.setNavigationBarTitle({
            title: info.no,
        });
        this.roomInfo = info;
        this.setData({
            meID: info.me.id,
            // 根据入会后服务端校验返回后的音视频状态来设置初始摄像头、麦克风状态
            enableCamera: info.me.vstate == DeviceState.DS_Active,
            enableMic: info.me.astate == DeviceState.DS_Active,
            renderAccounts: {},
            memberNum: info.persons.length + 1,
            amixer: info.amixer,
        });
        // 渲染网格数据
        // 如果在共享，优先渲染共享
        if(info.share) {
            this.tryRender(info.share.person);
        }
        // 再渲染自己
        this.tryRender(info.me);
        for (let i = 0; i < info.persons.length && i < 3; i++) {
            this.tryRender(info.persons[i]);
        }
    },
    /**
     * 尝试渲染某成员到某格子
     * @param account 成员信息
     * @param grid 格子，传空则自动寻找空余格子（没有则不显示），否则会强制渲染到对应格子
     * @returns 
     */
    tryRender(account: AccountInfo, grid: string = '') {
        if(grid == '') {
            // 是不是已经在渲染
            grid = this.getRenderingGrid(account);
        }
        // 检查可用格子
        let renderAccounts = this.data.renderAccounts;
        if (grid == '') {
            if (!renderAccounts.leftBig) {
                grid = 'leftBig';
            } else if (!renderAccounts.right1) {
                grid = 'right1';
            } else if (!renderAccounts.right2) {
                grid = 'right2';
            } else if (!renderAccounts.right3) {
                grid = 'right3';
            }
        }
        if (grid == '') {
            console.log('暂时没有可用的格子来渲染', account);
            return;
        }
        // 先占据格子
        console.log('render', grid, account);
        this.setData({
            [`renderAccounts.${grid}`]: account,
        });
        // 尝试自动拉流
        let isSharing = (this.roomInfo.share && this.roomInfo.share.person.id == account.id);
        if (account.rtmp == '' && ( isSharing || account.vstate === DeviceState.DS_Active)) {
            vcsIns.pullPeerStream(account.id, isSharing ? TrackDesc.SHARE : (grid == 'leftBig' ? TrackDesc.CAMERAL_BIG : TrackDesc.CAMERAL_SMALL)).then((rtmp) => {
                this.tryUpdateRender(account);
            }).catch((err) => {
                console.error('自动尝试取流失败', err);
            });
        }
    },
    /**
     * 将右侧某视图切换到左侧大图
     * @param grid 右侧格子
     */
    toggleLeftBig(grid: string) {
        if (grid == 'leftBig') {
            return;
        }
        // 格子没在渲染，直接返回
        let raccount: AccountInfo = (this.data.renderAccounts as any)[grid];
        if (!raccount) {
            return;
        }
        let laccount = this.data.renderAccounts.leftBig;
        // 先左右交换，占据格子
        console.log('render toggle left', grid, raccount, laccount);
        // stop media
        this.stopMedia(raccount);
        laccount && this.stopMedia(laccount);
        this.setData({
            [`renderAccounts.leftBig`]: raccount,
            [`renderAccounts.${grid}`]: laccount,
        });
        // 再自动切大小流
        if (raccount.id != this.data.meID && vcsIns.getPullingTrackDesc(raccount.id) === TrackDesc.CAMERAL_SMALL) {
            vcsIns.switchBigStream(raccount.id).then(() => {
                this.tryUpdateRender(raccount);
            }).catch((err) => {
                console.error('自动尝试切大流失败', err);
            });
        }
        if (laccount && laccount.id != this.data.meID && vcsIns.getPullingTrackDesc(laccount!.id) === TrackDesc.CAMERAL_BIG) {
            vcsIns.switchSmallStream(laccount!.id).then(() => {
                this.tryUpdateRender(laccount!);
            }).catch((err) => {
                console.error('自动尝试切小流失败', err);
            });
        }
    },
    /**
     * 获取某成员正在渲染的格子
     * @param account 成员信息
     * @returns 
     */
    getRenderingGrid(account: AccountInfo): string {
        let renderAccounts = this.data.renderAccounts;
        if (renderAccounts.leftBig && renderAccounts.leftBig.id == account.id) {
            return 'leftBig';
        } else if (renderAccounts.right1 && renderAccounts.right1.id == account.id) {
            return 'right1';
        } else if (renderAccounts.right2 && renderAccounts.right2.id == account.id) {
            return 'right2';
        } else if (renderAccounts.right3 && renderAccounts.right3.id == account.id) {
            return 'right3';
        }
        return '';
    },
    /**
     * 尝试更新渲染某成员，如果成员没有在渲染则不做任何事情
     * @param account 成员信息
     * @returns 
     */
    tryUpdateRender(account: AccountInfo) {
        // 如果不是在render直接返回
        let grid = this.getRenderingGrid(account);
        if (grid == '') {
            return;
        }
        console.log('render update', grid, account);
        this.setData({
            [`renderAccounts.${grid}`]: account,
        });
    },
    /**
     * 尝试移除渲染某成员，如果成员没有在渲染则不做任何事情
     * @param account 成员信息
     * @returns 
     */
    tryRemoveRender(account: AccountInfo) {
        let grid = this.getRenderingGrid(account);
        if (grid == '') {
            return;
        }
        console.log('render remove', grid, account);
        this.stopMedia(account);
        this.setData({
            [`renderAccounts.${grid}`]: null,
        });
        // 尝试自动补位
        for (let tmpAccount of this.roomInfo.persons) {
            // 当前没在渲染
            if (account.id != tmpAccount.id && this.getRenderingGrid(tmpAccount) == '') {
                this.tryRender(tmpAccount, grid);
                break;
            }
        }
        // 如果移除的是大网格，并且只剩1人，将自己切过去
        if (grid == 'leftBig' && this.roomInfo.persons.length == 0) {
            this.toggleLeftBig(this.getRenderingGrid(this.roomInfo.me));
        }
    },
    /**
     * 停止微信的媒体播放
     * @param account 成员信息
     */
    stopMedia(account: AccountInfo) {
        if (account.id == this.data.meID) {
            console.log('stop pusher');
            wx.createLivePusherContext().stop();
        } else {
            console.log('stop player', account.id, account.nickname);
            wx.createLivePlayerContext(`player-${account.id}`).stop();
        }
    },
    /**
     * 重新播放
     */
    replay(id: string, reason: string) {
        console.log("重新拉流", id, reason);
        let replay = this.data.replay;
        replay[id] = true;
        this.setData({
            replay: replay
        });

        setTimeout(() => {
            let replay = this.data.replay;
            replay[id] = false;
            this.setData({
                replay: replay
            });
        }, 200);
    },
    /**
     * 重新推流 
     */
    repush(reason: string) {
        console.log("重新推流", reason);
        this.setData({
            repush: true
        });
        setTimeout(() => this.setData({
            repush: false
        }), 200);
    },
    /**
     * 推流状态改变
     * @param event 
     */
    onPushStateChange(event: WechatMiniprogram.CustomEvent): void {
        let dataset = event.target.dataset;
        console.log("pusher statechange", dataset, event.detail);
        vcsIns.updatePusherStateChange(event.detail);
    },
    /**
     * 推流网络状态通知
     * @param event 
     */
    onPushNetStatus(event: WechatMiniprogram.CustomEvent) {
        // let dataset = event.target.dataset;
        // console.log("pusher netstatus", dataset, event.detail);
        vcsIns.updatePusherNetStatus(event.detail);
    },
    /**
     * 推流渲染错误
     * @param event 
     */
    onPushError(event: WechatMiniprogram.CustomEvent) {
        let dataset = event.target.dataset;
        console.log("pusher error", dataset, event.detail);
        wx.showToast({
            icon: "none",
            title: `推流失败${event.detail.errMsg}${event.detail.errCode}，将自动重试`,
        });
        // 尝试重新推流
        this.repush(event.detail.errMsg);
    },
    /**
     * 推流麦克风采集音量大小
     * @param event 
     */
    onPushVolumeNotify(event: WechatMiniprogram.CustomEvent) {
        vcsIns.updatePusherVolume(event.detail);
    },
    /**
     * 拉流状态改变
     * @param event 
     */
    onPlayStateChange(event: WechatMiniprogram.CustomEvent): void {
        let dataset = event.target.dataset;
        console.log(`player statechange`, dataset, event.detail);
        vcsIns.updatePlayerStateChange(event.target.dataset.id, event.detail);

    },
    /**
     * 拉流网络状态通知
     * @param event 
     */
    onPlayNetStatus(event: WechatMiniprogram.CustomEvent) {
        let dataset = event.target.dataset;
        // console.log(`player netstatus`, dataset, event.detail);
        vcsIns.updatePlayerNetStatus(dataset.id, event.detail);
    },
    /**
     * 生命周期函数--监听页面显示
     */
    onShow() {
        if (this.isHide) {
            console.log("页面恢复显示，自动重推重拉");
            // 建议恢复摄像头
            this.isHide = false;
            if (this.isCameraCloseByHide) {
                this.setCameraState(DeviceState.DS_Active);
                this.isCameraCloseByHide = false;
            }
            this.repush("从最小化还原");
            this.replay("all", "从最小化还原");
        }
    },
    /**
     * 生命周期函数--监听页面隐藏
     */
    onHide() {
        console.log("页面隐藏hide");
        // 建议关闭摄像头
        if (this.data.enableCamera) {
            wx.showToast({
                icon: "none",
                title: "最小化，已自动为您关闭摄像头",
            });
            this.setCameraState(DeviceState.DS_Closed);
            // 摄像头关闭后建议重新推流下，减少延时
            this.repush('最小化自动关闭摄像头');
            this.isCameraCloseByHide = true;
        }
        this.isHide = true;
    },
})