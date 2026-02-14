// plugins/ultimate-image-manager/index.js
import { plugin } from 'node-karin';
import { ImageConfig } from './config.js';
import { ImageManager } from './lib/ImageManager.js';

const config = new ImageConfig();
const manager = new ImageManager(config);

export class UltimateImageManager extends plugin {
  constructor() {
    super({
      name: '终极图片管家',
      dsc: '支持分类存储与关键词随机的图片管理插件',
      event: 'message',
      priority: 999,
      rule: [
        { reg: /^&随机(.+)$/, fnc: "sendRandomByKeyword" },
        { reg: /^&随机图片(?:\s+(.+))?$/, fnc: "sendRandomImage" },
        { reg: /^存入\s+(.+)$/, fnc: "saveToCategory", permission: "master" },
        { reg: /^偷图(?:\s+(.+))?$/, fnc: "stealImage", permission: "master" },
        { reg: /^&添加图片(?:\s+(.+))?$/, fnc: "addImage", permission: "master" },
        { reg: /^&查看图片\s+(\d+)$/, fnc: "viewSpecificImage" },
        { reg: /^&重命名图片\s+(\d+)\s+(.+)$/, fnc: "renameImage", permission: "master" },
        { reg: /^&删除图片\s+(\d+)$/, fnc: "deleteImage", permission: "master" },
        { reg: /^&图片列表$/, fnc: "listImages" },
        { reg: /^&设置图片大小\s+(\d+)(MB|KB)$/, fnc: "setMaxFileSize", permission: "master" },
        { reg: /^&帮助$/, fnc: "showHelp" },
      ],
    });
    this.manager = manager;
  }

  // 委托方法
  sendRandomByKeyword(e) { return this.manager.sendRandomByKeyword(e); }
  sendRandomImage(e) { return this.manager.sendRandomImage(e); }
  saveToCategory(e) { return this.manager.saveToCategory(e); }
  stealImage(e) { return this.manager.stealImage(e); }
  addImage(e) { return this.manager.addImage(e); }
  viewSpecificImage(e) { return this.manager.viewSpecificImage(e); }
  renameImage(e) { return this.manager.renameImage(e); }
  deleteImage(e) { return this.manager.deleteImage(e); }
  listImages(e) { return this.manager.listImages(e); }
  setMaxFileSize(e) { return this.manager.setMaxFileSize(e); }
  showHelp(e) { return this.manager.showHelp(e); }
}