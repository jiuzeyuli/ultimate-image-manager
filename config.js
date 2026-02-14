// plugins/ultimate-image-manager/config.js
import fs from 'fs';
import path from 'path';

export class ImageConfig {
  constructor() {
    this.dataDir = path.join(process.cwd(), 'data'); // 使用 Yunzai 根目录 data/
    this.imageDir = path.join(this.dataDir, 'images');
    this.configPath = path.join(this.dataDir, 'image_config.json');
    this.init();
    this.load();
  }

  init() {
    try {
      if (!fs.existsSync(this.imageDir)) {
        fs.mkdirSync(this.imageDir, { recursive: true });
      } else {
        // 迁移根目录旧图片到 default 分类
        const files = fs.readdirSync(this.imageDir).filter(f =>
          fs.statSync(path.join(this.imageDir, f)).isFile()
        );
        if (files.length > 0) {
          const defaultDir = path.join(this.imageDir, 'default');
          if (!fs.existsSync(defaultDir)) fs.mkdirSync(defaultDir);
          files.forEach(f => {
            fs.renameSync(
              path.join(this.imageDir, f),
              path.join(defaultDir, f)
            );
          });
          console.log(`[ImageManager] 迁移 ${files.length} 张旧图片至 default 分类`);
        }
      }
    } catch (err) {
      console.error('存储初始化失败:', err);
    }
  }

  load() {
    try {
      if (fs.existsSync(this.configPath)) {
        const cfg = JSON.parse(fs.readFileSync(this.configPath, 'utf8'));
        this.maxFileSize = cfg.maxFileSize || 10 * 1024 * 1024;
        this.allowedTypes = cfg.allowedTypes || ['jpg', 'jpeg', 'png', 'gif', 'webp'];
      } else {
        this.maxFileSize = 10 * 1024 * 1024;
        this.allowedTypes = ['jpg', 'jpeg', 'png', 'gif', 'webp'];
        this.save();
      }
    } catch (err) {
      console.error('配置加载失败:', err);
      this.maxFileSize = 10 * 1024 * 1024;
      this.allowedTypes = ['jpg', 'jpeg', 'png', 'gif', 'webp'];
    }
  }

  save() {
    const cfg = { maxFileSize: this.maxFileSize, allowedTypes: this.allowedTypes };
    fs.writeFileSync(this.configPath, JSON.stringify(cfg, null, 2));
  }
}