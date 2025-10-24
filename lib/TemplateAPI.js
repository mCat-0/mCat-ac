import fs from 'fs/promises'
import path from 'path'
import { pathToFileURL } from 'url'

class TemplateAPI {
  constructor(pluginPath) {
    this.pluginPath = pluginPath
    this.templateDir = path.join(pluginPath, 'res', 'wFile')
  }

  /**
   * 获取模板列表
   * @returns {Promise<Array>} 模板名称列表
   */
  async getTemplates() {
    try {
      const templates = await fs.readdir(this.templateDir)
      // 过滤掉非目录项和HTML文件
      return templates.filter(t => !t.endsWith('.html') && !t.startsWith('.'))
    } catch (error) {
      throw new Error(`获取模板列表失败: ${error.message}`)
    }
  }

  /**
   * 获取模板详情
   * @param {string} templateName - 模板名称
   * @returns {Promise<Object>} 模板配置信息
   */
  async getTemplate(templateName) {
    if (!templateName) {
      throw new Error('模板名称不能为空')
    }

    const templatePath = path.join(this.templateDir, templateName)
    
    try {
      // 检查模板目录是否存在
      await fs.access(templatePath)
    } catch (error) {
      throw new Error(`模板 "${templateName}" 不存在`)
    }

    try {
      // 读取配置文件
      const configPath = path.join(templatePath, 'config.json')
      const configContent = await fs.readFile(configPath, 'utf8')
      const config = JSON.parse(configContent)
      
      // 返回模板信息
      return {
        name: templateName,
        ...config,
        path: templatePath
      }
    } catch (error) {
      throw new Error(`读取模板 "${templateName}" 配置失败: ${error.message}`)
    }
  }

  /**
   * 创建新模板
   * @param {string} templateName - 模板名称
   * @param {Object} config - 模板配置
   * @returns {Promise<void>}
   */
  async createTemplate(templateName, config) {
    if (!templateName) {
      throw new Error('模板名称不能为空')
    }

    if (!config || typeof config !== 'object') {
      throw new Error('配置内容不能为空且必须为对象')
    }

    const templatePath = path.join(this.templateDir, templateName)
    
    try {
      // 检查模板是否已存在
      await fs.access(templatePath)
      throw new Error(`模板 "${templateName}" 已存在`)
    } catch (error) {
      // 如果错误是文件不存在，则继续创建
      if (error.code !== 'ENOENT') {
        throw error
      }
    }

    try {
      // 创建模板目录
      await fs.mkdir(templatePath, { recursive: true })
      
      // 创建配置文件
      const configPath = path.join(templatePath, 'config.json')
      await fs.writeFile(configPath, JSON.stringify(config, null, 2), 'utf8')
      
      // 创建默认的HTML模板文件
      const htmlTemplate = `<!DOCTYPE html>
<html lang="zh-CN">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>{{pageTitle}}</title>
  <style>
    {{customStyles}}
  </style>
</head>
<body>
  <div class="container">
    {{header}}
    {{achievementList}}
    {{footer}}
  </div>
</body>
</html>`
      
      const htmlPath = path.join(templatePath, 'theme-improved.html')
      await fs.writeFile(htmlPath, htmlTemplate, 'utf8')
    } catch (error) {
      // 如果创建失败，尝试删除已创建的目录
      try {
        await fs.rm(templatePath, { recursive: true, force: true })
      } catch (rmError) {
        // 忽略删除失败
      }
      throw new Error(`创建模板 "${templateName}" 失败: ${error.message}`)
    }
  }

  /**
   * 更新模板
   * @param {string} templateName - 模板名称
   * @param {Object} config - 模板配置
   * @returns {Promise<void>}
   */
  async updateTemplate(templateName, config) {
    if (!templateName) {
      throw new Error('模板名称不能为空')
    }

    if (!config || typeof config !== 'object') {
      throw new Error('配置内容不能为空且必须为对象')
    }

    const templatePath = path.join(this.templateDir, templateName)
    
    try {
      // 检查模板目录是否存在
      await fs.access(templatePath)
    } catch (error) {
      throw new Error(`模板 "${templateName}" 不存在`)
    }

    try {
      // 更新配置文件
      const configPath = path.join(templatePath, 'config.json')
      await fs.writeFile(configPath, JSON.stringify(config, null, 2), 'utf8')
    } catch (error) {
      throw new Error(`更新模板 "${templateName}" 失败: ${error.message}`)
    }
  }

  /**
   * 删除模板
   * @param {string} templateName - 模板名称
   * @returns {Promise<void>}
   */
  async deleteTemplate(templateName) {
    if (!templateName) {
      throw new Error('模板名称不能为空')
    }

    // 防止删除默认的RO模板
    if (templateName === 'RO') {
      throw new Error('不能删除默认的RO模板')
    }

    const templatePath = path.join(this.templateDir, templateName)
    
    try {
      // 检查模板目录是否存在
      await fs.access(templatePath)
    } catch (error) {
      throw new Error(`模板 "${templateName}" 不存在`)
    }

    try {
      // 删除模板目录
      await fs.rm(templatePath, { recursive: true, force: true })
    } catch (error) {
      throw new Error(`删除模板 "${templateName}" 失败: ${error.message}`)
    }
  }

  /**
   * 预览模板效果
   * @param {string} templateName - 模板名称
   * @param {Object} data - 渲染数据
   * @returns {Promise<string>} 渲染后的HTML内容
   */
  async previewTemplate(templateName, data) {
    if (!templateName) {
      throw new Error('模板名称不能为空')
    }

    if (!data || typeof data !== 'object') {
      throw new Error('渲染数据不能为空且必须为对象')
    }

    const templatePath = path.join(this.templateDir, templateName)
    
    try {
      // 检查模板目录是否存在
      await fs.access(templatePath)
    } catch (error) {
      throw new Error(`模板 "${templateName}" 不存在`)
    }

    try {
      // 读取模板配置
      const configPath = path.join(templatePath, 'config.json')
      const configContent = await fs.readFile(configPath, 'utf8')
      const templateConfig = JSON.parse(configContent)
      
      // 合并配置数据
      const renderData = {
        ...data,
        config: templateConfig.config || templateConfig,
        template: templateName
      }
      
      // 动态导入mCat-ac类来渲染模板
      const modulePath = pathToFileURL(path.join(this.pluginPath, 'mCat-ac.js')).href
      const mCatAcModule = await import(modulePath)
      const mCatAcClass = mCatAcModule.default || mCatAcModule
      
      // 创建一个模拟的e对象
      const mockE = {
        msg: '#成就查漏',
        user_id: 'preview',
        isMaster: true,
        reply: async () => {}
      }
      
      // 创建实例并渲染HTML
      const acInstance = new mCatAcClass(mockE)
      return await acInstance.generateHtml(renderData)
    } catch (error) {
      throw new Error(`预览模板 "${templateName}" 失败: ${error.message}`)
    }
  }
}

export default TemplateAPI