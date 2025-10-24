// 使用CommonJS语法导入模块
const fs = require('fs');
const path = require('path');

/**
 * TRSS-Yunzai 椰羊成就文件处理辅助插件
 * 专注于处理用户提交的文件
 */

// 插件对象 - 这是TRSS-Yunzai所需的标准格式
const achievementHelperPlugin = {
  // 插件基本信息
  name: 'mCat-ac-helper',
  desc: '椰羊成就文件处理辅助插件',
  version: '1.0.0',
  author: 'Helper',
  // 必需的cron属性，即使没有定时任务
  cron: {},
  
  // 插件加载时执行
  async init() {
    console.log(`${this.name} 插件已加载`);
  },
  
  // 插件卸载时执行
  async destroy() {
    console.log(`${this.name} 插件已卸载`);
  },
  
  /**
   * 检测文件是否为椰羊成就文件
   * @param {string} filePath - 文件路径
   * @param {Object} fileData - 文件内容
   * @returns {boolean} 是否为椰羊成就文件
   */
  isCocogoatFile(filePath, fileData) {
    // 检查文件名是否包含相关关键字
    const fileName = path.basename(filePath).toLowerCase();
    if (fileName.includes('椰羊') || fileName.includes('uiaf')) {
      return true;
    }
    
    // 检查文件内容是否包含关键字
    const fileContent = typeof fileData === 'string' ? fileData : JSON.stringify(fileData);
    if (fileContent.includes('cocogoat') || fileContent.includes('椰羊成就')) {
      return true;
    }
    
    return false;
  },
  
  /**
   * 从椰羊成就文件中提取已完成的成就ID
   * @param {Object} data - 文件数据
   * @returns {Array} 已完成的成就ID数组
   */
  extractCompletedAchievements(data) {
    const completedIds = [];
    
    // 基本类型检查
    if (!data || typeof data !== 'object') {
      console.error('数据格式无效，必须是对象');
      return completedIds;
    }
    
    // 1. 检查UIAF格式 (椰羊UIAF1.0和1.1)
    if (data.info && data.info.export_app === 'cocogoat' && Array.isArray(data.list)) {
      console.log('检测到UIAF格式');
      for (const item of data.list) {
        if (item.id) {
          // 对于UIAF格式，所有在list中的都是已完成的
          completedIds.push(item.id);
        }
      }
    }
    // 2. 检查legacy格式 (椰羊成就.legacy)
    else if (data.source === '椰羊成就' && data.value && Array.isArray(data.value.achievements)) {
      console.log('检测到legacy格式');
      for (const item of data.value.achievements) {
        if (item.id) {
          // 在legacy格式中，所有列出的都是已完成的
          completedIds.push(item.id);
        }
      }
    }
    // 3. 检查uiafext格式 (椰羊成就.uiafext)
    else if (data.info && data.info.export_app === 'cocogoat' && Array.isArray(data.list)) {
      console.log('检测到uiafext格式');
      for (const item of data.list) {
        // uiafext格式中可能有status字段，值为3表示已完成
        if (item.id && (!item.status || item.status === 3)) {
          completedIds.push(item.id);
        }
      }
    }
    // 4. 通用格式检测
    else {
      console.log('尝试通用格式检测');
      // 检查可能的数组字段
      const arrayFields = ['list', 'achievements', 'items', 'completed', 'completedIds'];
      for (const field of arrayFields) {
        // 检查直接字段
        if (Array.isArray(data[field])) {
          for (const item of data[field]) {
            if (item.id) {
              completedIds.push(item.id);
            }
          }
          if (completedIds.length > 0) {
            console.log(`从${field}字段提取到${completedIds.length}个成就`);
            break;
          }
        }
        
        // 检查嵌套字段
        if (typeof data.value === 'object' && Array.isArray(data.value[field])) {
          for (const item of data.value[field]) {
            if (item.id) {
              completedIds.push(item.id);
            }
          }
          if (completedIds.length > 0) {
            console.log(`从value.${field}字段提取到${completedIds.length}个成就`);
            break;
          }
        }
      }
    }
    
    // 去重
    const uniqueIds = [...new Set(completedIds)];
    console.log(`总共提取到${uniqueIds.length}个唯一的成就ID`);
    return uniqueIds;
  },
  
  /**
   * 保存用户成就数据到指定目录
   * @param {string} userId - 用户ID
   * @param {Array} completedIds - 已完成的成就ID数组
   * @param {string} outputDir - 输出目录
   */
  async saveUserAchievements(userId, completedIds, outputDir) {
    const filePath = path.join(outputDir, `${userId}.json`);
    
    // 创建目录（如果不存在）
    try {
      await fs.promises.mkdir(outputDir, { recursive: true });
    } catch (err) {
      console.error(`创建目录失败: ${err.message}`);
      return;
    }
    
    // 读取已有数据或创建新数据
    let userData = { completedIds: [], timestamp: Date.now() };
    
    try {
      await fs.promises.access(filePath);
      const existingData = await fs.promises.readFile(filePath, 'utf8');
      userData = JSON.parse(existingData);
    } catch (e) {
      // 文件不存在或其他错误，使用默认数据
      console.log(`创建新的用户数据文件: ${filePath}`);
    }
    
    // 合并并去重
    const currentSet = new Set(userData.completedIds);
    const uniqueIds = [...new Set([...userData.completedIds, ...completedIds])];
    
    // 更新数据
    userData.completedIds = uniqueIds;
    userData.timestamp = Date.now();
    userData.lastUpdate = new Date().toISOString();
    
    // 保存数据
    try {
      await fs.promises.writeFile(filePath, JSON.stringify(userData, null, 2), 'utf8');
      console.log(`成功保存用户数据到: ${filePath}`);
      console.log(`原始成就数: ${userData.completedIds ? userData.completedIds.length : 0}, 新增成就数: ${uniqueIds.length - (userData.completedIds ? userData.completedIds.length : 0)}`);
    } catch (err) {
      console.error(`保存用户数据失败: ${err.message}`);
    }
  },
  
  /**
   * 直接处理成就数据
   * @param {Object} fileData - 文件数据对象
   * @param {string} userId - 用户ID
   * @param {string} outputDir - 输出目录
   * @param {string} fileName - 可选的文件名
   */
  async processAchievementData(fileData, userId, outputDir, fileName = 'unknown.json') {
    try {
      console.log(`开始处理成就数据，文件名: ${fileName}`);
      
      // 检查是否为椰羊成就文件
      if (!this.isCocogoatFile(fileName, fileData)) {
        console.log(`跳过非椰羊成就数据: ${fileName}`);
        return;
      }
      
      // 提取已完成的成就ID
      const completedIds = this.extractCompletedAchievements(fileData);
      
      if (completedIds.length === 0) {
        console.error(`数据中未找到有效成就数据: ${fileName}`);
        return;
      }
      
      // 保存用户数据
      await this.saveUserAchievements(userId, completedIds, outputDir);
      
    } catch (err) {
      console.error(`处理成就数据时出错: ${err.message}`);
    }
  },
  
  /**
   * 处理单个成就文件
   * @param {string} filePath - 文件路径
   * @param {string} userId - 用户ID
   * @param {string} outputDir - 输出目录
   */
  async processAchievementFile(filePath, userId, outputDir) {
    try {
      console.log(`开始处理文件: ${filePath}`);
      
      // 创建Rflie文件夹路径
      const rflieDir = path.join(__dirname, 'Rflie');
      // 确保Rflie文件夹存在
      try {
        await fs.promises.mkdir(rflieDir, { recursive: true });
        console.log(`确保Rflie文件夹存在: ${rflieDir}`);
      } catch (mkdirErr) {
        console.error(`创建Rflie文件夹失败: ${mkdirErr.message}`);
      }
      
      // 读取文件内容
      const fileContent = await fs.promises.readFile(filePath, 'utf8');
      
      // 保存原始文件到Rflie文件夹
      const fileName = path.basename(filePath);
      const timestamp = Date.now();
      const safeFileName = `${userId}_${timestamp}_${fileName.replace(/[^a-zA-Z0-9._-]/g, '_')}`;
      const savePath = path.join(rflieDir, safeFileName);
      
      try {
        await fs.promises.writeFile(savePath, fileContent, 'utf8');
        console.log(`原始文件已保存到: ${savePath}`);
      } catch (saveErr) {
        console.error(`保存原始文件失败: ${saveErr.message}`);
      }
      
      const fileData = JSON.parse(fileContent);
      
      // 使用通用函数处理数据
      await this.processAchievementData(fileData, userId, outputDir, fileName);
      
    } catch (err) {
      console.error(`处理文件时出错: ${err.message}`);
    }
  },
  
  /**
   * 从Yunzai框架的fileInfo对象中提取并处理文件内容
   * 增强版文件获取逻辑，支持多种适配器和文件处理方式
   * @param {Object} fileInfo - 从Yunzai获取的fileInfo对象
   * @param {Object} e - Yunzai的事件对象
   * @param {string} userId - 用户ID
   * @param {string} outputDir - 输出目录
   * @param {Function} onProgress - 进度回调函数
   */
  async processFromFileInfo(fileInfo, e, userId, outputDir, onProgress = null) {
    try {
      console.log(`[mCat-ac-helper] 开始从fileInfo处理文件内容`);
      
      // 调用进度回调
      if (typeof onProgress === 'function') {
        onProgress('开始处理文件...');
      }
      
      // 创建Rflie文件夹路径
      const rflieDir = path.join(__dirname, 'Rflie');
      // 确保Rflie文件夹存在
      try {
        await fs.promises.mkdir(rflieDir, { recursive: true });
        console.log(`[mCat-ac-helper] 确保Rflie文件夹存在: ${rflieDir}`);
      } catch (mkdirErr) {
        console.error(`[mCat-ac-helper] 创建Rflie文件夹失败: ${mkdirErr.message}`);
      }
      
      // 尝试直接获取文件内容
      let fileContent = null;
      let originalFileName = 'achievement.json';
      let fileType = 'unknown';
      
      // 辅助函数：从各种可能的位置提取文件名
      const extractFileName = (info, event) => {
        // 检查最常见的文件名属性
        const nameProps = ['filename', 'file', 'name', 'title', 'file_name', 'fname'];
        for (const prop of nameProps) {
          if (info && info[prop]) return info[prop];
          if (event && event.file && event.file[prop]) return event.file[prop];
          if (info && info.data && info.data[prop]) return info.data[prop];
          if (event && event.data && event.data[prop]) return event.data[prop];
        }
        
        // 检查CQ码格式
        if (event && event.message && Array.isArray(event.message)) {
          for (const msg of event.message) {
            if (msg.type === 'file' && msg.data && (msg.data.filename || msg.data.file)) {
              return msg.data.filename || msg.data.file;
            }
          }
        }
        
        // 检查CQ码字符串
        if (event && event.content && typeof event.content === 'string') {
          const cqRegex = /\[CQ:file,file=(.+?)(?:,|\])/;
          const match = event.content.match(cqRegex);
          if (match && match[1]) return match[1];
        }
        
        return 'achievement.json';
      };
      
      // 辅助函数：从各种可能的位置提取文件ID
      const extractFileId = (info, event) => {
        const idProps = ['file_id', 'id', 'fileId'];
        for (const prop of idProps) {
          if (info && info[prop]) return info[prop];
          if (event && event.file && event.file[prop]) return event.file[prop];
          if (info && info.data && info.data[prop]) return info.data[prop];
          if (event && event.data && event.data[prop]) return event.data[prop];
        }
        
        // 检查CQ码格式
        if (event && event.message && Array.isArray(event.message)) {
          for (const msg of event.message) {
            if (msg.type === 'file' && msg.data && msg.data.file_id) {
              return msg.data.file_id;
            }
          }
        }
        
        return null;
      };
      
      // 辅助函数：从各种可能的位置提取文件路径
      const extractFilePath = (info, event) => {
        const pathProps = ['path', 'file_path', 'filepath', 'local_path', 'filePath'];
        for (const prop of pathProps) {
          if (info && info[prop]) return info[prop];
          if (event && event.file && event.file[prop]) return event.file[prop];
          if (info && info.data && info.data[prop]) return info.data[prop];
          if (event && event.data && event.data[prop]) return event.data[prop];
        }
        return null;
      };
      
      // 辅助函数：从message数组中提取文件信息
      const extractFromMessageArray = (event) => {
        if (!event || !event.message || !Array.isArray(event.message)) return null;
        
        for (const msg of event.message) {
          if (msg.type === 'file' && msg.data) {
            return msg.data;
          }
          // 检查是否有file对象
          if (msg.file) {
            return msg.file;
          }
        }
        return null;
      };
      
      // 调用进度回调
      if (typeof onProgress === 'function') {
        onProgress('正在提取文件信息...');
      }
      
      // 从message数组中提取文件信息
      const msgFileData = extractFromMessageArray(e);
      if (msgFileData) {
        console.log(`[mCat-ac-helper] 从message数组提取到文件数据`);
        // 更新fileInfo
        fileInfo = { ...fileInfo, ...msgFileData };
      }
      
      // 方法1: 尝试直接从fileInfo获取文件内容
      if (fileInfo && fileInfo.content) {
        console.log(`[mCat-ac-helper] 直接从fileInfo.content获取文件内容`);
        fileContent = fileInfo.content;
        originalFileName = extractFileName(fileInfo, e);
      }
      // 方法2: 尝试从e.file获取文件内容
      else if (e && e.file && e.file.content) {
        console.log(`[mCat-ac-helper] 从e.file.content获取文件内容`);
        fileContent = e.file.content;
        originalFileName = extractFileName(fileInfo, e);
      }
      // 方法3: 尝试直接读取文件路径
      else {
        const filePath = extractFilePath(fileInfo, e);
        if (filePath) {
          console.log(`[mCat-ac-helper] 尝试从文件路径读取: ${filePath}`);
          try {
            // 检查文件是否存在
            await fs.promises.access(filePath);
            fileContent = await fs.promises.readFile(filePath, 'utf8');
            originalFileName = extractFileName(fileInfo, e);
            console.log(`[mCat-ac-helper] 成功从文件路径读取内容`);
          } catch (readErr) {
            console.error(`[mCat-ac-helper] 读取文件路径失败: ${readErr.message}`);
          }
        }
      }
      
      // 方法4: 如果有file_id，尝试使用Yunzai框架的GetFile方法下载文件
      if (!fileContent) {
        const fileId = extractFileId(fileInfo, e);
        if (fileId) {
          console.log(`[mCat-ac-helper] 尝试使用file_id下载文件: ${fileId}`);
          originalFileName = extractFileName(fileInfo, e);
          
          // 创建临时文件路径
          const tempDir = path.join(__dirname, 'temp');
          await fs.promises.mkdir(tempDir, { recursive: true });
          const tempFilePath = path.join(tempDir, `temp_${userId}_${Date.now()}.json`);
          
          // 调用进度回调
          if (typeof onProgress === 'function') {
            onProgress('正在下载文件...');
          }
          
          // 尝试多种GetFile方法
          let fileDownloaded = false;
          
          // 尝试1: 全局YunzaiBot.GetFile
          if (global?.YunzaiBot?.GetFile && typeof global.YunzaiBot.GetFile === 'function') {
            try {
              console.log(`[mCat-ac-helper] 尝试使用全局YunzaiBot.GetFile方法`);
              const fileInfoResult = await global.YunzaiBot.GetFile(fileId);
              if (fileInfoResult && fileInfoResult.path) {
                fileContent = await fs.promises.readFile(fileInfoResult.path, 'utf8');
                fileDownloaded = true;
                console.log(`[mCat-ac-helper] 使用YunzaiBot.GetFile成功`);
              }
            } catch (err) {
              console.error(`[mCat-ac-helper] YunzaiBot.GetFile失败: ${err.message}`);
            }
          }
          
          // 尝试2: 全局GetFile
          if (!fileDownloaded && global?.GetFile && typeof global.GetFile === 'function') {
            try {
              console.log(`[mCat-ac-helper] 尝试使用全局GetFile方法`);
              const fileInfoResult = await global.GetFile(fileId);
              if (fileInfoResult && fileInfoResult.path) {
                fileContent = await fs.promises.readFile(fileInfoResult.path, 'utf8');
                fileDownloaded = true;
                console.log(`[mCat-ac-helper] 使用GetFile成功`);
              }
            } catch (err) {
              console.error(`[mCat-ac-helper] GetFile失败: ${err.message}`);
            }
          }
          
          // 尝试3: bot实例的GetFile
          if (!fileDownloaded && e?.bot?.GetFile && typeof e.bot.GetFile === 'function') {
            try {
              console.log(`[mCat-ac-helper] 尝试使用bot.GetFile方法`);
              const fileInfoResult = await e.bot.GetFile(fileId);
              if (fileInfoResult && fileInfoResult.path) {
                fileContent = await fs.promises.readFile(fileInfoResult.path, 'utf8');
                fileDownloaded = true;
                console.log(`[mCat-ac-helper] 使用bot.GetFile成功`);
              }
            } catch (err) {
              console.error(`[mCat-ac-helper] bot.GetFile失败: ${err.message}`);
            }
          }
          
          // 尝试4: client实例的GetFile
          if (!fileDownloaded && e?.client?.GetFile && typeof e.client.GetFile === 'function') {
            try {
              console.log(`[mCat-ac-helper] 尝试使用client.GetFile方法`);
              const fileInfoResult = await e.client.GetFile(fileId);
              if (fileInfoResult && fileInfoResult.path) {
                fileContent = await fs.promises.readFile(fileInfoResult.path, 'utf8');
                fileDownloaded = true;
                console.log(`[mCat-ac-helper] 使用client.GetFile成功`);
              }
            } catch (err) {
              console.error(`[mCat-ac-helper] client.GetFile失败: ${err.message}`);
            }
          }
          
          // 尝试5: group实例的getFolder方法（用于群文件）
          if (!fileDownloaded && e?.group?.getFolder && typeof e.group.getFolder === 'function') {
            try {
              console.log(`[mCat-ac-helper] 尝试使用group.getFolder方法`);
              const folderInfo = await e.group.getFolder();
              console.log(`[mCat-ac-helper] 获取到群文件列表，尝试查找目标文件`);
            } catch (err) {
              console.error(`[mCat-ac-helper] group.getFolder失败: ${err.message}`);
            }
          }
          
          // 尝试6: 带参数的GetFile调用
          if (!fileDownloaded) {
            try {
              console.log(`[mCat-ac-helper] 尝试使用带参数的GetFile方法`);
              
              // 尝试各种GetFile方法，带参数
              const getFileMethods = [
                () => global?.YunzaiBot?.GetFile?.({file_id: fileId, target_path: tempFilePath}),
                () => global?.GetFile?.({file_id: fileId, target_path: tempFilePath}),
                () => e?.bot?.GetFile?.({file_id: fileId, target_path: tempFilePath}),
                () => e?.client?.GetFile?.({file_id: fileId, target_path: tempFilePath}),
                // 额外的参数格式尝试
                () => global?.YunzaiBot?.GetFile?.({id: fileId, path: tempFilePath}),
                () => global?.GetFile?.({id: fileId, path: tempFilePath})
              ];
              
              for (const method of getFileMethods) {
                try {
                  await method();
                  // 检查文件是否已创建
                  await fs.promises.access(tempFilePath);
                  fileContent = await fs.promises.readFile(tempFilePath, 'utf8');
                  fileDownloaded = true;
                  console.log(`[mCat-ac-helper] 使用带参数的GetFile成功`);
                  break;
                } catch (methodErr) {
                  // 继续尝试下一个方法
                }
              }
            } catch (err) {
              console.error(`[mCat-ac-helper] 带参数的GetFile失败: ${err.message}`);
            }
          }
        }
      }
      
      // 方法5: 扫描临时目录查找最近的JSON文件（增强版，最后手段）
      if (!fileContent) {
        console.log(`[mCat-ac-helper] 尝试扫描临时目录查找最近的JSON文件`);
        
        // 调用进度回调
        if (typeof onProgress === 'function') {
          onProgress('尝试从临时目录查找文件...');
        }
        
        // 定义增强版临时目录列表，增加了更多可能的位置
        const tempDirs = [
          path.join(process.cwd(), 'temp'),
          path.join(process.cwd(), 'data', 'temp'),
          path.join(__dirname, 'temp'),
          path.join(process.cwd(), 'downloads'),
          path.join(process.cwd(), 'data', 'downloads'),
          // 增加miao插件可能使用的目录
          path.join(process.cwd(), 'plugins', 'miao', 'data'),
          path.join(process.cwd(), 'plugins', 'miao', 'temp'),
          // 增加napcat可能使用的目录
          path.join(process.cwd(), 'download'),
          path.join(process.cwd(), 'temp', 'napcat'),
          path.join(process.cwd(), 'temp', 'napcat', 'file'),
          process.env.TEMP || process.env.TMP || '/tmp'
        ];
        
        // 查找最近修改的JSON文件
        let recentFiles = [];
        
        for (const dir of tempDirs) {
          try {
            if (await fs.promises.stat(dir).then(stat => stat.isDirectory())) {
              const files = await fs.promises.readdir(dir);
              for (const file of files) {
                // 扩展匹配范围，不仅限于.json
                if (file.endsWith('.json') || file.includes('成就') || file.includes('uiaf')) {
                  const filePath = path.join(dir, file);
                  const stats = await fs.promises.stat(filePath);
                  // 扩大时间范围到10分钟
                  if (Date.now() - stats.mtimeMs < 10 * 60 * 1000) {
                    recentFiles.push({ path: filePath, mtime: stats.mtimeMs, name: file });
                  }
                }
              }
            }
          } catch (e) {
            // 忽略不存在的目录
          }
        }
        
        // 按修改时间排序，取最新的
        if (recentFiles.length > 0) {
          recentFiles.sort((a, b) => b.mtime - a.mtime);
          const latestFile = recentFiles[0];
          
          try {
            console.log(`[mCat-ac-helper] 尝试读取最近的JSON文件: ${latestFile.path}`);
            fileContent = await fs.promises.readFile(latestFile.path, 'utf8');
            originalFileName = latestFile.name;
            console.log(`[mCat-ac-helper] 成功读取最近的JSON文件`);
          } catch (readErr) {
            console.error(`[mCat-ac-helper] 读取最近文件失败: ${readErr.message}`);
          }
        }
      }
      
      // 如果获取到了文件内容，进行处理
      if (fileContent) {
        // 保存原始文件到Rflie文件夹
        const timestamp = Date.now();
        const safeFileName = `${userId}_${timestamp}_${originalFileName.replace(/[^a-zA-Z0-9._-]/g, '_')}`;
        const savePath = path.join(rflieDir, safeFileName);
        
        try {
          await fs.promises.writeFile(savePath, fileContent, 'utf8');
          console.log(`[mCat-ac-helper] 原始文件已保存到: ${savePath}`);
        } catch (saveErr) {
          console.error(`[mCat-ac-helper] 保存原始文件失败: ${saveErr.message}`);
        }
        
        // 调用进度回调
        if (typeof onProgress === 'function') {
          onProgress('正在解析文件内容...');
        }
        
        // 检测文件类型
        if (fileContent.includes('"uiaf_version"') || fileContent.includes('"info":{"export_app":"cocogoat"')) {
          fileType = 'uiaf';
        } else if (fileContent.includes('"source":"椰羊成就"')) {
          fileType = 'legacy';
        } else if (fileContent.includes('.uiafext')) {
          fileType = 'uiafext';
        }
        
        try {
          // 尝试解析JSON，添加多重错误处理和修复
          let fileData;
          
          // 尝试1: 直接解析
          try {
            fileData = JSON.parse(fileContent);
          } 
          // 尝试2: 移除BOM和前后空白
          catch (parseErr1) {
            console.warn(`[mCat-ac-helper] 直接解析失败，尝试清理文件内容: ${parseErr1.message}`);
            const cleanContent = fileContent.trim().replace(/^\uFEFF/, '').replace(/[\r\n]+$/, '');
            try {
              fileData = JSON.parse(cleanContent);
            } 
            // 尝试3: 修复常见格式问题
            catch (parseErr2) {
              console.warn(`[mCat-ac-helper] 清理后解析失败，尝试修复格式: ${parseErr2.message}`);
              // 尝试修复常见的格式问题
              let fixedContent = cleanContent;
              // 修复尾部逗号
              fixedContent = fixedContent.replace(/,([\s\n]*)}/g, '$1}');
              fixedContent = fixedContent.replace(/,([\s\n]*\])/g, '$1]');
              // 修复单引号
              fixedContent = fixedContent.replace(/'([^']*)'/g, '"$1"');
              
              try {
                fileData = JSON.parse(fixedContent);
              } 
              // 尝试4: 移除注释（简单实现）
              catch (parseErr3) {
                console.warn(`[mCat-ac-helper] 修复格式后解析失败，尝试移除注释: ${parseErr3.message}`);
                // 简单移除单行注释
                let noCommentsContent = fixedContent.replace(/\/\/.*$/gm, '');
                // 简单移除多行注释（可能不完美）
                noCommentsContent = noCommentsContent.replace(/\/\*[\s\S]*?\*\//g, '');
                
                try {
                  fileData = JSON.parse(noCommentsContent);
                } catch (finalErr) {
                  console.error(`[mCat-ac-helper] 所有解析尝试均失败: ${finalErr.message}`);
                  throw finalErr;
                }
              }
            }
          }
          
          // 处理解析成功的数据
          console.log(`[mCat-ac-helper] 成功解析文件内容，文件类型: ${fileType}`);
          const result = await this.processAchievementData(fileData, userId, outputDir, originalFileName);
          
          // 调用进度回调
          if (typeof onProgress === 'function') {
            onProgress('文件处理完成！');
          }
          
          return {
            success: true,
            fileType: fileType,
            fileName: originalFileName,
            content: fileData
          };
          
        } catch (parseErr) {
          console.error(`[mCat-ac-helper] JSON解析失败: ${parseErr.message}`);
          
          // 调用进度回调
          if (typeof onProgress === 'function') {
            onProgress('文件格式错误，无法解析！');
          }
          
          return {
            success: false,
            error: 'JSON格式错误',
            errorDetails: parseErr.message
          };
        }
      }
      
      console.log(`[mCat-ac-helper] 无法从fileInfo获取文件内容，所有方法均已尝试`);
      
      // 调用进度回调
      if (typeof onProgress === 'function') {
        onProgress('无法获取文件内容，请重新发送！');
      }
      
      return {
        success: false,
        error: '无法获取文件内容'
      };
      
    } catch (err) {
      console.error(`[mCat-ac-helper] 从fileInfo处理文件时出错: ${err.message}`);
      console.error(`[mCat-ac-helper] 错误详情: ${err.stack}`);
      
      // 调用进度回调
      if (typeof onProgress === 'function') {
        onProgress(`处理文件时发生错误: ${err.message}`);
      }
      
      return {
        success: false,
        error: '处理文件时发生错误',
        errorDetails: err.message
      };
    }
  },
  
  /**
   * 扫描临时目录并处理最近的成就文件
   * @param {string} userId - 用户ID
   * @param {string} outputDir - 输出目录
   * @param {Array} tempDirs - 要扫描的临时目录列表
   */
  async scanAndProcessRecentFiles(userId, outputDir, tempDirs = null) {
    try {
      console.log(`[mCat-ac-helper] 开始扫描临时目录中的最近成就文件`);
      
      // 默认临时目录列表
      if (!tempDirs) {
        tempDirs = [
          path.join(process.cwd(), 'temp'),
          path.join(process.cwd(), 'data', 'temp'),
          path.join(__dirname, 'temp'),
          process.env.TEMP || process.env.TMP || '/tmp',
          path.join(process.cwd(), 'downloads'),
          path.join(process.cwd(), 'data', 'downloads')
        ];
      }
      
      // 记录所有找到的JSON文件
      const allJsonFiles = [];
      
      // 扫描所有临时目录
      for (const dir of tempDirs) {
        try {
          if (await fs.promises.stat(dir).then(stat => stat.isDirectory())) {
            const files = await fs.promises.readdir(dir);
            const jsonFiles = files
              .filter(file => file.endsWith('.json'))
              .map(file => path.join(dir, file));
            
            for (const filePath of jsonFiles) {
              try {
                const stats = await fs.promises.stat(filePath);
                allJsonFiles.push({
                  path: filePath,
                  mtime: stats.mtimeMs
                });
              } catch (e) {
                // 忽略单个文件的错误
              }
            }
          }
        } catch (e) {
          // 忽略不存在的目录
        }
      }
      
      // 按修改时间排序，最新的在前
      allJsonFiles.sort((a, b) => b.mtime - a.mtime);
      
      // 只处理最近的5个文件
      const recentFiles = allJsonFiles.slice(0, 5);
      
      // 检查最近2分钟内的文件
      const twoMinutesAgo = Date.now() - 120000;
      const recentEnoughFiles = recentFiles.filter(file => file.mtime > twoMinutesAgo);
      
      console.log(`[mCat-ac-helper] 找到${recentEnoughFiles.length}个最近修改的JSON文件`);
      
      // 逐个处理文件
      for (const { path: filePath } of recentEnoughFiles) {
        try {
          const fileContent = await fs.promises.readFile(filePath, 'utf8');
          
          // 快速检查是否包含成就关键字
          if (fileContent.includes('uiaf_version') || 
              fileContent.includes('椰羊成就') || 
              fileContent.includes('achievements') ||
              fileContent.includes('"list":') ||
              fileContent.includes('"id":')) {
            
            console.log(`[mCat-ac-helper] 处理最近的成就文件: ${filePath}`);
            
            // 创建Rflie文件夹路径
            const rflieDir = path.join(__dirname, 'Rflie');
            // 确保Rflie文件夹存在
            try {
              await fs.promises.mkdir(rflieDir, { recursive: true });
            } catch (mkdirErr) {
              console.error(`[mCat-ac-helper] 创建Rflie文件夹失败: ${mkdirErr.message}`);
            }
            
            // 保存原始文件到Rflie文件夹
            const fileName = path.basename(filePath);
            const timestamp = Date.now();
            const safeFileName = `${userId}_${timestamp}_${fileName.replace(/[^a-zA-Z0-9._-]/g, '_')}`;
            const savePath = path.join(rflieDir, safeFileName);
            
            try {
              await fs.promises.writeFile(savePath, fileContent, 'utf8');
              console.log(`[mCat-ac-helper] 原始文件已保存到: ${savePath}`);
            } catch (saveErr) {
              console.error(`[mCat-ac-helper] 保存原始文件失败: ${saveErr.message}`);
            }
            
            const fileData = JSON.parse(fileContent);
            await this.processAchievementData(fileData, userId, outputDir, fileName);
            return true;
          }
        } catch (e) {
          // 忽略单个文件的错误
        }
      }
      
      console.log(`[mCat-ac-helper] 未找到最近的成就文件`);
      return false;
      
    } catch (err) {
      console.error(`[mCat-ac-helper] 扫描临时目录时出错: ${err.message}`);
      return false;
    }
  }
};

// 只导出插件对象作为默认导出
// 这是TRSS-Yunzai插件系统所必需的
module.exports = achievementHelperPlugin;

// 导出helper对象，供mCat-ac.js使用
module.exports.helper = {
  processAchievementData: achievementHelperPlugin.processAchievementData,
  processFromFileInfo: achievementHelperPlugin.processFromFileInfo,
  scanAndProcessRecentFiles: achievementHelperPlugin.scanAndProcessRecentFiles,
  processAchievementFile: achievementHelperPlugin.processAchievementFile,
  extractCompletedAchievements: achievementHelperPlugin.extractCompletedAchievements,
  saveUserAchievements: achievementHelperPlugin.saveUserAchievements
};

// 为了兼容性，同时导出插件的工具函数
module.exports.processAchievementData = achievementHelperPlugin.processAchievementData;
module.exports.processFromFileInfo = achievementHelperPlugin.processFromFileInfo;
module.exports.scanAndProcessRecentFiles = achievementHelperPlugin.scanAndProcessRecentFiles;
module.exports.processAchievementFile = achievementHelperPlugin.processAchievementFile;
module.exports.extractCompletedAchievements = achievementHelperPlugin.extractCompletedAchievements;
module.exports.saveUserAchievements = achievementHelperPlugin.saveUserAchievements;