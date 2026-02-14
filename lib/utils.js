// plugins/ultimate-image-manager/lib/utils.js
import path from 'path';

export function sanitizeName(name) {
  return (
    name
      .replace(/[<>:"/\\|?*]/g, '')
      .replace(/\s+/g, '_')
      .substring(0, 50)
      .trim() || '未命名_' + Date.now().toString(36).slice(-4)
  );
}

export function sanitizeCategory(name) {
  return name
    .replace(/[^a-zA-Z0-9\u4e00-\u9fa5_-]/g, '')
    .substring(0, 30)
    .trim() || 'default';
}

export function formatSize(bytes) {
  if (bytes >= 1024 * 1024) return `${(bytes / (1024 * 1024)).toFixed(1)}MB`;
  return `${(bytes / 1024).toFixed(1)}KB`;
}

export function generateDefaultName() {
  return `图片_${Date.now().toString(36)}`;
}

export function generateFilenameFromUrl(url) {
  try {
    const parsed = new URL(url);
    let base = path.basename(parsed.pathname, path.extname(parsed.pathname)) || '网络图片';
    base = base.replace(/[^a-zA-Z0-9一-龥_-]/g, '');
    const domain = parsed.hostname.replace('www.', '').split('.')[0];
    return `${domain}_${base}`.substring(0, 40);
  } catch {
    return '网络图片_' + Date.now().toString(36).slice(-6);
  }
}

export function errorTranslator(err, maxFileSize) {
  const errors = {
    ECONNRESET: '🌐 连接意外断开',
    ECONNABORTED: '⏳ 下载超时',
    ENOTFOUND: '🌐 域名无法解析',
    EACCES: '🔒 文件访问权限不足',
    ENOENT: '❌ 文件不存在',
    HTTP_404: '🔗 图片不存在(404)',
    HTTP_403: '🔒 无访问权限(403)',
    HTTP_500: '🛑 服务器错误(500)',
    TIMEOUT: '⏳ 请求超时',
    FILE_SIZE_EXCEEDED: `❌ 文件大小超过限制（最大 ${formatSize(maxFileSize)}）`,
    invalid_type: (ext) => `❌ 不支持 ${ext} 格式文件`,
  };

  if (err.message.startsWith('invalid_type')) {
    return errors.invalid_type(err.message.split(':')[1]);
  }
  if (err.message === 'FILE_SIZE_EXCEEDED') return errors.FILE_SIZE_EXCEEDED;
  if (err.message === 'TIMEOUT') return errors.TIMEOUT;
  if (err.message.startsWith('HTTP_')) return errors[err.message] || `HTTP错误: ${err.message.split('_')[1]}`;
  if (err.code && errors[err.code]) return errors[err.code];
  return errors[err.message] || `未知错误：${err.message}`;
}