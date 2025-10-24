import fs from 'fs/promises'
import path from 'path'
import { fileURLToPath } from 'url'
import { logger } from '../../lib/common/common.js'

// 获取当前文件的目录路径
const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

/**
 * 模板配置解析器
 * 支持新旧两种配置文件格式
 */
class TemplateConfigParser {
  constructor(loggerInstance = logger) {
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
    
    // 确保logger有必要的方法
    if (!loggerInstance.info) loggerInstance.info = console.info.bind(console);
    if (!loggerInstance.error) loggerInstance.error = console.error.bind(console);
    if (!loggerInstance.debug) loggerInstance.debug = console.debug ? console.debug.bind(console) : console.log.bind(console);
    if (!loggerInstance.warn) loggerInstance.warn = console.warn ? console.warn.bind(console) : console.log.bind(console);
    
    this.logger = loggerInstance;
  }
  /**
   * 解析新格式配置文件
   * @param {Object} config - 新格式配置对象
   * @returns {Object} 标准化配置对象
   */
  parseNewFormat(config) {
    // 验证必需字段
    if (!config.name || !config.version || !config.config) {
      throw new Error('配置文件缺少必需字段: name, version, config')
    }

    // 返回标准化配置
    return {
      name: config.name,
      version: config.version,
      author: config.author || 'Unknown',
      description: config.description || '',
      preview: config.preview || '',
      config: {
        background: {
          url: config.config.background?.url || '',
          blur: config.config.background?.blur || 0,
          opacity: config.config.background?.opacity || 0.8
        },
        font: {
          family: config.config.font?.family || 'SimHei',
          sizes: {
            title: config.config.font?.sizes?.title || 24,
            subtitle: config.config.font?.sizes?.subtitle || 18,
            content: config.config.font?.sizes?.content || 14
          },
          colors: {
            title: config.config.font?.colors?.title || '#FFFFFF',
            subtitle: config.config.font?.colors?.subtitle || '#F0F0F0',
            content: config.config.font?.colors?.content || '#E0E0E0'
          }
        },
        layout: {
          padding: {
            top: config.config.layout?.padding?.top || 50,
            right: config.config.layout?.padding?.right || 50,
            bottom: config.config.layout?.padding?.bottom || 50,
            left: config.config.layout?.padding?.left || 50
          },
          spacing: {
            title: config.config.layout?.spacing?.title || 30,
            subtitle: config.config.layout?.spacing?.subtitle || 20,
            item: config.config.layout?.spacing?.item || 15
          },
          item: {
            width: config.config.layout?.item?.width || 1100,
            height: config.config.layout?.item?.height || 120,
            padding: {
              top: config.config.layout?.item?.padding?.top || 15,
              right: config.config.layout?.item?.padding?.right || 20,
              bottom: config.config.layout?.item?.padding?.bottom || 15,
              left: config.config.layout?.item?.padding?.left || 20
            },
            background: {
              color: config.config.layout?.item?.background?.color || 'rgba(25, 25, 25, 0.7)',
              borderRadius: config.config.layout?.item?.background?.borderRadius || 10
            }
          }
        },
        header: {
          enable: config.config.header?.enable !== false, // 默认为true
          title: config.config.header?.title || '成就查漏结果',
          subtitle: config.config.header?.subtitle || '探索提瓦特的每一个角落',
          showStats: config.config.header?.showStats !== false, // 默认为true
          stats: config.config.header?.stats || [
            { label: '已完成', key: 'completedCount' },
            { label: '未完成', key: 'incompleteCount' },
            { label: '可获得原石', key: 'totalReward' }
          ],
          showPage: config.config.header?.showPage !== false // 默认为true
        },
        achievement: {
          showId: config.config.achievement?.showId !== false, // 默认为true
          showReward: config.config.achievement?.showReward !== false, // 默认为true
          showDesc: config.config.achievement?.showDesc !== false, // 默认为true
          showHidden: config.config.achievement?.showHidden !== false, // 默认为true
          hiddenText: config.config.achievement?.hiddenText || '隐藏',
          hiddenColor: config.config.achievement?.hiddenColor || '#FFA500'
        },
        footer: {
          enable: config.config.footer?.enable !== false, // 默认为true
          text: config.config.footer?.text || 'mCat-ac 成就查漏工具',
          showTime: config.config.footer?.showTime !== false // 默认为true
        }
      }
    }
  }

  /**
   * 解析旧格式配置文件
   * @param {Object} config - 旧格式配置对象
   * @returns {Object} 标准化配置对象
   */
  parseOldFormat(config) {
    // 转换旧格式到新格式
    return {
      name: config.theme_values?.['theme-name'] || 'RO',
      version: config.theme_values?.['theme-version'] || '1.0.0',
      author: config.theme_values?.['theme-author'] || 'Unknown',
      description: config.theme_values?.['theme-description'] || '',
      preview: '',
      config: {
        background: {
          url: config.theme_values?.['theme-bg'] || '',
          blur: 0,
          opacity: 0.8
        },
        font: {
          family: config['font-style']?.['font-family'] || 'SimHei',
          sizes: {
            title: parseInt(config['font-style']?.['font-size']) || 24,
            subtitle: 18,
            content: 14
          },
          colors: {
            title: config['font-style']?.['font-color']?.split(' ')[0] || '#FFFFFF',
            subtitle: '#F0F0F0',
            content: '#E0E0E0'
          }
        },
        layout: {
          padding: {
            top: 50,
            right: 50,
            bottom: 50,
            left: 50
          },
          spacing: {
            title: 30,
            subtitle: 20,
            item: 15
          },
          item: {
            width: 1100,
            height: 120,
            padding: {
              top: 15,
              right: 20,
              bottom: 15,
              left: 20
            },
            background: {
              color: 'rgba(25, 25, 25, 0.7)',
              borderRadius: 10
            }
          }
        },
        header: {
          enable: true,
          title: '成就查漏结果',
          subtitle: '探索提瓦特的每一个角落',
          showStats: true,
          stats: [
            { label: '已完成', key: 'completedCount' },
            { label: '未完成', key: 'incompleteCount' },
            { label: '可获得原石', key: 'totalReward' }
          ],
          showPage: true
        },
        achievement: {
          showId: true,
          showReward: true,
          showDesc: true,
          showHidden: true,
          hiddenText: '隐藏',
          hiddenColor: '#FFA500'
        },
        footer: {
          enable: true,
          text: 'mCat-ac 成就查漏工具',
          showTime: true
        }
      }
    }
  }

  /**
   * 自动检测并解析配置文件
   * @param {Object} config - 配置对象
   * @returns {Object} 标准化配置对象
   */
  parse(config) {
    if (this.isNewFormat(config)) {
      return this.parseNewFormat(config)
    } else {
      return this.parseOldFormat(config)
    }
  }

  /**
   * 检查配置文件是否为新格式
   * @param {Object} config - 配置对象
   * @returns {boolean} 是否为新格式
   */
  isNewFormat(config) {
    // 新格式具有name和config字段
    return !!(config.name && config.config)
  }

  /**
   * 加载并解析配置文件
   * @param {string} configPath - 配置文件路径
   * @returns {Object} 标准化配置对象
   */
  async loadConfig(configPath) {
    try {
      this.logger.info(`${this.COLORS.CYAN}正在加载配置文件: ${configPath}${this.COLORS.RESET}`)
      const configContent = await fs.readFile(configPath, 'utf8')
      const config = JSON.parse(configContent)
      const parsedConfig = this.parse(config)
      this.logger.debug(`${this.COLORS.GREEN}配置文件解析成功${this.COLORS.RESET}`)
      return parsedConfig
    } catch (error) {
      this.logger.error(`${this.COLORS.RED}加载配置文件失败: ${error.message}${this.COLORS.RESET}`)
      throw error
    }
  }
}

export default TemplateConfigParser