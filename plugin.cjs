// mCat-ac 成就检查插件主入口

const path = require('path');

// 颜色常量定义
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
// 由于mCat-ac.js是ES模块，我们需要使用动态import
let AchievementCheck;

// 使用IIFE包装异步导入
(async () => {
  try {
    const module = await import('./mCat-ac.js');
    AchievementCheck = module.default;
    console.log(`${COLORS.GREEN}[mCat-ac] 成功动态导入ES模块${COLORS.RESET}`);
  } catch (error) {
    console.error(`${COLORS.RED}[mCat-ac] 动态导入ES模块失败:${COLORS.RESET}`, error.message);
  }
})();

// 插件主类
class mCatAcPlugin {
  constructor() {
    this.achievementCheck = null;
    this.initialized = false;
    
    // 等待AchievementCheck加载完成后初始化
    this.waitForInitialization();
  }

  // 等待模块加载完成并初始化
  async waitForInitialization() {
    // 等待AchievementCheck加载完成
    while (!AchievementCheck) {
      await new Promise(resolve => setTimeout(resolve, 100));
    }
    
    try {
        // 创建成就检查实例
        this.achievementCheck = new AchievementCheck();
        // 初始化插件数据目录
        await this.initDir();
        this.initialized = true;
        // 移除可能导致重复的初始化完成日志
        // console.log('[mCat-ac] 插件初始化完成');
      } catch (error) {
        console.error('[mCat-ac] 插件初始化失败:', error.message);
      }
  }

  // 初始化插件数据目录
  async initDir() {
    const fs = require('fs').promises;
    const dirs = [
      path.join(__dirname, 'data'),
      path.join(__dirname, 'data/achievements'),
      path.join(__dirname, 'data/users'),
      path.join(__dirname, 'cache')
    ];
    
    try {
      for (const dir of dirs) {
        try {
          await fs.access(dir);
        } catch (err) {
          // 目录不存在，创建它
          await fs.mkdir(dir, { recursive: true });
          console.log(`${COLORS.CYAN}[mCat-ac] 创建目录: ${dir}${COLORS.RESET}`);
        }
      }
      console.log(`${COLORS.GREEN}[mCat-ac] 目录初始化完成${COLORS.RESET}`);
    } catch (error) {
      console.error(`${COLORS.RED}[mCat-ac] 目录初始化失败: ${error.message}${COLORS.RESET}`);
      throw error;
    }
  }

  // 确保插件已初始化
  async ensureInitialized(e) {
    // 等待插件完全初始化
    if (!this.initialized || !this.achievementCheck) {
      // 设置超时，避免无限等待
      const timeout = 5000; // 5秒超时
      const startTime = Date.now();
      
      while (!this.initialized || !this.achievementCheck) {
        if (Date.now() - startTime > timeout) {
          if (e) {
            await e.reply('[mCat-ac] 插件初始化超时，请稍后再试');
          }
          console.error(`${COLORS.RED}[mCat-ac] 插件初始化超时${COLORS.RESET}`);
          return false;
        }
        await new Promise(resolve => setTimeout(resolve, 100));
      }
    }
    
    return true;
  }

  // 注册命令
  async registerCommands() {
    // 成就校对命令
    this.register('成就校对', this.handleCheckUpdate.bind(this));
    
    // 成就录入命令
    this.register('成就录入', this.handleImport.bind(this));
    
    // 成就查询命令
    this.register('成就查询', this.handleQuery.bind(this));
    
    // 成就重置命令
    this.register('成就重置', this.handleReset.bind(this));
    
    // 成就清理命令
    this.register('成就清理', this.handleClean.bind(this));
    
    // 成就ID查询命令
    this.register('成就ID', this.handleIdSearch.bind(this));
    
    // 成就查找命令
    this.register('成就查找', this.handleNameSearch.bind(this));
    
    // 成就阶段命令
    this.register('成就阶段', this.handleStageSearch.bind(this));
    
    // 成就设置命令
    this.register('成就设置', this.handleSettings.bind(this));
  }

  // 注册单个命令
  register(pattern, handler) {
    if (!global.cmd || !global.cmd.register) {
      console.error(`${COLORS.RED}[mCat-ac] 命令注册失败: cmd模块未加载${COLORS.RESET}`);
      return;
    }
    
    global.cmd.register(
      'mCat-ac',
      [pattern],
      { authority: 0, priority: 500 },
      async (e) => {
        try {
          return await handler(e);
        } catch (error) {
          console.error(`${COLORS.RED}[mCat-ac] 命令执行出错: ${error.message}${COLORS.RESET}`);
          console.error(error.stack);
          await e.reply(`⚠️ 命令执行出错: ${error.message}`);
          return false;
        }
      }
    );
  }

  // 处理成就校对命令
  async handleCheckUpdate(e) {
    if (!await this.ensureInitialized(e)) return;
    await e.reply('正在更新成就数据，请稍候...');
    const result = await this.achievementCheck.updateCheckFile();
    if (result.success) {
      await e.reply(`✅ ${result.message}`);
    } else {
      await e.reply(`❌ ${result.message}`);
    }
    return true;
  }

  // 处理成就录入命令
  async handleImport(e) {
    if (!await this.ensureInitialized(e)) return;
    const code = e.msg.replace(/^成就录入\s*/, '').trim();
    if (!code) {
      await e.reply('请输入成就分享码！格式：成就录入 [分享码]');
      return false;
    }
    
    await e.reply('正在解析成就数据，请稍候...');
    const result = await this.achievementCheck.importAchievementByCode(e.user_id, code);
    if (result.success) {
      await e.reply(`✅ 成就录入成功！共录入 ${result.count} 个成就`);
    } else {
      await e.reply(`❌ ${result.message}`);
    }
    return true;
  }

  // 处理成就查询命令
  async handleQuery(e) {
    if (!await this.ensureInitialized(e)) return;
    const category = e.msg.replace(/^成就查询\s*/, '').trim();
    await e.reply('正在生成成就报告，请稍候...');
    await this.achievementCheck.compareAchievements(e, category);
    return true;
  }

  // 处理成就重置命令
  async handleReset(e) {
    if (!await this.ensureInitialized(e)) return;
    const result = await this.achievementCheck.resetAchievements(e.user_id);
    if (result.success) {
      await e.reply('✅ 成就数据已重置');
    } else {
      await e.reply(`❌ ${result.message}`);
    }
    return true;
  }

  // 处理成就清理命令
  async handleClean(e) {
    if (!await this.ensureInitialized(e)) return;
    const result = await this.achievementCheck.cleanCache();
    if (result.success) {
      await e.reply(`✅ 缓存清理成功！清理了 ${result.count} 个文件`);
    } else {
      await e.reply(`❌ ${result.message}`);
    }
    return true;
  }

  // 处理成就ID查询命令
  async handleIdSearch(e) {
    if (!await this.ensureInitialized(e)) return;
    const id = e.msg.replace(/^成就ID\s*/, '').trim();
    if (!id) {
      await e.reply('请输入成就ID！格式：成就ID [成就ID]');
      return false;
    }
    
    const achievement = await this.achievementCheck.findAchievementById(id);
    if (achievement) {
      await e.reply(`🔍 成就信息：
ID: ${achievement.id}
名称: ${achievement.name}
描述: ${achievement.description || '无描述'}
奖励: ${achievement.reward || '无奖励'}`);
    } else {
      await e.reply(`❌ 未找到ID为 ${id} 的成就`);
    }
    return true;
  }

  // 处理成就查找命令
  async handleNameSearch(e) {
    if (!await this.ensureInitialized(e)) return;
    const name = e.msg.replace(/^成就查找\s*/, '').trim();
    if (!name) {
      await e.reply('请输入成就名称！格式：成就查找 [成就名称]');
      return false;
    }
    
    const achievements = await this.achievementCheck.findAllAchievementsByName(name);
    if (achievements.length > 0) {
      let message = `🔍 找到 ${achievements.length} 个相关成就：\n`;
      achievements.slice(0, 5).forEach(ach => {
        message += `\nID: ${ach.id}\n名称: ${ach.name}\n描述: ${ach.description || '无描述'}\n---`;
      });
      if (achievements.length > 5) {
        message += `\n\n... 还有 ${achievements.length - 5} 个结果未显示`;
      }
      await e.reply(message);
    } else {
      await e.reply(`❌ 未找到名称包含 "${name}" 的成就`);
    }
    return true;
  }

  // 处理成就阶段命令
  async handleStageSearch(e) {
    if (!await this.ensureInitialized(e)) return;
    const match = e.msg.match(/^成就阶段\s*(.+?)\s*(\d+)$/);
    if (!match) {
      await e.reply('格式错误！格式：成就阶段 [成就名称] [阶段号]');
      return false;
    }
    
    const [, name, stageStr] = match;
    const stage = parseInt(stageStr);
    
    const achievement = await this.achievementCheck.findAchievementByStage(name, stage);
    if (achievement) {
      await e.reply(`🔍 成就信息：
ID: ${achievement.id}
名称: ${achievement.name}
描述: ${achievement.description || '无描述'}
阶段: ${stage}\n奖励: ${achievement.reward || '无奖励'}`);
    } else {
      await e.reply(`❌ 未找到名称为 "${name}" 的第 ${stage} 阶段成就`);
    }
    return true;
  }

  // 处理成就设置命令
  async handleSettings(e) {
    if (!await this.ensureInitialized(e)) return;
    const params = e.msg.replace(/^成就设置\s*/, '').trim();
    
    if (!params) {
      // 显示设置菜单
      await this.achievementCheck.showSettings(e);
    } else {
      // 设置具体选项
      const [option, value] = params.split(/\s+/);
      await this.achievementCheck.setConfig(e, option, value);
    }
    return true;
  }
}

// 导出插件主函数
module.exports = async function App() {
  try {
    const plugin = new mCatAcPlugin();
    await plugin.registerCommands();
    console.log(`${COLORS.GREEN}[mCat-ac] 成就检查插件已加载${COLORS.RESET}`);
  } catch (error) {
    console.error(`${COLORS.RED}[mCat-ac] 插件加载失败: ${error.message}${COLORS.RESET}`);
  }
};