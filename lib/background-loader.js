import fs from 'fs/promises';
import path from 'path';

/**
 * 背景图片加载器
 * 处理模板中的背景图片加载，支持相对路径
 */
export class BackgroundLoader {
  constructor(logger, __dirname) {
    // 颜色常量定义
    this.COLORS = {
      PURPLE: '\x1b[35m',
      CYAN: '\x1b[36m',
      YELLOW: '\x1b[33m',
      ORANGE: '\x1b[33m\x1b[1m',
      PINK: '\x1b[35m\x1b[1m',
      WHITE: '\x1b[37m',
      RED: '\x1b[31m',
      GREEN: '\x1b[32m',
      RESET: '\x1b[0m'
    };
    
    this.logger = logger;
    this.__dirname = __dirname;
  }

  /**
   * 解析简单的YAML格式
   */
  parseSimpleYaml(yamlStr) {
    const result = {};
    const lines = yamlStr.split('\n');
    
    for (const line of lines) {
      // 跳过空行和注释行
      if (!line.trim() || line.trim().startsWith('#')) continue;
      
      // 简单的键值对解析
      const match = line.match(/^\s*(.+?)\s*:\s*(.+?)\s*$/);
      if (match) {
        const key = match[1].trim();
        let value = match[2].trim();
        
        // 处理数字、布尔值和空值
        if (value === 'true') value = true;
        else if (value === 'false') value = false;
        else if (value === 'null') value = null;
        else if (!isNaN(value) && value !== '') value = Number(value);
        // 移除引号
        else if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith('\'') && value.endsWith('\''))) {
          value = value.slice(1, -1);
        }
        
        result[key] = value;
      }
    }
    
    return result;
  }

  /**
   * 获取背景图片URL，支持相对路径
   */
  async getBackgroundImage(templateName) {
    // 尝试从模板配置中获取相对路径的背景图片
    const templateDir = path.join(this.__dirname, `res/wFile/${templateName}`);
    const configPath = path.join(templateDir, 'config.yaml');
    
    try {
      const configContent = await fs.readFile(configPath, 'utf8');
      const config = this.parseSimpleYaml(configContent);
      
      // 如果配置中指定了背景图片路径
      if (config?.background?.url) {
        const bgUrl = config.background.url;
        
        // 处理相对路径
        if (bgUrl.startsWith('./') || bgUrl.startsWith('../')) {
          const absoluteBgPath = path.resolve(templateDir, bgUrl);
          try {
            await fs.access(absoluteBgPath);
            const fileUrl = `file:///${absoluteBgPath.replace(/\\/g, '/')}`;
            this.logger.info(`${this.COLORS.GREEN}使用配置中的相对路径背景: ${fileUrl}${this.COLORS.RESET}`);
            return fileUrl;
          } catch (e) {
            this.logger.warn(`${this.COLORS.YELLOW}配置中指定的背景图片不存在: ${absoluteBgPath}${this.COLORS.RESET}`);
          }
        }
      }
    } catch (e) {
      this.logger.warn(`${this.COLORS.YELLOW}读取模板配置失败: ${e.message}${this.COLORS.RESET}`);
    }
    
    // 尝试默认的SVG背景
    const bgPath = path.join(templateDir, 'background.svg');
    try {
      await fs.access(bgPath);
      const fileUrl = `file:///${bgPath.replace(/\\/g, '/')}`;
      this.logger.info(`${this.COLORS.GREEN}使用默认SVG背景: ${fileUrl}${this.COLORS.RESET}`);
      return fileUrl;
    } catch (e) {
      this.logger.warn(`${this.COLORS.YELLOW}默认SVG背景不存在: ${bgPath}${this.COLORS.RESET}`);
    }
    
    // 尝试PNG背景
    const pngBgPath = path.join(templateDir, 'bg', 'bg.png');
    try {
      await fs.access(pngBgPath);
      const fileUrl = `file:///${pngBgPath.replace(/\\/g, '/')}`;
      this.logger.info(`${this.COLORS.GREEN}使用PNG背景: ${fileUrl}${this.COLORS.RESET}`);
      return fileUrl;
    } catch (e) {
      this.logger.warn(`${this.COLORS.YELLOW}PNG背景不存在: ${pngBgPath}${this.COLORS.RESET}`);
    }
    
    this.logger.info(`${this.COLORS.CYAN}没有可用的背景图片，使用CSS背景色${this.COLORS.RESET}`);
    return '';
  }
}

export default BackgroundLoader;