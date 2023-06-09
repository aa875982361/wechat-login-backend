import express from 'express';
import config from './config';
import https from 'https'
import { getAccessToken } from './accessToken';
import { request } from './request';
import { QrCodeBase } from './url';
import { getOnlyOneScene, getSceneToken, setSceneToken } from './sceneManager';
import bodyParser from 'body-parser'; // 引入 body-parser 中间件
const axios = require("axios");
const querystring = require("querystring");
const crypto = require('crypto');
const fs = require('fs')
const httpsProxyAgent = require('https-proxy-agent');
const xml2js = require('xml2js') // 引入 xml2js 库
const xmlParser = require('express-xml-bodyparser');


const app = express();


app.use(bodyParser.urlencoded({ extended: true }));
app.use(bodyParser.json());
app.use(xmlParser()); /* 为了解析微信的 xml 格式的文件而加入的 */



// const httpsOptions = {
//   cert: fs.readFileSync('/path/to/domain.crt'),
//   key: fs.readFileSync('/path/to/domain.key')
// }
// const  axiosConfig = { proxy: { host: "127.0.0.1", port: 7890 } }
const httpsAgent = new httpsProxyAgent("http://127.0.0.1:7890");

// 微信公众号 AppID 和 AppSecret, 需要在微信公众号平台上注册并获取
const APP_ID = config.APP_ID;
const APP_SECRET = config.APP_SECRET;
const STATE = config.STATE; // 自定义参数，可以用来防止跨站请求伪造
const redirectUri = `${config.HOST}/api/wechat/callback`;
const token = config.TOKEN || ""


// 处理微信授权登录的回调接口
app.get("/api/wechat/callback", async (req, res) => {
  const { code } = req.query;

  if (!code) {
    return res.status(400).json({ message: "Missing code parameter" });
  }

  try {
    // 获取access_token
    const tokenUrl = `https://api.weixin.qq.com/sns/oauth2/access_token?appid=${APP_ID}&secret=${APP_SECRET}&code=${code}&grant_type=authorization_code`
    const { data: tokenData } = await axios.request({
      url: tokenUrl,
      httpsAgent,
      proxy: false,
      method: "GET"
    });

    // 获取用户信息
    const { access_token, openid } = tokenData;
    const { data: userData } = await axios.request({
      url: `https://api.weixin.qq.com/sns/userinfo?access_token=${access_token}&openid=${openid}&lang=zh_CN`,
      httpsAgent,
      proxy: false,
      method: "GET"
    })

    // TODO: 在此处处理用户信息，例如存储到数据库中
    console.log("userData", userData)

    return res.json({ message: "Success", data: userData });
  } catch (error) {
    console.error(error);
    return res.status(500).json({ message: "Failed to get user info" });
  }
});

// 生成微信授权链接的接口
app.get("/api/wechat/auth", (req, res) => {
  // redirect_uri 是微信授权后回调的地址，需要在微信公众号平台上配置

  const scope = "snsapi_userinfo";
  const appId = APP_ID;

  const params = {
    appid: appId,
    redirect_uri: redirectUri,
    response_type: "code",
    scope: scope,
    state: STATE,
  };

  const url = `https://open.weixin.qq.com/connect/oauth2/authorize?${querystring.stringify(
    params
  )}#wechat_redirect`;

  return res.redirect(url);
});

// 生成带有扫码状态的二维码
app.get("/api/oauth/qrcode", async (req, res) => {
  // 场景值
  const scene = getOnlyOneScene()
  console.log("/api/oauth/qrcode scene", scene);
  
  const accessToken = await getAccessToken()
  console.log("/api/oauth/qrcode accessToken", accessToken)
  // 构建请求url
  const getQrCodeUrl = `${QrCodeBase}?access_token=${accessToken}`
  console.log("/api/oauth/qrcode getQrCodeUrl");
  
  // {"ticket":"gQH47joAAAAAAAAAASxodHRwOi8vd2VpeGluLnFxLmNvbS9xL2taZ2Z3TVRtNzJXV1Brb3ZhYmJJAAIEZ23sUwMEmm
  // 3sUw==","expire_seconds":60,"url":"http://weixin.qq.com/q/kZgfwMTm72WWPkovabbI"}
  // 文档：https://developers.weixin.qq.com/doc/offiaccount/Account_Management/Generating_a_Parametric_QR_Code.html
  // 获取ticket
  const response = await request({
    url: getQrCodeUrl,
    method: "POST",
    data: {
      "expire_seconds": 604800,
      "action_name": "QR_STR_SCENE",
      "action_info": {
        "scene": {
          "scene_str": scene
        }
      }
    }
  })
  console.log("/api/oauth/qrcode getQrCodeUrl response", response.data);
  
  const { ticket, expire_seconds, url } = response?.data || {} 
  console.log("/api/oauth/qrcode ticket", ticket);
  console.log("/api/oauth/qrcode url", url);
  
  // 生成二维码图片的URL
  const qrcodeUrl = `https://mp.weixin.qq.com/cgi-bin/showqrcode?ticket=${encodeURIComponent(ticket)}`;
  
  const result = {
    qrcodeUrl,
    scene
  }
  console.log("/api/oauth/qrcode result", result);
  return res.send(JSON.stringify(result));
});

app.get("/api/oauth/scene", async (req, res) => {
  const scene = req.query.scene as string || "" 
  console.log("/api/oauth/scene", scene);
  // 检查scene 有没有登录成功
  const token = getSceneToken(scene)
  const result = {
    token
  }
  console.log("/api/oauth/scene result", result);
  return res.send(JSON.stringify(result));
  
})

app.get('/api/wechat', (req, res) => {
  console.log("/api/wechat query", req.query)
  console.log("/api/wechat body", req.body)
  console.log("/api/wechat body xml ", req.body?.xml)
  const signature = req.query.signature;
  const timestamp = req.query.timestamp;
  const nonce = req.query.nonce;
  const echostr = req.query.echostr;

  const signatureArr = [token, timestamp, nonce];
  console.log("signatureArr", signatureArr);
  
  signatureArr.sort();
  const signatureStr = signatureArr.join('');
  const genSignature = crypto.createHash('sha1').update(signatureStr).digest('hex');
  console.log("genSignature", genSignature);
  console.log("signature", signature);
  
  if (genSignature === signature) {
    res.send(echostr);
  } else {
    res.send("success")
  }
});
// 接受微信的消息推送
app.post('/api/wechat', (req, res) => {
  console.log("/api/wechat query", req.query)
  console.log("/api/wechat body", req.body)
  console.log("/api/wechat body xml ", req.body?.xml)
  let xml = req.body.xml // 获取 POST 请求中的 xml 数据
  if(!xml){
    console.warn("没有xml消息体");
    
    res.send("success")
    return
  }
  /**
   * {
       tousername: [ 'gh_00eefa0749a6' ],
       fromusername: [ 'oPuYn6s3yuFnvmk74ZhYajZyrVCY' ],
       createtime: [ '1681906907' ],
       msgtype: [ 'event' ],
       event: [ 'SCAN' ],
       eventkey: [ 'gcy6uIm5KzTxxA9uRWkQXSWJLjLZ7RGz' ],
       ticket: [
         'gQHh8DwAAAAAAAAAAS5odHRwOi8vd2VpeGluLnFxLmNvbS9xLzAyS25Fbk04LUNjREcxaGxuOTFBY2EAAgTV3D9kAwSAOgkA'
       ]
     }

    {
      tousername: [ 'gh_00eefa0749a6' ],
      fromusername: [ 'oPuYn6p-ugQrPrg2AJgLhscRPdkw' ],
      createtime: [ '1681913092' ],
      msgtype: [ 'event' ],
      event: [ 'subscribe' ],
      eventkey: [ 'qrscene_AmQ2SGOMsnpiK7OOeXVOMMC35FxNxfkO' ],
      ticket: [
        'gQGT8DwAAAAAAAAAAS5odHRwOi8vd2VpeGluLnFxLmNvbS9xLzAybk96VE5ULUNjREcxaFhMOU5BY04AAgT79D9kAwSAOgkA'
      ]
    }
   */
  const {event = [], eventkey = [], fromusername = [] } = xml
  const eventName = event[0] || ""
  const userOpenId = fromusername[0] || ""
  switch(eventName){
    case "SCAN":
      const scene = eventkey[0] || ""
      if(!userOpenId || !scene){
        console.warn("没有用户openid 或者没有scene", userOpenId, scene)
      }else{
        // 设置场景值对应的openid
        setSceneToken(scene, userOpenId)
      }
      break
    case "subscribe":
      // qrscene_AmQ2SGOMsnpiK7OOeXVOMMC35FxNxfkO
      const qrSceneStr = eventkey[0] || ""
      // 如果是扫码关注的场景
      // 需要分割场景值
      const realScene = qrSceneStr.split("_")[1] || ""
      if(!userOpenId || !realScene){
        console.warn("没有用户 openid 或者没有 realScene", userOpenId, realScene)
      }else{
        // 设置场景值对应的openid
        setSceneToken(realScene, userOpenId)
      }
      break
  }
  // 如果前面没有返回值 默认返回成功
  res.send("success")

});



const port = process.env.PORT || 8080;
app.listen(port, () => console.log(`Server running on port ${port}`));