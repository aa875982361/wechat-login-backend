/**
 * 管理scene的方法
 */
const sceneMap: Record<string, any> = {
  // "32位字符": { endTime: 111, userInfo: { openId: "xxx"}}
}
// 字符集
const characters = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
// 字符集长度
const charactersLength = characters.length;
// scene 有效时间
const effectiveTime = 1000 * 60 * 60 * 3

/**
 * 获取一个唯一scene
 * @returns 
 */
export function getOnlyOneScene(): string{
  // 随机生成32位字符
  let resultScene = ""
  // 没有结果scene 或者 原本存在 就继续换
  while(!resultScene || sceneMap[resultScene]){
    // 生成新的scene
    resultScene = generateRandomString(16)
  }
  // 初始化
  sceneMap[resultScene] = {
    // 过期时间 两个小时后
    expireTime: +new Date() + effectiveTime
  }
  return resultScene
}

/**
 * 获取随机字符
 * @param length 
 * @returns 
 */
function generateRandomString(length: number): string  {
  let result = '';

  for (let i = 0; i < length; i++) {
    result += characters.charAt(Math.floor(Math.random() * charactersLength));
  }
  return result;
}
