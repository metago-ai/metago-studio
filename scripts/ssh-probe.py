#!/usr/bin/env python3
"""
SSH 探测腾讯云服务器环境
"""
import paramiko
import sys

HOST = '118.24.186.55'
PORT = 22
USER = 'ubuntu'
PASS = 'Yx860215'

def run_cmd(ssh, cmd):
    stdin, stdout, stderr = ssh.exec_command(cmd, timeout=15)
    out = stdout.read().decode('utf-8', errors='replace')
    err = stderr.read().decode('utf-8', errors='replace')
    return out + (f"\n[stderr] {err}" if err.strip() else "")

def main():
    ssh = paramiko.SSHClient()
    ssh.set_missing_host_key_policy(paramiko.AutoAddPolicy())
    try:
        ssh.connect(HOST, port=PORT, username=USER, password=PASS, timeout=15)
    except Exception as e:
        print(f"SSH 连接失败: {e}")
        sys.exit(1)

    print("=" * 60)
    print("腾讯云服务器环境探测")
    print("=" * 60)

    print("\n=== 系统信息 ===")
    print(run_cmd(ssh, "uname -a").strip())

    print("\n=== Node.js / npm 版本 ===")
    print(run_cmd(ssh, "node -v 2>/dev/null || echo 'Node.js 未安装'; npm -v 2>/dev/null || echo 'npm 未安装'").strip())

    print("\n=== 已占用端口（LISTEN）===")
    print(run_cmd(ssh, "sudo netstat -tlnp 2>/dev/null | grep LISTEN | head -40").strip())

    print("\n=== 已占用端口号列表 ===")
    print(run_cmd(ssh, "sudo netstat -tlnp 2>/dev/null | grep LISTEN | awk '{print $4}' | rev | cut -d: -f1 | rev | sort -un").strip())

    print("\n=== PM2 进程列表 ===")
    print(run_cmd(ssh, "pm2 list 2>/dev/null || echo 'PM2 未安装'").strip())

    print("\n=== Nginx 站点 ===")
    print(run_cmd(ssh, "ls /etc/nginx/sites-enabled/ 2>/dev/null || echo '无 Nginx 或无 sites-enabled'").strip())

    print("\n=== Nginx 反代配置 ===")
    print(run_cmd(ssh, "grep -r 'proxy_pass\\|server_name\\|listen' /etc/nginx/sites-enabled/ 2>/dev/null | head -30").strip())

    print("\n=== Docker 容器 ===")
    print(run_cmd(ssh, "sudo docker ps 2>/dev/null | head -20 || echo 'Docker 未安装或未运行'").strip())

    print("\n=== home 目录内容 ===")
    print(run_cmd(ssh, "ls -la ~").strip())

    print("\n=== 磁盘空间 ===")
    print(run_cmd(ssh, "df -h / | tail -1").strip())

    print("\n=== 内存 ===")
    print(run_cmd(ssh, "free -h | head -2").strip())

    print("\n=== CPU 核数 ===")
    print(run_cmd(ssh, "nproc").strip())

    ssh.close()
    print("\n" + "=" * 60)
    print("探测完成")

if __name__ == '__main__':
    main()
