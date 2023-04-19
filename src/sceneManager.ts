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
    resultScene = generateRandomString(32)
  }
  // 初始化
  sceneMap[resultScene] = {
    // 过期时间 两个小时后
    expireTime: +new Date() + effectiveTime
  }
  return resultScene
}
/**
 * 获取场景值对应的参数
 * @param scene 
 * @returns 
 */
export function getSceneToken(scene: string): string {
  const token = scene && sceneMap[scene] && sceneMap[scene].token || ""
  return token
}

/**
 * 设置场景值对应的openid
 * @param scene 
 * @param openId 
 * @returns 
 */
export function setSceneToken(scene: string, openId: string): boolean{
  if(!scene || !openId){
    return false
  }
  if(!sceneMap[scene]){
    console.warn("没有对应的场景值", scene)
    return false
  }
  // TODO:接入生成jwt的服务
  console.log("setSceneToken 成功", scene, openId);
  
  sceneMap[scene].token = openId
  return true
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
