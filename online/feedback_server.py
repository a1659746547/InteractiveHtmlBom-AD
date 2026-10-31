"""Standalone feedback endpoint; keep separate from the deployed sharing service."""
import hashlib
import base64
import io
import json
import os
import re
import secrets
import smtplib
import ssl
import threading
import time
from datetime import datetime, timezone
from email.message import EmailMessage
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer

RECIPIENT = 'tnanastar@163.com'
CATEGORIES = {'bug': '使用问题', 'idea': '功能建议', 'other': '其他反馈'}
VIEWS = {'主页', 'PCB 装配', 'Gerber 查看'}
MAX_IMAGE = 5 * 1024 * 1024
MAX_BODY = 21 * 1024 * 1024


def validate_images(items):
    if not isinstance(items, list) or len(items) > 3:
        raise ValueError('最多发送 3 张图片')
    if not items:
        return []
    from PIL import Image
    result = []
    formats = {'image/jpeg': ('JPEG', 'jpg'), 'image/png': ('PNG', 'png'), 'image/webp': ('WEBP', 'webp')}
    for index, item in enumerate(items):
        if not isinstance(item, dict) or not isinstance(item.get('data'), str) or item.get('mime') not in formats:
            raise ValueError('图片格式无效')
        if len(item['data']) > ((MAX_IMAGE + 2) // 3) * 4:
            raise ValueError('单张图片最大 5 MB')
        raw = base64.b64decode(item['data'], validate=True)
        if not 0 < len(raw) <= MAX_IMAGE:
            raise ValueError('单张图片最大 5 MB')
        expected, extension = formats[item['mime']]
        try:
            with Image.open(io.BytesIO(raw)) as image:
                if image.format != expected or image.width * image.height > 20_000_000 or getattr(image, 'n_frames', 1) != 1:
                    raise ValueError('仅支持 2000 万像素以内的静态 JPG、PNG、WebP')
                image.verify()
            # Decode then re-encode without metadata or trailing embedded payloads.
            with Image.open(io.BytesIO(raw)) as image:
                image.load()
                clean = image.convert('RGB' if expected == 'JPEG' else 'RGBA')
                clean.info.clear()
                output = io.BytesIO()
                clean.save(output, format=expected, **({'quality': 90} if expected != 'PNG' else {}))
                cleaned = output.getvalue()
            if len(cleaned) > MAX_IMAGE:
                raise ValueError('请压缩图片后再发送')
        except Exception as exc:
            raise ValueError('图片损坏、过大或格式不支持') from exc
        result.append({'mime': item['mime'], 'bytes': cleaned, 'filename': f'feedback-{index + 1}.{extension}'})
    return result


def validate(data):
    if not isinstance(data, dict):
        raise ValueError('反馈格式无效')
    if data.get('category') not in CATEGORIES:
        raise ValueError('请选择反馈类型')
    for field in ('content', 'contact', 'website', 'view'):
        if not isinstance(data.get(field, ''), str):
            raise ValueError('反馈格式无效')
    content = data.get('content', '').strip()
    contact = data.get('contact', '').strip()
    if not 5 <= len(content) <= 3000:
        raise ValueError('反馈内容须为 5～3000 个字')
    if len(contact) > 100 or any(c in contact for c in '\r\n\x00'):
        raise ValueError('联系方式格式无效')
    if '\x00' in content or data.get('website'):
        raise ValueError('反馈格式无效')
    view = data.get('view', '主页')
    if view not in VIEWS:
        raise ValueError('页面类型无效')
    return {'category': data['category'], 'content': content, 'contact': contact, 'view': view,
            'images': validate_images(data.get('images', []))}


def mail_settings():
    return {'host': os.environ.get('FEEDBACK_SMTP_HOST', 'smtp.163.com'),
            'port': int(os.environ.get('FEEDBACK_SMTP_PORT', '465')),
            'user': os.environ.get('FEEDBACK_SMTP_USER', RECIPIENT),
            'password': os.environ.get('FEEDBACK_SMTP_PASSWORD', '')}


def deliver(data, settings, smtp_factory=None):
    if not settings['password']:
        raise RuntimeError('mail_not_configured')
    if not re.fullmatch(r'[^\s<>@,;]+@[^\s<>@,;]+\.[^\s<>@,;]+', settings['user']):
        raise RuntimeError('invalid_sender')
    message = EmailMessage()
    message['From'] = settings['user']
    message['To'] = RECIPIENT
    message['Subject'] = '[PCB 装配助手反馈] ' + CATEGORIES[data['category']]
    message.set_content('反馈类型：' + CATEGORIES[data['category']] + '\n页面：' + data['view']
                        + '\n时间（UTC）：' + datetime.now(timezone.utc).isoformat(timespec='seconds')
                        + '\n联系方式：' + (data['contact'] or '未填写')
                        + '\n\n反馈内容：\n' + data['content'])
    for image in data.get('images', []):
        message.add_attachment(image['bytes'], maintype='image', subtype=image['mime'].split('/')[1], filename=image['filename'])
    factory = smtp_factory or smtplib.SMTP_SSL
    with factory(settings['host'], settings['port'], timeout=12,
                 context=ssl.create_default_context()) as client:
        client.login(settings['user'], settings['password'])
        refused = client.send_message(message, from_addr=settings['user'], to_addrs=[RECIPIENT])
        if refused:
            raise RuntimeError('recipient_refused')


class Limiter:
    def __init__(self):
        self.lock = threading.Lock()
        self.entries = {}
        self.global_times = []
        self.salt = secrets.token_bytes(32)

    def allow(self, ip, now=None):
        now = time.monotonic() if now is None else now
        key = hashlib.sha256(self.salt + ip.encode()).hexdigest()
        with self.lock:
            self.entries = {k: [t for t in v if t > now - 3600]
                            for k, v in self.entries.items() if v and v[-1] > now - 3600}
            self.global_times = [t for t in self.global_times if t > now - 3600]
            history = self.entries.get(key, [])
            if len(history) >= 3 or len(self.global_times) >= 50 or len(self.entries) >= 5000:
                return False
            self.entries[key] = history + [now]
            self.global_times.append(now)
            return True


LIMITER = Limiter()
SLOTS = threading.BoundedSemaphore(2)


class Handler(BaseHTTPRequestHandler):
    def setup(self):
        super().setup()
        self.connection.settimeout(60)

    def log_message(self, *args):
        pass  # Never record feedback contents, contact information or SMTP credentials.

    def reply(self, status, data):
        body = json.dumps(data, ensure_ascii=False).encode()
        self.send_response(status)
        self.send_header('Content-Type', 'application/json; charset=utf-8')
        self.send_header('Cache-Control', 'no-store')
        self.send_header('X-Content-Type-Options', 'nosniff')
        self.send_header('Content-Length', str(len(body)))
        self.end_headers()
        self.wfile.write(body)

    def do_POST(self):
        if self.path != '/api/feedback':
            return self.reply(404, {'error': '接口不存在'})
        if self.headers.get('Origin') != os.environ.get('FEEDBACK_ORIGIN', 'https://pcb.kn21.xyz'):
            return self.reply(403, {'error': '请通过网站反馈表单提交'})
        if self.headers.get('Content-Type', '').split(';')[0].strip().lower() != 'application/json':
            return self.reply(415, {'error': '请求格式无效'})
        if self.headers.get('Transfer-Encoding') or len(self.headers.get_all('Content-Length', [])) != 1:
            return self.reply(400, {'error': '请求格式无效'})
        try:
            length = int(self.headers.get('Content-Length', '0'))
        except ValueError:
            length = 0
        if not 0 < length <= MAX_BODY:
            return self.reply(413, {'error': '图片与反馈内容超过大小限制'})
        ip = self.headers.get('X-Real-IP', self.client_address[0])[:100]
        if not LIMITER.allow(ip):
            return self.reply(429, {'error': '提交过于频繁，请稍后再试'})
        if not SLOTS.acquire(blocking=False):
            return self.reply(503, {'error': '反馈服务繁忙，请稍后再试'})
        try:
            return self.process_feedback(length)
        finally:
            SLOTS.release()

    def process_feedback(self, length):
        try:
            payload = validate(json.loads(self.rfile.read(length)))
        except (ValueError, TypeError, KeyError, RecursionError, OSError):
            return self.reply(400, {'error': '请检查反馈内容和图片：最多 3 张静态 JPG、PNG、WebP，每张 5 MB'})
        except ImportError:
            return self.reply(503, {'error': '图片服务暂不可用，请稍后重试'})
        try:
            settings = mail_settings()
        except ValueError:
            return self.reply(503, {'error': '邮件服务暂未配置，请稍后再试'})
        if not settings['password']:
            return self.reply(503, {'error': '邮件服务暂未配置，请稍后再试'})
        try:
            deliver(payload, settings)
        except Exception:
            return self.reply(502, {'error': '邮件发送未确认，请稍后重试'})
        return self.reply(200, {'ok': True})

    def do_GET(self):
        if self.path == '/api/feedback':
            try:
                ready = bool(mail_settings()['password'])
            except (ValueError, KeyError):
                ready = False
            return self.reply(200 if ready else 503, {'service': 'pcb-feedback', 'ready': ready})
        return self.reply(405, {'error': '请通过反馈表单提交'})


if __name__ == '__main__':
    ThreadingHTTPServer(('127.0.0.1', int(os.environ.get('FEEDBACK_PORT', '8769'))), Handler).serve_forever()
