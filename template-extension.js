// 成就查漏插件扩展 - 用于支持YAML模板自定义
// 使用方法：将此文件放在mCat-ac插件目录下，然后安装js-yaml依赖

import fs from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';
import { dirname } from 'path';

// 定义__dirname以兼容CommonJS模块的方式
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// 获取插件根目录
const getPluginDir = () => {
  return __dirname;
};

// 默认配置，按照新的颜色和字号规范设置
const defaultConfig = {
  page: {
    title: "成就查漏结果",
    backgroundColor: "#000000",
    textColor: "#ffffff",
    backgroundImage: "bg.png", // 规范要求：背景命名为bg，支持png/jpg格式
    padding: 0,
    width: "800px",
    height: "auto" // 自适应高度以显示所有内容
  },
  header: {
    title: "成就查漏结果",
    titleColor: "#FFD69E", // 规范要求：标题颜色
    titleSize: 60, // 规范要求：标题字号
    uidColor: "#FFD69E", // 规范要求：uid颜色
    pageInfoColor: "#FFF2E0" // 规范要求：页数颜色
  },
  category: {
    titleColor: "#FFF2E0", // 规范要求：成就类目颜色
    titleSize: 40, // 规范要求：成就类目字号
    background: {
      width: 680, // 规范要求：默认宽度680
      autoHeight: true,
      borderRadius: 24, // 规范要求：圆角24
      color: "rgba(0, 0, 0, 0.4)", // 规范要求：透明度40%
      blur: 10, // 规范要求：毛玻璃模糊10
      shadow: false,
      statsColor: "#FFD69E" // 规范要求：未完成成就统计颜色
    },
    spacing: 20
  },
  achievement: {
    showId: true,
    showReward: true,
    showDesc: true,
    background: {
      width: 620,
      height: 80,
      borderRadius: 12,
      color: "rgba(0, 0, 0, 0.6)",
      blur: 0,
      shadow: false
    },
    nameColor: "#FFD69E", // 规范要求：成就名字颜色
    idColor: "#FFD69E", // 规范要求：成就id颜色
    descColor: "#FFD69E", // 规范要求：成就描述颜色
    rewardColor: "#FFD69E", // 规范要求：原石数量颜色
    rewardSize: 20, // 规范要求：原石数量字号
    primogemIcon: {
      path: path.join(__dirname, 'res/wFile/def/icons/ys.png')
    }
  },
  footer: {
    text: "由mCat-ac生成",
    color: "#D3F4FF", // 规范要求：页脚颜色
    versionColor: "#D3F4FF" // 规范要求：版本号颜色
  },
  common: {
    font: {
      family: "'HYWenHei', Microsoft YaHei, Arial, sans-serif"
    }
  }
};

// 处理毛玻璃效果
const glassEffect = (background) => {
  try {
    if (!background || !background.blur) return '';
    return `
      background-color: ${background.color};
      backdrop-filter: blur(${background.blur}px);
      -webkit-backdrop-filter: blur(${background.blur}px);`;
  } catch (error) {
    console.error('Error in glassEffect:', error);
    return 'background-color: rgba(0, 0, 0, 0.4);';
  }
};

// 获取文件的URL路径
const getFileUrl = (filePath) => {
  try {
    // 处理不同系统的路径格式
    const normalizedPath = path.normalize(filePath).replace(/\\/g, '/');
    // 转换为file:// URL格式
    return `file:///${normalizedPath}`;
  } catch (error) {
    console.error('Error in getFileUrl:', error);
    return filePath;
  }
};

// 生成CSS样式
const generateCSS = (config, data) => {
  try {
    // 防御性检查，确保配置对象存在且结构完整
    const safeConfig = {
      page: {
        backgroundColor: "#000000",
        textColor: "#ffffff",
        backgroundImage: "",
        width: "800px",
        height: "1600px",
        ...(config?.page || {})
      },
      header: {
        title: "成就查漏结果",
        titleColor: "#FFD69E",
        titleSize: 60,
        uidColor: "#FFD69E",
        pageInfoColor: "#FFF2E0",
        ...(config?.header || {})
      },
      category: {
        titleColor: "#FFF2E0",
        titleSize: 40,
        background: {
          width: 680,
          borderRadius: 24,
          color: "rgba(0, 0, 0, 0.4)",
          blur: 10,
          shadow: false,
          statsColor: "#FFD69E",
          ...(config?.category?.background || {})
        },
        spacing: 20,
        ...(config?.category || {})
      },
      achievement: {
        showId: true,
        showReward: true,
        showDesc: true,
        background: {
          width: 620,
          height: 80,
          borderRadius: 12,
          color: "rgba(0, 0, 0, 0.6)",
          blur: 0,
          shadow: false,
          ...(config?.achievement?.background || {})
        },
        nameColor: "#FFD69E",
        idColor: "#FFD69E",
        descColor: "#FFD69E",
        rewardColor: "#FFD69E",
        rewardSize: 20,
        primogemIcon: {
          path: '',
          ...(config?.achievement?.primogemIcon || {})
        },
        ...(config?.achievement || {})
      },
      footer: {
        text: "由mCat-ac生成",
        color: "#D3F4FF",
        versionColor: "#D3F4FF",
        ...(config?.footer || {})
      },
      common: {
        font: {
          family: "'HYWenHei', Microsoft YaHei, Arial, sans-serif",
          ...(config?.common?.font || {})
        },
        ...(config?.common || {})
      }
    };

    // 提取配置值，提供默认值作为后备
    const fontSize = {
      title: safeConfig.font?.size?.title || 60, // 规范要求：标题60px
      subtitle: safeConfig.font?.size?.subtitle || 24, // 规范要求：副标题24px
      content: safeConfig.font?.size?.content || 14 // 规范要求：内容14px
    };
    
    const spacing = {
      title: safeConfig.layout?.spacing?.title || 30, // 规范要求：标题间距30px
      subtitle: safeConfig.layout?.spacing?.subtitle || 15, // 规范要求：副标题间距15px
      stats: safeConfig.spacing?.stats || 30, // 规范要求：统计信息间距30px
      category: safeConfig.spacing?.category || 30 // 规范要求：分类间距30px
    };

    // 计算实际的背景图片URL
    let backgroundImage = '';
    // 优先使用传入的背景图片URL（可能来自API）
    if (data?.background) {
      console.log('使用传入的背景图片URL:', data.background);
      backgroundImage = `background-image: url('${data.background}');`;
    } 
    // 如果没有传入的背景图片，再使用配置文件中的背景图片
    else if (safeConfig.page.backgroundImage) {
      // 尝试获取背景图片的实际路径
      const bgPath = path.join(__dirname, 'res/wFile/def/bg', safeConfig.page.backgroundImage);
      backgroundImage = `background-image: url('${getFileUrl(bgPath)}');`;
    }

    // 计算原石图标的实际路径
    let primogemIconUrl = '';
    if (safeConfig.achievement.primogemIcon?.path) {
      primogemIconUrl = getFileUrl(safeConfig.achievement.primogemIcon.path);
    }

    return `
      /* 全局样式 - 使用规范的字体 */
      @font-face {
        font-family: 'HYWenHei';
        src: url('${getFileUrl(path.join(__dirname, 'res/wFile/def/fonts/HYWenHei.ttf'))}') format('truetype');
        font-weight: normal;
        font-style: normal;
      }
      
      * {
        margin: 0;
        padding: 0;
        box-sizing: border-box;
      }
      
      /* 页面基础样式 - 自适应高度以显示所有内容 */
      body {
        font-family: ${safeConfig.common.font.family};
        background-color: ${safeConfig.page.backgroundColor};
        ${backgroundImage}
        background-size: cover;
        background-position: center;
        color: ${safeConfig.page.textColor};
        width: ${safeConfig.page.width};
        min-height: ${safeConfig.page.height};
        overflow: visible;
        display: flex;
        justify-content: center;
        align-items: flex-start;
        padding: 20px 0;
      }
      
      /* 主容器样式 */
      .container {
        width: 100%;
        min-height: ${safeConfig.page.height};
        padding: 40px 60px;
        display: flex;
        flex-direction: column;
        justify-content: flex-start;
        align-items: center;
      }
      
      /* 页眉样式 - 显示标题、UID和页码信息 */
      .header {
        text-align: center;
        margin-bottom: ${spacing.title}px;
        display: flex;
        flex-direction: column;
        align-items: center;
        gap: ${spacing.subtitle}px;
      }
      
      .overall-stats {
        font-size: ${fontSize.subtitle}px;
        color: #FFD69E; /* 规范要求：统计信息 #FFD69E */
        margin-bottom: 5px;
        text-align: center;
        display: flex;
        gap: 50px; /* 增加间距以匹配设计稿要求 */
        justify-content: center;
      }
      
      .header h1 {
        font-size: ${fontSize.title}px; /* 规范要求：成就查漏结果 60px */
        color: #FFD69E; /* 规范要求：成就查漏结果 #FFD69E */
        font-weight: bold;
        margin-bottom: 10px;
        text-align: center;
      }
      
      .uid-info {
        font-size: ${fontSize.subtitle}px; /* 规范要求：uid 24px */
        color: #FFF2E0; /* 规范要求：uid #FFF2E0 */
        margin-bottom: 5px;
        text-align: center;
      }
      
      .page-info {
        font-size: ${fontSize.subtitle}px; /* 规范要求：页数 24px */
        color: #FFF2E0; /* 规范要求：页数 #FFF2E0 */
        text-align: center;
        margin-bottom: 10px;
      }
      
      /* 成就分类容器 - 移除固定高度限制，允许内容自然扩展 */
      .achievement-categories {
        width: 100%;
        display: flex;
        flex-direction: column;
        gap: ${spacing.category}px;
        min-height: 200px;
      }
      
      /* 自定义滚动条 */
      .achievement-categories::-webkit-scrollbar {
        width: 8px;
      }
      
      .achievement-categories::-webkit-scrollbar-track {
        background: rgba(255, 255, 255, 0.1);
        border-radius: 4px;
      }
      
      .achievement-categories::-webkit-scrollbar-thumb {
        background: rgba(255, 215, 0, 0.5);
        border-radius: 4px;
      }
      
      /* 成就分类样式 - 严格按照规范要求的宽度和圆角 */
      .achievement-category {
        margin-bottom: 20px;
        background: rgba(0, 0, 0, 0.4); /* 规范要求：透明度40% */
        backdrop-filter: blur(10px);
        -webkit-backdrop-filter: blur(10px);
        border-radius: 24px; /* 规范要求：圆角24 */
        width: 680px;
        margin-left: auto;
        margin-right: auto;
        box-sizing: border-box;
        overflow: hidden;
      }
      
      /* 分类头部 - 显示分类标题和统计信息 */
      .category-header {
        padding: 15px 20px;
        text-align: center;
      }
      
      .category-title {
        font-size: ${fontSize.subtitle + 10}px; /* 规范要求：成就类目 40px */
        color: #FFF2E0; /* 规范要求：成就类目 #FFF2E0 */
        font-weight: bold;
        margin-bottom: 10px;
        text-align: center;
      }
      
      /* 分类统计信息样式 */
      .category-stats {
        display: flex;
        justify-content: space-between;
        margin-top: 5px;
        padding: 0 20px;
      }
      
      .incomplete-count, .category-reward {
        color: #FFD69E; /* 使用与成就名称相同的颜色 */
        font-size: ${fontSize.subtitle}px;
        font-weight: bold;
      }
      
      /* 成就列表容器 */
      .category-achievements {
        display: flex;
        flex-direction: column;
        gap: 7px;
        padding: 0 30px 30px 30px; /* 将底部内边距从20px改为30px，与左右间距一致 */
        align-items: center;
      }
      
      /* 成就项样式 - 严格按照规范要求的尺寸和样式 */
      .achievement-item {
        background-color: rgba(0, 0, 0, 0.6); /* 规范要求：透明度60% */
        border-radius: 12px; /* 规范要求：圆角12 */
        padding: 12px 15px;
        width: 620px; /* 规范要求：宽度620 */
        height: auto;
        min-height: 70px; /* 调整为更紧凑的高度 */
        display: flex;
        justify-content: center;
        align-items: center;
        margin: 0 auto;
        border: 1px solid transparent; /* 预留边框空间 */
      }
      
      /* 成就主体内容布局 */
      .achievement-main {
        display: flex;
        justify-content: space-between;
        align-items: center;
        width: 100%;
        gap: 10px;
      }
      
      /* 成就内容整体 */
      .achievement-content {
        display: flex;
        flex-direction: column;
        flex: 1;
        align-items: flex-start;
      }
      
      /* 成就名称和ID */
      .achievement-name-id {
        display: flex;
        align-items: center;
        gap: 8px;
        flex: 1;
        margin-bottom: 3px;
      }
      
      .achievement-id {
        font-size: ${fontSize.content}px; /* 规范要求：成就id 14px */
        color: #FFD69E; /* 规范要求：成就id #FFD69E */
      }
      
      /* 成就奖励 */
      .achievement-reward {
        display: flex;
        align-items: flex-end;
        justify-content: flex-end;
        gap: 3px;
        font-size: ${fontSize.subtitle - 4}px; /* 规范要求：原石数量 20px */
        color: #FFD69E; /* 规范要求：原石数量 #FFD69E */
        font-weight: bold;
        min-width: 60px;
      }
      
      .primogem-icon {
        width: auto;
        height: auto;
        max-width: 120px;
        max-height: 120px;
        vertical-align: bottom;
      }
      
      /* 成就名称和描述 */
      .achievement-name {
        font-size: ${fontSize.subtitle}px; /* 使用配置中的副标题大小 */
        color: #FFD69E; /* 规范要求：成就名字 #FFD69E */
        font-weight: bold;
      }
      
      .achievement-desc {
        font-size: ${fontSize.content}px; /* 使用配置中的内容大小 */
        color: #FFD69E; /* 规范要求：成就描述 #FFD69E */
        line-height: 1.3;
        align-self: flex-start;
      }
      
      /* 页脚样式 - 按照规范要求显示生成信息和版本号 */
      .footer {
        margin-top: auto;
        text-align: center;
        padding-top: 20px;
      }
      
      .footer-text {
        color: #D3F4FF; /* 规范要求：页脚 #D3F4FF */
        font-size: ${fontSize.subtitle}px; /* 规范要求：页脚 24px */
        margin-bottom: 5px;
      }
      
      .footer-version {
        color: #D3F4FF; /* 规范要求：版本号 #D3F4FF */
        font-size: ${fontSize.subtitle}px; /* 规范要求：版本号 24px */
      }`;
  } catch (error) {
    console.error('Error in generateCSS:', error);
    // 返回最小化的CSS以避免渲染完全失败
    return `
      @font-face {
        font-family: 'HYWenHei';
        src: url('${getFileUrl(path.join(__dirname, 'res/wFile/def/fonts/HYWenHei.ttf'))}') format('truetype');
      }
      body { font-family: 'HYWenHei', Arial, sans-serif; background-color: #000; color: #fff; width: 800px; height: 1600px; }
      .container { text-align: center; padding: 20px; }
    `;
  }
};

// 生成HTML内容
const renderHtml = async (data) => {
  try {
    // 防御性检查，确保配置对象存在且结构完整
    const inputConfig = data?.config || {};
    const config = {
      page: {
        backgroundColor: "#000000",
        textColor: "#ffffff",
        backgroundImage: "bg.png",
        width: "800px",
        height: "1600px",
        ...(inputConfig?.page || {})
      },
      header: {
        title: "成就查漏结果",
        titleColor: "#FFD69E",
        titleSize: 60,
        uidColor: "#FFF2E0",
        pageInfoColor: "#FFF2E0",
        ...(inputConfig?.header || {})
      },
      category: {
        titleColor: "#FFF2E0",
        titleSize: 40,
        background: {
          width: 680,
          borderRadius: 24,
          color: "rgba(0, 0, 0, 0.4)",
          blur: 10,
          shadow: false,
          statsColor: "#FFD69E",
          ...(inputConfig?.category?.background || {})
        },
        spacing: 30,
        ...(inputConfig?.category || {})
      },
      achievement: {
        showId: true,
        showReward: true,
        showDesc: true,
        background: {
          width: 620,
          height: 80,
          borderRadius: 12,
          color: "rgba(0, 0, 0, 0.6)",
          blur: 0,
          shadow: false,
          ...(inputConfig?.achievement?.background || {})
        },
        nameColor: "#FFD69E",
        idColor: "#FFD69E",
        descColor: "#FFD69E",
        rewardColor: "#FFD69E",
        rewardSize: 20,
        primogemIcon: {
          path: path.join(__dirname, 'res/wFile/def/icons/ys.png'),
          ...(inputConfig?.achievement?.primogemIcon || {})
        },
        ...(inputConfig?.achievement || {})
      },
      footer: {
        text: "由mCat-ac生成",
        color: "#D3F4FF",
        versionColor: "#D3F4FF",
        ...(inputConfig?.footer || {})
      },
      common: {
        font: {
          family: "'HYWenHei', Microsoft YaHei, Arial, sans-serif",
          ...(inputConfig?.common?.font || {})
        },
        ...(inputConfig?.common || {})
      }
    };
    
    // 生成CSS样式，同时传递完整的data对象以支持API背景图片
    const css = generateCSS(config, data);
    
    // 准备成就分类数据
    const categories = {};
    const achievements = Array.isArray(data?.achievements) ? data.achievements : [];
    
    // 首先尝试加载成就系列文件进行精确分类
    try {
      // 创建成就ID到分类名称的完整映射
      const achievementIdToCategory = {};
      
      // 获取成就文件目录
      const achievementFilesDir = path.join(__dirname, 'data', 'mCatAc', 'File');
      
      // 分类文件映射表 - 文件名到中文分类名的映射
      const categoryNames = {
        'mondstadt_the_city_of_wind_and_song.json': '蒙德·风与牧歌的城邦',
        'liyue_the_harbor_of_stone_and_contracts.json': '璃月·岩与契约的海港',
        'inazuma_the_islands_of_thunder_and_eternity_series_i.json': '稻妻·雷与永恒的群岛',
        'inazuma_the_islands_of_thunder_and_eternity_series_ii.json': '稻妻·雷与永恒的群岛',
        'sumeru_the_rainforest_of_lore.json': '须弥·智慧的雨林',
        'sumeru_the_gilded_desert_series_i.json': '须弥·镀金的沙漠',
        'sumeru_the_gilded_desert_series_ii.json': '须弥·镀金的沙漠',
        'fontaine_dance_of_the_dewwhite_springs_i.json': '枫丹·泉水之舞',
        'fontaine_dance_of_the_dewwhite_springs_ii.json': '枫丹·泉水之舞',
        'fontaine_dance_of_the_dewwhite_springs_iii.json': '枫丹·泉水之舞',
        'natlan_the_land_of_fire_and_competition_i.json': '纳塔·火与竞赛之地',
        'natlan_the_land_of_fire_and_competition_ii.json': '纳塔·火与竞赛之地',
        'snezhnaya_does_not_believe_in_tears_series_i.json': '至冬·不相信眼泪',
        'wonders_of_the_world.json': '天地万象',
        'challenger_series_i.json': '挑战者·第一辑',
        'challenger_series_ii.json': '挑战者·第二辑',
        'challenger_series_iii.json': '挑战者·第三辑',
        'challenger_series_iv.json': '挑战者·第四辑',
        'challenger_series_v.json': '挑战者·第五辑',
        'challenger_series_vi.json': '挑战者·第六辑',
        'challenger_series_vii.json': '挑战者·第七辑',
        'challenger_series_viii.json': '挑战者·第八辑',
        'challenger_series_ix.json': '挑战者·第九辑',
        'challenger_series_x.json': '挑战者·第十辑',
        'mortal_travails_series_i.json': '尘歌壶·第一辑',
        'mortal_travails_series_ii.json': '尘歌壶·第二辑',
        'mortal_travails_series_iii.json': '尘歌壶·第三辑',
        'mortal_travails_series_iv.json': '尘歌壶·第四辑',
        'mortal_travails_series_v.json': '尘歌壶·第五辑',
        'the_art_of_adventure.json': '冒险等阶',
        'the_light_of_day.json': '见闻录',
        'a_realm_beyond_series_i.json': '异界的探索·第一辑',
        'a_realm_beyond_series_ii.json': '异界的探索·第二辑',
        'a_realm_beyond_series_iii.json': '异界的探索·第三辑',
        'duelist_series_i.json': '决斗大师·第一辑',
        'duelist_series_ii.json': '决斗大师·第二辑',
        'duelist_series_iii.json': '决斗大师·第三辑',
        'genius_invokation_tcg.json': '七圣召唤',
        'teyvat_fishing_guide_series_i.json': '提瓦特钓鱼指南',
        'elemental_specialist_series_i.json': '元素专家·第一辑',
        'elemental_specialist_series_ii.json': '元素专家·第二辑',
        'marksmanship.json': '神射手',
        'domains_and_spiral_abyss_series_i.json': '秘境与深境螺旋',
        'repertoire_of_myriad_melodies.json': '万曲复调',
        'rhapsodia_in_the_ancient_sea.json': '古海的狂想曲',
        'chenyus_splendor.json': '沉玉谷的荣光',
        'stone_harbors_nostalgia_series_i.json': '石港旧忆',
        'memories_of_the_heart.json': '心的记忆',
        'a_summer_of_ash_and_prickly_pears.json': '灰烬与金梨的夏日',
        'blessed_hamada.json': '赐福的绿洲',
        'chasmlighter.json': '深境燃灯者',
        'imaginarium_theater_the_first_folio.json': '幻戏剧场·第一幕',
        'imaginarium_theater_the_second_folio.json': '幻戏剧场·第二幕',
        'meetings_in_outrealm_series_i.json': '异界相遇·第一辑',
        'meetings_in_outrealm_series_ii.json': '异界相遇·第二辑',
        'meetings_in_outrealm_series_iii.json': '异界相遇·第三辑',
        'meetings_in_outrealm_series_iv.json': '异界相遇·第四辑',
        'meetings_in_outrealm_series_v.json': '异界相遇·第五辑',
        'meetings_in_outrealm_series_vi.json': '异界相遇·第六辑',
        'nodkrai_an_elysium_of_moonlight_and_wanderings_i.json': '诺特克拉伊·月光与流浪的乐土',
        'olah_series_i.json': '奥拉·第一辑',
        'sacred_mountains_fading_glow.json': '圣山的残晖',
        'the_chronicles_of_the_sea_of_fog.json': '雾海纪行',
        'the_heros_journey.json': '英雄之旅',
        'visitors_on_the_icy_mountain.json': '冰峰来客'
      };
      
      // 手动添加特殊测试ID的分类
      achievementIdToCategory[1001] = '基础玩法';
      achievementIdToCategory[1002] = '基础玩法';
      
      // 遍历所有成就文件并建立映射 - 直接从文件中读取分类名
      try {
        const files = await fs.readdir(achievementFilesDir);
        let processedFiles = 0;
        
        for (const file of files) {
          if (file.endsWith('.json')) {
            const filePath = path.join(achievementFilesDir, file);
            try {
              const fileContent = await fs.readFile(filePath, 'utf8');
              const data = JSON.parse(fileContent);
              
              // 直接从文件中读取分类名
              let categoryName = data.name || '未分类';
              
              // 如果文件中没有name字段，并且在categoryNames中有映射，则使用映射
              if (categoryName === '未分类' && categoryNames[file]) {
                categoryName = categoryNames[file];
              }
              
              // 处理文件中的成就列表
              if (Array.isArray(data.achievements)) {
                data.achievements.forEach(achievement => {
                  if (achievement.id) {
                    achievementIdToCategory[achievement.id] = categoryName;
                  }
                });
                processedFiles++;
                console.log(`成功处理成就文件: ${file}，分类名: ${categoryName}，包含 ${data.achievements.length} 个成就`);
              }
            } catch (err) {
              console.warn(`读取成就文件 ${file} 失败:`, err.message);
            }
          }
        }
        
        console.log(`成功建立成就ID到分类的映射，共处理 ${processedFiles} 个成就文件，映射 ${Object.keys(achievementIdToCategory).length} 个成就`);
      } catch (err) {
        console.error('读取成就文件目录失败:', err.message);
      }
      
      // 备用ID范围映射（当文件读取失败时使用）
      const fallbackIdRanges = [
        { min: 80000, max: 81000, name: '蒙德·风与牧歌的城邦' },
        { min: 81000, max: 82000, name: '璃月·岩与契约的海港' },
        { min: 84000, max: 86000, name: '稻妻·雷与永恒的群岛' },
        { min: 86000, max: 89000, name: '须弥·智慧的雨林' },
        { min: 89000, max: 90000, name: '枫丹·泉水之舞' },
        { min: 90000, max: 91000, name: '纳塔·火与竞赛之地' },
        { min: 1000, max: 2000, name: '基础玩法' }
      ];
      
      // 对成就进行分类
      achievements.forEach(ac => {
        let categoryName = '未分类';
        
        // 优先使用精确ID映射
        if (ac?.id && achievementIdToCategory[ac.id]) {
          categoryName = achievementIdToCategory[ac.id];
        } else if (ac?.id) {
          const id = Number(ac.id);
          if (!isNaN(id)) {
            // 使用ID范围进行备用分类
            const matchedRange = fallbackIdRanges.find(range => id >= range.min && id < range.max);
            if (matchedRange) {
              categoryName = matchedRange.name;
            }
          }
        }
        
        // 将成就添加到对应分类
        if (!categories[categoryName]) {
          categories[categoryName] = [];
        }
        categories[categoryName].push(ac);
      });
    } catch (error) {
      console.error('加载成就分类数据失败:', error);
      // 回退到简单的分类方式
      achievements.forEach(ac => {
        const categoryName = '未分类';
        if (!categories[categoryName]) {
          categories[categoryName] = [];
        }
        categories[categoryName].push(ac);
      });
    }
    
    // 生成HTML
    return `
      <!DOCTYPE html>
      <html lang="zh-CN">
      <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>${config?.page?.title || '成就查漏结果'}</title>
        <style>
          ${css}
        </style>
      </head>
      <body>
        <div class="container">
          <div class="header">
            <h1>${config?.header?.title || '成就查漏结果'}</h1>
            <div class="uid-info">uid: ${data?.uid || '未知UID'}</div>
            <div class="overall-stats">
              <span>已完成:${data?.completedCount || 0}</span>
              <span>未完成:${data?.incompleteCount || 0}</span>
              <span>可获得原石:${data?.totalRewards || 0}</span>
            </div>
            <div class="page-info">第${data?.currentPage || 1}/${data?.totalPages || 1}页</div>
          </div>
          
          <div class="achievement-categories">
            ${Object.entries(categories).map(([category, items]) => {
              try {
                const rewardTotal = items.reduce((sum, ac) => sum + (Number(ac?.reward) || 0), 0);
                  return `
                    <div class="achievement-category">
                      <div class="category-header">
                        <h2 class="category-title">${category}</h2>
                        <div class="category-stats">
                          <span class="incomplete-count">还有${items.length}个成就未完成</span>
                          <span class="category-reward">可获得原石:${rewardTotal}</span>
                        </div>
                      </div>
                      <div class="category-achievements">
                        ${items.map(ac => `
                          <div class="achievement-item">
                              <div class="achievement-main">
                                <div class="achievement-content">
                                  <div class="achievement-name-id">
                                    <span class="achievement-name">${ac?.name || '未知成就'}</span>
                                    ${config?.achievement?.showId !== false ? `<span class="achievement-id">id:${ac?.id || '-'}</span>` : ''}
                                  </div>
                                  ${config?.achievement?.showDesc !== false ? `<div class="achievement-desc">${ac?.desc || ''}</div>` : ''}
                                </div>
                                ${config?.achievement?.showReward !== false ? 
                                  `<div class="achievement-reward">
                                    <span>${ac?.reward || 0}</span>
                                    <img class="primogem-icon" src="${config?.achievement?.primogemIcon?.path || ''}" alt="primogem" />
                                  </div>` : ''}
                              </div>
                            </div>
                        `).join('')}
                      </div>
                    </div>
                  `;
              } catch (error) {
                console.error(`Error rendering category ${category}:`, error);
                return `<div class="achievement-category"><div class="category-header"><h3 class="category-title">${category}</h3></div></div>`;
              }
            }).join('')}
          </div>
          
          <div class="footer">
          <div class="footer-text">由mCat-ac生成</div>
          <div class="footer-version">v${global.mCatAcVersion || '1.0.0'}</div>
        </div>
        </div>
      </body>
      </html>
    `;
  } catch (error) {
    console.error('Error in renderHtml:', error);
    // 返回一个基本的HTML结构，确保不会完全失败
    return `
      <!DOCTYPE html>
      <html lang="zh-CN">
      <head>
        <meta charset="UTF-8">
        <title>成就查漏结果</title>
        <style>
          body { font-family: Arial, sans-serif; background-color: #000; color: #fff; width: 800px; height: 1600px; display: flex; justify-content: center; align-items: center; text-align: center; }
        </style>
      </head>
      <body>
        <div>
          <h1>成就查漏结果</h1>
          <p>uid: ${data?.uid || '未知UID'}</p>
          <p>数据加载中...</p>
        </div>
      </body>
      </html>
    `;
  }
};

// 导出函数
export { renderHtml, generateCSS, defaultConfig };
export default { renderHtml, generateCSS, defaultConfig };