import plugin from '../../lib/plugins/plugin.js'
import fs from 'fs/promises'
import fsSync from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'
import { createHash } from 'crypto'
import { segment } from 'oicq'

// 导入新的模板系统
import templateManagerModule from './lib/template-manager.js';
const templateManager = templateManagerModule.default || templateManagerModule;
import configLoaderModule from './lib/config-loader.js';
const configLoader = configLoaderModule.default || configLoaderModule;

// 引入成就文件处理助手
import { createRequire } from 'module';
const require = createRequire(import.meta.url);
const helper = require('./process_achievement_files.cjs').helper;
const { processAchievementData } = helper;

// ESM 中获取 __dirname 的替代方案
const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

// 颜色常量定义（移到模块级别，确保全局可用）
const COLORS = {
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

// 全局变量声明
let logger = console;
// 提供默认的axios对象以避免构造函数错误
let axios = {
  get: async () => { throw new Error('使用内置HTTP实现'); },
  post: async () => { throw new Error('使用内置HTTP实现'); }
};
let schedule = {
  scheduleJob: () => ({ cancel: () => {} })
};
// 模块级用户状态存储，确保所有实例共享同一个状态对象
let userInputStatus = {};

// 异步初始化函数
async function initializeDependencies() {
  // 尝试导入日志模块，适配不同环境
  try {
    // 首先尝试从config目录导入
    logger = (await import('../../lib/config/log.js')).default;
  } catch (error) {
    try {
      // 尝试从common目录导入
      const commonModule = await import('../../lib/common/common.js');
      logger = commonModule.default || console;
    } catch (error2) {
      // 如果都失败，使用console作为后备
      logger = console;
    }
  }

  // 确保logger有必要的方法
  if (!logger) logger = console;
  if (!logger.info) logger.info = console.info.bind(console);
  if (!logger.error) logger.error = console.error.bind(console);
  if (!logger.debug) logger.debug = console.debug ? console.debug.bind(console) : console.log.bind(console);
  if (!logger.warn) logger.warn = console.warn ? console.warn.bind(console) : console.log.bind(console);
  
  // 仅保留初始化开始日志
  logger.info(`${COLORS.CYAN}mCat-ac: 开始初始化依赖${COLORS.RESET}`);
  
  // 使用内置http/https模块实现一个简单的请求功能
  const https = await import('https');
  const http = await import('http');
  
  // 减少初始化日志
  logger.info(`${COLORS.CYAN}mCat-ac: 初始化HTTP请求实现${COLORS.RESET}`);
  
  // 创建自定义的axios兼容实现
  axios = {
    __isBuiltInHttp: true,
    get: async (url, config = {}) => {
      return new Promise((resolve, reject) => {
        const protocol = url.startsWith('https') ? https : http;
        const timeout = config.timeout || 30000;
        const headers = {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
          'Accept': 'application/json, text/plain, */*',
          'Accept-Language': 'zh-CN,zh;q=0.9',
          ...config.headers
        };
        
        // 移除请求前的日志
      
        
        const req = protocol.get(url, { headers }, (res) => {
          let data = '';
          
          res.on('data', (chunk) => {
            data += chunk;
          });
          
          res.on('end', () => {
            // 减少请求成功的日志，只在必要时记录
          
            // 尝试解析JSON
            let parsedData = data;
            try {
              parsedData = JSON.parse(data);
            } catch (e) {
              // 如果解析失败，保持原始字符串
            }
            resolve({
              status: res.statusCode,
              data: parsedData,
              statusText: res.statusMessage,
              headers: res.headers
            });
          });
        });
        
        req.setTimeout(timeout, () => {
          req.destroy();
          reject(new Error(`请求超时 (${timeout}ms)`));
        });
        
        req.on('error', (error) => {
          // 保留错误日志
          logger.error(`${COLORS.RED}mCat-ac: HTTP请求失败: ${error.message}${COLORS.RESET}`);
          reject(error);
        });
      });
    }
  };
  
  // 尝试导入schedule模块
  try {
    schedule = (await import('node-schedule')).default;
  } catch (error) {
    logger.warn(`${COLORS.YELLOW}mCat-ac: 无法导入schedule依赖，定时任务功能将不可用${COLORS.RESET}`);
  }
  
  // 尝试导入实际的axios包，如果成功则使用它
  try {
    const actualAxios = (await import('axios')).default;
    
    // 配置axios
    axios = {
      __isBuiltInHttp: false,
      ...actualAxios,
      get: async (url, config = {}) => {
        // 移除请求前的日志
      
        const defaultConfig = {
          timeout: 30000, // 30秒超时
          headers: {
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
            'Accept': 'application/json, text/plain, */*',
            'Accept-Language': 'zh-CN,zh;q=0.9',
          },
          ...config
        };
        
        try {
          const response = await actualAxios.get(url, defaultConfig);
          // 移除请求成功的日志
        
          return response;
        } catch (error) {
          // 保留错误日志
          logger.error(`mCat-ac: axios请求失败: ${error.message}`);
          if (error.response) {
            logger.error(`mCat-ac: 响应错误 - 状态码: ${error.response.status}`);
          }
          throw error;
        }
      }
    };
  } catch (axiosImportError) {
    // 移除警告日志，仅保留错误
  
  }
}
  // schedule已经在前面尝试导入过了，不需要重复导入

// 导出插件实例
// export moved to end of file

// 在类构造函数中调用初始化函数

class AchievementCheck extends plugin {
  constructor () {
    super({
      name: 'mCat-ac',
      dsc: '成就查漏工具',
      event: 'message',
      priority: 5000,
      rule: [
        { reg: '^#成就帮助$', fnc: 'helpAchievements' },
        { reg: '^#成就录入$', fnc: 'startInput' },
        { reg: '^#成就录入(.+)$', fnc: 'inputByIdOrName' },
        { reg: '^#成就查漏$', fnc: 'checkAchievements' },
        { reg: '^#成就重置$', fnc: 'resetAchievements' },
        { reg: '^#更新校对文件$', fnc: 'updateCheckFile' },
        { reg: '^#强制更新校对文件$', fnc: 'forceUpdateCheckFile' },
        { reg: '^#成就调试$', fnc: 'debugStatus' },
        // ACM指令 - 管理员指令
        { reg: '^#ACM开启api$', fnc: 'acmEnableApi', permission: 'master' },
        { reg: '^#ACM关闭api$', fnc: 'acmDisableApi', permission: 'master' },
        { reg: '^#ACM开启随机$', fnc: 'acmEnableRandom', permission: 'master' },
        { reg: '^#ACM关闭随机$', fnc: 'acmDisableRandom', permission: 'master' },
        { reg: '^#ACM更新$', fnc: 'acmUpdatePlugin', permission: 'master' },
        // 添加处理椰羊网站URL的规则
        { reg: 'https://77\\.cocogoat\\.cn/v2/memo/([a-zA-Z0-9]+)', fnc: 'importFromCocogoatUrl' },
        // 添加处理文件上传的规则
        { reg: '.*', fnc: 'accept', log: false }
      ]
    });
    
    // 初始化配置缓存和监听机制
    this.configCache = new Map();
    this.watchers = new Map();
    // 保存axios和schedule实例到类属性
    this.axios = axios;
    this.schedule = schedule;
    
    // 从package.json读取版本号
    try {
      const packagePath = path.join(__dirname, 'package.json');
      const packageContent = fsSync.readFileSync(packagePath, 'utf8');
      const packageData = JSON.parse(packageContent);
      this.version = packageData.version || '未知';
      global.mCatAcVersion = this.version; // 设置全局版本变量，供其他模块使用
      // 移除版本日志
    } catch (e) {
      logger.warn(`${COLORS.YELLOW}mCat-ac: 读取版本号失败: ${e.message}${COLORS.RESET}`);
      this.version = '未知';
      global.mCatAcVersion = '未知';
    }
    
    // 触发异步依赖初始化，避免构造函数直接使用async
    // 检查是否已经初始化过依赖，避免重复初始化
    if (!global.mCatAcDependenciesInitialized) {
      setTimeout(async () => {
        try {
          await initializeDependencies();
          
          // 确保logger有必要的方法
          if (!logger) logger = console
          if (!logger.info) logger.info = console.info.bind(console)
          if (!logger.error) logger.error = console.error.bind(console)
          if (!logger.debug) logger.debug = console.debug ? console.debug.bind(console) : console.log.bind(console)
          
          // 移除初始化完成日志
          
          // 设置全局标记，表示依赖已初始化
          global.mCatAcDependenciesInitialized = true
          // 标记实例依赖初始化完成
          this.dependenciesInitialized = true
          
          // 如果插件已经被加载且需要初始化，执行初始化
          if (this.needInit) {
            await this.performInit()
          }
          
          // 初始化完成后，如果需要可以在这里执行其他初始化操作
          // 注意：initData方法会在插件加载过程中由其他地方调用，避免重复初始化
          // if (typeof this.initData === 'function') {
          //   await this.initData();
          // }
        } catch (error) {
          console.error(`${COLORS.RED}mCat-ac: 依赖初始化失败: ${error.message}${COLORS.RESET}`);
        }
      }, 0);
    } else {
      // 如果已经初始化过，直接标记为完成
      this.dependenciesInitialized = true
      if (this.needInit) {
        // 使用setTimeout包装异步调用，避免在构造函数中使用await
        setTimeout(async () => {
          try {
            await this.performInit()
          } catch (error) {
            console.error(`${COLORS.RED}mCat-ac: 初始化失败: ${error.message}${COLORS.RESET}`)
          }
        }, 0)
      }
    }
    
    // 配置项
    this.config = {
      updateDays: 20,
      waitTime: 120,
      templates: ['RO'],
      pageSize: 20 // 修改为每页20个成就
    };
    
    // 初始化状态标志
    this.performInitCompleted = false;
    
    // 状态跟踪
    this._isGeneratingImages = false
    this._pendingScreenshots = new Set() // 跟踪待处理的截图任务
    
    // 添加进程退出监听，清理资源
    process.on('exit', this._cleanupResources.bind(this))
    // 捕获SIGINT信号 (Ctrl+C)
    process.on('SIGINT', () => {
      this._cleanupResources()
      process.exit(0)
    })
    
    // 设置定时清理任务，每小时执行一次
    this._cleanupInterval = setInterval(async () => {
      try {
        await this._cleanupTempFiles()
      } catch (error) {
        logger.error(`${COLORS.RED}mCat-ac: 定时清理临时文件失败: ${error.message}${COLORS.RESET}`)
      }
    }, 60 * 60 * 1000) // 1小时
    
    // 移除定期清理任务启动日志
  }
  
  // 执行初始化（在构造函数中通过setTimeout调用）
  async performInit() {
    // 防止重复执行初始化
    if (this.performInitCompleted) {
      logger.debug(`${COLORS.CYAN}mCat-ac: 初始化已完成，跳过重复初始化${COLORS.RESET}`);
      return;
    }
    
    try {
      // 确保logger有必要的方法
      if (!logger) logger = console;
      if (!logger.info) logger.info = console.info.bind(console);
      if (!logger.error) logger.error = console.error.bind(console);
      if (!logger.debug) logger.debug = console.debug ? console.debug.bind(console) : console.log.bind(console);
      
      logger.info(`${COLORS.CYAN}mCat-ac: 开始执行初始化${COLORS.RESET}`);
      
      // 执行数据初始化（如果initData方法存在）
      if (typeof this.initData === 'function') {
        await this.initData();
      }
      
      // 标记初始化完成
      this.performInitCompleted = true;
      logger.info(`${COLORS.GREEN}mCat-ac: performInit 初始化完成${COLORS.RESET}`);
    } catch (error) {
      logger.error(`${COLORS.RED}mCat-ac: performInit 初始化失败: ${error.message}${COLORS.RESET}`);
      throw error;
    }
  }
  
  // 显示帮助信息
  async helpAchievements(e) {
    try {
      // 添加任务状态标志，防止在错误情况下重复尝试
      if (this._isGeneratingImages) {
        logger.warn(`${COLORS.YELLOW}mCat-ac: 已有图片生成任务在进行中，跳过重复请求${COLORS.RESET}`)
        await e.reply('请稍后再试，当前有其他图片生成任务正在进行中。')
        return true
      }
      
      this._isGeneratingImages = true
      
      // 获取用户UID信息
      let uid = '未知UID'
      try {
        if (e.runtime) {
          uid = e.runtime.uid || '未知UID'
          logger.info(`${COLORS.PINK}mCat-ac: 从runtime获取到UID: ${uid}${COLORS.RESET}`)
        } else if (e.user && e.user.uid) {
          uid = e.user.uid
          logger.info(`${COLORS.PINK}mCat-ac: 从user获取到UID: ${uid}${COLORS.RESET}`)
        }
      } catch (uidError) {
        logger.warn(`${COLORS.YELLOW}mCat-ac: 获取UID时出错: ${uidError.message}${COLORS.RESET}`)
      }
      
      // 获取当前ACM配置状态
      let apiStatus = '未知', randomStatus = '未知';
      try {
        const config = await this.getThemeConfig('def');
        apiStatus = config.page?.useApiBackground ? '开启' : '关闭';
        randomStatus = config.page?.randomBackground ? '开启' : '关闭';
        logger.info(`${COLORS.CYAN}mCat-ac: 当前ACM配置 - API背景: ${apiStatus}, 随机背景: ${randomStatus}${COLORS.RESET}`);
      } catch (configError) {
        logger.warn(`${COLORS.YELLOW}mCat-ac: 获取ACM配置状态失败: ${configError.message}${COLORS.RESET}`);
      }

      // 生成帮助信息数据
      const helpData = {
        header: {
          title: 'mCat-ac帮助',
          subtitle: '' // 移除副标题
        },
        userCommands: [
          { command: '#成就帮助', description: '显示本帮助信息' },
          { command: '#成就录入', description: '开始成就录入流程，会提示输入分享码' },
          { command: '#成就录入[ID/名称]', description: '直接录入指定ID或名称的成就' },
          { command: '#成就查漏', description: '生成成就查漏报告，显示未完成的成就' },
          { command: '#成就重置', description: '重置当前用户的成就数据' },
          { command: '分享椰羊网站链接', description: '自动导入成就数据' }
        ],
        adminCommands: [
          { command: '#更新校对文件', description: '更新成就校对文件（自动检查更新）' },
          { command: '#强制更新校对文件', description: '强制更新成就校对文件' },
          { command: '#成就调试', description: '显示调试信息（仅限测试环境）' },
          { command: '#ACM更新', description: '检查并更新插件到最新版本' },
          // ACM管理员指令
          { command: '#ACM开启api', description: '开启从网络获取背景图片功能' },
          { command: '#ACM关闭api', description: '关闭从网络获取背景图片功能' },
          { command: '#ACM开启随机', description: '开启使用随机背景图片功能' },
          { command: '#ACM关闭随机', description: '关闭使用随机背景图片功能' }
        ],
        // ACM配置状态信息
        acmStatus: {
          apiBackground: apiStatus,
          randomBackground: randomStatus
        },
        note: '部分指令需要在私聊环境下使用以保护隐私。',
        // 移除uid字段
        time: new Date().toLocaleString('zh-CN')
      }
      
      // 生成帮助信息图片
      const imagePath = await this.renderHelpImage(e, helpData)
      
      // 发送图片
      if (imagePath) {
        // 使用卡片消息发送图片
        await this.sendImagesAsCards(e, [imagePath])
      } else {
        throw new Error('未能生成帮助信息图片')
      }
      
      return true
    } catch (error) {
      logger.error(`mCat-ac: 显示帮助信息失败: ${error.message}`)
      await e.reply('获取帮助信息失败，请稍后重试。')
      return false
    } finally {
      // 确保无论成功失败都清除状态标志
      this._isGeneratingImages = false
    }
  }
  
  // 生成帮助信息图片
  async renderHelpImage(e, helpData) {
    try {
      // 使用puppeteer直接渲染
      const puppeteer = (await import('../../lib/puppeteer/puppeteer.js')).default
      const tempDir = path.join(__dirname, 'temp')
      
      // 确保临时目录存在
      try {
        await fs.mkdir(tempDir, { recursive: true })
      } catch (e) {}
      
      // 选择模板
      const template = this.getTemplate()
      
      // 加载模板配置
      const templateConfig = await this.loadTemplateConfig(template)
      
      // 直接指定背景图片路径，确保使用正确的背景图片
      const bgImagePath = path.join(__dirname, 'res/wFile/def/bg/bg.png')
      let backgroundUrl = ''
      
      try {
        // 检查背景图片是否存在
        await fs.access(bgImagePath)
        backgroundUrl = `file:///${bgImagePath.replace(/\\/g, '/')}`
        logger.info(`mCat-ac: 成功设置背景图片: ${backgroundUrl}`)
      } catch (e) {
        logger.warn(`mCat-ac: 背景图片不存在: ${bgImagePath}`)
        // 如果不存在，尝试获取默认背景图片
        try {
          backgroundUrl = await this.getBackgroundImage(template)
          logger.info(`mCat-ac: 使用模板背景图片: ${backgroundUrl}`)
        } catch (e2) {
          logger.warn(`mCat-ac: 无法获取背景图片`)
        }
      }
      
      // 准备渲染数据
      const renderData = {
        ...helpData,
        config: templateConfig,
        background: backgroundUrl,
        isHelpPage: true, // 添加标记以区分帮助页面
        time: new Date().toLocaleString('zh-CN')
      }
      
      // 确保配置中的页面背景图片设置正确
      if (renderData.config && renderData.config.page && backgroundUrl) {
        renderData.config.page.backgroundImage = backgroundUrl
        logger.info(`mCat-ac: 已将背景图片设置到配置中`)
      }
      
      // 生成HTML内容
      const html = await this.generateHelpHtml(renderData)
      
      // 保存HTML到临时文件
      const htmlPath = path.join(tempDir, `${Date.now()}.html`)
      await fs.writeFile(htmlPath, html, 'utf8')
      logger.info(`mCat-ac: 已保存HTML到: ${htmlPath}`)
      
      // 使用puppeteer渲染 - 设置固定宽度800px，高度自适应
      const imagePath = path.join(tempDir, `${Date.now()}.png`)
      
      // 生成截图任务ID
      const screenshotId = `${Date.now()}`
      this._pendingScreenshots.add(screenshotId)
      
      try {
        const templateName = `mcat_ac_${screenshotId}`
        
        // 基于内容数量动态调整视口高度，确保完整显示
        const commandCount = helpData.userCommands.length + helpData.adminCommands.length
        const viewportHeight = Math.max(800, 600 + commandCount * 80) // 每个命令项约80px
        
        await puppeteer.screenshot(templateName, {
          tplFile: htmlPath,
          path: imagePath,
          type: 'png',
          quality: 100,
          viewport: {
            width: 800, // 固定宽度800px
            height: viewportHeight
          },
          fullPage: true // 捕获完整页面内容
        })
        
        logger.info(`mCat-ac: 成功生成帮助信息图片: ${imagePath}`)
        
        // 设置延迟清理临时文件（5分钟后）
        setTimeout(async () => {
          await this._cleanupAssociatedFiles(imagePath)
        }, 5 * 60 * 1000) // 5分钟
        
        return imagePath
      } catch (error) {
        logger.error(`mCat-ac: 渲染帮助信息图片时出错: ${error.message}`)
        throw error
      } finally {
        // 无论成功失败，移除任务ID
        this._pendingScreenshots.delete(screenshotId)
      }
    } catch (error) {
      logger.error(`mCat-ac: 生成帮助信息图片失败: ${error.message}`)
      throw error
    }
  }
  
  // 生成帮助信息HTML内容
  async generateHelpHtml(data) {
    try {
      // 确保背景图片路径正确设置
      const bgImagePath = path.join(__dirname, 'res/wFile/def/bg/bg.png')
      
      // 首先尝试使用直接指定的背景图片路径
      try {
        await fs.access(bgImagePath)
        // 设置正确的文件URL路径
        data.background = `file:///${bgImagePath.replace(/\\/g, '/')}`
        logger.info(`mCat-ac: 直接设置背景图片: ${data.background}`)
      } catch (e) {
        logger.warn(`mCat-ac: 背景图片不存在: ${bgImagePath}`)
      }
      
      // 确保配置中的页面背景图片设置
      if (data.config && data.config.page && data.background) {
        data.config.page.backgroundImage = data.background
      }
      
      // 获取CSS样式
      const style = this.generateHelpCss(data.config, data.background)
      
      // 生成HTML内容
      return `
        <!DOCTYPE html>
        <html lang="zh-CN">
        <head>
          <meta charset="UTF-8">
          <meta name="viewport" content="width=device-width, initial-scale=1.0">
          <title>${data.header.title}</title>
          <style>
            ${style}
          </style>
        </head>
        <body>
          <div class="container">
            <div class="header">
              <h1>${data.header.title}</h1>
              ${data.header.subtitle ? `<h2>${data.header.subtitle}</h2>` : ''}
              <!-- 移除UID信息 -->
            </div>
            
            <div class="help-content">
              <!-- 用户指令部分 - 添加与成就查漏一致的类目背景框 -->
              <div class="category-section">
                <div class="category-title">用户指令</div>
                <div class="category-content">
                  ${data.userCommands.map(cmd => `
                    <div class="command-item">
                      <div class="command-name">${cmd.command}</div>
                      <div class="command-desc">${cmd.description}</div>
                    </div>
                  `).join('')}
                </div>
              </div>
              
              <!-- 管理指令部分 - 添加与成就查漏一致的类目背景框 -->
              <div class="category-section">
                <div class="category-title">管理指令</div>
                <div class="category-content">
                  ${data.adminCommands.map(cmd => `
                    <div class="command-item">
                      <div class="command-name">${cmd.command}</div>
                      <div class="command-desc">${cmd.description}</div>
                    </div>
                  `).join('')}
                </div>
              </div>
              
              <!-- ACM配置状态部分 -->
              ${data.acmStatus ? `
                <div class="category-section">
                  <div class="category-title">ACM配置状态</div>
                  <div class="category-content">
                    <div class="status-item">
                      <div class="status-name">网络背景获取</div>
                      <div class="status-value">${data.acmStatus.apiBackground}</div>
                    </div>
                    <div class="status-item">
                      <div class="status-name">随机背景功能</div>
                      <div class="status-value">${data.acmStatus.randomBackground}</div>
                    </div>
                  </div>
                </div>
              ` : ''}
              
              <!-- 备注部分 -->
              ${data.note ? `
                <div class="note-section">
                  <div class="note-text">${data.note}</div>
                </div>
              ` : ''}
            </div>
            
            <!-- 页脚 -->
            <div class="footer">
              <div class="footer-text">mCat-ac 成就查漏工具</div>
              <div class="footer-version">v${this.version}</div>
              ${data.time ? `<div class="footer-time">${data.time}</div>` : ''}
            </div>
          </div>
        </body>
        </html>
      `;
    } catch (error) {
      logger.error('生成帮助信息HTML内容失败:', error.message);
      return '<html><body>错误：生成HTML失败</body></html>';
    }
  }
  
  // 生成帮助信息CSS样式
  generateHelpCss(config, backgroundImage) {
    // 防御性检查，确保配置对象存在且结构完整
    const safeConfig = {
      page: {
        backgroundColor: "#000000",
        textColor: "#ffffff",
        // 使用传入的背景图片路径，确保正确引用
        backgroundImage: backgroundImage || "",
        width: "800px",
        ...(config?.page || {})
      },
      header: {
        titleColor: "#FFD69E",
        titleSize: 60,
        subtitleColor: "#FFF2E0",
        subtitleSize: 30,
        ...(config?.header || {})
      },
      category: {
        // 类目样式 - 与成就查漏保持一致
        background: {
          color: "rgba(0, 0, 0, 0.4)",
          borderRadius: 24,
          padding: "20px"
        },
        title: {
          color: "#FFD69E",
          fontSize: 40,
          fontWeight: "bold",
          textShadow: "2px 2px 4px rgba(0, 0, 0, 0.8)"
        },
        ...(config?.category || {})
      },
      command: {
        nameColor: "#FFD69E", // 命令名使用金色
        descColor: "#FFF2E0", // 命令描述使用浅黄色，与命令名区分
        background: {
          width: 720,
          borderRadius: 12,
          color: "rgba(0, 0, 0, 0.6)",
          ...(config?.achievement?.background || {})
        },
        ...(config?.achievement || {})
      },
      footer: {
        enable: true,
        textColor: "#FFD69E",
        text: "mCat-ac 成就查漏工具",
        showTime: true,
        ...(config?.footer || {})
      }
    };
    
    try {
      // 确保背景图片被正确应用到CSS中
      const backgroundStyle = safeConfig.page.backgroundImage ? 
        `url('${safeConfig.page.backgroundImage}')` : 
        'none';
      
      logger.info(`mCat-ac: 在CSS中应用背景图片: ${backgroundStyle}`);
      
      return `
        @font-face {
          font-family: 'HYWenHei';
          src: url('file:///${path.join(__dirname, 'res/wFile/def/fonts/HYWenHei.ttf').replace(/\\/g, '/')}') format('truetype');
        }
        
        * {
          margin: 0;
          padding: 0;
          box-sizing: border-box;
        }
        
        body {
          font-family: 'HYWenHei', 'Microsoft YaHei', Arial, sans-serif;
          background-color: ${safeConfig.page.backgroundColor};
          color: ${safeConfig.page.textColor};
          width: ${safeConfig.page.width};
          min-height: 800px;
          margin: 0 auto;
          padding: 20px;
          background-image: ${backgroundStyle};
          background-size: cover;
          background-position: center;
          background-repeat: no-repeat;
        }
        
        .container {
          width: 100%;
          min-height: 100%;
          display: flex;
          flex-direction: column;
          align-items: center;
          padding: 20px 0;
        }
        
        .header {
          text-align: center;
          margin-bottom: 40px;
        }
        
        .header h1 {
          color: ${safeConfig.header.titleColor};
          font-size: ${safeConfig.header.titleSize}px;
          margin-bottom: 10px;
          text-shadow: 2px 2px 4px rgba(0, 0, 0, 0.8);
        }
        
        .header h2 {
          color: ${safeConfig.header.subtitleColor};
          font-size: ${safeConfig.header.subtitleSize}px;
          margin-bottom: 10px;
        }
        
        .help-content {
          width: 100%;
          display: flex;
          flex-direction: column;
          align-items: center;
          gap: 30px;
        }
        
        /* 类目背景框样式 - 与成就查漏保持一致，添加毛玻璃效果 */
        .category-section {
          width: 680px;
          background-color: rgba(0, 0, 0, 0.4); /* 规范要求：透明度40% */
          backdrop-filter: blur(10px);
          -webkit-backdrop-filter: blur(10px);
          border-radius: ${safeConfig.category.background.borderRadius}px;
          padding: ${safeConfig.category.background.padding};
          margin-bottom: 20px;
          border: 1px solid rgba(255, 255, 255, 0.2);
        }
        
        .category-title {
          color: ${safeConfig.category.title.color};
          font-size: ${safeConfig.category.title.fontSize}px;
          font-weight: ${safeConfig.category.title.fontWeight};
          text-shadow: ${safeConfig.category.title.textShadow};
          text-align: center;
          margin-bottom: 20px;
        }
        
        .category-content {
          display: flex;
          flex-direction: column;
          align-items: center;
        }
        
        /* 命令项样式 - 与成就查漏中的成就背景框保持一致 */
        .command-item {
          width: 100%;
          background-color: ${safeConfig.command.background.color};
          border-radius: ${safeConfig.command.background.borderRadius}px;
          padding: 15px;
          margin-bottom: 15px;
          box-shadow: 0 2px 8px rgba(0, 0, 0, 0.2);
          border: 1px solid rgba(255, 215, 0, 0.2);
        }
        
        .command-name {
          color: ${safeConfig.command.nameColor}; /* 金色命令名 */
          font-size: 24px;
          font-weight: bold;
          margin-bottom: 8px;
        }
        
        .command-desc {
          color: ${safeConfig.command.descColor}; /* 浅黄色描述，与命令名区分 */
          font-size: 20px;
          line-height: 1.4;
        }
        
        /* ACM配置状态项样式 */
        .status-item {
          width: 100%;
          background-color: ${safeConfig.command.background.color};
          border-radius: ${safeConfig.command.background.borderRadius}px;
          padding: 15px;
          margin-bottom: 15px;
          box-shadow: 0 2px 8px rgba(0, 0, 0, 0.2);
          border: 1px solid rgba(255, 214, 158, 0.3);
          display: flex;
          justify-content: space-between;
          align-items: center;
        }
        
        .status-name {
          color: #FFD69E;
          font-size: 24px;
          font-weight: bold;
        }
        
        .status-value {
          color: #FFFFFF;
          font-size: 24px;
          font-weight: bold;
          text-shadow: 0 0 10px rgba(255, 214, 158, 0.5);
        }
        
        .note-section {
          width: 100%;
          text-align: center;
          margin-top: 30px;
        }
        
        .note-text {
          color: ${safeConfig.command.descColor};
          font-size: 20px;
          font-style: italic;
          line-height: 1.4;
        }
        
        .footer {
          margin-top: 40px;
          text-align: center;
          width: 100%;
        }
        
        .footer-text {
          color: ${safeConfig.footer.textColor};
          font-size: 24px;
          margin-bottom: 5px;
        }
        
        .footer-version {
          color: ${safeConfig.footer.textColor};
          font-size: 20px;
          margin-bottom: 5px;
        }
        
        .footer-time {
          color: ${safeConfig.footer.textColor};
          font-size: 18px;
          opacity: 0.8;
        }
      `;
    } catch (error) {
      console.error('Error in generateHelpCss:', error);
      // 返回最小化的CSS以避免渲染完全失败
      return `
        body { 
          font-family: Arial, sans-serif; 
          background-color: #000; 
          color: #fff; 
          width: 800px; 
          margin: 0 auto; 
          padding: 20px;
          background-image: ${backgroundImage ? `url('${backgroundImage}')` : 'none'};
          background-size: cover;
          background-position: center;
        }
        .container { text-align: center; }
        h1, h2, h3 { color: #FFD69E; }
        .command-item { margin: 10px 0; padding: 10px; background: rgba(0,0,0,0.6); border-radius: 12px; }
        .footer { margin-top: 30px; }
      `;
    }
  }

  // 清理资源
  _cleanupResources() {
    // 清除定时清理任务
    if (this._cleanupInterval) {
      clearInterval(this._cleanupInterval)
      logger.info('mCat-ac: 已停止定期清理临时文件任务')
    }
    
    if (this._pendingScreenshots && this._pendingScreenshots.size > 0) {
      logger.warn(`mCat-ac: 正在清理 ${this._pendingScreenshots.size} 个未完成的截图任务`)
      // 清空待处理任务集合
      this._pendingScreenshots.clear()
      // 强制设置生成标志为false
      this._isGeneratingImages = false
    }
    
    // 清理过期的临时文件
    this._cleanupTempFiles()
  }
  
  // 清理临时文件
  async _cleanupTempFiles() {
    try {
      const tempDir = path.join(__dirname, 'temp')
      
      // 检查临时目录是否存在
      try {
        await fs.access(tempDir)
      } catch (e) {
        return // 目录不存在，无需清理
      }
      
      // 获取临时目录内容
      const files = await fs.readdir(tempDir)
      const now = Date.now()
      let deletedCount = 0
      
      // 清理规则：删除超过10分钟的文件
      const MAX_AGE = 10 * 60 * 1000 // 10分钟
      
      for (const file of files) {
        const filePath = path.join(tempDir, file)
        
        try {
          const stats = await fs.stat(filePath)
          const age = now - stats.mtimeMs
          
          // 如果是HTML或PNG文件且超过指定时间，删除它
          if ((file.endsWith('.html') || file.endsWith('.png')) && age > MAX_AGE) {
            await fs.unlink(filePath)
            deletedCount++
          }
        } catch (e) {
          // 忽略无法删除的文件
          logger.warn(`mCat-ac: 无法删除临时文件 ${file}: ${e.message}`)
        }
      }
      
      if (deletedCount > 0) {
        logger.info(`mCat-ac: 清理了 ${deletedCount} 个过期临时文件`)
      }
    } catch (error) {
      logger.error(`mCat-ac: 清理临时文件时出错: ${error.message}`)
    }
  }
  
  // 删除指定的临时文件
  async _deleteTempFile(filePath) {
    try {
      // 检查文件是否存在
      await fs.access(filePath)
      // 删除文件
      await fs.unlink(filePath)
      logger.info(`mCat-ac: 已删除临时文件: ${filePath}`)
    } catch (error) {
      // 文件不存在或无法删除时忽略错误
      logger.warn(`mCat-ac: 无法删除临时文件 ${filePath}: ${error.message}`)
    }
  }
  
  // 清理关联的临时文件（HTML和PNG）
  async _cleanupAssociatedFiles(pngFilePath) {
    try {
      // 1. 删除PNG文件本身
      await this._deleteTempFile(pngFilePath)
      
      // 2. 尝试找到并删除关联的HTML文件
      // 从文件名格式来看，HTML和PNG文件是成对生成的，使用相似的时间戳
      const tempDir = path.dirname(pngFilePath)
      const fileName = path.basename(pngFilePath)
      const timestamp = fileName.split('.')[0]
      
      // 查找对应的HTML文件
      const files = await fs.readdir(tempDir)
      for (const file of files) {
        // 如果找到相同时间戳的HTML文件，删除它
        if (file.endsWith('.html') && file.startsWith(timestamp)) {
          await this._deleteTempFile(path.join(tempDir, file))
          break
        }
      }
    } catch (error) {
      logger.error(`mCat-ac: 清理关联临时文件时出错: ${error.message}`)
    }
  }

  // 开始录入成就
  async startInput (e) {
    // 用户身份验证：检查是否绑定游戏UID
    const hasBoundUid = await this.checkUserBinding(e)
    if (!hasBoundUid) {
      return
    }
    
    // 使用字符串格式的用户ID以保持一致性
    const userId = String(e.user_id)
    
    // 设置用户录入状态为等待分享码
    userInputStatus[userId] = 'waitingForShareCode'
    // 保留用户状态设置的关键日志
    logger.info(`mCat-ac: 用户${userId}开始成就录入流程`)
    
    await e.reply('请发送九位椰羊成就分享码，超时1分钟后需要重新发起指令。')
    
    // 设置超时清理 - 现在使用1分钟超时（可配置）
    setTimeout(() => {
      if (userInputStatus && userInputStatus[userId] !== undefined) {
        delete userInputStatus[userId]
        // 移除超时清理的详细日志
      
      }
    }, 60000) // 1分钟超时
    
    // 移除超时设置的详细日志
  
  }
  
  // 通过ID或名称录入成就
  async inputByIdOrName (e) {
    // 用户身份验证：检查是否绑定游戏UID
    const hasBoundUid = await this.checkUserBinding(e)
    if (!hasBoundUid) {
      return false
    }
    
    const userId = e.user_id
    
    // 检查e.match的结构，提取输入内容
    let input = ''
    if (Array.isArray(e.match) && e.match[1]) {
      input = e.match[1].trim()
    } else if (e.raw_message && typeof e.raw_message === 'string') {
      // 尝试从原始消息中提取内容
      const match = e.raw_message.match(/^#成就录入\s*(.+)$/)
      if (match && match[1]) {
        input = match[1].trim()
      }
    }
    
    // 最终防御性检查
    if (!input) {
      await e.reply('命令格式有误，请使用 #成就录入 成就ID或名称')
      return false
    }
    
    try {
      // 解析输入内容
      const inputs = input.split(/\s+/)
      const completedIds = new Set() // 使用Set避免重复
      const recordedAchievements = new Set() // 使用Set避免重复显示
      
      // 读取用户当前已完成的成就
      const userAchievements = await this.getUserAchievements(userId)
      const userCompletedSet = new Set(userAchievements || [])
      
      for (const item of inputs) {
        // 判断是ID还是名称
        if (/^\d+$/.test(item)) {
          // 是ID
          const id = parseInt(item)
          
          // 查找成就信息
          const achievement = await this.findAchievementById(id)
          if (achievement) {
            // 自动完成前置成就
            const allRequiredIds = await this.getAllRequiredAchievementIds(id)
            for (const requiredId of allRequiredIds) {
              completedIds.add(requiredId)
            }
            
            // 记录当前成就
            completedIds.add(id)
            const stageInfo = this.getAchievementStageInfo(achievement)
            recordedAchievements.add(`${id} (${achievement.name}${stageInfo})`)
          } else {
            recordedAchievements.add(`${id} (未知成就)`) 
          }
        } else {
          // 检查是否是"成就名称+数字"格式，如"动物园大亨3"
          const nameStageMatch = item.match(/^(.+?)(\d+)$/)
          let targetAchievement = null
          let targetStage = 1
          
          if (nameStageMatch) {
            const baseName = nameStageMatch[1].trim()
            targetStage = parseInt(nameStageMatch[2])
            
            // 查找所有同名成就并根据阶段选择
            targetAchievement = await this.findAchievementByStage(baseName, targetStage)
          } else {
            // 普通名称查找
            // 对于阶段性成就，根据用户已完成情况确定录入哪个阶段
            const allSameNameAchievements = await this.findAllAchievementsByName(item)
            
            if (allSameNameAchievements.length > 1) {
              // 是阶段性成就
              // 获取已完成的最高阶段
              let highestCompletedStage = 0
              const completedStages = []
              
              for (const ac of allSameNameAchievements) {
                const stageNum = this.determineStageNumber(ac)
                if (userCompletedSet.has(ac.id)) {
                  completedStages.push(ac)
                  if (stageNum > highestCompletedStage) {
                    highestCompletedStage = stageNum
                  }
                }
              }
              
              // 找到下一个应该完成的阶段（当前最高完成阶段+1）
              let nextStage = null
              for (const ac of allSameNameAchievements) {
                const stageNum = this.determineStageNumber(ac)
                if (stageNum === highestCompletedStage + 1) {
                  nextStage = ac
                  break
                }
              }
              
              // 如果下一个阶段不存在（已经是最高阶段），则仍然选择最高阶段
              if (!nextStage) {
                nextStage = allSameNameAchievements.sort((a, b) => 
                  this.determineStageNumber(b) - this.determineStageNumber(a)
                )[0]
              }
              
              targetAchievement = nextStage
            } else {
              // 非阶段性成就或只有一个阶段
              targetAchievement = allSameNameAchievements[0]
            }
          }
          
          if (targetAchievement) {
            // 自动完成前置成就
            const allRequiredIds = await this.getAllRequiredAchievementIds(targetAchievement.id)
            for (const requiredId of allRequiredIds) {
              completedIds.add(requiredId)
            }
            
            // 记录当前成就
            completedIds.add(targetAchievement.id)
            const stageInfo = this.getAchievementStageInfo(targetAchievement)
            recordedAchievements.add(`${targetAchievement.name}${stageInfo} (ID: ${targetAchievement.id})`)
          } else {
            await e.reply(`未找到成就：${item}`)
          }
        }
      }
      
      // 转换Set为数组
      const completedIdsArray = Array.from(completedIds)
      const recordedAchievementsArray = Array.from(recordedAchievements)
      
      // 保存录入的成就
      await this.saveUserAchievements(userId, completedIdsArray)
      
      // 导入转发消息工具
      const common = await import('../../lib/common/common.js');
      const makeForwardMsg = common.default.makeForwardMsg;
      
      // 反馈录入结果，使用卡片格式
      if (recordedAchievementsArray.length > 0) {
        try {
          // 准备卡片消息内容
          const cardMessage = `成功录入 ${completedIdsArray.length} 个成就：\n${recordedAchievementsArray.join('\n')}`;
          // 使用makeForwardMsg创建卡片消息
          const forwardMsg = await makeForwardMsg(e, [cardMessage], '✨ 成就录入结果');
          await e.reply(forwardMsg);
        } catch (error) {
          logger.error(`[mCat-ac] 发送卡片消息失败: ${error.message}`);
          // 降级方案：使用普通文本消息
          await e.reply(`成功录入 ${completedIdsArray.length} 个成就：\n${recordedAchievementsArray.join('\n')}`);
        }
      } else {
        await e.reply('没有成功录入任何成就')
      }
    } catch (err) {
      logger.error(`录入成就时出错: ${err.message}`)
      await e.reply('录入成就时出错，请重试')
    }
  }
      
  // 解析成就文件
  parseAchievementFile(data) {
    try {
      const completedIds = []
      const possibleSheepFormats = [
        data?.data?.achievements,
        data?.list,
        data?.achievements,
        data?.value?.achievements,
        data?.items,
        data?.records,
        data
      ].filter(Boolean);
      
      for (const achievements of possibleSheepFormats) {
        if (Array.isArray(achievements) && achievements.length > 0) {
          logger.info(`[mCat-ac] 检测到可能的椰羊成就格式，长度: ${achievements.length}`)
          let foundIds = false;
          for (const item of achievements) {
            if (item.id && item.timestamp !== 0) {
              completedIds.push(item.id)
              foundIds = true
              if (completedIds.length <= 5) { // 只记录前5个ID作为示例
                logger.debug(`[mCat-ac] 添加可能的椰羊成就ID: ${item.id}`)
              }
            }
          }
          if (foundIds) {
            logger.info(`[mCat-ac] 从可能的椰羊成就格式中找到${completedIds.length}个成就`)
            return [...new Set(completedIds)]
          }
        }
      }
      
      // 椰羊成就legacy格式
      if ((data.source === '椰羊成就' || data.info?.app === '椰羊成就') && Array.isArray(data.value?.achievements)) {
        logger.info('[mCat-ac] 检测到椰羊成就legacy格式')
        for (const item of data.value.achievements) {
          if (item.id && item.timestamp !== 0) {
            completedIds.push(item.id)
            logger.debug(`[mCat-ac] 添加椰羊成就legacy格式ID: ${item.id}`)
          }
        }
        return [...new Set(completedIds)]
      }
      
      // 椰羊成就UIAF扩展格式
      if ((data.source === '椰羊成就' || data.info?.app === '椰羊成就') && Array.isArray(data.achievements)) {
        logger.info('[mCat-ac] 检测到椰羊成就UIAF扩展格式')
        for (const item of data.achievements) {
          if (item.id && item.timestamp !== 0) {
            completedIds.push(item.id)
            logger.debug(`[mCat-ac] 添加椰羊成就UIAF扩展格式ID: ${item.id}`)
          }
        }
        return [...new Set(completedIds)]
      }
      
      // ===== 3. NapCatQQ可能的格式 =====
      // 检查NapCatQQ可能使用的嵌套数据结构
      if (data.data && typeof data.data === 'object') {
        logger.info('[mCat-ac] 检测到嵌套data对象结构')
        // 检查data.list格式
        if (Array.isArray(data.data.list)) {
          logger.info('[mCat-ac] 检测到data.list格式')
          for (const item of data.data.list) {
            if (item.id && item.timestamp !== 0) {
              completedIds.push(item.id)
              logger.debug(`[mCat-ac] 从data.list添加ID: ${item.id}`)
            }
          }
          if (completedIds.length > 0) {
            return [...new Set(completedIds)]
          }
        }
        // 检查data.achievements格式
        if (Array.isArray(data.data.achievements)) {
          logger.info('[mCat-ac] 检测到data.achievements格式')
          for (const item of data.data.achievements) {
            if (item.id && item.timestamp !== 0) {
              completedIds.push(item.id)
              logger.debug(`[mCat-ac] 从data.achievements添加ID: ${item.id}`)
            }
          }
          if (completedIds.length > 0) {
            return [...new Set(completedIds)]
          }
        }
      }
      
      // ===== 4. 内容嵌套格式 =====
      if (data.content && typeof data.content === 'object') {
        logger.info('[mCat-ac] 检测到嵌套content对象结构')
        if (Array.isArray(data.content.achievements)) {
          logger.info('[mCat-ac] 检测到content.achievements格式')
          for (const item of data.content.achievements) {
            if (item.id && item.timestamp !== 0) {
              completedIds.push(item.id)
              logger.debug(`[mCat-ac] 从content.achievements添加ID: ${item.id}`)
            }
          }
          if (completedIds.length > 0) {
            return [...new Set(completedIds)]
          }
        }
      }
      
      // ===== 5. 通用格式检测 =====
      // list数组格式
      if (Array.isArray(data.list)) {
        logger.info('[mCat-ac] 检测到list数组格式')
        for (const item of data.list) {
          if (item.id && item.timestamp !== 0) {
            completedIds.push(item.id)
            logger.debug(`[mCat-ac] 添加list数组格式ID: ${item.id}`)
          }
        }
        if (completedIds.length > 0) {
          return [...new Set(completedIds)]
        }
      }
      
      // 通用成就列表格式
      if (Array.isArray(data.achievements)) {
        logger.info('[mCat-ac] 检测到通用成就列表格式')
        for (const item of data.achievements) {
          if (item.id && item.timestamp !== 0) {
            completedIds.push(item.id)
            logger.debug(`[mCat-ac] 添加通用成就格式ID: ${item.id}`)
          }
        }
        if (completedIds.length > 0) {
          return [...new Set(completedIds)]
        }
      }
      
      // ===== 6. 直接ID数组格式 =====
      if (Array.isArray(data) && data.length > 0) {
        // 如果数据本身就是数组，尝试提取ID
        if (typeof data[0] === 'number') {
          // 如果是ID数组
          logger.info('[mCat-ac] 检测到ID数组格式')
          completedIds.push(...data)
          logger.info(`[mCat-ac] 添加ID数组格式，共${data.length}个ID`)
          return [...new Set(completedIds)]
        } else if (typeof data[0] === 'object' && data[0] !== null) {
          // 如果是对象数组，尝试提取每个对象的ID
          logger.info('[mCat-ac] 检测到对象数组格式，尝试提取ID')
          for (const item of data) {
            if (item.id && item.timestamp !== 0) {
              completedIds.push(item.id)
              logger.debug(`[mCat-ac] 从对象数组中添加ID: ${item.id}`)
            }
          }
          if (completedIds.length > 0) {
            return [...new Set(completedIds)]
          }
        }
      }
      
      // 额外的通用格式检测 - 尝试所有可能的数组字段，增强对椰羊成就.uiafext格式的支持
      if (typeof data === 'object' && data !== null && completedIds.length === 0) {
        logger.info('[mCat-ac] 执行额外的通用格式检测 - 搜索所有可能的数组字段')
        
        // 搜索所有可能包含成就数据的数组字段
        for (const key in data) {
          // 优先检查可能包含椰羊成就数据的字段
          if (['value', 'data', 'content', 'achievements', 'list', 'items', 'records', 'unlocked'].includes(key)) {
            logger.info(`[mCat-ac] 优先检查可能的椰羊成就字段: ${key}`)
          }
          
          const value = data[key];
          if (Array.isArray(value) && value.length > 0) {
            logger.info(`[mCat-ac] 检测到数组字段: ${key}, 长度: ${value.length}`)
            
            // 检查数组元素是否包含ID或本身是数字ID
            let foundInArray = false;
            // 增加检查范围，从10个元素扩展到20个
            for (const item of value.slice(0, 20)) { 
              if (item && typeof item === 'object') {
                if (item.id && item.timestamp !== 0) {
                  completedIds.push(item.id)
                  foundInArray = true
                  logger.debug(`[mCat-ac] 从数组字段 ${key} 中找到ID: ${item.id}`)
                }
              } else if (typeof item === 'number') {
                // 如果是数字，可能是直接的ID
                completedIds.push(item)
                foundInArray = true
                logger.debug(`[mCat-ac] 从数组字段 ${key} 中找到数字ID: ${item}`)
              }
            }
            
            if (foundInArray) {
              logger.info(`[mCat-ac] 从数组字段 ${key} 中找到成就数据，继续扫描整个数组`)
              // 扫描整个数组
              for (const item of value) {
                if (item && typeof item === 'object' && item.id && item.timestamp !== 0) {
                  completedIds.push(item.id)
                } else if (typeof item === 'number') {
                  completedIds.push(item)
                }
              }
              return [...new Set(completedIds)]
            }
          }
        }
      }
      
      // ===== 7. 增强的ID字段搜索 =====
      if (typeof data === 'object' && data !== null) {
        logger.info('[mCat-ac] 尝试从对象中查找所有可能的ID字段')
        
        // 检查常用的已完成ID字段，增加更多可能的字段名，特别是针对椰羊成就.uiafext格式
        const commonIdFields = ['completedIds', 'completed', 'finishedIds', 'finished', 'achievementIds', 
                                'achievement_list', 'completed_achievements', 'got', 'received', 
                                'unlocked', 'accomplished', 'achieved', 'achievements_list', 
                                'completed_ids', 'finished_ids', 'achievement_ids', 'unlocked_achievements']
        for (const field of commonIdFields) {
          if (Array.isArray(data[field])) {
            logger.info(`[mCat-ac] 检测到${field}字段数组`)
            const validIds = data[field].filter(id => typeof id === 'number')
            completedIds.push(...validIds)
            logger.info(`[mCat-ac] 从${field}字段添加${validIds.length}个ID`)
            if (validIds.length > 0) {
              return [...new Set(completedIds)]
            }
          }
        }
        
        // 检查其他可能包含ID的字段 - 深度搜索，增强对椰羊成就格式的支持
        const searchIdInObject = (obj, parentKey = '', depth = 0) => {
          // 防止过深的递归
          if (depth > 5) return;
          if (!obj || typeof obj !== 'object') return;
          
          // 如果是数组，检查每个元素
          if (Array.isArray(obj)) {
            // 记录数组长度，帮助诊断
            if (parentKey && obj.length > 0) {
              logger.info(`[mCat-ac] 深度搜索: ${parentKey} 是数组，长度: ${obj.length}`)
            }
            
            // 优先检查前30个元素
            const checkItems = obj.slice(0, 30);
            for (const item of checkItems) {
              if (item && typeof item === 'object') {
                if (item.id && item.timestamp !== 0) {
                  completedIds.push(item.id)
                  logger.debug(`[mCat-ac] 深度搜索发现ID: ${item.id} (来自${parentKey})`)
                } else {
                  // 递归搜索对象内部
                  searchIdInObject(item, parentKey, depth + 1)
                }
              } else if (typeof item === 'number') {
                // 如果数组元素是数字，可能是直接的ID数组
                logger.debug(`[mCat-ac] 深度搜索发现数字ID: ${item} (来自${parentKey})`)
                completedIds.push(item)
              }
            }
            
            // 如果在前30个元素中找到ID，继续检查剩余元素
            if (completedIds.length > 0 && obj.length > 30) {
              logger.info(`[mCat-ac] 在数组 ${parentKey} 的前30个元素中找到ID，继续检查剩余元素`)
              for (const item of obj.slice(30)) {
                if (item && typeof item === 'object' && item.id && item.timestamp !== 0) {
                  completedIds.push(item.id)
                } else if (typeof item === 'number') {
                  completedIds.push(item)
                }
              }
            }
          } else {
            // 如果是对象，检查所有属性
            for (const key in obj) {
              const newKey = parentKey ? `${parentKey}.${key}` : key;
              const value = obj[key];
              
              // 特别处理可能包含ID的字段名
              if (['id', 'achievementId', 'achievement_id', 'accomplishmentId', 'taskId', 'achievement'].includes(key) && typeof value === 'number') {
                logger.debug(`[mCat-ac] 深度搜索发现ID字段: ${value} (来自${newKey})`)
                completedIds.push(value)
              }
              // 检查是否是成就项
              else if (value && typeof value === 'object' && value.id && value.timestamp !== 0) {
                completedIds.push(value.id)
                logger.debug(`[mCat-ac] 深度搜索发现ID: ${value.id} (来自${newKey})`)
              } else if (value && typeof value === 'object') {
                // 优先搜索可能包含成就数据的字段
                if (['achievements', 'achievement_list', 'completed_achievements', 'data', 'list', 'content', 'items', 
                     'records', 'unlocked', 'got', 'received', 'accomplished', 'achieved'].includes(key)) {
                  logger.info(`[mCat-ac] 深度搜索: 优先进入${newKey} 对象`)
                  searchIdInObject(value, newKey, depth + 1);
                } else {
                  // 递归搜索嵌套对象
                  searchIdInObject(value, newKey, depth + 1);
                }
              }
            }
          }
        };
        
        // 执行深度搜索
        searchIdInObject(data);
      }
      
      // ===== 8. 最后验证 =====
      // 去重并排序，确保ID唯一性
      const uniqueIds = [...new Set(completedIds)]
      
      // 验证ID数量是否合理
      if (uniqueIds.length === 0) {
        logger.warn('[mCat-ac] 未找到任何有效的成就ID')
      } else if (uniqueIds.length < 10) {
        logger.warn(`[mCat-ac] 找到的成就ID数量较少: ${uniqueIds.length}个`)
      } else {
        logger.info(`[mCat-ac] 解析完成，共找到${uniqueIds.length}个唯一成就ID`)
      }
      
      return uniqueIds
    } catch (error) {
      logger.error('[mCat-ac] 解析成就文件时出错:', error.message)
      logger.error('[mCat-ac] 错误堆栈:', error.stack)
      return completedIds
    }
  }
  
  // 处理校对文件
  async processVerificationFiles() {
    try {
      const verificationDir = path.join(__dirname, 'data', 'Verification');
      logger.info(`${COLORS.ORANGE}开始处理校对文件，目录: ${verificationDir}${COLORS.RESET}`);
      
      // 确保目录存在
      try {
        await fs.mkdir(verificationDir, { recursive: true });
      } catch (mkdirError) {
        logger.error(`${COLORS.RED}创建校对文件目录失败: ${mkdirError.message}${COLORS.RESET}`);
      }
      
      // 获取所有校对文件
      let files = [];
      try {
        files = await fs.readdir(verificationDir);
      } catch (readError) {
        logger.error(`读取校对文件目录失败: ${readError.message}`);
        return;
      }
      
      const jsonFiles = files.filter(file => file.endsWith('.json'));
      logger.info(`找到${jsonFiles.length}个校对文件`);
      
      // 处理每个校对文件
      for (const file of jsonFiles) {
        try {
          const filePath = path.join(verificationDir, file);
          const data = await fs.readFile(filePath, 'utf8');
          const jsonData = JSON.parse(data);
          
          // 解析成就数据
          const achievements = this.parseAchievementFile(jsonData);
          logger.info(`处理文件${file}，解析到${achievements.length}个成就`);
          
          // 这里可以将成就数据存储到内存中
          // 暂时只是记录日志
        } catch (fileError) {
          logger.error(`处理文件${file}时出错: ${fileError.message}`);
          continue;
        }
      }
    } catch (error) {
      logger.error(`处理校对文件时出错: ${error.message}`);
    }
  }
  
  // 插件初始化数据
  async initData() {
    try {
      logger.info(`${COLORS.CYAN}mCat-ac: 开始初始化数据${COLORS.RESET}`);
      
      // 创建必要的目录结构
      const dataDirs = [
        path.join(__dirname, 'data'),
        path.join(__dirname, 'data', 'UserLog'),
        path.join(__dirname, 'data', 'Verification')
      ];
      
      for (const dir of dataDirs) {
        try {
          await fs.mkdir(dir, { recursive: true });
          logger.info(`${COLORS.PURPLE}mCat-ac: 确保目录存在: ${dir}${COLORS.RESET}`);
        } catch (mkdirError) {
          logger.error(`${COLORS.RED}mCat-ac: 创建目录失败 ${dir}: ${mkdirError.message}${COLORS.RESET}`);
        }
      }
      
      // 处理校对文件
      await this.processVerificationFiles();
      
      logger.info(`${COLORS.GREEN}mCat-ac: 数据初始化完成${COLORS.RESET}`);
      
      // 初始化配置文件监听器，启用配置热更新功能
      await this.initConfigWatchers();
    } catch (error) {
      logger.error(`${COLORS.RED}mCat-ac: 初始化数据时出错: ${error.message}${COLORS.RESET}`);
    }
  }
  
  // 保存用户成就数据（优化版）
  async saveUserAchievements (userId, completedIds) {
    const filePath = path.join(__dirname, `data/UserLog/${userId}.json`)
    
    // 异步创建目录（如果不存在）
    const dirPath = path.dirname(filePath)
    try {
      await fs.mkdir(dirPath, { recursive: true })
    } catch (err) {
      // 忽略目录已存在的错误
    }
    
    // 读取已有数据或创建新数据 - 使用try-catch优化错误处理
    let userData = { completedIds: [], timestamp: Date.now() }
    let existingCompletedIds = []
    
    try {
      // 快速路径：先检查文件是否存在
      await fs.access(filePath)
      const existingData = await fs.readFile(filePath, 'utf8')
      const parsedData = JSON.parse(existingData)
      
      // 关键修复：检查数据格式并兼容处理
      if (Array.isArray(parsedData)) {
        // 如果是直接的ID数组格式
        logger.info(`${COLORS.PURPLE}mCat-ac: 检测到数组格式的用户数据，正在转换为对象格式${COLORS.RESET}`)
        existingCompletedIds = parsedData
        userData.completedIds = existingCompletedIds
      } else if (parsedData.completedIds) {
        // 如果是包含completedIds属性的对象格式
        userData = parsedData
        existingCompletedIds = parsedData.completedIds
      } else {
        // 未知格式，使用默认数据
        logger.warn(`${COLORS.YELLOW}mCat-ac: 检测到未知格式的用户数据，使用默认格式${COLORS.RESET}`)
      }
    } catch (e) {
      // 文件不存在或其他错误，使用默认数据
    }
    
    // 性能优化：仅当有新ID时才更新
    if (completedIds.length > 0) {
      // 使用Set进行高效去重
      const currentSet = new Set(existingCompletedIds)
      const addedCount = completedIds.filter(id => !currentSet.has(id)).length
      
      // 添加必要的成就ID 84517（如果不存在）
      const targetAchievementId = 84517;
      let addedTargetId = false;
      if (!currentSet.has(targetAchievementId)) {
        currentSet.add(targetAchievementId);
        addedTargetId = true;
        logger.info(`[mCat-ac] 自动添加成就ID ${targetAchievementId} 到用户${userId}的成就数据中`);
      }
      
      if (addedCount > 0 || addedTargetId) {
        // 合并并去重
        const uniqueIds = [...new Set([...Array.from(currentSet), ...completedIds])]
        userData.completedIds = uniqueIds
        userData.timestamp = Date.now()
        userData.lastUpdate = new Date().toISOString()
        
        // 保存数据 - 使用更紧凑的格式减少文件大小
        await fs.writeFile(filePath, JSON.stringify(userData), 'utf8')
        logger.info(`[mCat-ac] 用户${userId}的成就数据已保存，新增${addedCount}个成就${addedTargetId ? '，自动添加了特定成就' : ''}`)
      }
    } else {
      // 检查是否需要添加成就ID 84517（当没有新数据但需要确保特定ID存在时）
      const targetAchievementId = 84517;
      const currentSet = new Set(existingCompletedIds);
      if (!currentSet.has(targetAchievementId)) {
        currentSet.add(targetAchievementId);
        userData.completedIds = Array.from(currentSet);
        userData.timestamp = Date.now();
        userData.lastUpdate = new Date().toISOString();
        await fs.writeFile(filePath, JSON.stringify(userData), 'utf8');
        logger.info(`[mCat-ac] 自动添加成就ID ${targetAchievementId} 到用户${userId}的成就数据中`);
      } else {
        // 至少保存时间戳
        userData.timestamp = Date.now()
        await fs.writeFile(filePath, JSON.stringify(userData), 'utf8')
      }
    }
  }
  
  // 调试状态信息
  async debugStatus (e) {
    try {
      const statusInfo = []
      
      // 插件基本信息
      statusInfo.push('=== mCat-ac 插件调试信息 ===')
      statusInfo.push(`插件版本: ${this.version || '未知'}`)
      statusInfo.push(`依赖初始化状态: ${this.dependenciesInitialized ? '已完成' : '未完成'}`)
      
      // 用户状态信息
      const userId = String(e.user_id)
      const userFilePath = path.join(__dirname, `data/UserLog/${userId}.json`)
      
      try {
        await fs.access(userFilePath)
        const userDataStr = await fs.readFile(userFilePath, 'utf8')
        const userData = JSON.parse(userDataStr)
        statusInfo.push(`\n用户 ${userId} 成就记录:`)
        statusInfo.push(`已完成成就数量: ${userData.completedIds ? userData.completedIds.length : 0}`)
        statusInfo.push(`最后更新时间: ${new Date(userData.lastUpdate || Date.now()).toLocaleString('zh-CN')}`)
      } catch (err) {
        statusInfo.push(`\n用户 ${userId}: 暂无成就记录`)
      }
      
      // 目录检查
      const dataDir = path.join(__dirname, 'data')
      const acmDir = path.join(__dirname, 'data/mCatAc') // 统一使用data/mCatAc路径
      const userLogDir = path.join(__dirname, 'data/UserLog')
      
      statusInfo.push('\n目录状态:')
      try {
        await fs.access(dataDir)
        statusInfo.push(`- 数据目录: 存在`)
      } catch (err) {
        statusInfo.push(`- 数据目录: 不存在`)
      }
      
      try {
        await fs.access(acmDir)
        const acmFiles = await fs.readdir(acmDir)
        statusInfo.push(`- 成就数据目录: 存在 (${acmFiles.length}个文件)`)
        if (acmFiles.includes('mCatAc.json')) {
          statusInfo.push(`  - 主成就数据文件: 存在`)
        }
      } catch (err) {
        statusInfo.push(`- 成就数据目录: 不存在`)
      }
      
      // 缓存状态
      statusInfo.push('\n缓存状态:')
      statusInfo.push(`- 成就缓存: ${this.cachedAchievements ? '已加载' : '未加载'}`)
      if (this.cachedAchievements && this.cachedAchievements.achievements) {
        statusInfo.push(`  - 缓存成就数量: ${this.cachedAchievements.achievements.length}`)
      }
      
      // 发送调试信息
      await e.reply(statusInfo.join('\n'))
    } catch (error) {
      logger.error(`[mCat-ac] 调试状态出错: ${error.message}`)
      await e.reply(`调试状态失败: ${error.message}`)
    }
  }
  
  // 成就重置功能
  async resetAchievements (e) {
    const userId = String(e.user_id)
    const filePath = path.join(__dirname, `data/UserLog/${userId}.json`)
    
    try {
      // 检查文件是否存在
      await fs.access(filePath)
      
      // 创建空的成就数据对象（只包含必要的字段）
      const emptyUserData = { 
        completedIds: [], 
        timestamp: Date.now(),
        lastUpdate: new Date().toISOString() 
      }
      
      // 写入空数据覆盖原文件
      await fs.writeFile(filePath, JSON.stringify(emptyUserData), 'utf8')
      
      logger.info(`[mCat-ac] 用户${userId}的成就数据已重置`)
      await e.reply('成就数据已成功重置！\n您可以重新使用#成就录入指令上传新的成就数据。')
      
    } catch (err) {
      if (err.code === 'ENOENT') {
        // 文件不存在，说明用户还没有录入过成就数据
        await e.reply('您还没有录入过任何成就数据，无需重置！')
      } else {
        // 其他错误
        logger.error(`[mCat-ac] 重置用户${userId}成就数据时出错: ${err.message}`)
        await e.reply(`重置成就数据时出现错误：${err.message}\n请稍后重试。`)
      }
    }
  }
  
  // 成就比对（优化版）
  // 处理消息接受，支持文件上传和状态管理
  async accept (e) {
    try {
      const userId = String(e.user_id)
      const userStatus = userInputStatus[userId]
      
      // 移除accept状态日志
      
      // 检查是否有椰羊成就URL
      const urlMatch = e.raw_message?.match(/https:\/\/77\.cocogoat\.cn\/v2\/memo\/([a-zA-Z0-9]+)/)
      if (urlMatch) {
        logger.info(`[mCat-ac] 检测到椰羊成就URL: ${urlMatch[0]}`)
        // 临时修改e.match以便importFromCocogoatUrl函数能正确处理
        e.match = urlMatch
        
        try {
          await this.importFromCocogoatUrl(e)
        } catch (error) {
          logger.error(`[mCat-ac] 调用importFromCocogoatUrl函数失败: ${error.message}`)
          await e.reply('导入椰羊成就失败，请重试')
        }
        return true
      }
      
      // 处理文件上传
      if (userStatus === 'waitingForShareCode' && e.file && e.file.url) {
        logger.info(`[mCat-ac] 检测到文件上传，处理成就数据导入`)
        
        try {
          // 下载并解析文件
          const response = await axios.get(e.file.url)
          const data = response.data
          
          // 解析成就数据
          const achievements = this.parseAchievementFile(data)
          
          if (achievements.length > 0) {
            // 保存用户成就
            await this.saveUserAchievements(userId, achievements)
            delete userInputStatus[userId]
            await e.reply(`成功导入 ${achievements.length} 个成就！`)  
          } else {
            await e.reply('未能从文件中解析出有效的成就数据')
          }
        } catch (error) {
          logger.error(`[mCat-ac] 处理文件上传失败: ${error.message}`)
          await e.reply('处理文件失败，请确保文件格式正确')
        }
        return true
      }
      
      // 处理分享码输入
      if (userStatus === 'waitingForShareCode' && e.raw_message && e.raw_message.length === 9 && /^[a-zA-Z0-9]+$/.test(e.raw_message)) {
        logger.info(`[mCat-ac] 检测到椰羊分享码，开始导入成就`)
        
        try {
          // 构造URL并调用导入函数
          const url = `https://77.cocogoat.cn/v2/memo/${e.raw_message}`
          e.match = ['', e.raw_message]
          await this.importFromCocogoatUrl(e)
        } catch (error) {
          logger.error(`[mCat-ac] 导入椰羊成就失败: ${error.message}`)
          await e.reply('导入失败，请检查分享码是否正确')
        }
        return true
      }
      
      return false
    } catch (error) {
      logger.error(`[mCat-ac] accept函数出错: ${error.message}`)
      return false
    }
  }
  
  // 从椰羊网站URL导入成就
  async importFromCocogoatUrl(e) {
    try {
      const userId = String(e.user_id)
      const shareCode = e.match[1] || ''
      
      if (!shareCode || shareCode.length !== 9) {
        await e.reply('无效的分享码，请使用九位椰羊成就分享码')
        return false
      }
      
      // 保留导入开始的关键日志，统一格式
      logger.info(`mCat-ac: 开始从椰羊网站导入成就，用户${userId}，分享码: ${shareCode}`)
      
      // 构造请求URL
      const url = `https://77.cocogoat.cn/v2/memo/${shareCode}`
      
      // 发送请求获取成就数据
      const response = await axios.get(url, {
        headers: {
          'Accept': 'application/json',
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36'
        },
        timeout: 15000
      })
      
      const data = response.data
      
      // 检查响应是否包含有效的成就数据
      if (!data || !data.value) {
        await e.reply('未能从分享链接获取有效的成就数据')
        return false
      }
      
      // 解析成就数据
      const achievements = this.parseAchievementFile(data.value)
      
      if (achievements.length > 0) {
        // 保存用户成就
        await this.saveUserAchievements(userId, achievements)
        
        // 清理状态
        if (userInputStatus[userId]) {
          delete userInputStatus[userId]
        }
        
        // 保留导入成功的关键日志
        logger.info(`mCat-ac: 成功从椰羊网站导入${achievements.length}个成就，用户${userId}`)
        
        await e.reply(`成功从椰羊网站导入 ${achievements.length} 个成就！`)
        return true
      } else {
        await e.reply('未能解析出有效的成就数据，请检查分享码是否正确')
        return false
      }
    } catch (error) {
      // 保留错误日志，统一格式
      logger.error(`mCat-ac: 从椰羊网站导入成就失败: ${error.message}`)
      
      let errorMsg = '导入失败，请重试'
      if (error.response) {
        if (error.response.status === 404) {
          errorMsg = '未找到对应的成就数据，请检查分享码是否正确'
        } else if (error.response.status === 429) {
          errorMsg = '请求过于频繁，请稍后再试'
        }
      } else if (error.request) {
        errorMsg = '网络连接失败，请检查网络后重试'
      }
      
      await e.reply(errorMsg)
      return false
    }
  }
  
  // 成就比对（优化版）
  async compareAchievements (e, userId, progressInfo = []) {
    try {
      // 保留开始成就比对的日志
      logger.info(`${COLORS.CYAN}mCat-ac: 开始对用户${userId}进行成就比对${COLORS.RESET}`);
      progressInfo.push('开始成就比对...');
      // 记录开始时间用于性能统计
      const compareStartTime = Date.now()
      
      // 使用统一的getUserAchievements方法读取用户成就数据
      const completedIds = await this.getUserAchievements(userId)
      const userData = { completedIds } // 包装成标准格式
      
      // 读取总成就数据 - 使用缓存机制
      const acFilePath = path.join(__dirname, 'data/mCatAc/mCatAc.json')
      
      // 初始化缓存属性
      if (typeof this.cachedAchievements === 'undefined') {
        this.cachedAchievements = null
      }
      if (typeof this.achievementCacheTime === 'undefined') {
        this.achievementCacheTime = 0
      }
      
      // 检查是否有缓存的成就数据
      if (!this.cachedAchievements || (Date.now() - this.achievementCacheTime > 3600000)) {
        // 缓存过期或不存在，重新读取
        const acDataStr = await fs.readFile(acFilePath, 'utf8')
        const catalogData = JSON.parse(acDataStr)
        
        // 初始化成就数组
        const allAchievements = []
        
        // 读取所有成就文件内容
        if (catalogData?.categories && Array.isArray(catalogData.categories)) {
          for (const category of catalogData.categories) {
            const filePath = path.join(__dirname, 'data/mCatAc/File', category.fileName)
            try {
              await fs.access(filePath)
              const fileContent = await fs.readFile(filePath, 'utf8')
              const achievementData = JSON.parse(fileContent)
              
              // 将该分类下的所有成就添加到总数组中
              if (achievementData?.achievements && Array.isArray(achievementData.achievements)) {
                allAchievements.push(...achievementData.achievements)
              }
            } catch (err) {
              // 保留文件读取失败的警告日志
              logger.warn(`${COLORS.YELLOW}读取成就文件 ${category.fileName} 失败: ${err.message}${COLORS.RESET}`)
            }
          }
        }
        
        // 创建完整的成就数据对象
        this.cachedAchievements = {
          ...catalogData,
          achievements: allAchievements
        }
        this.achievementCacheTime = Date.now()
      }
      
      const acData = this.cachedAchievements
      
      // 计算已完成和未完成的成就
      const completedSet = new Set(userData.completedIds)
      let totalReward = 0
      const EXCLUDED_ACHIEVEMENT_ID = 84517 // 不参与统计和比对的特殊成就ID
      
      // 过滤未完成的成就
      const incompleteAchievements = []
      
      // 获取achievements数组
      const achievements = acData?.achievements || []
      
      // 防御性检查，确保achievements是可迭代的
      if (!Array.isArray(achievements)) {
        // 保留错误日志
        logger.error(`${COLORS.RED}成就数据格式错误：achievements不是数组${COLORS.RESET}`)
        await e.reply('成就数据格式错误，请更新校对文件后重试')
        return
      }
      
      for (const ac of achievements) {
        // 跳过特殊成就ID，不参与比对和显示
        if (ac.id === EXCLUDED_ACHIEVEMENT_ID) {
          continue
        }
        
        if (!completedSet.has(ac.id)) {
          incompleteAchievements.push(ac)
          totalReward += ac.reward || 0
        }
      }
      
      // 进度反馈
      const completedCount = userData.completedIds ? userData.completedIds.length : 0;
      const compareResult = `比对完成，耗时: ${Math.round((Date.now() - compareStartTime) / 1000)}秒\n已完成成就: ${completedCount}\n未完成成就: ${incompleteAchievements.length}\n可获取奖励: ${totalReward}原石`;
      
      // 保留成就比对结果的关键日志
      logger.info(`${COLORS.GREEN}mCat-ac: 成就比对完成 - 总成就数: ${achievements.length}, 已完成: ${completedCount}, 未完成: ${incompleteAchievements.length}${COLORS.RESET}`);
      
      progressInfo.push(compareResult);
      progressInfo.push('正在生成结果图片...');
      
      // 清空进度信息，不需要发送进度
      progressInfo.length = 0;
      
      // 优化：只显示少量未完成成就的预览，避免生成过多图片
      // 限制返回的未完成成就数量，默认显示前50个
      const displayIncompleteAchievements = incompleteAchievements.slice(0, 50);
      
      await this.generateResultImages(e, {
        completedCount: completedCount,
        incompleteCount: incompleteAchievements.length,
        incompleteAchievements: displayIncompleteAchievements,
        totalReward: totalReward,
        // 添加完整数量信息，方便用户了解
        actualIncompleteCount: incompleteAchievements.length,
        displayLimit: 50
      })
    } catch (err) {
      // 保留错误日志
      logger.error(`成就比对时出错: ${err.message}`)
      // 检查是否是文件不存在的错误
      if (err.code === 'ENOENT' && err.message.includes('mCatAc.json')) {
        await e.reply('无本地校对文件，需管理员使用"#更新校对文件"指令更新本地文件')
      } else {
        await e.reply('成就比对时出错，请重试')
      }
    }
  }
  
  // 检查用户是否绑定游戏UID
  async checkUserBinding (e) {
    try {
      // 使用与checkAchievements相同的UID获取方法
      // 检查用户是否有绑定的UID
      const hasUid = await e.user?.hasUid() || false
      if (!hasUid) {
        await e.reply('您尚未绑定游戏UID，请先完成绑定操作后再使用成就录入功能')
        return false
      }
      return true
    } catch (err) {
      logger.error(`检查用户绑定状态时出错: ${err.message}`)
      await e.reply('您尚未绑定游戏UID，请先完成绑定操作后再使用成就录入功能')
      return false
    }
  }
  
  // 查询成就查漏
  async checkAchievements (e) {
    const userId = e.user_id
    const userFilePath = path.join(__dirname, `data/UserLog/${userId}.json`)
    
    try {
      // 检查用户是否有录入记录
      await fs.access(userFilePath)
      
      // 直接调用比对函数
      await this.compareAchievements(e, userId)
    } catch (err) {
      await e.reply('未发现已录入成就，请先进行#成就录入')
    }
  }
  
  // 已在前面实现了完整版本的compareAchievements方法
  
  // 更新校对文件 - 支持所有成就分类（改进版）
  async updateCheckFile (e) {
    const baseUrl = 'https://github.com/dvaJi/genshin-data'
    const achievementsFolder = 'src/data/chinese-simplified/achievements'
    const savePath = path.join(__dirname, 'data/mCatAc/mCatAc.json')
    const acmDirPath = path.join(__dirname, 'data/mCatAc')
    const acmFileDirPath = path.join(__dirname, 'data/mCatAc/File')
    
    try {
      // 检查主成就文件是否存在
      let fileExists = false;
      try {
        await fs.access(savePath);
        fileExists = true;
        // 移除不必要的日志
        // logger.info('成就主文件已存在');
      } catch (err) {
        // 文件不存在
        fileExists = false;
      }
      
      // 如果文件存在且不是由用户主动触发的更新，则提示用户使用更新指令
      if (fileExists && !e) {
        // 移除不必要的日志
        // logger.info('成就主文件已存在，等待用户指令');
        return;
      }
      
      // 如果是用户主动请求更新，即使文件存在也要执行更新
      if (fileExists && e) {
        // 保留用户请求更新的日志
        logger.info(`${COLORS.CYAN}用户请求更新校对文件，开始执行更新操作${COLORS.RESET}`);
        await e.reply('正在更新成就校对文件，请稍候...');
      }
      
      // 确保ACM目录存在
      try {
        await fs.access(acmDirPath);
      } catch (err) {
        // 目录不存在，创建它
        await fs.mkdir(acmDirPath, { recursive: true });
        // 移除目录创建成功的日志
        // logger.info('创建ACM目录成功')
      }
      
      // 确保File目录存在
      try {
        await fs.access(acmFileDirPath);
      } catch (err) {
        // 目录不存在，创建它
        await fs.mkdir(acmFileDirPath, { recursive: true });
        // 移除目录创建成功的日志
        // logger.info('创建ACM/File目录成功')
      }
      
      // 动态获取GitHub仓库中的成就文件列表
      let achievementFiles = []
      
      try {
        // 保留开始获取文件列表的日志
        logger.info(`${COLORS.WHITE}正在从GitHub获取成就文件列表...${COLORS.RESET}`)
        
        // 使用HTTPS模块直接获取文件列表，避免axios超时问题
        const fileList = await this.getAchievementFilesFromGitHub();
        achievementFiles = fileList;
        // 保留获取到文件数量的日志
        logger.info(`${COLORS.GREEN}成功获取到 ${achievementFiles.length} 个成就文件${COLORS.RESET}`)
      } catch (err) {
        logger.warn(`${COLORS.YELLOW}从GitHub获取文件列表失败: ${err.message}，使用备用方法${COLORS.RESET}`)
        
        // 备用方案：使用预定义的基本文件列表，确保核心功能可用
        achievementFiles = [
          'adventurers_guild.json',
          'wonders_of_the_world.json',
          'mondstadt_adventure.json',
          'mondstadt_stories.json',
          'liye_adventure.json',
          'liye_stories.json',
          'inazuma_adventure.json',
          'inazuma_stories.json',
          'sumeru_adventure.json',
          'sumeru_stories.json',
          'fontaine_adventure.json',
          'fontaine_stories.json'
        ]
        // 保留使用备用列表的日志
        logger.info(`使用备用文件列表，共 ${achievementFiles.length} 个文件`)
      }
      
      // 下载所有成就文件 - 保留文件下载开始的日志
      logger.info(`${COLORS.CYAN}开始下载成就文件，共 ${achievementFiles.length} 个${COLORS.RESET}`);
      const downloadResult = await this.downloadAchievementFiles(achievementFiles);
      
      // 校验文件完整性
      const validationResult = await this.validateAchievementFiles(achievementFiles);
      
      // 重新下载缺失的文件
      if (validationResult.missingFiles.length > 0) {
        logger.info(`发现 ${validationResult.missingFiles.length} 个缺失文件，正在重新下载...`)
        await e.reply(`发现 ${validationResult.missingFiles.length} 个缺失文件，正在重新下载...`)
        
        const retryResult = await this.downloadAchievementFiles(validationResult.missingFiles);
        logger.info(`重新下载完成: 成功 ${retryResult.successCount}, 失败 ${retryResult.failCount}`)
      }
      
      // 更新成就目录文件
    await this.updateAchievementCatalog(achievementFiles);
    
    // 注意：当前实现会下载文件并可能覆盖本地文件，但不会主动删除现有文件
      
      const resultMsg = `成就校对文件更新成功！\n成功下载 ${downloadResult.successCount}/${achievementFiles.length} 个成就文件\n缺失文件: ${validationResult.missingFiles.length} 个\n总成就分类数量: ${achievementFiles.length}`
      // 保留操作完成的日志
      logger.info(resultMsg)
      
      // 如果有消息事件，回复用户
      if (e) {
        await e.reply(resultMsg)
      }
    } catch (err) {
      // 保留错误日志
      logger.error(`${COLORS.RED}更新校对文件失败: ${err.message}${COLORS.RESET}`)
      
      // 如果有消息事件，回复用户
      if (e) {
        await e.reply(`更新校对文件失败: ${err.message}`)
      }
    }
  }
  
  // 强制更新校对文件 - 先删除本地文件，再重新下载
  async forceUpdateCheckFile (e) {
    const fs = require('fs').promises;
    const fsSync = require('fs');
    const acmFileDirPath = path.join(__dirname, 'data/mCatAc/File');
    
    try {
      // 保留强制更新开始的日志
      logger.info(`${COLORS.CYAN}用户请求强制更新校对文件，开始执行操作${COLORS.RESET}`);
      await e.reply('正在强制更新成就校对文件，请稍候...');
      
      // 首先删除所有本地成就文件
      logger.info(`开始删除本地成就文件`);
      
      if (fsSync.existsSync(acmFileDirPath)) {
        // 读取目录内容
        const files = await fs.readdir(acmFileDirPath);
        
        // 删除所有.json文件
        const jsonFiles = files.filter(f => f.endsWith('.json'));
        for (const file of jsonFiles) {
          const filePath = path.join(acmFileDirPath, file);
          await fs.unlink(filePath);
          // 移除单个文件删除的日志
          // logger.info(`已删除文件: ${file}`);
        }
        
        logger.info(`成功删除 ${jsonFiles.length} 个本地成就文件`);
        await e.reply(`已删除 ${jsonFiles.length} 个本地成就文件，正在重新下载...`);
      } else {
        logger.info('成就文件目录不存在，将创建新目录');
        await e.reply('成就文件目录不存在，将创建新目录并下载文件...');
      }
      
      // 调用现有的updateCheckFile方法执行下载操作
      // 由于e存在，updateCheckFile会执行完整的更新流程
      await this.updateCheckFile(e);
      
    } catch (err) {
      // 保留错误日志
      logger.error(`${COLORS.RED}强制更新校对文件失败: ${err.message}${COLORS.RESET}`);
      
      // 如果有消息事件，回复用户
      if (e) {
        await e.reply(`强制更新校对文件失败: ${err.message}`);
      }
    }
  }
  
  // 从GitHub获取成就文件列表
  async getAchievementFilesFromGitHub() {
    return new Promise((resolve, reject) => {
      const https = require('https');
      
      const options = {
        hostname: 'api.github.com',
        port: 443,
        path: '/repos/dvaJi/genshin-data/contents/src/data/chinese-simplified/achievements',
        method: 'GET',
        headers: {
          'User-Agent': 'mCat-ac Plugin'
        }
      };

      const req = https.request(options, (res) => {
        let data = '';
        res.on('data', (chunk) => {
          data += chunk;
        });
        res.on('end', () => {
          try {
            const response = JSON.parse(data);
            
            // 检查响应是否是数组
            if (Array.isArray(response)) {
              // 过滤出.json文件
              const jsonFiles = response.filter(file => file.name && file.name.endsWith('.json'));
              resolve(jsonFiles.map(file => file.name));
            } else {
              reject(new Error('Unexpected response format from GitHub API'));
            }
          } catch (error) {
            reject(error);
          }
        });
      });

      req.on('error', (error) => {
        reject(error);
      });

      req.end();
    });
  }
  
  // 下载成就文件（改进版，使用多种下载源和重试机制）
  async downloadAchievementFiles(fileNames) {
    const https = require('https');
    const fs = require('fs').promises;
    const fsSync = require('fs');
    
    let successCount = 0;
    let failCount = 0;
    
    // 读取上次成功的源索引配置
    let lastSuccessSourceIndex = 0;
    const configPath = path.join(__dirname, 'data', 'mCatAc', 'downloadConfig.json');
    try {
      if (fsSync.existsSync(configPath)) {
        const configContent = fsSync.readFileSync(configPath, 'utf8');
        const config = JSON.parse(configContent);
        lastSuccessSourceIndex = config.lastSuccessSourceIndex || 0;
      }
    } catch (err) {
      logger.warn('读取下载配置失败，使用默认源');
    }
    
    // 定义下载源
    const downloadSources = [
      `https://raw.githubusercontent.com/dvaJi/genshin-data/master/src/data/chinese-simplified/achievements/`,
      `https://cdn.jsdelivr.net/gh/dvaJi/genshin-data@master/src/data/chinese-simplified/achievements/`,
      `https://github.com/dvaJi/genshin-data/raw/master/src/data/chinese-simplified/achievements/`
    ];
    
    // 使用并发控制下载文件
    const concurrency = 8; // 最大并发数
    for (let i = 0; i < fileNames.length; i += concurrency) {
      const batch = fileNames.slice(i, i + concurrency);
      const promises = batch.map(async (fileName) => {
        const filePath = path.join(__dirname, 'data', 'mCatAc', 'File', fileName);
        
        // 优先使用上次成功的源
        let currentSourceIndex = lastSuccessSourceIndex;
        let sourceSwitched = false;
        
        // 尝试下载，如果当前源失败则切换到下一个源
        while (currentSourceIndex < downloadSources.length) {
          const rawUrl = downloadSources[currentSourceIndex] + fileName;
          logger.info(`正在下载 ${fileName} (源 ${currentSourceIndex + 1}/${downloadSources.length})`);
          
          // 每个源最多重试3次
          for (let retry = 0; retry < 3; retry++) {
            try {
              await new Promise((resolve, reject) => {
                // 检查文件是否已经存在且有效
                try {
                  if (fsSync.existsSync(filePath)) {
                    const stats = fsSync.statSync(filePath);
                    // 如果文件大小为0，删除它
                    if (stats.size === 0) {
                      fsSync.unlinkSync(filePath);
                    } else {
                      // 检查文件内容是否有效
                      try {
                        const fileContent = fsSync.readFileSync(filePath, 'utf8');
                        const jsonData = JSON.parse(fileContent);
                        if (jsonData && (Array.isArray(jsonData) || (typeof jsonData === 'object' && jsonData.achievements))) {
                          logger.info(`✓ ${fileName} 文件已存在且有效，跳过下载`);
                          // 移除这里的计数，避免重复
                          // successCount++;
                          resolve();
                          return;
                        } else {
                          // 文件内容无效，删除它
                          fsSync.unlinkSync(filePath);
                        }
                      } catch (parseError) {
                        // JSON解析失败，删除文件
                        fsSync.unlinkSync(filePath);
                      }
                    }
                  }
                } catch (checkError) {
                  logger.warn(`检查 ${fileName} 文件时出错: ${checkError.message}`);
                }
                
                const file = fsSync.createWriteStream(filePath);
                const request = https.get(rawUrl, {
                  headers: {
                    'User-Agent': 'mCat-ac Plugin'
                  }
                }, (response) => {
                  // 检查状态码
                  if (response.statusCode >= 200 && response.statusCode < 300) {
                    response.pipe(file);
                    file.on('finish', () => {
                      file.close();
                      // 验证下载的文件是否有效
                      try {
                        const fileContent = fsSync.readFileSync(filePath, 'utf8');
                        JSON.parse(fileContent); // 尝试解析JSON
                        logger.info(`✓ 成功下载 ${fileName} (源 ${currentSourceIndex + 1}, 重试 ${retry})`);
                        resolve();
                      } catch (parseError) {
                        // JSON解析失败，删除文件并重试
                        fsSync.unlink(filePath, (err) => {});
                        reject(new Error(`JSON解析失败: ${parseError.message}`));
                      }
                    });
                  } else {
                    // 删除部分下载的文件（如果存在）
                    fsSync.unlink(filePath, (err) => {});
                    reject(new Error(`HTTP ${response.statusCode}`));
                  }
                });

                request.on('error', (error) => {
                  // 删除部分下载的文件（如果存在）
                  fsSync.unlink(filePath, (err) => {});
                  reject(error);
                });
                
                // 设置超时
                request.setTimeout(20000, () => {
                  request.destroy();
                  reject(new Error('timeout'));
                });
              });
              
              // 下载成功，更新上次成功的源索引
              if (currentSourceIndex !== lastSuccessSourceIndex) {
                try {
                  const configDir = path.dirname(configPath);
                  if (!fsSync.existsSync(configDir)) {
                    fsSync.mkdirSync(configDir, { recursive: true });
                  }
                  fsSync.writeFileSync(configPath, JSON.stringify({ lastSuccessSourceIndex: currentSourceIndex }, null, 2));
                  logger.info(`已更新上次成功源索引为: ${currentSourceIndex + 1}`);
                } catch (writeErr) {
                  logger.warn(`保存下载配置失败: ${writeErr.message}`);
                }
              }
              
              // 保留这里的计数，确保下载的文件被正确计数一次
              successCount++;
              return; // 成功下载，跳出循环
            } catch (error) {
              logger.warn(`下载 ${fileName} 失败 (源 ${currentSourceIndex + 1}, 重试 ${retry + 1}/3): ${error.message}`);
              // 如果不是最后一次重试，等待一段时间再重试
              if (retry < 2) {
                await new Promise(resolve => setTimeout(resolve, 1000 * (retry + 1)));
              }
            }
          }
          
          // 当前源的所有重试都失败了，切换到下一个源
          currentSourceIndex++;
          sourceSwitched = true;
        }
        
        // 所有源都失败了
        failCount++;
        logger.error(`所有源都失败，无法下载 ${fileName}`);
      });
      
      // 等待这一批下载完成
      await Promise.allSettled(promises);
      
      // 显示进度
      const processed = Math.min(i + batch.length, fileNames.length);
      logger.info(`下载进度: ${processed}/${fileNames.length} (成功: ${successCount}, 失败: ${failCount})`);
    }
    
    return { successCount, failCount };
  }
  
  // 校验成就文件完整性
  async validateAchievementFiles(remoteFiles) {
    const localDir = path.join(__dirname, 'data', 'mCatAc', 'File');
    let localFiles = [];
    
    try {
      localFiles = await fs.readdir(localDir);
    } catch (err) {
      logger.error(`读取本地文件目录失败: ${err.message}`);
      return { missingFiles: remoteFiles, extraFiles: [], invalidFiles: [] };
    }
    
    const localFileSet = new Set(localFiles.filter(file => file.endsWith('.json')));
    const remoteFileSet = new Set(remoteFiles);
    
    // 找出缺失的文件
    const missingFiles = [];
    for (const remoteFile of remoteFiles) {
      if (!localFileSet.has(remoteFile)) {
        missingFiles.push(remoteFile);
      }
    }
    
    // 找出本地多余的文件
    const extraFiles = [];
    for (const localFile of localFileSet) {
      if (!remoteFileSet.has(localFile)) {
        extraFiles.push(localFile);
      }
    }
    
    // 找出无效的文件（存在但内容无效）
    const invalidFiles = [];
    for (const localFile of localFileSet) {
      if (remoteFileSet.has(localFile)) {
        try {
          const filePath = path.join(localDir, localFile);
          const fileContent = await fs.readFile(filePath, 'utf8');
          const jsonData = JSON.parse(fileContent);
          
          // 检查是否是有效的成就文件格式
          if (!jsonData || !Array.isArray(jsonData) && (!jsonData.achievements || !Array.isArray(jsonData.achievements))) {
            invalidFiles.push(localFile);
          }
        } catch (err) {
          // JSON解析失败或文件读取失败
          invalidFiles.push(localFile);
        }
      }
    }
    
    return { missingFiles, extraFiles, invalidFiles };
  }
  
  // 更新成就目录文件
  async updateAchievementCatalog(files) {
    const catalogPath = path.join(__dirname, 'data', 'mCatAc', 'mCatAc.json');
    const catalog = {
      categories: [],
      lastUpdated: new Date().toISOString(),
      totalAchievements: 0
    };

    // 遍历所有成就文件，提取分类信息
    for (const fileName of files) {
      const filePath = path.join(__dirname, 'data', 'mCatAc', 'File', fileName);
      try {
        // 检查文件是否存在
        await fs.access(filePath);
        
        const fileContent = await fs.readFile(filePath, 'utf8');
        const achievementData = JSON.parse(fileContent);
        
        // 提取分类信息
        const category = {
          name: achievementData.name || fileName.replace('.json', ''),
          fileName: fileName,
          achievementCount: achievementData.achievements ? achievementData.achievements.length : 0
        };
        
        catalog.categories.push(category);
        catalog.totalAchievements += category.achievementCount;
      } catch (error) {
        logger.error(`处理 ${fileName} 时出错:`, error.message);
      }
    }

    // 写入目录文件
    await fs.writeFile(catalogPath, JSON.stringify(catalog, null, 2));
    logger.info('更新了mCatAc.json目录文件');
  }
  
  // 清理缓存
  async cleanCache () {
    // 清理临时文件等
    logger.info('缓存清理完成')
  }
  
  // 清理缓存
  async cleanCache () {
    // 清理临时文件等
    logger.info('缓存清理完成')
  }
  
  // 通过ID查找成就
  async findAchievementById (id) {
    // 如果缓存已初始化，先从缓存中查找
    if (this.cachedAchievements && this.cachedAchievements.achievements) {
      const achievement = this.cachedAchievements.achievements.find(ac => ac.id === id)
      if (achievement) {
        return achievement
      }
    }
    
    // 如果缓存未初始化或缓存中找不到，尝试初始化完整缓存（从所有文件加载成就）
    try {
      // 初始化缓存属性
      if (typeof this.cachedAchievements === 'undefined') {
        this.cachedAchievements = null
      }
      if (typeof this.achievementCacheTime === 'undefined') {
        this.achievementCacheTime = 0
      }
      
      // 读取主成就文件获取分类信息
      const acFilePath = path.join(__dirname, 'data/mCatAc/mCatAc.json')
      const acDataStr = await fs.readFile(acFilePath, 'utf8')
      const catalogData = JSON.parse(acDataStr)
      
      // 初始化成就数组
      const allAchievements = []
      
      // 读取所有成就文件内容
      if (catalogData?.categories && Array.isArray(catalogData.categories)) {
        for (const category of catalogData.categories) {
          const filePath = path.join(__dirname, 'data/mCatAc/File', category.fileName)
          try {
            await fs.access(filePath)
            const fileContent = await fs.readFile(filePath, 'utf8')
            const achievementData = JSON.parse(fileContent)
            
            // 将该分类下的所有成就添加到总数组中
            if (achievementData?.achievements && Array.isArray(achievementData.achievements)) {
              allAchievements.push(...achievementData.achievements)
              
              // 在添加的同时检查是否有匹配的ID
              for (const ac of achievementData.achievements) {
                if (ac.id === id) {
                  // 先创建完整的缓存对象
                  this.cachedAchievements = {
                    ...catalogData,
                    achievements: allAchievements
                  }
                  this.achievementCacheTime = Date.now()
                  
                  // 找到匹配的成就，立即返回
                  return ac
                }
              }
            }
          } catch (err) {
            logger.warn(`读取成就文件 ${category.fileName} 失败: ${err.message}`)
          }
        }
      }
      
      // 创建完整的成就数据对象
      this.cachedAchievements = {
        ...catalogData,
        achievements: allAchievements
      }
      this.achievementCacheTime = Date.now()
      
      // 再次尝试从完整缓存中查找
      if (Array.isArray(allAchievements)) {
        for (const ac of allAchievements) {
          if (ac.id === id) {
            return ac
          }
        }
      }
    } catch (err) {
      logger.error(`读取成就数据失败: ${err.message}`)
    }
    
    return null
  }
  
  // 获取用户已完成的成就
  async getUserAchievements (userId) {
    const userFilePath = path.join(__dirname, 'data/UserLog', `${userId}.json`)
    const EXCLUDED_ACHIEVEMENT_ID = 84517 // 不参与统计和比对的特殊成就ID
    
    try {
      // 使用fs.access代替fs.existsSync，确保使用promises API
      await fs.access(userFilePath)
      const userDataStr = await fs.readFile(userFilePath, 'utf8')
      const userData = JSON.parse(userDataStr)
      
      // 支持多种数据格式
      if (Array.isArray(userData)) {
        // 如果是简单数组格式，过滤掉不参与统计的ID后返回
        const filteredData = userData.filter(id => id !== EXCLUDED_ACHIEVEMENT_ID)
        logger.info(`mCat-ac: 检测到数组格式的用户成就数据，已完成数: ${filteredData.length}（已排除特殊成就）`)
        return filteredData
      } else if (userData.completedIds) {
        // 如果有completedIds属性，过滤掉不参与统计的ID后返回
        return userData.completedIds.filter(id => id !== EXCLUDED_ACHIEVEMENT_ID)
      } else if (Array.isArray(userData.achievements)) {
        // 如果是包含achievements数组的格式，提取已完成的ID并过滤
        return userData.achievements
          .filter(ac => ac.status === true || ac.completed)
          .map(ac => ac.id)
          .filter(id => id !== EXCLUDED_ACHIEVEMENT_ID)
      }
      
      // 默认返回空数组
      return []
    } catch (err) {
      // 忽略文件不存在的错误，只记录其他错误
      if (err.code !== 'ENOENT') {
        logger.error(`读取用户成就数据失败: ${err.message}`)
      }
    }
    
    return []
  }
  
  // 获取成就阶段信息
  getAchievementStageInfo (achievement) {
    // 对于没有preStage的成就，检查是否有后续阶段
    if (!achievement.preStage) {
      // 检查是否有其他成就引用了当前成就作为preStage
      if (this.cachedAchievements && this.cachedAchievements.achievements) {
        const hasNextStage = this.cachedAchievements.achievements.some(
          ac => ac.preStage === achievement.id
        )
        if (hasNextStage) {
          return '【1阶段】'
        }
      }
      return ''
    }
    
    // 有preStage的成就，需要确定其阶段号
    const stageNum = this.determineStageNumber(achievement)
    if (stageNum > 1) {
      return `【${stageNum}阶段】`
    }
    
    return ''
  }
  
  // 获取某成就的所有前置成就ID
  async getAllRequiredAchievementIds (achievementId) {
    const requiredIds = []
    let currentId = achievementId
    
    // 向上查找所有preStage
    while (true) {
      const achievement = await this.findAchievementById(currentId)
      if (!achievement || !achievement.preStage) {
        break
      }
      
      requiredIds.push(achievement.preStage)
      currentId = achievement.preStage
    }
    
    return requiredIds.reverse() // 返回从低到高的阶段顺序
  }
  
  // 查找同名的所有成就
  async findAllAchievementsByName (name) {
    const results = []
    
    if (this.cachedAchievements && this.cachedAchievements.achievements) {
      for (const ac of this.cachedAchievements.achievements) {
        if (ac.name && (ac.name.includes(name) || name.includes(ac.name))) {
          results.push(ac)
        }
      }
    } else {
      // 如果缓存未初始化，读取文件
      const acFilePath = path.join(__dirname, 'data/mCatAc/mCatAc.json') // 统一使用data/mCatAc路径
      try {
        const acDataStr = await fs.readFile(acFilePath, 'utf8')
        const acData = JSON.parse(acDataStr)
        
        if (acData?.achievements && Array.isArray(acData.achievements)) {
          for (const ac of acData.achievements) {
            if (ac.name && (ac.name.includes(name) || name.includes(ac.name))) {
              results.push(ac)
            }
          }
        }
      } catch (err) {
        logger.error(`读取成就数据失败: ${err.message}`)
      }
    }
    
    return results
  }
  
  // 根据名称和阶段查找成就
  async findAchievementByStage (name, targetStage) {
    const allSameNameAchievements = await this.findAllAchievementsByName(name)
    
    // 为每个成就计算阶段号并查找匹配的阶段
    for (const ac of allSameNameAchievements) {
      if (this.determineStageNumber(ac) === targetStage) {
        return ac
      }
    }
    
    // 如果找不到精确匹配，尝试找最接近的阶段
    if (allSameNameAchievements.length > 0) {
      const achievementsWithStage = allSameNameAchievements.map(ac => ({
        achievement: ac,
        stage: this.determineStageNumber(ac)
      }))
      
      // 按照阶段号排序
      achievementsWithStage.sort((a, b) => a.stage - b.stage)
      
      // 返回小于等于目标阶段的最大阶段
      for (let i = achievementsWithStage.length - 1; i >= 0; i--) {
        if (achievementsWithStage[i].stage <= targetStage) {
          return achievementsWithStage[i].achievement
        }
      }
      
      // 如果都大于目标阶段，返回最小的阶段
      return achievementsWithStage[0].achievement
    }
    
    return null
  }
  
  // 确定成就的阶段号
  determineStageNumber (achievement) {
    let stage = 1
    let currentAchievement = achievement
    
    // 向上查找preStage链，计算阶段数
    while (currentAchievement.preStage) {
      stage++
      // 从缓存中查找preStage对应的成就
      if (this.cachedAchievements && this.cachedAchievements.achievements) {
        const preStageAchievement = this.cachedAchievements.achievements.find(
          ac => ac.id === currentAchievement.preStage
        )
        if (preStageAchievement) {
          currentAchievement = preStageAchievement
        } else {
          // 找不到preStage对应的成就，停止查找
          break
        }
      } else {
        // 缓存未初始化，停止查找
        break
      }
    }
    
    // 阶段号应该从1开始，且最高阶段在preStage链的最末端
    return stage
  }

  // 通过名称查找成就
  async findAchievementByName (name) {
    // 读取成就数据
    const acFilePath = path.join(__dirname, 'data/mCatAc/mCatAc.json') // 统一使用data/mCatAc路径
    let acData
    
    // 尝试使用缓存
    if (this.cachedAchievements) {
      acData = this.cachedAchievements
    } else {
      try {
        const acDataStr = await fs.readFile(acFilePath, 'utf8')
        acData = JSON.parse(acDataStr)
        this.cachedAchievements = acData
        this.achievementCacheTime = Date.now()
      } catch (err) {
        logger.error(`读取成就数据失败: ${err.message}`)
        return null
      }
    }
    
    // 检查数据结构并查找名称匹配的成就
    const achievements = acData?.achievements || []
    if (Array.isArray(achievements)) {
      for (const ac of achievements) {
        if (ac.name && (ac.name.includes(name) || name.includes(ac.name))) {
          return ac
        }
      }
    }
    
    return null
  }
  
  // 生成结果图片
  async generateResultImages (e, result) {
    // 添加任务状态标志，防止在错误情况下重复尝试
    if (this._isGeneratingImages) {
      logger.warn('mCat-ac: 已有图片生成任务在进行中，跳过重复请求')
      return
    }
    
    this._isGeneratingImages = true
    
    try {
      // 检查是否有未完成的成就
      if (!result.incompleteAchievements || result.incompleteAchievements.length === 0) {
        await e.reply(`🎉 恭喜你！所有成就都已完成！\n已完成成就: ${result.completedCount}\n可获取奖励: ${result.totalReward}原石`)
        return
      }
      
      // 防御性检查，确保数据结构完整
      if (!result || typeof result !== 'object') {
        throw new Error('无效的结果数据')
      }
      
      // 获取实际的未完成成就总数和显示限制
      const actualIncompleteCount = result.actualIncompleteCount || result.incompleteCount
      const displayLimit = result.displayLimit || 20
      const displayCount = result.incompleteAchievements.length
      
      // 获取用户UID信息
      let uid = '未知UID'
      try {
        if (e.runtime) {
          uid = e.runtime.uid || '未知UID'
          logger.info(`mCat-ac: 从runtime获取到UID: ${uid}`)
        } else if (e.user && e.user.uid) {
          uid = e.user.uid
          logger.info(`mCat-ac: 从user获取到UID: ${uid}`)
        } else {
          logger.info('mCat-ac: 无法获取UID信息')
        }
      } catch (uidError) {
        logger.warn(`mCat-ac: 获取UID时出错: ${uidError.message}`)
      }
      
      // 分页处理 - 每页显示指定数量的成就，减少每页显示数量以确保完整渲染
      const pages = []
      const pageSize = this.config?.pageSize || 10 // 减少为10个/页，确保图片能够完整显示
      const incompleteAchievements = Array.isArray(result.incompleteAchievements) ? result.incompleteAchievements : []
      
      // 计算未完成成就的总原石奖励
      const totalRewards = incompleteAchievements.reduce((sum, achievement) => {
        return sum + (achievement.reward || 0)
      }, 0)
      
      // 记录正确的日志信息，包括实际数量和显示限制
      logger.info(`mCat-ac: 开始生成分页数据，实际未完成数: ${actualIncompleteCount}，显示: ${displayCount}，每页${pageSize}个，总奖励: ${totalRewards}原石`)
      
      for (let i = 0; i < incompleteAchievements.length; i += pageSize) {
        pages.push(incompleteAchievements.slice(i, i + pageSize))
      }
      
      // 为每页生成图片
      const imagePaths = []
      for (let i = 0; i < pages.length; i++) {
        try {
          const pageData = {
            ...result,
            currentPage: i + 1,
            totalPages: pages.length,
            achievements: pages[i], // 确保只传递当前页的未完成成就
            isIncompleteList: true, // 添加标志确认这是未完成成就列表
            actualIncompleteCount: actualIncompleteCount, // 传递真实的未完成数量
            displayLimit: displayLimit, // 传递显示限制
            uid: uid, // 传递UID信息
            completedCount: result.completedCount || 0, // 已完成成就数量
            incompleteCount: actualIncompleteCount || 0, // 未完成成就数量
            totalRewards: totalRewards // 可获得的总原石数量
          }
          
          const imagePath = await this.renderPage(pageData)
          imagePaths.push(imagePath)
        } catch (pageError) {
          logger.error(`mCat-ac: 渲染第${i+1}页时出错: ${pageError.message}`)
          // 允许单页失败但继续处理其他页面
          continue
        }
      }
      
      // 如果有实际未完成成就但只显示了一部分，提示用户
      if (displayCount < actualIncompleteCount) {
        await e.reply(`📋 检测到 ${actualIncompleteCount} 个未完成成就，这里只显示前 ${displayLimit} 个最优先的。`)
      }
      
      // 发送图片（使用卡片消息）
      if (imagePaths.length > 0) {
        await this.sendImagesAsCards(e, imagePaths)
      } else {
        throw new Error('未能生成任何有效图片')
      }
    } catch (err) {
      logger.error(`生成图片时出错: ${err.message}`)
      // 避免无限重试，只回复一次错误消息
      await e.reply(`生成结果图片失败: ${err.message}`)
    } finally {
      // 确保无论成功失败都清除状态标志
      this._isGeneratingImages = false
    }
  }
  
  // 渲染页面
  async renderPage (data) {
    // 使用puppeteer直接渲染
    const puppeteer = (await import('../../lib/puppeteer/puppeteer.js')).default
    const tempDir = path.join(__dirname, 'temp')
    
    // 确保临时目录存在
    try {
      await fs.mkdir(tempDir, { recursive: true })
    } catch (e) {}
    
    // 选择模板
    const template = this.getTemplate()
    
    // 加载模板配置
    const templateConfig = await this.loadTemplateConfig(template)
    
    // 获取背景图片
    const backgroundUrl = await this.getBackgroundImage(template)
    
    // 准备渲染数据 - 确保传递的是未完成成就
    const renderData = {
      ...data,
      config: templateConfig,
      background: backgroundUrl,
      time: new Date().toLocaleString('zh-CN')
    }
    
    // 生成HTML内容
    const html = await this.generateHtml(renderData)
    
    // 保存HTML到临时文件
    const htmlPath = path.join(tempDir, `${Date.now()}.html`)
    await fs.writeFile(htmlPath, html, 'utf8')
    
    // 使用puppeteer渲染
    const imagePath = path.join(tempDir, `${Date.now()}.png`)
    
    // 生成截图任务ID
    const screenshotId = `${Date.now()}`
    this._pendingScreenshots.add(screenshotId)
    
    try {
      // 使用puppeteer截图 - 修正参数格式并优化截图配置
      // 添加视口设置以确保图片完整性
      const templateName = `mcat_ac_${screenshotId}`
      
      // 完全自适应高度设置，移除固定最大高度限制
      // 根据成就数量和内容动态计算所需高度
      const achievementCount = data.achievements?.length || 0
      const viewportHeight = 300 + achievementCount * 200 // 增加每个成就项的估算高度为200px，确保足够空间
      
      // 检查是否为API背景图片（网络图片）
      const isApiBackground = backgroundUrl && (backgroundUrl.startsWith('http://') || backgroundUrl.startsWith('https://'))
      
      // 自定义puppeteer渲染选项，确保背景图片完全加载
      const renderOptions = {
        tplFile: htmlPath,
        path: imagePath,
        type: 'png',
        quality: 100,
        viewport: {
          width: 1200,
          height: viewportHeight
        },
        fullPage: true,
        // 对于API背景图片，增加等待网络空闲的配置
        waitUntil: isApiBackground ? 'networkidle0' : 'networkidle2',
        // 大幅增加页面加载超时时间，确保有足够时间加载背景图片
        timeout: 120000, // 增加到120秒，给足够时间让增强的背景图加载机制生效
        // 对于所有情况都使用背景加载脚本，而不仅仅是API背景
        preloadScript: this._getBackgroundLoadScript(),
        // 增加截图前的延迟，确保背景图片渲染完成
        delay: isApiBackground ? 5000 : 3000 // 增加延迟时间，API背景至少5秒
      }
      
      logger.info(`mCat-ac: 开始渲染图片，是否API背景: ${isApiBackground}`)
      
      await puppeteer.screenshot(templateName, renderOptions)
      
      logger.info(`mCat-ac: 成功生成第${data.currentPage}/${data.totalPages}页图片，包含${achievementCount}个未完成成就`)
      
      // 设置延迟清理临时文件（5分钟后）
      setTimeout(async () => {
        await this._cleanupAssociatedFiles(imagePath)
      }, 5 * 60 * 1000) // 5分钟
      
      return imagePath
    } catch (error) {
      logger.error(`mCat-ac: 渲染图片时出错: ${error.message}`)
      throw error
    } finally {
      // 无论成功失败，移除任务ID
      this._pendingScreenshots.delete(screenshotId)
    }
  }
  
  // 生成背景图片加载检测脚本
  _getBackgroundLoadScript() {
    return `
      // 确保所有图片（包括背景图片）都已加载完成
      async function waitForAllImagesLoaded() {
        console.log('开始等待所有图片加载完成');
        
        // 增加重试计数器，用于在图片加载失败时进行有限次数的重试
        let maxRetries = 2;
        let currentRetry = 0;
        
        // 主要图片加载函数，支持重试
        async function loadImagesWithRetry() {
          try {
            // 等待当前文档中的所有图片加载完成
            const images = Array.from(document.images);
            console.log('等待' + images.length + '个直接图片元素加载');
            await Promise.allSettled(images.map(img => 
              new Promise(resolve => {
                if (img.complete) {
                  console.log('图片已完成加载: ' + img.src);
                  resolve();
                } else {
                  img.onload = () => {
                    console.log('图片加载成功: ' + img.src);
                    resolve();
                  };
                  img.onerror = () => {
                    console.warn('图片加载失败: ' + img.src);
                    resolve(); // 即使失败也继续
                  };
                  // 增加超时处理时间到10秒
                  setTimeout(() => {
                    console.warn('图片加载超时: ' + img.src);
                    resolve(); // 超时也继续
                  }, 10000);
                }
              })
            ));
            
            console.log('直接图片元素加载完成');
            
            // 提取所有背景图片URL
            const backgroundUrls = new Set();
            const extractBackgroundImages = (element) => {
              const bgStyle = window.getComputedStyle(element).backgroundImage;
              if (bgStyle && bgStyle !== 'none' && bgStyle.includes('url(')) {
                // 提取URL
                const urls = bgStyle.match(/url\(['"]?(.*?)['"]?\)/g);
                if (urls) {
                  urls.forEach(url => {
                    // 清理URL格式
                    const cleanUrl = url.replace(/^url\(['"]?/, '').replace(/['"]?\)$/, '');
                    backgroundUrls.add(cleanUrl);
                  });
                }
              }
              // 递归检查子元素
              Array.from(element.children).forEach(child => extractBackgroundImages(child));
            };
            
            extractBackgroundImages(document.body);
            console.log('发现' + backgroundUrls.size + '个背景图片URL');
            
            // 预加载所有背景图片以确保它们完全加载
            const backgroundPromises = Array.from(backgroundUrls).map(url => {
              return new Promise(resolve => {
                const img = new Image();
                img.onload = () => {
                  console.log('背景图片加载成功: ' + url);
                  resolve();
                };
                img.onerror = () => {
                  console.warn('背景图片加载失败: ' + url);
                  resolve(); // 即使失败也继续
                };
                // 增加超时处理时间到15秒
                setTimeout(() => {
                  console.warn('背景图片加载超时: ' + url);
                  resolve(); // 超时也继续
                }, 15000);
                img.src = url;
              });
            });
            
            // 等待所有背景图片预加载完成
            const results = await Promise.allSettled(backgroundPromises);
            
            // 检查失败的图片数量
            const failedImages = results.filter(r => r.status === 'rejected').length;
            console.log('所有背景图片预加载完成，失败数量: ' + failedImages);
            
            // 如果有失败的图片且未达到最大重试次数，进行重试
            if (failedImages > 0 && currentRetry < maxRetries) {
              currentRetry++;
              console.log('发现加载失败的图片，开始第' + currentRetry + '次重试');
              // 短暂延迟后重试
              await new Promise(resolve => setTimeout(resolve, 2000));
              return loadImagesWithRetry();
            }
            
            return true; // 所有图片处理完成或达到最大重试次数
          } catch (error) {
            console.error('图片加载过程中发生错误:', error);
            // 发生错误时，如果未达到最大重试次数，进行重试
            if (currentRetry < maxRetries) {
              currentRetry++;
              console.log('加载过程出错，开始第' + currentRetry + '次重试');
              await new Promise(resolve => setTimeout(resolve, 3000));
              return loadImagesWithRetry();
            }
            return false; // 达到最大重试次数
          }
        }
        
        // 执行图片加载逻辑
        await loadImagesWithRetry();
        
        // 添加额外的等待时间，确保浏览器有足够时间渲染背景图片
        console.log('添加第一次额外的渲染等待时间 - 2秒');
        await new Promise(resolve => {
          setTimeout(() => {
            console.log('第一次渲染等待完成');
            resolve();
          }, 2000);
        });
        
        // 强制重绘页面以确保背景图片完全渲染
        console.log('强制页面重绘以确保背景图片完全渲染');
        const bodyStyle = document.body.style;
        const originalDisplay = bodyStyle.display;
        bodyStyle.display = 'none';
        bodyStyle.display = originalDisplay;
        
        // 添加第二次额外等待，给重绘操作留出时间
        console.log('添加第二次额外的渲染等待时间 - 3秒');
        await new Promise(resolve => {
          setTimeout(() => {
            console.log('第二次渲染等待完成');
            resolve();
          }, 3000);
        });
        
        // 检查body元素的背景图片是否已加载并渲染
        console.log('检查页面背景图渲染状态');
        const bodyBgStyle = window.getComputedStyle(document.body).backgroundImage;
        console.log('页面背景样式: ' + bodyBgStyle);
        
        console.log('所有图片（包括背景图片）已加载完成，页面可以截图');
        
        // 返回成功信息
        return { status: 'success', message: '所有图片加载完成' };
      }
      
      // 执行等待函数
      return waitForAllImagesLoaded();
    `;
  }
  
  // 获取模板 - 默认使用新模板'def'
  getTemplate () {
    // 删除旧的RO模板
    if (this.config.templates && this.config.templates.includes('RO')) {
      this.config.templates = this.config.templates.filter(t => t !== 'RO')
    }
    
    if (this.config.templates.length > 0) {
      const randomIndex = Math.floor(Math.random() * this.config.templates.length)
      return this.config.templates[randomIndex]
    }
    
    // 默认使用新模板
    return 'def'
  }
  
  // 解析简单的YAML格式
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

  // 加载模板配置 (支持YAML格式)
  // ACM指令 - 开启API背景
  async acmEnableApi(e) {
    try {
      const success = await this.updateThemeConfig('def', { useApiBackground: true });
      if (success) {
        await e.reply('✅ ACM设置成功\n已开启从网络获取背景图片功能');
        logger.info(`mCat-ac: 用户${e.user?.id}开启了API背景图片功能`);
      } else {
        await e.reply('❌ ACM设置失败\n无法更新配置文件，请检查权限');
      }
    } catch (err) {
      logger.error(`mCat-ac: ACM设置失败: ${err.message}`);
      await e.reply('❌ ACM设置过程中发生错误');
    }
    return true;
  }

  // ACM指令 - 关闭API背景
  async acmDisableApi(e) {
    try {
      const success = await this.updateThemeConfig('def', { useApiBackground: false });
      if (success) {
        await e.reply('✅ ACM设置成功\n已关闭从网络获取背景图片功能，将使用本地背景图片');
        logger.info(`mCat-ac: 用户${e.user?.id}关闭了API背景图片功能`);
      } else {
        await e.reply('❌ ACM设置失败\n无法更新配置文件，请检查权限');
      }
    } catch (err) {
      logger.error(`mCat-ac: ACM设置失败: ${err.message}`);
      await e.reply('❌ ACM设置过程中发生错误');
    }
    return true;
  }

  // ACM指令 - 开启随机背景
  async acmEnableRandom(e) {
    try {
      const success = await this.updateThemeConfig('def', { randomBackground: true });
      if (success) {
        await e.reply('✅ ACM设置成功\n已开启使用随机背景图片功能');
        logger.info(`mCat-ac: 用户${e.user?.id}开启了随机背景功能`);
      } else {
        await e.reply('❌ ACM设置失败\n无法更新配置文件，请检查权限');
      }
    } catch (err) {
      logger.error(`mCat-ac: ACM设置失败: ${err.message}`);
      await e.reply('❌ ACM设置过程中发生错误');
    }
    return true;
  }

  // ACM指令 - 关闭随机背景
  async acmDisableRandom(e) {
    try {
      const success = await this.updateThemeConfig('def', { randomBackground: false });
      if (success) {
        await e.reply('✅ ACM设置成功\n已关闭使用随机背景图片功能，将使用固定背景图片');
        logger.info(`mCat-ac: 用户${e.user?.id}关闭了随机背景功能`);
      } else {
        await e.reply('❌ ACM设置失败\n无法更新配置文件，请检查权限');
      }
    } catch (err) {
      logger.error(`mCat-ac: ACM设置失败: ${err.message}`);
      await e.reply('❌ ACM设置过程中发生错误');
    }
    return true;
  }

  // 加载模板配置 (支持YAML格式)
  async loadTemplateConfig (templateName) {
    // 首先尝试加载标准config.yaml文件
    let configPath = path.join(__dirname, `res/wFile/${templateName}/config.yaml`)
    
    // 如果config.yaml不存在，尝试加载theme-config.yaml作为备选
    if (!fsSync.existsSync(configPath)) {
      configPath = path.join(__dirname, `res/wFile/${templateName}/theme-config.yaml`)
    }
    
    try {
      const configContent = await fs.readFile(configPath, 'utf8')
      // 使用自定义函数解析简单YAML配置
      const config = this.parseSimpleYaml(configContent)
      
      if (!config || typeof config !== 'object') {
        logger.error(`模板配置解析失败: ${templateName}`)
        return this.getDefaultTemplateConfig()
      }
      
      return config
    } catch (e) {
      logger.error(`加载模板配置失败: ${e.message}`)
      return this.getDefaultTemplateConfig()
    }
  }

  // 获取默认模板配置
  getDefaultTemplateConfig() {
    return {
      background: { 
        blur: 0, 
        opacity: 0.8, 
        url: '' 
      },
      font: {
        family: 'SimHei',
        size: { 
          title: 24, 
          subtitle: 18, 
          content: 14 
        },
        color: { 
          title: '#FFFFFF', 
          subtitle: '#F0F0F0', 
          content: '#E0E0E0' 
        },
        shadow: { 
          enable: true, 
          color: 'rgba(0, 0, 0, 0.7)', 
          blur: 3,
          offsetX: 1,
          offsetY: 1
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
  
  // 获取默认模板配置
  getDefaultTemplateConfig () {
    return {
      background: { 
        blur: 0, 
        opacity: 0.8, 
        url: '' 
      },
      font: {
        family: 'SimHei',
        size: { 
          title: 24, 
          subtitle: 18, 
          content: 14 
        },
        color: { 
          title: '#FFFFFF', 
          subtitle: '#F0F0F0', 
          content: '#E0E0E0' 
        },
        shadow: { 
          enable: true, 
          color: 'rgba(0, 0, 0, 0.7)', 
          blur: 3,
          offsetX: 1,
          offsetY: 1
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

  // 初始化配置文件监听器
  async initConfigWatchers() {
    try {
      // 动态导入chokidar，避免在不支持的环境中出错
      const chokidar = (await import('chokidar')).default;
      // 监听默认模板的配置文件
      this._watchConfigFile(path.join(__dirname, 'res/wFile/def/theme-config.yaml'));
      logger.info('mCat-ac: 配置文件监听器初始化完成');
    } catch (err) {
      logger.warn(`mCat-ac: 初始化配置监听器失败: ${err.message}`);
    }
  }
  
  // 监听单个配置文件
  async _watchConfigFile(configPath) {
    try {
      const chokidar = (await import('chokidar')).default;
      // 如果已经有监听器，先关闭
      if (this.watchers.has(configPath)) {
        this.watchers.get(configPath).close();
      }
      
      // 创建新的文件监听器
      const watcher = chokidar.watch(configPath, {
        persistent: true,
        ignoreInitial: true
      });
      
      watcher.on('change', async (path) => {
        logger.info(`mCat-ac: 配置文件已更新: ${path}`);
        // 清除该配置的缓存，下次读取时会重新加载
        this.configCache.delete(path);
      });
      
      watcher.on('error', (error) => {
        logger.error(`mCat-ac: 监听配置文件失败: ${error.message}`);
      });
      
      this.watchers.set(configPath, watcher);
    } catch (err) {
      logger.warn(`mCat-ac: 创建配置文件监听器失败: ${err.message}`);
    }
  }
  
  // 重写的YAML解析函数，正确处理嵌套结构和缩进
  simpleYamlParse(yamlString) {
    const result = {};
    const lines = yamlString.split('\n');
    
    // 栈用来追踪嵌套层级
    const stack = [{ level: 0, object: result }];
    
    lines.forEach(line => {
      // 移除行尾空白
      line = line.replace(/\s*$/, '');
      
      // 跳过空行和注释
      if (line.trim() === '' || line.trim().startsWith('#')) {
        return;
      }
      
      // 计算缩进级别（每2个空格为一级）
      const indent = (line.match(/^\s*/) || [''])[0].length;
      const currentLevel = Math.floor(indent / 2);
      
      // 提取键值对
      const match = line.match(/^\s*([^:\s]+)\s*:\s*(.*)$/);
      if (match) {
        const key = match[1];
        let value = match[2].trim();
        
        // 找到当前层级的父对象，确保栈不会被完全清空（保留根对象）
          while (stack.length > 1 && stack[stack.length - 1].level >= currentLevel) {
            stack.pop();
          }
        
        const parentObj = stack[stack.length - 1].object;
        
        // 处理值
        if (value === '' && !line.endsWith(':')) {
          // 创建新的嵌套对象
          parentObj[key] = {};
          stack.push({ level: currentLevel + 1, object: parentObj[key] });
        } else if (value === '') {
          // 冒号结尾的对象定义
          parentObj[key] = {};
          stack.push({ level: currentLevel + 1, object: parentObj[key] });
        } else {
          // 有值的情况，转换类型
          if (value === 'true') {
            parentObj[key] = true;
          } else if (value === 'false') {
            parentObj[key] = false;
          } else if (/^\d+$/.test(value)) {
            parentObj[key] = parseInt(value, 10);
          } else if (/^\d+\.\d+$/.test(value)) {
            parentObj[key] = parseFloat(value);
          } else if (value.startsWith('"') && value.endsWith('"')) {
            parentObj[key] = value.substring(1, value.length - 1);
          } else if (value.startsWith('\'') && value.endsWith('\'')) {
            parentObj[key] = value.substring(1, value.length - 1);
          } else {
            // 清理注释部分
            const commentIndex = value.indexOf('#');
            if (commentIndex !== -1) {
              value = value.substring(0, commentIndex).trim();
            }
            parentObj[key] = value;
          }
        }
      }
    });
    
    return result;
  }

  // 更新YAML配置文件
  async updateThemeConfig(templateName, updates) {
    try {
      const configPath = path.join(__dirname, `res/wFile/${templateName}/theme-config.yaml`);
      let config = {};
      
      // 读取现有配置
      if (fsSync.existsSync(configPath)) {
        const configContent = await fs.readFile(configPath, 'utf8');
        // 尝试使用YAML库解析，如果有则使用，否则使用简单解析
        try {
          // 尝试导入yaml库
          const yaml = (await import('yaml')).default;
          config = yaml.parse(configContent);
        } catch (e) {
          // 如果无法导入yaml库，使用简单解析
          config = this.parseSimpleYaml(configContent);
        }
      }
      
      // 确保有page对象
      if (!config.page) {
        config.page = {};
      }
      
      // 应用更新
      Object.assign(config.page, updates);
      
      // 写入配置文件
      let configContent;
      try {
        // 尝试使用YAML库
        const yaml = (await import('yaml')).default;
        configContent = yaml.stringify(config);
      } catch (e) {
        // 降级为简单的YAML生成
        configContent = `# 主题配置\npage:\n`;
        for (const [key, value] of Object.entries(config.page)) {
          configContent += `  ${key}: ${typeof value === 'boolean' ? value : JSON.stringify(value)}\n`;
        }
      }
      
      await fs.writeFile(configPath, configContent, 'utf8');
      logger.info(`mCat-ac: 成功更新配置文件: ${configPath}`);
      
      // 清除缓存，确保下次读取时会重新加载
      this.configCache.delete(configPath);
      
      // 直接更新内存中的缓存配置，确保立即生效
      const newConfig = { ...config };
      this.configCache.set(configPath, newConfig);
      logger.info(`mCat-ac: 配置已更新到内存缓存 - useApiBackground: ${newConfig.page?.useApiBackground}`);
      
      // 强制重新加载配置文件以验证更改是否生效
      try {
        const updatedConfig = await this.getThemeConfig(templateName);
        logger.info(`mCat-ac: 更新后验证配置 - useApiBackground: ${updatedConfig.page?.useApiBackground}`);
      } catch (e) {
        logger.warn(`mCat-ac: 验证配置时出错: ${e.message}`);
      }
      
      return true;
    } catch (err) {
      logger.error(`mCat-ac: 更新配置文件失败: ${err.message}`);
      return false;
    }
  }

  // 读取配置文件（带缓存和热更新支持）
  async getThemeConfig(templateName) {
    const configPath = path.join(__dirname, `res/wFile/${templateName}/theme-config.yaml`);
    
    // 检查是否有缓存且缓存有效
    if (this.configCache.has(configPath)) {
      const cachedConfig = this.configCache.get(configPath);
      logger.info(`mCat-ac: 使用缓存的配置文件`);
      return cachedConfig;
    }
    
    // 确保有该文件的监听器
    await this._watchConfigFile(configPath);
    
    // 读取配置文件
    let config = {
      page: {
        useApiBackground: true,
        randomBackground: true,
        apiConfig: {
          url: "https://api.acgurl.link/img",
          method: "GET",
          params: {
            type: "yss",
            json: "true"
          },
          timeout: 10000,
          retryCount: 3,
          retryInterval: 1000
        }
      }
    };
    
    try {
      // 尝试读取YAML配置文件
      if (await fs.access(configPath).then(() => true).catch(() => false)) {
        try {
          // 读取文件内容
          const fileContent = await fs.readFile(configPath, 'utf8');
          
          // 增强的配置解析，不依赖js-yaml
          let useApiBackground = true; // 默认值
          let randomBackground = true; // 默认值
          
          // 方法1: 精确匹配嵌套配置
          const useApiBgMatch = fileContent.match(/^\s*page:\s*[\r\n][\s\S]*?^\s*useApiBackground\s*:\s*(true|false)/m);
          if (useApiBgMatch) {
            useApiBackground = useApiBgMatch[1] === 'true';
            logger.info(`mCat-ac: 精确匹配到useApiBackground: ${useApiBackground}`);
          } else {
            // 方法2: 宽松匹配
            const looseMatch = fileContent.match(/useApiBackground\s*:\s*(true|false)/i);
            if (looseMatch) {
              useApiBackground = looseMatch[1].toLowerCase() === 'true';
              logger.info(`mCat-ac: 宽松匹配到useApiBackground: ${useApiBackground}`);
            }
          }
          
          // 同样处理randomBackground
          const randomBgMatch = fileContent.match(/^\s*page:\s*[\r\n][\s\S]*?^\s*randomBackground\s*:\s*(true|false)/m);
          if (randomBgMatch) {
            randomBackground = randomBgMatch[1] === 'true';
            logger.info(`mCat-ac: 精确匹配到randomBackground: ${randomBackground}`);
          } else {
            const looseRandomMatch = fileContent.match(/randomBackground\s*:\s*(true|false)/i);
            if (looseRandomMatch) {
              randomBackground = looseRandomMatch[1].toLowerCase() === 'true';
              logger.info(`mCat-ac: 宽松匹配到randomBackground: ${randomBackground}`);
            }
          }
          
          // 更新配置
          config.page.useApiBackground = useApiBackground;
          config.page.randomBackground = randomBackground;
          
          logger.info("mCat-ac: 增强配置解析完成 - useApiBackground: " + useApiBackground);
        } catch (parseErr) {
          logger.warn("mCat-ac: 解析配置文件失败: " + parseErr.message + "，使用默认配置");
        }
      } else {
        logger.info(`mCat-ac: 配置文件不存在，使用默认配置`);
      }
      
      logger.info(`mCat-ac: 使用配置文件中的设置 - useApiBackground: ${config.page.useApiBackground}`);
    } catch (err) {
      logger.warn(`mCat-ac: 配置处理异常: ${err.message}`);
    }
    
    // 缓存配置
    this.configCache.set(configPath, config);
    logger.info(`mCat-ac: 配置已缓存 - useApiBackground: ${config.page.useApiBackground}`);
    
    return config;
  }
  
  // 获取背景图片
  async getBackgroundImage(templateName) {
    try {
      // 使用带缓存和热更新的配置读取方法
      const config = await this.getThemeConfig(templateName);
      
      // 记录当前配置状态，便于调试
      logger.info(`mCat-ac: 当前配置状态 - useApiBackground: ${config.page?.useApiBackground}, randomBackground: ${config.page?.randomBackground}`);

      // 严格检查是否启用API获取背景，只有明确为true时才使用API
      if (config.page?.useApiBackground === true) {
        logger.info(`mCat-ac: 尝试从API获取背景图片`);
        try {
          const apiConfig = config.page.apiConfig || {};
          logger.info(`mCat-ac: API配置: ${JSON.stringify(apiConfig)}`);
          const apiBgUrl = await this.getRandomBackgroundFromApi(apiConfig);
          if (apiBgUrl) {
            logger.info(`mCat-ac: 成功从API获取背景图片: ${apiBgUrl}`);
            
            // 添加3秒延迟，确保API图片加载完成后再参与后续的图片生成流程
            logger.info(`mCat-ac: 添加3秒延迟以确保图片加载完成`);
            await new Promise(resolve => setTimeout(resolve, 3000));
            
            return apiBgUrl;
          }
        } catch (err) {
          logger.error(`mCat-ac: 从API获取背景图片失败: ${err.message}`);
          // API失败后继续尝试本地背景
        }
      }

      // 检查是否使用随机本地背景
      if (config.page?.randomBackground) {
        const bgDir = path.join(__dirname, `res/wFile/${templateName}/bg`);
        try {
          const files = await fs.readdir(bgDir);
          // 筛选出以bg开头的图片文件
          const bgFiles = files.filter(file => 
            (file.startsWith('bg') || file.startsWith('bg_')) && 
            (file.endsWith('.png') || file.endsWith('.jpg') || file.endsWith('.jpeg'))
          );
          
          if (bgFiles.length > 0) {
            // 随机选择一个背景文件
            const randomBg = bgFiles[Math.floor(Math.random() * bgFiles.length)];
            const randomBgPath = path.join(bgDir, randomBg);
            logger.info(`mCat-ac: 使用随机背景: ${randomBgPath}`);
            return `file:///${randomBgPath.replace(/\\/g, '/')}`;
          }
        } catch (err) {
          logger.warn(`mCat-ac: 读取背景文件夹失败: ${err.message}`);
        }
      }

      // 优先使用模板中的bg/bg.png背景图片
      const bgPath = path.join(__dirname, `res/wFile/${templateName}/bg/bg.png`)
      try {
        await fs.access(bgPath)
        logger.info(`mCat-ac: 使用模板背景: ${bgPath}`)
        return `file:///${bgPath.replace(/\\/g, '/')}`
      } catch (e) {
        logger.warn(`mCat-ac: 模板背景不存在: ${bgPath}`)
      }
      
      // 如果模板背景不存在，使用默认模板'def'的背景
      const defaultBgPath = path.join(__dirname, 'res/wFile/def/bg/bg.png')
      try {
        await fs.access(defaultBgPath)
        logger.info(`mCat-ac: 使用默认背景: ${defaultBgPath}`)
        return `file:///${defaultBgPath.replace(/\\/g, '/')}`
      } catch (e) {
        logger.warn(`mCat-ac: 默认背景不存在: ${defaultBgPath}`)
      }
      
      // 如果都不存在，返回空字符串，让HTML使用CSS背景色
      logger.info('mCat-ac: 没有可用的背景图片，使用CSS背景色')
      return ''
    } catch (error) {
      logger.error(`mCat-ac: 获取背景图片过程中发生错误: ${error.message}`)
      return ''
    }
  }
  
  // 生成缓存目录路径
  _getCacheDirectory() {
    const cacheDir = path.join(__dirname, 'data', 'bg_cache');
    return cacheDir;
  }
  
  // 确保缓存目录存在
  async _ensureCacheDirectory() {
    const cacheDir = this._getCacheDirectory();
    try {
      await fs.mkdir(cacheDir, { recursive: true });
      logger.info(`mCat-ac: 缓存目录已创建或存在: ${cacheDir}`);
    } catch (error) {
      logger.error(`mCat-ac: 创建缓存目录失败: ${error.message}`);
      throw error;
    }
  }
  
  // 生成图片缓存文件名
  _generateCacheFileName(url) {
    const crypto = require('crypto');
    const hash = crypto.createHash('md5').update(url).digest('hex');
    // 从URL中提取文件扩展名
    const extension = url.match(/\.([a-zA-Z0-9]+)$/)?.[1] || 'png';
    return `${hash}.${extension}`;
  }
  
  // 校验图片完整性 - 已被移除，不再使用图片完整性验证
  
  // 下载并缓存图片，进行完整性校验 - 已被移除，不再使用图片缓存机制
  // async _cacheAndValidateBackgroundImage(imageUrl) {
  //   try {
  //     // 确保缓存目录存在
  //     await this._ensureCacheDirectory();
  //     
  //     // 生成缓存文件名和路径
  //     const cacheFileName = this._generateCacheFileName(imageUrl);
  //     const cacheFilePath = path.join(this._getCacheDirectory(), cacheFileName);
  //     
  //     // 检查缓存是否已经存在并有效
  //     try {
  //       await fs.access(cacheFilePath);
  //       logger.info(`mCat-ac: 检查已有缓存图片的完整性`);
  //       // 图片完整性验证已被移除 - if (await this._validateImageIntegrity(cacheFilePath)) {
  //         logger.info(`mCat-ac: 使用有效的缓存图片: ${cacheFileName}`);
  //         return `file:///${cacheFilePath.replace(/\\/g, '/')}`;
  //       } else {
  //         logger.warn(`mCat-ac: 缓存图片不完整，将重新下载`);
  //       }
  //     } catch (e) {
  //       // 缓存不存在，需要下载
  //       logger.info(`mCat-ac: 缓存不存在，准备下载图片`);
  //     }
  //     
  //     // 使用HTTP模块下载图片
  //     const protocol = imageUrl.startsWith('https') ? require('https') : require('http');
  //     
  //     await new Promise((resolve, reject) => {
  //       logger.info(`mCat-ac: 开始下载图片: ${imageUrl}`);
  //       
  //       // 创建临时文件路径，避免下载中断导致文件损坏
  //       const tempFilePath = cacheFilePath + '.tmp';
  //       const file = fsSync.createWriteStream(tempFilePath);
  //       
  //       let receivedBytes = 0;
  //       let totalBytes = 0;
  //       
  //       // 处理重定向的函数
  //         const handleRedirect = (url, redirectCount = 0) => {
  //           // 防止无限重定向
  //           if (redirectCount > 3) {
  //             reject(new Error('超过最大重定向次数'));
  //             return;
  //           }
            
  //           const currentProtocol = url.startsWith('https') ? require('https') : require('http');
            
  //           const req = currentProtocol.get(url, {
  //             timeout: 30000, // 增加下载超时时间
  //             headers: {
  //               'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
  //               'Accept': 'image/*'
  //             }
  //           }, (res) => {
  //             // 处理重定向
  //             if (res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) {
  //               const redirectUrl = new URL(res.headers.location, url).href;
  //               logger.info(`mCat-ac: 跟随重定向: ${url} -> ${redirectUrl}`);
  //               // 关闭当前响应
  //               res.resume();
  //               // 跟随重定向
  //               handleRedirect(redirectUrl, redirectCount + 1);
  //               return;
  //             }
  //             
  //             // 检查响应状态
  //             if (res.statusCode !== 200) {
  //               file.close();
  //               fsSync.unlink(tempFilePath, () => {}); // 清理临时文件
  //               return reject(new Error(`图片下载失败: HTTP ${res.statusCode}`));
  //             }
  //         
  //         // 获取内容长度
  //         totalBytes = parseInt(res.headers['content-length']) || 0;
          
          //         // 写入数据
          //         res.pipe(file);
          
          //         // 监控下载进度
          //         res.on('data', (chunk) => {
  //           receivedBytes += chunk.length;
  //           
  //           if (totalBytes > 0) {
  //             const progress = Math.round((receivedBytes / totalBytes) * 100);
  //             logger.info(`mCat-ac: 下载进度: ${progress}% (${receivedBytes}/${totalBytes} bytes)`);
  //           }
  //         });
          
  //         // 下载完成
  //         file.on('finish', () => {
  //           file.close(async () => {
  //             try {
  //               // 验证下载的文件完整性
  //               logger.info(`mCat-ac: 下载完成，开始验证图片完整性`);
  //               
  //               // 图片完整性验证已被移除 - if (await this._validateImageIntegrity(tempFilePath)) {
  //                 // 完整性验证通过，重命名临时文件为正式缓存文件
  //                 await fs.rename(tempFilePath, cacheFilePath);
  //                 logger.info(`mCat-ac: 图片下载和完整性验证成功`);
  //                 resolve();
  //               } else {
  //                 // 完整性验证失败，删除临时文件
  //                 await fs.unlink(tempFilePath);
  //                 reject(new Error('图片完整性验证失败'));
  //               }
  //             } catch (error) {
  //               // 清理临时文件
  //               try {
  //                 await fs.unlink(tempFilePath);
  //               } catch (e) {}
  //               reject(error);
  //             }
  //           });
  //         });
          
  
  //       });
  //       }; // 结束handleRedirect函数的定义
  //       
  //       // 开始下载，处理可能的重定向
  //       handleRedirect(imageUrl);
  //     });
  //     
  //     // 返回本地缓存文件的URL
  //     return `file:///${cacheFilePath.replace(/\\/g, '/')}`;
  //   } catch (error) {
  //     logger.error(`mCat-ac: 图片缓存和验证失败: ${error.message}`);
  //     throw error;
  //   }
  // }
  
  // 从API获取随机背景 - 简化版本，移除缓存和验证逻辑
  async getRandomBackgroundFromApi (apiConfig) {
    try {
      // 设置默认配置，使用壁纸API.txt中指定的URL
      const config = {
        url: 'https://api.acgurl.link/img',
        method: 'GET',
        params: {
          type: 'yss',
          json: 'true'
        },
        headers: {},
        timeout: 20000,
        retryCount: 3,  // 减少重试次数
        retryInterval: 2000,
        ...apiConfig
      };

      logger.info(`mCat-ac: 准备请求背景图片API: ${config.url}`);
      
      // 安全地记录API参数，避免敏感信息泄露
      const safeParams = { ...config.params };
      // 移除可能的敏感参数
      if (safeParams.token || safeParams.key || safeParams.api_key) {
        delete safeParams.token;
        delete safeParams.key;
        delete safeParams.api_key;
      }
      logger.info(`mCat-ac: API参数: ${JSON.stringify(safeParams)}`);
      
      // 确保makeHttpRequest方法已初始化
      if (!this.makeHttpRequest || typeof this.makeHttpRequest !== 'function') {
        try {
          this.makeHttpRequest = await this._createHttpRequestMethod();
        } catch (error) {
          this._fallbackToSimpleHttpRequest();
        }
      }

      // 重试逻辑
      let lastError = null;
      
      for (let i = 0; i <= config.retryCount; i++) {
        try {
          logger.info(`mCat-ac: 尝试第${i+1}/${config.retryCount+1}次请求`);
          
          // 准备请求配置
          const requestConfig = {
            params: config.params,
            headers: {
              'Content-Type': 'application/json',
              'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
              'Accept': 'application/json, image/*',
              ...config.headers
            },
            timeout: config.timeout
          };
          
          const response = await this.makeHttpRequest(config.url, requestConfig);

          // 根据是否返回JSON处理响应
          if (config.params?.json === 'true' || config.params?.json === true) {
            const data = response.data || {};
            
            // 智能提取图片URL
            let imageUrl = null;
            
            // 首先尝试常见的直接字段
            const directFields = ['url', 'image', 'img', 'path', 'background', 'picture', 
                                 'result', 'data', 'img_url', 'image_url', 'pic', 'photo',
                                 'file', 'src', 'href'];
            
            for (const field of directFields) {
              if (data[field] && typeof data[field] === 'string' && 
                  (data[field].startsWith('http://') || data[field].startsWith('https://'))) {
                imageUrl = data[field];
                logger.info(`mCat-ac: 从字段'${field}'找到图片URL`);
                break;
              }
            }
            
            // 如果直接字段没有找到，尝试嵌套对象
            if (!imageUrl && typeof data === 'object') {
              if (data.data && typeof data.data === 'object') {
                for (const field of directFields) {
                  if (data.data[field] && typeof data.data[field] === 'string' &&
                      (data.data[field].startsWith('http://') || data.data[field].startsWith('https://'))) {
                    imageUrl = data.data[field];
                    logger.info(`mCat-ac: 从嵌套字段'data.${field}'找到图片URL`);
                    break;
                  }
                }
              }
              
              // 尝试数组中的第一个元素
              if (!imageUrl && Array.isArray(data.data)) {
                const firstItem = data.data[0];
                if (firstItem && typeof firstItem === 'object') {
                  for (const field of directFields) {
                    if (firstItem[field] && typeof firstItem[field] === 'string' &&
                        (firstItem[field].startsWith('http://') || firstItem[field].startsWith('https://'))) {
                      imageUrl = firstItem[field];
                      logger.info(`mCat-ac: 从数组元素字段'${field}'找到图片URL`);
                      break;
                    }
                  }
                }
              }
            }
            
            // 如果找到了有效的URL，直接返回
            if (imageUrl && typeof imageUrl === 'string' && 
                (imageUrl.startsWith('http://') || imageUrl.startsWith('https://'))) {
              logger.info(`mCat-ac: 成功获取图片URL: ${imageUrl}`);
              // 直接返回API提供的URL，不再进行缓存和验证
              // 移除了所有验证和缓存逻辑，防止重复下载
              return imageUrl;
            } else if (response.status === 200 && typeof data === 'string' && data.includes('http')) {
              // 尝试从响应文本中提取URL
              const urlMatch = data.match(/https?:\/\/[^"'\s]+/);
              if (urlMatch && urlMatch[0]) {
                logger.info(`mCat-ac: 成功从文本中提取URL: ${urlMatch[0]}`);
                return urlMatch[0];
              }
            }
            
            throw new Error(`API返回数据中未找到有效的图片URL字段`);
          } else {
            // 如果不是JSON响应，直接返回API URL
            logger.info('mCat-ac: 返回API直接提供的图片URL');
            const paramsString = Object.keys(config.params).length > 0 
              ? '?' + new URLSearchParams(config.params).toString() 
              : '';
            const fullUrl = config.url + paramsString;
            logger.info(`mCat-ac: 完整图片URL: ${fullUrl}`);
            // 直接返回原始URL
            return fullUrl;
          }
        } catch (error) {
          lastError = error;
          
          let errorMessage = error.message || '未知错误';
          
          // 屏蔽敏感信息
          if (errorMessage.includes(config.url)) {
            errorMessage = errorMessage.replace(config.url, '[API URL]');
          }
          
          if (i < config.retryCount) {
            const actualDelay = Math.min(
              config.retryInterval * Math.pow(1.5, i) + Math.random() * 500,
              10000
            );
            logger.warn(`mCat-ac: 请求失败，${(actualDelay/1000).toFixed(1)}秒后重试 (${i+1}/${config.retryCount}): ${errorMessage}`);
            await new Promise(resolve => setTimeout(resolve, actualDelay));
          } else {
            throw new Error(`从API获取背景图片失败: ${errorMessage}`);
          }
        }
      }

      throw lastError;
    } catch (error) {
      logger.error(`mCat-ac: 从API获取背景图片失败: ${error.message}`);
      throw error;
    }
  }
  
  // 验证图片URL是否有效 - 已被移除，不再使用URL验证
  // async _validateImageUrl(url) {
  //   return new Promise((resolve) => {
  //     try {
  //       // 基本的URL格式验证
  //       if (!url || typeof url !== 'string' || 
  //           !(url.startsWith('http://') || url.startsWith('https://'))) {
  //         logger.warn('mCat-ac: 图片URL格式无效');
  //         resolve(false);
  //         return;
  //       }
  //       
  //       const protocol = url.startsWith('https') ? require('https') : require('http');
        
        // 简化的验证逻辑，只检查是否能连接
  //         const req = protocol.request(url, { 
  //           method: 'HEAD',
  //           timeout: 5000,
  //           headers: {
  //             'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)',
  //             'Accept': 'image/*'
  //           }
  //         }, (res) => {
  //         // 检查响应头中的Content-Type是否为图片类型，或检查状态码
  //         const contentType = res.headers['content-type'] || '';
  //         const isImageType = contentType.startsWith('image/');
  //         const isSuccess = res.statusCode >= 200 && res.statusCode < 400;
  //         
  //         // 更宽松的验证策略：即使不是明确的图片类型，只要状态码正常也认为有效
  //         const isValid = isSuccess || isImageType;
  //         
  //         logger.info(`mCat-ac: 图片URL验证结果 - 状态码: ${res.statusCode}, Content-Type: ${contentType}, 有效: ${isValid}`);
  //         resolve(isValid);
  //         
  //         // 确保消耗响应体
  //         res.resume();
  //       });
  //       
  //       req.setTimeout(5000, () => {
  //         req.destroy();
  //         logger.warn(`mCat-ac: 图片URL验证超时`);
  //         // 超时时更倾向于认为有效，避免因网络问题导致的误判
  //         resolve(true);
  //       });
  //       
  //       req.on('error', (error) => {
  //       logger.warn(`mCat-ac: 图片URL验证出错: ${error.message}`);
  //       // 错误时也尝试认为有效，增加容错性
  //       resolve(true);
  //     });
        
  //       req.end();
  //     } catch (error) {
  //       logger.error(`mCat-ac: 图片URL验证内部错误: ${error.message}`);
  //       // 内部错误时仍然尝试使用URL
  //       resolve(true);
  //     }
  //   });
  // }
  
  // 创建HTTP请求方法
  async _createHttpRequestMethod() {
    try {
      logger.info('mCat-ac: 开始创建HTTP请求方法');
      
      // 尝试使用异步导入
      let https, http;
      try {
        https = await import('https');
        http = await import('http');
        logger.info('mCat-ac: 成功导入HTTP/HTTPS模块');
      } catch (importError) {
        logger.warn(`mCat-ac: 异步导入失败，尝试同步导入: ${importError.message}`);
        // 失败时回退到同步导入
        https = require('https');
        http = require('http');
        logger.info('mCat-ac: 同步导入HTTP/HTTPS模块成功');
      }
      
      // 创建并返回HTTP请求函数
      const makeHttpRequest = async (url, config = {}) => {
        // 参数验证
        if (!url || typeof url !== 'string' || !url.startsWith('http')) {
          logger.error('mCat-ac: 无效的URL参数');
          throw new Error('无效的URL');
        }
        
        logger.info(`mCat-ac: 发送HTTP请求到: ${url}`);
        return new Promise((resolve, reject) => {
          try {
            const protocol = url.startsWith('https') ? https : http;
            const timeout = config.timeout || 15000; // 增加默认超时时间
            const headers = {
              'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
              'Accept': 'application/json, text/plain, */*',
              'Connection': 'keep-alive',
              ...config.headers
            };
            
            // 构建URL
            let fullUrl = url;
            if (config.params && typeof config.params === 'object' && Object.keys(config.params).length > 0) {
              try {
                const params = new URLSearchParams(config.params).toString();
                if (params) {
                  fullUrl += (url.includes('?') ? '&' : '?') + params;
                }
              } catch (paramError) {
                logger.warn(`mCat-ac: 参数处理错误，忽略参数: ${paramError.message}`);
              }
            }
            
            logger.info(`mCat-ac: 完整请求URL: ${fullUrl}`);
            
            // 设置请求选项
            const options = {
              headers,
              timeout: timeout / 2, // 请求超时
              agent: false, // 禁用连接池以避免潜在问题
              maxRedirects: 5
            };
            
            const req = protocol.get(fullUrl, options, (res) => {
              // 处理重定向
              if (res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) {
                logger.info(`mCat-ac: 检测到重定向到: ${res.headers.location}`);
                // 关闭当前连接
                res.resume();
                // 递归处理重定向，但限制重定向次数
                const redirectCount = config.redirectCount || 0;
                if (redirectCount < 5) {
                  makeHttpRequest(res.headers.location, {
                    ...config,
                    redirectCount: redirectCount + 1
                  }).then(resolve).catch(reject);
                } else {
                  reject(new Error('重定向次数过多'));
                }
                return;
              }
              
              let data = '';
              
              // 设置响应超时
              const responseTimeout = setTimeout(() => {
                req.destroy();
                reject(new Error('响应处理超时'));
              }, timeout);
              
              res.on('data', (chunk) => {
                data += chunk;
              });
              
              res.on('end', () => {
                clearTimeout(responseTimeout);
                logger.info(`mCat-ac: 请求成功，状态码: ${res.statusCode}`);
                
                // 防御性处理
                if (data === undefined || data === null) {
                  data = '';
                }
                
                // 尝试解析JSON
                let parsedData = data;
                if (config.params?.json === 'true' || 
                    (typeof data === 'string' && 
                     (data.trim().startsWith('{') || data.trim().startsWith('[')))) {
                  try {
                    parsedData = JSON.parse(data);
                    logger.info('mCat-ac: 成功解析JSON响应');
                  } catch (e) {
                    logger.warn(`mCat-ac: 无法解析JSON，返回原始数据: ${e.message}`);
                    // 对于期望JSON的情况，返回空对象而不是原始文本
                    if (config.params?.json === 'true') {
                      parsedData = {};
                    }
                  }
                }
                
                resolve({
                  status: res.statusCode,
                  data: parsedData,
                  statusText: res.statusMessage || '',
                  headers: res.headers || {}
                });
              });
            });
            
            req.setTimeout(timeout, () => {
              logger.warn('mCat-ac: 请求连接超时');
              req.destroy();
              reject(new Error('请求超时，请检查网络连接'));
            });
            
            req.on('error', (error) => {
              logger.error(`mCat-ac: 请求网络错误: ${error.message}`);
              // 标准化错误消息，不暴露底层细节
              let errorMessage = '网络连接问题';
              if (error.code === 'ECONNREFUSED') {
                errorMessage = '服务器拒绝连接';
              } else if (error.code === 'ETIMEDOUT') {
                errorMessage = '连接超时';
              }
              reject(new Error(errorMessage));
            });
          } catch (error) {
            logger.error(`mCat-ac: HTTP实现内部错误: ${error.message}`);
            reject(new Error('内部处理错误'));
          }
        });
      };
      
      logger.info('mCat-ac: HTTP请求方法创建成功');
      return makeHttpRequest;
    } catch (error) {
      logger.error(`mCat-ac: 创建HTTP请求方法失败: ${error.message}`);
      // 不返回null，而是抛出明确的错误
      throw new Error(`HTTP请求初始化失败: ${error.message}`);
    }
  }
  
  // 后备HTTP请求实现 - 在其他方法失败时使用
  _fallbackToSimpleHttpRequest() {
    logger.info('mCat-ac: 使用简单HTTP请求后备实现');
    
    try {
      // 同步导入必要的模块
      let https, http;
      try {
        https = require('https');
        http = require('http');
        logger.info('mCat-ac: 后备实现成功导入HTTP/HTTPS模块');
      } catch (importError) {
        logger.error(`mCat-ac: 后备实现无法导入HTTP模块: ${importError.message}`);
        // 创建一个最基本的mock实现，确保方法存在
        this.makeHttpRequest = async () => {
          throw new Error('系统环境缺少必要的HTTP模块');
        };
        return;
      }
      
      // 创建更健壮的后备HTTP请求函数
      this.makeHttpRequest = async (url, config = {}) => {
        // 参数验证
        if (!url || typeof url !== 'string' || !url.startsWith('http')) {
          logger.error('mCat-ac: 后备实现 - 无效的URL参数');
          throw new Error('无效的URL');
        }
        
        logger.info(`mCat-ac: 发送后备HTTP请求到: ${url}`);
        return new Promise((resolve, reject) => {
          try {
            const protocol = url.startsWith('https') ? https : http;
            const timeout = config.timeout || 20000; // 后备实现使用更长的超时时间
            
            // 设置基本的用户代理
            const headers = {
              'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)',
              ...(config.headers || {})
            };
            
            // 构建URL（更安全的参数处理）
            let fullUrl = url;
            if (config.params && typeof config.params === 'object') {
              try {
                const safeParams = {};
                // 只处理字符串参数
                for (const [key, value] of Object.entries(config.params)) {
                  if (typeof value === 'string' || typeof value === 'number' || typeof value === 'boolean') {
                    safeParams[key] = value;
                  }
                }
                
                const params = new URLSearchParams(safeParams).toString();
                if (params) {
                  fullUrl += (url.includes('?') ? '&' : '?') + params;
                }
              } catch (paramError) {
                logger.warn(`mCat-ac: 后备实现 - 参数处理错误: ${paramError.message}`);
                // 出错时仍然继续，使用原始URL
              }
            }
            
            logger.info(`mCat-ac: 后备请求完整URL: ${fullUrl}`);
            
            // 使用更安全的请求选项
            const options = {
              headers,
              timeout: timeout,
              rejectUnauthorized: false, // 允许自签名证书，提高兼容性
              agent: false // 不使用连接池
            };
            
            const req = protocol.get(fullUrl, options, (res) => {
              // 简单的重定向处理
              if (res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) {
                logger.info(`mCat-ac: 后备实现 - 检测到重定向`);
                res.resume();
                // 对于后备实现，我们直接跟随第一次重定向
                try {
                  const redirectUrl = new URL(res.headers.location, fullUrl).toString();
                  const redirectReq = protocol.get(redirectUrl, options, (redirectRes) => {
                    let redirectData = '';
                    redirectRes.on('data', (chunk) => redirectData += chunk);
                    redirectRes.on('end', () => {
                      processResponse(redirectRes, redirectData, resolve, reject, config);
                    });
                    redirectReq.on('error', (err) => handleError('重定向请求', err, reject));
                    redirectReq.setTimeout(timeout, () => {
                      redirectReq.destroy();
                      reject(new Error('重定向请求超时'));
                    });
                  });
                } catch (redirectError) {
                  logger.warn(`mCat-ac: 后备实现 - 重定向处理失败: ${redirectError.message}`);
                  // 继续处理原始响应
                  processResponse(res, '', resolve, reject, config);
                }
                return;
              }
              
              let data = '';
              res.on('data', (chunk) => {
                // 限制数据大小，防止内存溢出
                if (data.length + chunk.length > 10 * 1024 * 1024) { // 10MB限制
                  logger.warn('mCat-ac: 后备实现 - 响应数据过大，截断处理');
                  req.destroy();
                  reject(new Error('响应数据过大'));
                  return;
                }
                data += chunk;
              });
              
              res.on('end', () => {
                processResponse(res, data, resolve, reject, config);
              });
            });
            
            req.setTimeout(timeout, () => {
              logger.warn('mCat-ac: 后备实现 - 请求超时');
              req.destroy();
              reject(new Error('网络请求超时，请检查网络连接'));
            });
            
            req.on('error', (error) => {
              handleError('请求', error, reject);
            });
          } catch (error) {
            logger.error(`mCat-ac: 后备实现内部错误: ${error.message}`);
            reject(new Error('后备系统内部错误'));
          }
        });
      };
      
      // 辅助函数：处理响应
      function processResponse(res, data, resolve, reject, config) {
        logger.info(`mCat-ac: 后备请求成功，状态码: ${res.statusCode}`);
        
        // 即使状态码不是200，也尝试返回数据
        let parsedData = {};
        
        // 尝试解析JSON，但更容错
        if (config.params?.json === 'true' || 
            (typeof data === 'string' && 
             (data.trim().startsWith('{') || data.trim().startsWith('[')))) {
          try {
            parsedData = JSON.parse(data);
            logger.info('mCat-ac: 后备实现 - 成功解析JSON');
          } catch (e) {
            logger.warn(`mCat-ac: 后备实现 - 无法解析JSON: ${e.message}`);
            // 尝试提取可能的URL
            if (data.includes('http')) {
              const urlMatch = data.match(/https?:\/\/[^"'\s]+/);
              if (urlMatch) {
                parsedData.url = urlMatch[0];
                logger.info(`mCat-ac: 后备实现 - 从响应中提取URL: ${parsedData.url}`);
              }
            }
          }
        }
        
        // 返回完整的响应对象
        resolve({
          status: res.statusCode,
          data: parsedData,
          statusText: res.statusMessage || '',
          headers: res.headers || {}
        });
      }
      
      // 辅助函数：处理错误
      function handleError(context, error, reject) {
        logger.error(`mCat-ac: 后备实现 - ${context}错误: ${error.message}`);
        // 提供更友好的错误信息
        let userMessage = '网络连接不稳定';
        if (error.code === 'ECONNREFUSED') {
          userMessage = '服务器暂时不可用';
        } else if (error.code === 'ETIMEDOUT' || error.message.includes('timeout')) {
          userMessage = '网络请求超时';
        }
        reject(new Error(userMessage));
      }
      
      logger.info('mCat-ac: 后备HTTP请求实现初始化成功');
    } catch (error) {
      logger.error(`mCat-ac: 初始化后备实现失败: ${error.message}`);
      // 最后的安全保障
      this.makeHttpRequest = async () => {
        throw new Error('无法初始化网络请求功能');
      };
    }
  }

  // 生成HTML内容
  async generateHtml (data) {
    // 确保data包含必要的配置
    if (!data || !data.config) {
      logger.error('generateHtml: 缺少必要的配置数据')
      return '<html><body>错误：配置数据缺失</body></html>'
    }
    
    // 使用getBackgroundImage方法获取背景图片，支持API背景和本地背景
    const templateName = data.templateName || 'def';
    try {
      const backgroundImage = await this.getBackgroundImage(templateName);
      if (backgroundImage) {
        data.background = backgroundImage;
        logger.info(`成功获取背景图片: ${data.background}`);
      } else {
        logger.info('未获取到背景图片，将使用CSS背景色');
      }
    } catch (e) {
      logger.error(`获取背景图片失败: ${e.message}`);
    }
    
    // 尝试使用新的模板系统
    try {
      // 导入模板扩展模块
      const templateExtensionModule = await import('./template-extension.js');
      const templateExtension = templateExtensionModule.default || templateExtensionModule;
      
      // 准备成就列表数据 - 确保只包含未完成的成就
      const preparedData = {
        ...data,
        // 确保achievements是数组并只包含未完成的成就
        achievements: Array.isArray(data.achievements) ? data.achievements : [],
        // 计算分类统计信息
        categoryStats: this.calculateCategoryStats(data.achievements || [])
      };
      
      // 使用新模板系统渲染HTML
      logger.info('使用新模板系统渲染HTML');
      return await templateExtension.renderHtml(preparedData);
    } catch (templateError) {
      // 如果新模板系统出错，记录错误并回退到原有方式
      logger.error('新模板系统渲染失败:', templateError.message);
      logger.warn('回退到原有HTML生成方式');
      
      // 原有HTML生成逻辑作为回退
      const { config, time } = data;
      const style = this.generateCss(config);
      
      try {
        return `
          <!DOCTYPE html>
          <html lang="zh-CN">
          <head>
            <meta charset="UTF-8">
            <meta name="viewport" content="width=device-width, initial-scale=1.0">
            <title>成就查漏结果</title>
            <style>
              ${style}
            </style>
          </head>
          <body>
            <div class="container">
              ${this.generateHeader(data)}
              ${this.generateAchievementList(data)}
              ${this.generateFooter(data)}
            </div>
          </body>
          </html>
        `;
      } catch (error) {
        logger.error('生成HTML内容失败:', error.message);
        return '<html><body>错误：生成HTML失败</body></html>';
      }
    }
  }
  
  // 计算分类统计信息
  calculateCategoryStats(achievements) {
    if (!Array.isArray(achievements)) return {};
    
    const stats = {};
    
    achievements.forEach(ac => {
      const category = ac.category || '未分类';
      if (!stats[category]) {
        stats[category] = { count: 0, reward: 0 };
      }
      stats[category].count++;
      stats[category].reward += (ac.reward || 0);
    });
    
    return stats;
  }
  
  // 生成CSS样式
  generateCss (config) {
    const bg = config.background || { blur: 0, opacity: 0.5 }
    const fontsFolder = path.join(__dirname, 'res/wFile/def/fonts');
    
    // 获取字体配置，使用新的配置结构
    const fontConfig = config.common?.font || config.font || {};
    
    // 确保默认配置存在
    const defaultFont = fontConfig.default || {
      family: 'Microsoft YaHei, Arial, sans-serif',
      weight: 'normal',
      style: 'normal'
    };
    
    // 获取各元素字体设置，使用新的elements结构
    const elementFonts = fontConfig.elements || {
      pageTitle: {
        family: '"HYWenHei", Microsoft YaHei, SimHei',
        file: 'HYWenHei.ttf',
        size: 28,
        weight: 'bold',
        style: 'normal'
      },
      subtitle: {
        family: '"HYWenHei", Microsoft YaHei, SimHei',
        file: 'HYWenHei.ttf',
        size: 24,
        weight: 'normal',
        style: 'normal'
      },
      content: {
        family: '"HYWenHei", Microsoft YaHei, SimHei',
        file: 'HYWenHei.ttf',
        size: 16,
        weight: 'normal',
        style: 'normal'
      },
      achievementName: {
        family: '"HYWenHei", Microsoft YaHei, SimHei',
        file: 'HYWenHei.ttf',
        size: 20,
        weight: 'bold',
        style: 'normal'
      },
      achievementDesc: {
        family: 'Microsoft YaHei, Arial, sans-serif',
        size: 14,
        weight: 'normal',
        style: 'normal'
      },
      achievementId: {
        family: 'Microsoft YaHei, Arial, sans-serif',
        size: 14,
        weight: 'normal',
        style: 'normal'
      },
      reward: {
        family: '"HYWenHei", Microsoft YaHei, SimHei',
        file: 'HYWenHei.ttf',
        size: 16,
        weight: 'bold',
        style: 'normal'
      },
      stats: {
        family: '"HYWenHei", Microsoft YaHei, SimHei',
        file: 'HYWenHei.ttf',
        size: 16,
        weight: 'normal',
        style: 'normal'
      },
      pageInfo: {
        family: 'Microsoft YaHei, Arial, sans-serif',
        size: 14,
        weight: 'normal',
        style: 'normal'
      },
      footer: {
        family: 'Microsoft YaHei, Arial, sans-serif',
        size: 14,
        weight: 'normal',
        style: 'normal'
      }
    };
    
    // 阴影配置
    const shadowConfig = fontConfig.shadow || {
      enable: true,
      color: 'rgba(0, 0, 0, 0.7)',
      blur: 3,
      offsetX: 1,
      offsetY: 1
    };
    
    // 生成@font-face规则，加载所需字体
    const generateFontFaceRules = () => {
      const fontFaces = [];
      const loadedFonts = new Set();
      
      // 遍历所有元素字体配置
      Object.values(elementFonts).forEach(elementFont => {
        if (elementFont.file && typeof elementFont.family === 'string') {
          // 从字体族中提取字体名称
          const fontFamilyMatch = elementFont.family.match(/"([^"]+)"/);
          if (fontFamilyMatch && fontFamilyMatch[1]) {
            const fontFamily = fontFamilyMatch[1];
            if (!loadedFonts.has(fontFamily)) {
              const fontFilePath = path.join(fontsFolder, elementFont.file);
              fontFaces.push(`
                @font-face {
                  font-family: '${fontFamily}';
                  src: url('file:///${fontFilePath.replace(/\\/g, '/')}');
                  font-weight: ${elementFont.weight || defaultFont.weight};
                  font-style: ${elementFont.style || defaultFont.style};
                  /* 备用字体机制：确保浏览器能正确使用系统字体作为备选 */
                  font-display: swap;
                }`);
              loadedFonts.add(fontFamily);
            }
          }
        }
      });
      
      return fontFaces.join('');
    };
    
    // 获取元素的字体样式字符串
    const getElementFontStyle = (elementType) => {
      const elementFont = elementFonts[elementType];
      const family = elementFont?.family || defaultFont.family;
      const size = elementFont?.size || 16;
      const weight = elementFont?.weight || defaultFont.weight;
      const style = elementFont?.style || defaultFont.style;
      
      return {
        family,
        size,
        weight,
        style,
        css: `font-family: ${family}; font-size: ${size}px; font-weight: ${weight}; font-style: ${style};`
      };
    };
    
    const layout = config.layout || {
      padding: { top: 50, right: 50, bottom: 50, left: 50 },
      spacing: { title: 30, subtitle: 20, item: 15 }
    };
    
    const item = config.layout?.item || {
      width: 1100,
      height: 120,
      padding: { top: 15, right: 20, bottom: 15, left: 20 },
      background: { color: 'rgba(25, 25, 25, 0.7)', borderRadius: 10 }
    };
    
    // 获取各种元素的字体样式
    const pageTitleFont = getElementFontStyle('pageTitle');
    const subtitleFont = getElementFontStyle('subtitle');
    const contentFont = getElementFontStyle('content');
    const achievementNameFont = getElementFontStyle('achievementName');
    const achievementDescFont = getElementFontStyle('achievementDesc');
    const achievementIdFont = getElementFontStyle('achievementId');
    const rewardFont = getElementFontStyle('reward');
    const statsFont = getElementFontStyle('stats');
    const pageInfoFont = getElementFontStyle('pageInfo');
    const footerFont = getElementFontStyle('footer');
    
    return `
      /* 加载自定义字体 */
      ${generateFontFaceRules()}
      
      * {
        margin: 0;
        padding: 0;
        box-sizing: border-box;
      }
      
      body {
        font-family: ${defaultFont.family};
        font-weight: ${defaultFont.weight};
        font-style: ${defaultFont.style};
        color: #E0E0E0;
        background-image: url(${bg.url || 'none'});
        background-size: cover;
        background-position: center;
        backdrop-filter: blur(${bg.blur}px);
      }
      
      .container {
        padding: ${layout.padding.top}px ${layout.padding.right}px ${layout.padding.bottom}px ${layout.padding.left}px;
        background-color: rgba(0, 0, 0, ${1 - (bg.opacity || 1)});
        min-height: 100vh;
      }
      
      .header {
        text-align: center;
        margin-bottom: ${layout.spacing.title}px;
      }
      
      .header h1 {
        ${pageTitleFont.css}
        color: #FFFFFF;
        ${this.generateTextShadow(shadowConfig)}
        margin-bottom: ${layout.spacing.subtitle}px;
      }
      
      .header h2 {
        ${subtitleFont.css}
        color: #F0F0F0;
        ${this.generateTextShadow(shadowConfig)}
        margin-bottom: ${layout.spacing.subtitle}px;
      }
      
      .stats {
        display: flex;
        justify-content: center;
        gap: 30px;
        margin-bottom: ${layout.spacing.subtitle}px;
      }
      
      .stat-item {
        ${statsFont.css}
        color: #E0E0E0;
        ${this.generateTextShadow(shadowConfig)}
      }
      
      .page-info {
        ${pageInfoFont.css}
        color: #E0E0E0;
        ${this.generateTextShadow(shadowConfig)}
      }
      
      .achievement-list {
        display: flex;
        flex-direction: column;
        gap: ${layout.spacing.item}px;
      }
      
      .achievement-item {
        width: ${item.width}px;
        height: ${item.height}px;
        padding: ${item.padding.top}px ${item.padding.right}px ${item.padding.bottom}px ${item.padding.left}px;
        background-color: ${item.background.color};
        border-radius: ${item.background.borderRadius}px;
        margin: 0 auto;
        ${this.generateBoxShadow()}
      }
      
      .achievement-header {
        display: flex;
        justify-content: space-between;
        align-items: center;
        margin-bottom: 5px;
      }
      
      .achievement-id {
        ${achievementIdFont.css}
        color: #CCCCCC;
        opacity: 0.8;
      }
      
      .achievement-reward {
        background-image: url('file:///${path.join(__dirname, 'res/wFile/def/icons/ys.png').replace(/\\/g, '/')}'); 
        background-size: 16px 16px; 
        background-repeat: no-repeat; 
        padding-left: 20px;
        ${rewardFont.css}
        color: #FFD700;
        ${this.generateTextShadow(shadowConfig)}
      }
      
      .achievement-name {
        ${achievementNameFont.css}
        color: #FFFFFF;
        ${this.generateTextShadow(shadowConfig)}
        margin-bottom: 5px;
      }
      
      .achievement-desc {
        ${achievementDescFont.css}
        color: #CCCCCC;
        opacity: 0.9;
      }
      
      .hidden-tag {
        color: ${(config.achievement && config.achievement.hiddenColor) || '#FFA500'};
        ${contentFont.css}
      }
      
      .footer {
        text-align: center;
        margin-top: ${layout.spacing.title}px;
        ${footerFont.css}
        color: #CCCCCC;
        opacity: 0.8;
      }
    `
  }
  
  // 生成文本阴影样式
  generateTextShadow (shadowConfig) {
    if (shadowConfig?.enable) {
      return `text-shadow: ${shadowConfig.offsetX || 1}px ${shadowConfig.offsetY || 1}px ${shadowConfig.blur}px ${shadowConfig.color};`
    }
    return ''
  }
  
  // 生成盒子阴影
  generateBoxShadow () {
    return 'box-shadow: 0 4px 12px rgba(0, 0, 0, 0.3);'
  }
  
  // 生成页眉
  generateHeader (data) {
    const config = data.config.header
    if (!config || !config.enable) return ''
    
    let html = `
      <div class="header">
        <h1>${config.title}</h1>
        <h2>${config.subtitle}</h2>
    `
    
    if (config.showStats && config.stats.length > 0) {
      html += '<div class="stats">'
      for (const stat of config.stats) {
        html += `<div class="stat-item">${stat.label}: ${data[stat.key]}</div>`
      }
      html += '</div>'
    }
    
    if (config.showPage) {
      html += `<div class="page-info">第 ${data.currentPage} / ${data.totalPages} 页</div>`
    }
    
    html += '</div>'
    return html
  }
  
  // 生成成就列表（按类别分组）
  generateAchievementList (data) {
    // 添加防御性检查，确保配置存在
    const defaultConfig = {
      showId: true,
      showReward: true,
      showDesc: true,
      showHidden: true,
      hiddenText: '隐藏',
      hiddenColor: '#FFA500'
    }
    const config = data.config?.achievement || defaultConfig
    
    // 确保achievements是数组
    const achievements = Array.isArray(data.achievements) ? data.achievements : []
    
    // 按类别分组成就
    const categories = {};
    achievements.forEach(ac => {
      const categoryName = ac.category || '未分类';
      if (!categories[categoryName]) {
        categories[categoryName] = [];
      }
      categories[categoryName].push(ac);
    });
    
    // 生成分类HTML
    const categoryHtml = Object.entries(categories).map(([category, items]) => {
      // 计算该分类的未完成数量和总奖励
      const incompleteCount = items.length;
      const totalReward = items.reduce((sum, ac) => sum + (ac.reward || 0), 0);
      
      return `
        <div class="achievement-category">
          <div class="category-header">
            <h3 class="category-title">${category}</h3>
            <div class="category-stats">
              <span class="incomplete-count">还有${incompleteCount}个成就未完成</span>
              <span class="category-reward">可获得原石: ${totalReward}</span>
            </div>
          </div>
          <div class="category-achievements">
            ${items.map(ac => `
              <div class="achievement-item">
                <div class="achievement-header">
                  ${config.showId ? `<span class="achievement-id">ID: ${ac.id || '-'}</span>` : ''}
                  ${config.showReward ? `<span class="achievement-reward">${ac.reward || 0} 原石</span>` : ''}
                </div>
                <div class="achievement-name">
                  ${ac.name || '未知成就'}
                  ${config.showHidden && ac.hidden ? `<span class="hidden-tag" style="color: ${config.hiddenColor}">${config.hiddenText}</span>` : ''}
                </div>
                ${config.showDesc && ac.desc ? `<div class="achievement-desc">${ac.desc}</div>` : ''}
              </div>
            `).join('')}
          </div>
        </div>
      `;
    }).join('');
    
    return `
      <div class="achievement-categories">
        ${categoryHtml}
      </div>
    `
  }
  
  // 生成页脚
  generateFooter (data) {
    const config = data.config.footer
    if (!config || !config.enable) return ''
    
    return `
      <div class="footer">
        ${config.text}
        ${config.showTime ? `<br>${data.time}` : ''}
      </div>
    `
  }
  
  // 发送图片卡片
  async sendImagesAsCards (e, imagePaths) {
    try {
      if (!e || !imagePaths || imagePaths.length === 0) {
        logger.error('sendImagesAsCards: 参数错误')
        return
      }
      
      if (imagePaths.length === 1) {
        // 单张图片直接发送
        await e.reply(segment.image(imagePaths[0]))
      } else {
        // 多张图片尝试合并转发
        try {
          await e.reply(imagePaths.map(imgPath => segment.image(imgPath)))
        } catch (mergeError) {
          // 如果合并转发失败，回退到单张发送
          logger.warn('合并转发失败，尝试单张发送:', mergeError.message)
          for (const imgPath of imagePaths) {
            await e.reply(segment.image(imgPath))
            // 避免发送过快
            await new Promise(resolve => setTimeout(resolve, 500))
          }
        }
      }
    } catch (err) {
      logger.error('发送图片失败:', err.message)
    }
  }
  
  // 获取用户已完成的成就
  async getUserAchievements(userId) {
    const userFilePath = path.join(__dirname, `data/UserLog/${userId}.json`);
    const EXCLUDED_ACHIEVEMENT_ID = 84517; // 不参与统计和比对的特殊成就ID
    
    try {
      // 使用fs.access检查文件是否存在
      await fs.access(userFilePath);
      const userDataStr = await fs.readFile(userFilePath, 'utf8');
      
      // 解析用户数据
      const userData = JSON.parse(userDataStr);
      
      // 支持多种数据格式
      if (Array.isArray(userData)) {
        // 直接的ID数组格式，过滤掉不参与统计的ID
        const filteredData = userData.filter(id => id !== EXCLUDED_ACHIEVEMENT_ID);
        logger.info(`${COLORS.CYAN}mCat-ac: 检测到数组格式的用户数据，已完成数: ${filteredData.length}（已排除特殊成就）${COLORS.RESET}`);
        return filteredData;
      } else if (userData.completedIds) {
        // 包含completedIds属性的对象格式，过滤掉不参与统计的ID
        return userData.completedIds.filter(id => id !== EXCLUDED_ACHIEVEMENT_ID);
      } else if (Array.isArray(userData.achievements)) {
        // 包含achievements数组的格式，过滤掉不参与统计的ID
        return userData.achievements
          .filter(ac => ac.status === true || ac.completed)
          .map(ac => ac.id)
          .filter(id => id !== EXCLUDED_ACHIEVEMENT_ID);
      }
      
      logger.warn(`${COLORS.YELLOW}mCat-ac: 未知格式的用户数据，返回空数组${COLORS.RESET}`);
      return [];
    } catch (err) {
      if (err.code === 'ENOENT') {
        logger.info(`${COLORS.WHITE}mCat-ac: 用户${userId}的成就数据文件不存在${COLORS.RESET}`);
      } else {
        logger.error(`${COLORS.RED}mCat-ac: 读取用户${userId}的成就数据失败: ${err.message}${COLORS.RESET}`);
      }
    }
    
    return [];
  }

  // ACM更新插件功能
  async acmUpdatePlugin(e) {
    try {
      // 等待依赖初始化
      if (!this.dependenciesInitialized) {
        await e.reply('插件依赖正在初始化，请稍后再试...');
        return;
      }
      
      logger.info(`${COLORS.CYAN}mCat-ac: 开始执行插件更新检查${COLORS.RESET}`);
      await e.reply('正在执行插件更新检查...');
      
      // 1. 检查网络连接
      await e.reply('正在检查网络连接...');
      let repoUrl = 'https://gitlab.com/mCat0/mCat-ac';
      let repoName = 'GitLab';
      
      try {
        const networkCheck = await axios.get('https://gitlab.com', { timeout: 10000 });
        if (!networkCheck || networkCheck.status !== 200) {
          throw new Error('GitLab连接失败');
        }
      } catch (networkError) {
        logger.error(`${COLORS.RED}mCat-ac: GitLab连接检查失败: ${networkError.message}${COLORS.RESET}`);
        await e.reply('⚠️ GitLab连接失败，尝试使用Gitee备用仓库...');
        
        // 尝试Gitee连接
        try {
          const giteeCheck = await axios.get('https://gitee.com', { timeout: 10000 });
          if (!giteeCheck || giteeCheck.status !== 200) {
            throw new Error('Gitee连接失败');
          }
          repoUrl = 'https://gitee.com/mcat0/acm';
          repoName = 'Gitee';
          await e.reply(`✅ 已切换到${repoName}备用仓库`);
        } catch (giteeError) {
          logger.error(`${COLORS.RED}mCat-ac: Gitee连接检查也失败: ${giteeError.message}${COLORS.RESET}`);
          await e.reply('❌ 网络连接失败，无法访问GitLab和Gitee，请检查网络连接后重试');
          return;
        }
      }
      
      // 2. 查询当前已安装的插件版本
      const currentVersion = this.version || '未知';
      await e.reply(`当前已安装版本: ${currentVersion}`);
      
      // 3. 连接至官方插件仓库，获取最新版本信息
      await e.reply('正在获取最新版本信息...');
      let latestVersion, updateLogs;
      try {
        // 根据选择的仓库获取相应的URL
        let repoPackageUrl, readmeUrl;
        if (repoName === 'GitLab') {
          repoPackageUrl = 'https://gitlab.com/mCat0/mCat-ac/-/raw/master/package.json';
          readmeUrl = 'https://gitlab.com/mCat0/mCat-ac/-/raw/master/README.md';
        } else {
          repoPackageUrl = 'https://gitee.com/mcat0/acm/raw/master/package.json';
          readmeUrl = 'https://gitee.com/mcat0/acm/raw/master/README.md';
        }
        
        // 获取package.json中的最新版本
        const repoPackageResponse = await axios.get(repoPackageUrl, { timeout: 15000 });
        
        if (repoPackageResponse && repoPackageResponse.data) {
          latestVersion = repoPackageResponse.data.version || '未知';
          await e.reply(`仓库最新版本: ${latestVersion}`);
        }
        
        // 获取README.md中的更新日志
        const readmeResponse = await axios.get(readmeUrl, { timeout: 15000 });
        
        if (readmeResponse && readmeResponse.data) {
          const readmeContent = readmeResponse.data;
          // 提取更新日志部分
          const changelogMatch = readmeContent.match(/## 📝 更新日志[\s\S]*?(?=##|$)/);
          if (changelogMatch) {
            updateLogs = changelogMatch[0];
          }
        }
      } catch (repoError) {
        logger.error(`${COLORS.RED}mCat-ac: 获取仓库信息失败: ${repoError.message}${COLORS.RESET}`);
        await e.reply('❌ 获取仓库信息失败，请稍后重试');
        return;
      }
      
      // 4. 对比版本
      function compareVersions(v1, v2) {
        const arr1 = v1.split('.').map(Number);
        const arr2 = v2.split('.').map(Number);
        
        for (let i = 0; i < Math.max(arr1.length, arr2.length); i++) {
          const num1 = arr1[i] || 0;
          const num2 = arr2[i] || 0;
          
          if (num1 !== num2) {
            return num1 - num2;
          }
        }
        return 0;
      }
      
      if (currentVersion === '未知' || latestVersion === '未知') {
        await e.reply('⚠️ 版本信息不完整，无法准确判断是否需要更新');
      } else if (compareVersions(currentVersion, latestVersion) >= 0) {
        await e.reply('✅ 当前已是最新版本，无需更新');
        return;
      } else {
        await e.reply(`📢 检测到新版本: ${latestVersion}`);
        
        // 显示更新日志
        if (updateLogs) {
          // 提取最新版本的更新内容
          const latestLogMatch = updateLogs.match(new RegExp(`### v${latestVersion}[\s\S]*?(?=### v|$)`));
          if (latestLogMatch) {
            let logContent = latestLogMatch[0];
            // 限制日志长度
            if (logContent.length > 500) {
              logContent = logContent.substring(0, 500) + '...';
            }
            await e.reply(`📝 更新内容:\n${logContent}`);
          }
        }
        
        // 5. 执行更新
        await e.reply('🚀 开始更新插件...');
        
        try {
          // 执行git pull命令
          const { exec } = await import('child_process');
          const pluginDir = __dirname;
          
          // 根据仓库类型构建不同的git命令
          let gitCommand;
          if (repoName === 'GitLab') {
            gitCommand = 'git pull origin master';
          } else {
            // 对于Gitee，先检查是否已有remote
            await new Promise((resolve, reject) => {
              exec('git remote -v', { cwd: pluginDir }, (error, stdout) => {
                if (error) {
                  reject(error);
                  return;
                }
                
                if (!stdout.includes('gitee')) {
                  // 如果没有Gitee remote，则添加
                  exec('git remote add gitee https://gitee.com/mcat0/acm.git', { cwd: pluginDir }, (err) => {
                    if (err) {
                      logger.warn(`${COLORS.YELLOW}mCat-ac: 添加Gitee remote失败: ${err.message}${COLORS.RESET}`);
                    }
                    resolve();
                  });
                } else {
                  resolve();
                }
              });
            });
            gitCommand = 'git pull gitee master';
          }
          
          const updateResult = await new Promise((resolve, reject) => {
            exec(gitCommand, { cwd: pluginDir }, (error, stdout, stderr) => {
              if (error) {
                reject(new Error(`${error.message}\n${stderr}`));
              } else {
                resolve(stdout);
              }
            });
          });
          
          logger.info(`${COLORS.GREEN}mCat-ac: 插件更新成功:\n${updateResult}${COLORS.RESET}`);
          await e.reply('✅ 插件更新成功！');
          await e.reply('🔄 请重启Yunzai-Bot以应用更新');
          
          // 尝试更新版本号
          try {
            const packagePath = path.join(__dirname, 'package.json');
            const packageContent = fsSync.readFileSync(packagePath, 'utf8');
            const packageData = JSON.parse(packageContent);
            this.version = packageData.version || '未知';
            global.mCatAcVersion = this.version;
          } catch (e) {
            // 忽略版本更新错误
          }
        } catch (updateError) {
          logger.error(`${COLORS.RED}mCat-ac: 插件更新失败: ${updateError.message}${COLORS.RESET}`);
          await e.reply(`❌ 更新失败: ${updateError.message}`);
          await e.reply('建议手动更新或检查Git环境配置');
        }
      }
    } catch (error) {
      logger.error(`${COLORS.RED}mCat-ac: ACM更新功能出错: ${error.message}${COLORS.RESET}`);
      await e.reply('❌ 更新过程中发生错误，请稍后重试');
    }
  }
}

export default AchievementCheck