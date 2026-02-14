// plugins/ultimate-image-manager/lib/ImageManager.js
import fs from 'fs';
import path from 'path';
import https from 'https';
import http from 'http';
import { pipeline } from 'stream/promises';
import { segment } from 'node-karin';
import { fileURLToPath } from 'url';
import {
  sanitizeName,
  sanitizeCategory,
  formatSize,
  generateDefaultName,
  generateFilenameFromUrl,
  errorTranslator,
} from './utils.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

export class ImageManager {
  constructor(config) {
    this.config = config;
    this.imageDir = config.imageDir;
    this.maxFileSize = config.maxFileSize;
    this.allowedTypes = config.allowedTypes;
  }

  // ========== 下载图片 ==========
  async downloadImage(url, timeout = 10000) {
    return new Promise((resolve, reject) => {
      const protocol = url.startsWith('https') ? https : http;
      const req = protocol.get(url, { timeout }, (res) => {
        if (res.statusCode !== 200) {
          return reject(new Error(`HTTP_${res.statusCode}`));
        }
        if (res.headers['content-length'] > this.maxFileSize) {
          return reject(new Error('FILE_SIZE_EXCEEDED'));
        }

        const chunks = [];
        let totalLength = 0;

        res.on('data', (chunk) => {
          chunks.push(chunk);
          totalLength += chunk.length;
          if (totalLength > this.maxFileSize) {
            req.destroy();
            reject(new Error('FILE_SIZE_EXCEEDED'));
          }
        });

        res.on('end', () => {
          resolve(Buffer.concat(chunks));
        });

        res.on('error', reject);
      });

      req.on('timeout', () => {
        req.destroy();
        reject(new Error('TIMEOUT'));
      });

      req.on('error', reject);
    });
  }

  // ========== 验证并保存图片 ==========
  async validateAndSaveImage(buffer, customName = null, saveDir = this.imageDir) {
    if (!buffer || buffer.length === 0) {
      return { success: false, message: '图片数据为空' };
    }

    if (buffer.length > this.maxFileSize) {
      return { success: false, message: `文件大小超过限制（最大 ${formatSize(this.maxFileSize)}）` };
    }

    // 判断图片类型
    let ext = '';
    if (buffer[0] === 0x89 && buffer[1] === 0x50 && buffer[2] === 0x4e && buffer[3] === 0x47) ext = '.png';
    else if (buffer[0] === 0xff && buffer[1] === 0xd8 && buffer[2] === 0xff) ext = '.jpg';
    else if (buffer[0] === 0x47 && buffer[1] === 0x49 && buffer[2] === 0x46) ext = '.gif';
    else if (buffer.slice(0, 4).toString() === 'RIFF' && buffer.slice(8, 12).toString() === 'WEBP') ext = '.webp';
    else {
      return { success: false, message: '不支持的图片格式' };
    }

    // 创建目录
    if (!fs.existsSync(saveDir)) {
      fs.mkdirSync(saveDir, { recursive: true });
    }

    // 生成文件名
    let finalFilename;
    if (customName) {
      finalFilename = sanitizeName(customName) + ext;
    } else {
      finalFilename = generateDefaultName() + ext;
    }

    // 避免重名
    let counter = 1;
    let fullPath = path.join(saveDir, finalFilename);
    while (fs.existsSync(fullPath)) {
      const nameWithoutExt = finalFilename.replace(/\.[^/.]+$/, '');
      fullPath = path.join(saveDir, `${nameWithoutExt}_${counter}${ext}`);
      counter++;
    }

    try {
      fs.writeFileSync(fullPath, buffer);
      return { success: true, message: '保存成功', path: fullPath };
    } catch (err) {
      return { success: false, message: '写入文件失败: ' + err.message };
    }
  }

  // ========== 存入分类 ==========
  async saveToCategory(e) {
    const category = e.matches[1]?.trim();
    if (!category) return e.reply("请指定分类，例如：存入 猫猫");

    const safeCat = sanitizeCategory(category);
    let imgUrl = '';

    const msgs = e.source?.message ? [...e.source.message, ...e.message] : e.message;
    for (const seg of msgs) {
      if (seg.type === 'image' && seg.url) {
        imgUrl = seg.url;
        break;
      }
    }

    if (!imgUrl) return e.reply("请回复或发送一张图片再使用指令");

    try {
      const buffer = await this.downloadImage(imgUrl);
      const catDir = path.join(this.imageDir, safeCat);
      const result = await this.validateAndSaveImage(buffer, null, catDir);

      if (result.success) {
        e.reply(`✅ 图片已存入【${safeCat}】分类！`);
      } else {
        e.reply(`❌ ${result.message}`);
      }
    } catch (err) {
      e.reply(`⚠️ 保存失败：${errorTranslator(err, this.maxFileSize)}`);
    }
    return true;
  }

  // ========== 偷图 ==========
  async stealImage(e) {
    let imgUrl = '';
    if (e.source?.message) {
      for (const seg of e.source.message) {
        if (seg.type === 'image' && seg.url) {
          imgUrl = seg.url;
          break;
        }
      }
    }

    if (!imgUrl) return e.reply("请引用一条包含图片的消息使用偷图");

    try {
      const buffer = await this.downloadImage(imgUrl);
      const defaultDir = path.join(this.imageDir, 'default');
      const result = await this.validateAndSaveImage(buffer, null, defaultDir);

      if (result.success) {
        e.reply("✅ 偷图成功！");
      } else {
        e.reply(`❌ ${result.message}`);
      }
    } catch (err) {
      e.reply(`⚠️ 偷图失败：${errorTranslator(err, this.maxFileSize)}`);
    }
    return true;
  }

  // ========== 添加图片（URL/本地） ==========
  async addImage(e) {
    const customName = e.matches[1]?.trim() || null;
    let input = '';

    // 检查是否包含 URL
    for (const seg of e.message) {
      if (typeof seg === 'string') {
        const urlMatch = seg.match(/https?:\/\/[^\s]+/);
        if (urlMatch) {
          input = urlMatch[0];
          break;
        }
      }
    }

    if (!input) return e.reply("请提供一个图片链接，或直接发送图片");

    try {
      const buffer = await this.downloadImage(input);
      const defaultDir = path.join(this.imageDir, 'default');
      const result = await this.validateAndSaveImage(buffer, customName, defaultDir);

      if (result.success) {
        e.reply("✅ 图片添加成功！");
      } else {
        e.reply(`❌ ${result.message}`);
      }
    } catch (err) {
      e.reply(`⚠️ 添加失败：${errorTranslator(err, this.maxFileSize)}`);
    }
    return true;
  }

  // ========== 随机发图 ==========
  async sendRandomByKeyword(e) {
    const keyword = e.matches[1]?.trim();
    if (!keyword) return this.sendRandomImage(e);
    return this.sendRandomImageByCategory(e, keyword);
  }

  async sendRandomImage(e) {
    const category = e.matches[1]?.trim();
    if (category) return this.sendRandomImageByCategory(e, category);

    const allImages = this.getAllImagesRecursive();
    if (allImages.length === 0) return e.reply("图库为空，请先添加图片");

    const img = allImages[Math.floor(Math.random() * allImages.length)];
    e.reply([segment.image(`file:///${img.path}`), `\n📁 分类: ${img.category}`]);
    return true;
  }

  async sendRandomImageByCategory(e, categoryName) {
    const safeCat = sanitizeCategory(categoryName);
    const catPath = path.join(this.imageDir, safeCat);
    if (!fs.existsSync(catPath)) return e.reply(`❌ 分类【${safeCat}】不存在`);

    const files = this.getAllImagesInDir(catPath);
    if (files.length === 0) return e.reply(`【${safeCat}】分类下暂无图片~`);

    const file = files[Math.floor(Math.random() * files.length)];
    e.reply([segment.image(`file:///${file}`), `\n📁 来自【${safeCat}】`]);
    return true;
  }

  // ========== 查看指定图片 ==========
  async viewSpecificImage(e) {
    const index = parseInt(e.matches[1], 10) - 1;
    const allImages = this.getAllImagesRecursive();
    if (index < 0 || index >= allImages.length) {
      return e.reply("❌ 图片编号超出范围");
    }

    const img = allImages[index];
    e.reply([
      segment.image(`file:///${img.path}`),
      `\n📌 编号: ${index + 1}\n📁 分类: ${img.category}`
    ]);
    return true;
  }

  // ========== 图片列表 ==========
  async listImages(e) {
    const allImages = this.getAllImagesRecursive();
    if (allImages.length === 0) return e.reply("图库为空");

    const list = allImages.map((img, i) => {
      const filename = path.basename(img.path);
      return `${i + 1}. 【${img.category}】${filename}`;
    });

    // 分段发送（避免超长）
    const chunkSize = 20;
    for (let i = 0; i < list.length; i += chunkSize) {
      const chunk = list.slice(i, i + chunkSize);
      if (i === 0) {
        e.reply(`📊 图库共 ${allImages.length} 张图片：\n${chunk.join('\n')}`);
      } else {
        e.reply(chunk.join('\n'));
      }
    }
    return true;
  }

  // ========== 删除图片 ==========
  async deleteImage(e) {
    const index = parseInt(e.matches[1], 10) - 1;
    const allImages = this.getAllImagesRecursive();
    if (index < 0 || index >= allImages.length) {
      return e.reply("❌ 图片编号无效");
    }

    try {
      fs.unlinkSync(allImages[index].path);
      e.reply(`🗑️ 已删除第 ${index + 1} 张图片`);
    } catch (err) {
      e.reply("❌ 删除失败");
    }
    return true;
  }

  // ========== 重命名图片 ==========
  async renameImage(e) {
    const index = parseInt(e.matches[1], 10) - 1;
    const newName = e.matches[2]?.trim();
    if (!newName) return e.reply("请提供新文件名");

    const allImages = this.getAllImagesRecursive();
    if (index < 0 || index >= allImages.length) {
      return e.reply("❌ 图片编号无效");
    }

    const oldPath = allImages[index].path;
    const dir = path.dirname(oldPath);
    const ext = path.extname(oldPath);
    const safeName = sanitizeName(newName) + ext;
    const newPath = path.join(dir, safeName);

    try {
      if (fs.existsSync(newPath)) {
        return e.reply("❌ 文件名已存在");
      }
      fs.renameSync(oldPath, newPath);
      e.reply(`✅ 第 ${index + 1} 张图片已重命名为：${safeName}`);
    } catch (err) {
      e.reply("❌ 重命名失败");
    }
    return true;
  }

  // ========== 设置最大文件大小 ==========
  async setMaxFileSize(e) {
    const size = parseInt(e.matches[1], 10);
    const unit = e.matches[2];
    let bytes;

    if (unit === 'MB') {
      bytes = size * 1024 * 1024;
    } else if (unit === 'KB') {
      bytes = size * 1024;
    } else {
      return e.reply("单位必须是 MB 或 KB");
    }

    if (bytes <= 0 || bytes > 100 * 1024 * 1024) {
      return e.reply("大小需在 1KB ~ 100MB 之间");
    }

    this.config.maxFileSize = bytes;
    this.config.save();
    e.reply(`✅ 图片大小上限已设为 ${formatSize(bytes)}`);
    return true;
  }

  // ========== 帮助系统 ==========
  async showHelp(e) {
    const helpImgPath = path.join(__dirname, '../resources/help_guide.png');
    if (fs.existsSync(helpImgPath)) {
      e.reply([
        "📚 图片管家使用指南：",
        segment.image(`file:///${helpImgPath}`),
        "\n💡 提示：管理指令需管理员权限"
      ]);
    } else {
      this.showTextHelp(e);
    }
    return true;
  }

  showTextHelp(e) {
    const text = `
📚 终极图片管家 - 指令列表

🖼️ 随机看图
• &随机猫猫        → 随机发“猫猫”分类图
• &随机图片         → 全局随机发图

📥 存图（需回复图片）
• 存入 表情包       → 存入“表情包”分类
• 偷图             → 快速保存引用的图片

🛠️ 管理（仅管理员）
• &添加图片 [名]    → 上传新图
• &删除图片 1       → 删除第1张图
• &重命名图片 1 新名
• &图片列表         → 查看所有图片
• &设置图片大小 10MB

❓ &帮助            → 查看本帮助
`.trim();
    e.reply(text);
    return true;
  }

  // ========== 辅助方法 ==========
  getAllImagesInDir(dir) {
    if (!fs.existsSync(dir)) return [];
    return fs.readdirSync(dir)
      .map(f => path.join(dir, f))
      .filter(f => fs.statSync(f).isFile() && this.isValidImage(f));
  }

  getAllImagesRecursive() {
    const results = [];
    const scan = (dir, rel = '') => {
      const items = fs.readdirSync(dir, { withFileTypes: true });
      for (const item of items) {
        const full = path.join(dir, item.name);
        const currentRel = path.join(rel, item.name);
        if (item.isDirectory()) {
          scan(full, currentRel);
        } else if (this.isValidImage(item.name)) {
          results.push({ path: full, category: rel || 'default' });
        }
      }
    };
    scan(this.imageDir);
    return results;
  }

  isValidImage(filename) {
    const ext = path.extname(filename).toLowerCase().replace('.', '');
    return this.allowedTypes.includes(ext);
  }
}