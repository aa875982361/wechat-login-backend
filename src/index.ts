import express from 'express';
import config from './config';
import https from 'https'
import { getAccessToken } from './accessToken';
import { request } from './request';
import { QrCodeBase } from './url';
import { getOnlyOneScene, getSceneToken } from './sceneManager';
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
  res.send("success")
  // let xml = req.body.xml // 获取 POST 请求中的 xml 数据
  // if(!xml){

  // }
  // // 将 xml 数据解析成 JSON 对象
  // xml2js.parseString(xml, {explicitArray: false}, (err: any, json: any) => {
  //   if (err) {
  //     console.log('解析 XML 错误')
  //     console.log(err)
  //     return res.send('error')
  //   }
  //   let result = json.xml
  //   // 在这里对接收到的消息进行处理
  //   console.log(result)
  //   // 返回成功
  //   res.send('success')
  // })

});



const port = process.env.PORT || 8080;
app.listen(port, () => console.log(`Server running on port ${port}`));