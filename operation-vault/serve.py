#!/usr/bin/env python3
"""작전명 스낵 볼트 실행용 간이 서버.

저장소 루트를 내보내므로 기존 게임도 같은 주소에서 함께 열린다.
- .js 파일을 항상 자바스크립트로 내보낸다 (ES 모듈은 형식이 틀리면 실행되지 않는다).
- 캐시를 끄므로 두 폰이 서로 다른 버전을 쓰는 일이 없다.

사용법:  python3 serve.py [포트]      (기본 8000)
"""
import http.server
import os
import socket
import sys

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
PORT = int(sys.argv[1]) if len(sys.argv) > 1 else 8000


class Handler(http.server.SimpleHTTPRequestHandler):
    extensions_map = {
        **http.server.SimpleHTTPRequestHandler.extensions_map,
        ".js": "text/javascript",
        ".mjs": "text/javascript",
        ".css": "text/css",
        ".html": "text/html; charset=utf-8",
    }

    def __init__(self, *args, **kwargs):
        super().__init__(*args, directory=ROOT, **kwargs)

    def end_headers(self):
        self.send_header("Cache-Control", "no-cache, no-store, must-revalidate")
        super().end_headers()

    def log_message(self, fmt, *args):
        pass  # 요청 로그는 생략


def lan_ip():
    """같은 Wi-Fi의 폰에서 접속할 주소를 알아낸다."""
    s = socket.socket(socket.AF_INET, socket.SOCK_DGRAM)
    try:
        s.connect(("10.255.255.255", 1))
        return s.getsockname()[0]
    except OSError:
        return "127.0.0.1"
    finally:
        s.close()


if __name__ == "__main__":
    http.server.ThreadingHTTPServer.allow_reuse_address = True
    with http.server.ThreadingHTTPServer(("0.0.0.0", PORT), Handler) as httpd:
        print("작전명 스낵 볼트 서버가 켜졌습니다.")
        print(f"  부모 폰에서 열 주소: http://{lan_ip()}:{PORT}/operation-vault/")
        print(f"  이 컴퓨터에서:      http://localhost:{PORT}/operation-vault/")
        print("끝내려면 Ctrl+C 를 누르세요.")
        try:
            httpd.serve_forever()
        except KeyboardInterrupt:
            print("\n서버를 껐습니다.")
