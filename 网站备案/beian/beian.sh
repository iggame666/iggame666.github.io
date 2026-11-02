#!/bin/bash
cd /root/beian  # 将 /path/to/your/app 替换为 app.py 所在的目录
/usr/bin/gunicorn -w 4 -b 0.0.0.0:80 app:app  # 启动 Gunicorn，监听 80 端口