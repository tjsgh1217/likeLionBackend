#!/bin/bash

# 🚀 LikeLionB 자동화 배포 스크립트
# 사용법: ./deploy.sh

set -e  # 에러 발생 시 스크립트 중단

echo "🚀 LikeLionB 자동화 배포 시작..."

# 서버 정보
SERVER_IP="13.125.151.212"
SSH_USER="ec2-user"
KEY_FILE="./server163.pem"
REMOTE_DIR="~/likeLionB"

# 색상 정의
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# 로그 함수
log_info() {
    echo -e "${BLUE}[INFO]${NC} $1"
}

log_success() {
    echo -e "${GREEN}[SUCCESS]${NC} $1"
}

log_warning() {
    echo -e "${YELLOW}[WARNING]${NC} $1"
}

log_error() {
    echo -e "${RED}[ERROR]${NC} $1"
}

# 1단계: 빌드
log_info "1단계: 로컬 빌드 시작..."
if npm run build; then
    log_success "빌드 완료!"
else
    log_error "빌드 실패! 스크립트를 중단합니다."
    exit 1
fi

# 2단계: 서버 연결 확인
log_info "2단계: 서버 연결 확인..."
if ssh -i "$KEY_FILE" -o ConnectTimeout=10 "$SSH_USER@$SERVER_IP" "echo '서버 연결 성공!'" > /dev/null 2>&1; then
    log_success "서버 연결 성공!"
else
    log_error "서버 연결 실패! 키 파일과 서버 정보를 확인하세요."
    exit 1
fi

# 3단계: 소스 코드 전송
log_info "3단계: 소스 코드 전송..."
if scp -i "$KEY_FILE" -r ./dist "$SSH_USER@$SERVER_IP:$REMOTE_DIR/"; then
    log_success "소스 코드 전송 완료!"
else
    log_error "소스 코드 전송 실패!"
    exit 1
fi

# 4단계: 서버에서 빌드 및 재시작
log_info "4단계: 서버에서 서비스 재시작..."
ssh -i "$KEY_FILE" "$SSH_USER@$SERVER_IP" << 'EOF'
    cd ~/likeLionB
    
    # PM2 서비스 중지
    echo "PM2 서비스 중지 중..."
    pm2 stop likeLionB 2>/dev/null || true
    
    # 서비스 재시작
    echo "PM2 서비스 재시작 중..."
    pm2 start ecosystem.config.js
    
    # 상태 확인
    echo "서비스 상태 확인 중..."
    pm2 status likeLionB
    
    # 서비스 저장 (서버 재부팅 시 자동 시작)
    pm2 save
EOF

if [ $? -eq 0 ]; then
    log_success "서비스 재시작 완료!"
else
    log_error "서비스 재시작 실패!"
    exit 1
fi

# 5단계: 서비스 상태 확인
log_info "5단계: 서비스 상태 확인..."
sleep 3
if curl -s "http://$SERVER_IP:8080" > /dev/null; then
    log_success "서비스 정상 작동 확인!"
    echo -e "${GREEN}🎉 배포 완료! 서비스가 정상적으로 실행되고 있습니다.${NC}"
    echo -e "${BLUE}서비스 URL: http://$SERVER_IP:8080${NC}"
else
    log_warning "서비스 응답이 없습니다. 잠시 후 다시 확인해보세요."
fi

echo ""
log_info "배포 스크립트 실행 완료!"
