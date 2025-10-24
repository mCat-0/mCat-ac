// mCat-ac 成就检查插件配置文件
module.exports = {
  // 图片生成相关配置
  image: {
    // 是否使用随机背景图片
    randomBackground: false,
    // 图片模板类型 (当前使用 'def' - 默认模板)
    templates: ['def'],
    // 每页显示成就数量
    pageSize: 5
  },
  
  // API相关配置
  api: {
    // GitHub API配置 - 用于获取最新成就数据
    github: {
      // 成就数据仓库
      repo: 'https://api.github.com/repos/GenshinAchievement/GenshinAchievement/contents/achievements',
      // API请求超时时间 (毫秒)
      timeout: 15000
    },
    // 随机壁纸API
    wallpaper: {
      // 备用壁纸API地址
      url: 'https://picsum.photos/1080/1920',
      // 备用本地背景图片路径 (相对于插件目录)
      localBackup: './assets/bg.jpg'
    }
  },
  
  // 延迟和重试配置
  request: {
    // 随机延迟范围 (毫秒)
    delayRange: [1000, 3000],
    // 请求重试次数
    maxRetries: 3,
    // 重试间隔 (毫秒)
    retryDelay: 2000
  },
  
  // 缓存配置
  cache: {
    // 成就数据缓存时间 (毫秒)
    achievementCacheTime: 3600000, // 1小时
    // 模板缓存时间 (毫秒)
    templateCacheTime: 86400000, // 24小时
    // 背景图片缓存时间 (毫秒)
    backgroundCacheTime: 43200000 // 12小时
  },
  
  // 成就分类映射
  categories: {
    '天地万象': ['Reputation', 'Exploration', 'WorldQuest', 'Achievement'],
    '蒙德声望': ['Reputation-Mondstadt'],
    '璃月声望': ['Reputation-Liyue'],
    '稻妻声望': ['Reputation-Inazuma'],
    '须弥声望': ['Reputation-Sumeru'],
    '枫丹声望': ['Reputation-Fontaine'],
    '纳塔声望': ['Reputation-Natlan'],
    '每日委托': ['Daily'],
    '世界任务': ['WorldQuest'],
    '魔神任务': ['ArchonQuest'],
    '传说任务': ['StoryQuest'],
    '邀约事件': ['HangoutEvent'],
    '其他成就': ['Others']
  },
  
  // 成就等级配置
  rarity: {
    // 不同等级对应的颜色
    colors: {
      'Common': '#808080',     // 普通 - 灰色
      'Uncommon': '#008000',   // 稀有 - 绿色
      'Rare': '#0000CD',       // 珍贵 - 蓝色
      'Epic': '#800080',       // 史诗 - 紫色
      'Legendary': '#CD7F32'   // 传说 - 金色
    },
    // 等级显示名称
    names: {
      'Common': '普通',
      'Uncommon': '稀有',
      'Rare': '珍贵',
      'Epic': '史诗',
      'Legendary': '传说'
    }
  },
  
  // 日志配置
  log: {
    // 是否启用调试日志
    debug: false,
    // 日志级别
    level: 'info'
  }
};