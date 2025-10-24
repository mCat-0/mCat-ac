// YAML配置加载器
import fs from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';

// 在ESM中模拟__dirname
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

class ConfigLoader {
  constructor() {
    this.configCache = {};
  }

  // 加载配置文件（支持JSON和简单YAML格式）
  async loadConfig(configPath) {
    try {
      const content = await fs.readFile(configPath, 'utf8');
      
      // 尝试解析为JSON
      try {
        return JSON.parse(content);
      } catch (jsonError) {
        // JSON解析失败，尝试简单的YAML解析
        return parseSimpleYaml(content);
      }
    } catch (error) {
      console.error(`加载配置文件失败: ${error.message}`);
      return this.getDefaultConfig();
    }
  }

  // 获取默认配置
  getDefaultConfig() {
    return {
      page: {
        title: "成就查漏结果",
        subtitle: "原神成就追踪工具",
        backgroundColor: "#1a1a2e",
        textColor: "#ffffff",
        backgroundImage: "https://picsum.photos/id/1/1920/1080",
        enableBackgroundImage: true,
        padding: 20,
        borderRadius: 20
      },
      header: {
        enable: true,
        title: "成就查漏结果",
        subtitle: "旅行者的成就追踪记录",
        titleColor: "#f0f0f0",
        subtitleColor: "#cccccc",
        titleSize: 32,
        subtitleSize: 16,
        showStats: true,
        stats: {
          completed: true,
          total: true,
          primogems: true
        },
        statsColor: "#f59e0b",
        statsSize: 24
      },
      achievement: {
        showId: true,
        showReward: true,
        showDesc: true,
        showHidden: true,
        hiddenText: "隐藏",
        hiddenColor: "#FFA500",
        displayMode: "grid",
        itemsPerRow: 2,
        cardBackgroundColor: "rgba(22, 33, 62, 0.85)",
        cardHoverColor: "rgba(30, 41, 59, 0.9)",
        cardBorderColor: "#2a2a3e",
        cardBorderRadius: 12,
        cardShadow: "0 4px 15px rgba(0, 0, 0, 0.2)",
        nameColor: "#ffffff",
        descColor: "#cccccc",
        rewardColor: "#f59e0b"
      },
      category: {
        enabled: true,
        titleColor: "#f59e0b",
        titleSize: 20,
        backgroundColor: "rgba(30, 41, 59, 0.6)",
        borderColor: "#2a2a3e",
        statsColor: "#e2e8f0",
        showStats: true,
        spacing: 30
      },
      footer: {
        enable: true,
        text: "由mCat-ac插件生成 - 版本 1.0.0",
        color: "#888888",
        fontSize: 14,
        showTime: true,
        timeFormat: "YYYY-MM-DD HH:mm:ss"
      },
      animation: {
        enable: true,
        fadeInDuration: 500,
        hoverDuration: 300,
        hoverOffset: -3
      },
      responsive: {
        enable: true,
        mobileBreakpoint: 768,
        tabletBreakpoint: 1024,
        mobileItemsPerRow: 1,
        tabletItemsPerRow: 2,
        mobilePadding: 15,
        mobileFontScale: 0.9
      }
    };
  }

  // 根据配置生成CSS
  generateCSSFromConfig(config) {
    return `
      * {
        margin: 0;
        padding: 0;
        box-sizing: border-box;
      }
      
      body {
        background-color: ${config.page.backgroundColor};
        color: ${config.page.textColor};
        font-family: 'Microsoft YaHei', Arial, sans-serif;
        line-height: 1.6;
        padding: ${config.page.padding}px;
        ${config.page.enableBackgroundImage ? `background-image: url('${config.page.backgroundImage}');` : ''}
        background-size: cover;
        background-position: center;
        background-attachment: fixed;
      }
      
      .container {
        max-width: 1000px;
        margin: 0 auto;
        position: relative;
        background: linear-gradient(180deg, rgba(30, 41, 59, 0.7), rgba(22, 33, 62, 0.9));
        border-radius: ${config.page.borderRadius}px;
        overflow: hidden;
        box-shadow: 0 10px 30px rgba(0, 0, 0, 0.3);
      }
      
      .header {
        text-align: center;
        padding: 30px;
        background: rgba(22, 33, 62, 0.95);
        border-bottom: 2px solid ${config.achievement.cardBorderColor};
      }
      
      .header h1 {
        color: ${config.header.titleColor};
        font-size: ${config.header.titleSize}px;
        margin-bottom: 15px;
        text-shadow: 2px 2px 4px rgba(0, 0, 0, 0.5);
        font-weight: 700;
      }
      
      .user-info {
        display: flex;
        justify-content: center;
        align-items: center;
        gap: 40px;
        margin-bottom: 15px;
        padding: 15px;
        background: rgba(30, 41, 59, 0.5);
        border-radius: 12px;
      }
      
      .user-stat {
        display: flex;
        flex-direction: column;
        align-items: center;
        min-width: 100px;
      }
      
      .stat-value {
        color: ${config.header.statsColor};
        font-size: ${config.header.statsSize}px;
        font-weight: bold;
        text-shadow: 0 0 10px rgba(255, 158, 47, 0.3);
      }
      
      .stat-label {
        font-size: 14px;
        color: #cccccc;
        margin-top: 4px;
      }
      
      .achievement-categories {
        padding: 20px;
      }
      
      .achievement-category {
        margin-bottom: ${config.category.spacing}px;
        background: ${config.category.backgroundColor};
        border-radius: 16px;
        overflow: hidden;
        border: 1px solid ${config.category.borderColor};
        box-shadow: 0 4px 15px rgba(0, 0, 0, 0.2);
      }
      
      .category-header {
        padding: 15px 20px;
        background: rgba(22, 33, 62, 0.9);
        border-bottom: 1px solid ${config.category.borderColor};
      }
      
      .category-title {
        color: ${config.category.titleColor};
        font-size: ${config.category.titleSize}px;
        margin-bottom: 8px;
        font-weight: 600;
      }
      
      .category-stats {
        display: flex;
        gap: 20px;
        font-size: 14px;
        color: ${config.category.statsColor};
      }
      
      .incomplete-count {
        color: ${config.category.statsColor};
        font-weight: 500;
      }
      
      .category-reward {
        color: ${config.achievement.rewardColor};
        font-weight: 500;
      }
      
      .category-achievements {
        display: grid;
        grid-template-columns: repeat(auto-fill, minmax(280px, 1fr));
        gap: 15px;
        padding: 15px;
      }
      
      .achievement-item {
        background: ${config.achievement.cardBackgroundColor};
        border-radius: ${config.achievement.cardBorderRadius}px;
        padding: 16px;
        border: 1px solid ${config.achievement.cardBorderColor};
        transition: all ${config.animation.hoverDuration}ms ease;
        position: relative;
        overflow: hidden;
      }
      
      .achievement-item::before {
        content: '';
        position: absolute;
        top: 0;
        left: 0;
        width: 4px;
        height: 100%;
        background: linear-gradient(to bottom, ${config.header.statsColor}, transparent);
      }
      
      .achievement-item:hover {
        background: ${config.achievement.cardHoverColor};
        transform: translateY(${config.animation.hoverOffset}px);
        box-shadow: ${config.achievement.cardShadow};
      }
      
      .achievement-header {
        display: flex;
        justify-content: space-between;
        margin-bottom: 10px;
        font-size: 13px;
        color: #cccccc;
      }
      
      .achievement-id {
        opacity: 0.7;
      }
      
      .achievement-reward {
        color: ${config.achievement.rewardColor};
        font-weight: 500;
      }
      
      .achievement-name {
        font-size: 16px;
        font-weight: bold;
        margin-bottom: 8px;
        color: ${config.achievement.nameColor};
        display: flex;
        align-items: center;
        justify-content: space-between;
      }
      
      .achievement-desc {
        font-size: 14px;
        color: ${config.achievement.descColor};
        line-height: 1.5;
      }
      
      .hidden-tag {
        display: inline-block;
        padding: 2px 8px;
        background-color: rgba(255, 165, 0, 0.2);
        border-radius: 4px;
        font-size: 12px;
        font-weight: 500;
        color: ${config.achievement.hiddenColor};
      }
      
      .footer {
        text-align: center;
        padding: 20px;
        background: rgba(22, 33, 62, 0.95);
        border-top: 1px solid ${config.achievement.cardBorderColor};
        color: ${config.footer.color};
        font-size: ${config.footer.fontSize}px;
      }
      
      @media (max-width: 768px) {
        body {
          padding: ${config.responsive.mobilePadding}px;
        }
        
        .container {
          border-radius: 15px;
        }
        
        .header {
          padding: 20px;
        }
        
        .header h1 {
          font-size: ${Math.round(config.header.titleSize * config.responsive.mobileFontScale)}px;
        }
        
        .user-info {
          flex-direction: column;
          gap: 15px;
          padding: 10px;
        }
        
        .stat-value {
          font-size: ${Math.round(config.header.statsSize * config.responsive.mobileFontScale)}px;
        }
        
        .achievement-categories {
          padding: 15px;
        }
        
        .category-achievements {
          grid-template-columns: repeat(${config.responsive.mobileItemsPerRow}, 1fr);
          gap: 12px;
        }
        
        .achievement-item {
          padding: 14px;
        }
      }
      
      @media (min-width: 769px) and (max-width: 1024px) {
        .category-achievements {
          grid-template-columns: repeat(${config.responsive.tabletItemsPerRow}, 1fr);
        }
      }
      
      /* 添加动画效果 */
      @keyframes fadeIn {
        from {
          opacity: 0;
          transform: translateY(10px);
        }
        to {
          opacity: 1;
          transform: translateY(0);
        }
      }
      
      .achievement-category {
        animation: fadeIn ${config.animation.fadeInDuration}ms ease-out;
      }
      
      .achievement-item {
        animation: fadeIn ${Math.round(config.animation.fadeInDuration * 0.6)}ms ease-out;
      }
    `;
  }
}

// 简单的YAML解析函数（仅支持基本的键值对结构）
function parseSimpleYaml(yamlContent) {
  const result = {};
  const lines = yamlContent.split('\n');
  let currentObj = result;
  const stack = [result];
  
  for (const line of lines) {
    const trimmed = line.trim();
    // 跳过空行和注释
    if (trimmed === '' || trimmed.startsWith('#')) continue;
    
    // 处理嵌套对象
    const indentMatch = line.match(/^(\s*)/);
    const indent = indentMatch ? indentMatch[1].length / 2 : 0;
    
    // 调整对象栈
    while (stack.length - 1 > indent) {
      stack.pop();
    }
    currentObj = stack[stack.length - 1];
    
    // 解析键值对
    const kvMatch = trimmed.match(/^([^#:\s]+):\s*(.*)$/);
    if (kvMatch) {
      const key = kvMatch[1];
      let value = kvMatch[2].trim();
      
      // 处理嵌套对象标记
      if (value === '') {
        currentObj[key] = {};
        stack.push(currentObj[key]);
        currentObj = currentObj[key];
      } else {
        // 尝试解析为数字、布尔值或字符串
        if (!isNaN(value) && value !== '') {
          value = Number(value);
        } else if (value === 'true') {
          value = true;
        } else if (value === 'false') {
          value = false;
        } else if (value.startsWith('"') && value.endsWith('"')) {
          value = value.substring(1, value.length - 1);
        }
        currentObj[key] = value;
      }
    }
  }
  
  return result;
}

// 导出单例实例
export default new ConfigLoader();