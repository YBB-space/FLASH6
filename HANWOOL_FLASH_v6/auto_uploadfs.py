Import("env")

def before_upload(source, target, env):
    print("=== auto uploadfs before normal upload ===")
    # 먼저 LittleFS(또는 SPIFFS) 파일 시스템 업로드
    env.Execute("pio run -t uploadfs")

# 'upload' 타겟 실행 전에 위 함수를 한 번 호출하게 등록
env.AddPreAction("upload", before_upload)