#!/bin/bash

# ⚡ LikeLionB 빠른 배포 스크립트
# 사용법: ./quick-deploy.sh

echo "⚡ 빠른 배포 시작..."

# 빌드
npm run build

# dist 폴더만 전송
scp -i ./server163.pem -r ./dist ec2-user@13.125.151.212:~/likeLionB/

# 서비스 재시작
ssh -i ./server163.pem ec2-user@13.125.151.212 "cd ~/likeLionB && pm2 restart likeLionB"

echo "✅ 빠른 배포 완료!"
