# 判断日志文件夹是否存在
if [ ! -d "./release-log" ]; then
    mkdir "./release-log"
fi

# 设置默认处理分支
BranchName=main
if [ "" = "$1" ] ; then  
    echo "没有第一个参数"  
    # 切换到maste分支
    git checkout main
    # 先拉最新的代码
    git pull
    # 设置新的分支名
    RELEASE_NAME=release-$(date "+%Y%m%d%H%M%S")
    echo $RELEASE_NAME
    # 创建一个新版本的分支
    git checkout -b $RELEASE_NAME
    # 将最近3条git 日志 写入log
    LOG_FILE_PATH=release-log/$RELEASE_NAME.txt
    # 输出日志路径
    echo $LOG_FILE_PATH
    # 将最近的3条git记录保存到文件
    git log  -3  --pretty=format:'%s' --abbrev-commit   | awk   -F ':'   '{print   NR " "  $0 }' > $LOG_FILE_PATH
    # 输出这次的更新内容
    cat $LOG_FILE_PATH
else  
    echo "需要切换到版本$1"
    RELEASE_NAME=$1
    git checkout $RELEASE_NAME
fi  

# 设置环境变量
export PORT=8088
# 安装依赖库
npm install
# 启动服务
# npm run prod
# 通过pm2 启动服务
# 先restart pm2的服务 
echo "开始重启pm2 服务"
npx pm2 restart wechat_login
# 输出执行结果
if [ $? -eq 0 ]; then  
    echo "restart 成功"
else  
    echo "restart 出错" 
    echo "start 一下"
    npx pm2 start ts-node --name=wechat_login -- --transpile-only ./src/index.ts
    if [ $? -eq 0 ]; then  
        echo "start 成功"
    else  
        echo "start 出错" 
    fi 
fi 
# 切换为main分支
git checkout main