import axios from "axios"
import { HttpsProxyAgent } from "https-proxy-agent";

const httpsAgent = new HttpsProxyAgent("http://127.0.0.1:7890");

export interface RequestConfig {
  url: string,
  method?: "GET" | "POST",
  data?: any
}

/**
 * 代理一层服务
 * @param config 
 * @returns 
 */
 export async function request(config: RequestConfig): Promise<any>{
  const { url, method = "GET", data } = config
  return await axios.request({
    url: url,
    httpsAgent,
    proxy: false,
    method,
    data
  })
}