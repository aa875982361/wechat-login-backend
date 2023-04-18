/**
 * 处理accessToken 的获取和定时刷新
 */

import { request } from "./request"
import config from "./config"


// 获取access_token的地址
const getAccessTokenUrl = `https://api.weixin.qq.com/cgi-bin/token?grant_type=client_credential&appid=${config.APP_ID}&secret=${config.APP_SECRET}`
// 定时刷新时间
const refreshTime = 1000 * 60 * 60 * 2
let accessToken = ""
let preTokenTime = 0
let getAccessTokenPromise: undefined | Promise<string>
/**
 * 获取accesstoken
 * @returns 
 */
export async function getAccessToken(): Promise<string> {
  const currentTime = +new Date()
  if(accessToken && currentTime - preTokenTime < refreshTime){
    // 存在token 并且在2个小时内 则直接返回
    return accessToken
  }
  // 请求token
  // 使用一个promise 缓存
  if(!getAccessTokenPromise){
    getAccessTokenPromise = request({
      url: getAccessTokenUrl
    }).then(res => {
      console.log("getAccessToken", res?.data, res);
      // 重置
      getAccessTokenPromise = undefined
      // 保存accessToken
      accessToken = res?.data?.access_token
      // 返回结果
      return res?.data?.access_token
    })
  }
  return await getAccessTokenPromise
}

