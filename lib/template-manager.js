// 模板管理器
import fs from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';
import configLoaderModule from './config-loader.js';

// 在ESM中模拟__dirname
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const configLoader = configLoaderModule.default || configLoaderModule;

class TemplateManager {
  constructor() {
    this.templateCache = {};
    this.defaultTemplatePath = path.join(__dirname, '..', 'res', 'wFile', 'def', 'theme-improved.html');
    this.defaultConfigPath = path.join(__dirname, '..', 'res', 'wFile', 'def', 'theme-config.yaml');
  }

  // 加载模板文件
  async loadTemplate(templatePath = null) {
    try {
      const actualPath = templatePath || this.defaultTemplatePath;
      
      // 检查缓存
      if (this.templateCache[actualPath]) {
        return this.templateCache[actualPath];
      }
      
      const content = await fs.readFile(actualPath, 'utf8');
      this.templateCache[actualPath] = content;
      return content;
    } catch (error) {
      console.error(`加载模板文件失败: ${error.message}`);
      // 返回默认的基本HTML模板
      return this.getDefaultTemplate();
    }
  }

  // 获取默认模板
  getDefaultTemplate() {
    return `
      <!DOCTYPE html>
      <html lang="zh-CN">
      <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>{{pageTitle}}</title>
        <style>{{customStyles}}</style>
      </head>
      <body>
        <div class="container">
          {{header}}
          <div class="achievement-categories">
            {{achievementList}}
          </div>
          {{footer}}
        </div>
      </body>
      </html>
    `;
  }

  // 渲染模板
  async render(data) {
    try {
      // 加载模板和配置
      const template = await this.loadTemplate();
      const config = await configLoader.loadConfig(this.defaultConfigPath);
      
      // 生成CSS
      const css = configLoader.generateCSSFromConfig(config);
      
      // 准备替换数据
      const replacements = {
        '{{pageTitle}}': config.page.title || '成就查漏结果',
        '{{customStyles}}': css,
        '{{header}}': this.generateHeader(data, config),
        '{{achievementList}}': data.achievementList || '',
        '{{footer}}': this.generateFooter(data, config)
      };
      
      // 替换模板变量
      let renderedHtml = template;
      for (const [key, value] of Object.entries(replacements)) {
        renderedHtml = renderedHtml.replace(key, value);
      }
      
      return renderedHtml;
    } catch (error) {
      console.error(`渲染模板失败: ${error.message}`);
      // 返回简单的错误页面
      return this.getErrorTemplate(error.message);
    }
  }

  // 生成页眉
  generateHeader(data, config) {
    if (!config.header.enable) return '';
    
    let headerHtml = `
      <div class="header">
        <h1>${config.header.title}</h1>
    `;
    
    if (data.userInfo && config.header.showStats) {
      headerHtml += '<div class="user-info">';
      
      if (config.header.stats.completed && data.userInfo.completed) {
        headerHtml += `
          <div class="user-stat">
            <div class="stat-value">${data.userInfo.completed}</div>
            <div class="stat-label">已完成</div>
          </div>
        `;
      }
      
      if (config.header.stats.total && data.userInfo.total) {
        headerHtml += `
          <div class="user-stat">
            <div class="stat-value">${data.userInfo.total}</div>
            <div class="stat-label">总数</div>
          </div>
        `;
      }
      
      if (config.header.stats.primogems && data.userInfo.primogems) {
        headerHtml += `
          <div class="user-stat">
            <div class="stat-value">${data.userInfo.primogems}</div>
            <div class="stat-label">可获得原石</div>
          </div>
        `;
      }
      
      headerHtml += '</div>';
    }
    
    headerHtml += '</div>';
    return headerHtml;
  }

  // 生成页脚
  generateFooter(data, config) {
    if (!config.footer.enable) return '';
    
    let footerHtml = `<div class="footer">${config.footer.text}`;
    
    if (config.footer.showTime) {
      const now = new Date();
      const formattedTime = this.formatDate(now, config.footer.timeFormat);
      footerHtml += `<br>${formattedTime}`;
    }
    
    footerHtml += '</div>';
    return footerHtml;
  }

  // 格式化日期
  formatDate(date, format) {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    const hours = String(date.getHours()).padStart(2, '0');
    const minutes = String(date.getMinutes()).padStart(2, '0');
    const seconds = String(date.getSeconds()).padStart(2, '0');
    
    return format
      .replace('YYYY', year)
      .replace('MM', month)
      .replace('DD', day)
      .replace('HH', hours)
      .replace('mm', minutes)
      .replace('ss', seconds);
  }

  // 获取错误模板
  getErrorTemplate(errorMessage) {
    return `
      <!DOCTYPE html>
      <html lang="zh-CN">
      <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>错误</title>
        <style>
          body {
            font-family: 'Microsoft YaHei', Arial, sans-serif;
            background-color: #1a1a2e;
            color: #ffffff;
            display: flex;
            justify-content: center;
            align-items: center;
            height: 100vh;
            margin: 0;
            padding: 20px;
          }
          .error-container {
            background-color: #16213e;
            padding: 30px;
            border-radius: 10px;
            border: 1px solid #ff4444;
            max-width: 600px;
            text-align: center;
          }
          h1 {
            color: #ff4444;
            margin-bottom: 20px;
          }
          .error-message {
            color: #cccccc;
            font-size: 16px;
            line-height: 1.6;
          }
        </style>
      </head>
      <body>
        <div class="error-container">
          <h1>模板渲染错误</h1>
          <div class="error-message">${errorMessage}</div>
        </div>
      </body>
      </html>
    `;
  }

  // 获取模板列表
  async getTemplates() {
    try {
      const templateDir = path.join(__dirname, '..', 'res', 'wFile');
      const files = await fs.readdir(templateDir, { withFileTypes: true });
      
      const templateList = [];
      
      // 递归查找所有HTML文件
      const findTemplates = async (dir, relativePath = '') => {
        const items = await fs.readdir(dir, { withFileTypes: true });
        
        for (const item of items) {
          const itemPath = path.join(dir, item.name);
          const relPath = path.join(relativePath, item.name);
          
          if (item.isDirectory()) {
            await findTemplates(itemPath, relPath);
          } else if (item.name.endsWith('.html')) {
            templateList.push({
              name: item.name.replace('.html', ''),
              path: relPath,
              isDefault: itemPath === this.defaultTemplatePath
            });
          }
        }
      };
      
      await findTemplates(templateDir);
      return templateList;
    } catch (error) {
      console.error(`获取模板列表失败: ${error.message}`);
      return [];
    }
  }

  // 设置默认模板
  async setDefaultTemplate(templatePath) {
    try {
      // 验证模板文件存在
      await fs.access(templatePath);
      this.defaultTemplatePath = templatePath;
      // 清除缓存
      delete this.templateCache[templatePath];
      return true;
    } catch (error) {
      console.error(`设置默认模板失败: ${error.message}`);
      return false;
    }
  }
}

// 导出单例实例
export default new TemplateManager();