import express from 'express';
import config from './config';
import https from 'https'
const axios = require("axios");
const querystring = require("querystring");
const crypto = require('crypto');
const fs = require('fs')
const httpsProxyAgent = require('https-proxy-agent');

const app = express();

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
app.get("/oauth/qrcode", async (req, res) => {
  const redirect_uri = encodeURIComponent(
    redirectUri
  ); // 回调地址，需要在公众号后台配置
  const scope = "snsapi_base";
  const appId = APP_ID;
  const params = {
    appid: appId,
    redirect_uri: redirect_uri,
    response_type: "code",
    scope: scope,
    state: STATE,
  };
  const url = `https://open.weixin.qq.com/connect/qrconnect?appid=${APP_ID}&response_type=code&scope=snsapi_userinfo&redirect_uri=${redirect_uri}&state=${STATE}#wechat_redirect`
  const { data } = await axios.get(
    `https://open.weixin.qq.com/connect/qrconnect?appid=${APP_ID}&response_type=code&scope=snsapi_login&redirect_uri=${redirect_uri}&state=${STATE}#wechat_redirect`
  );

  console.log("url", url)

  console.log("qrcode data", data)
  return res.send(data);
});

app.get('/api/wechat', (req, res) => {
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
    res.send('Invalid signature');
  }
});



const port = process.env.PORT || 8080;
app.listen(port, () => console.log(`Server running on port ${port}`));