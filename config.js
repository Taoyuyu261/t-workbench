/*
 * 配置文件
 * 1) 登录：用户名 Taoyuji / 密码 0209t（此处只存 SHA-256 哈希，页面源码看不到明文。
 *    注意：纯前端校验只能防误触/防路人，不是银行级安全——请勿在此存真实隐私数据。）
 * 2) Supabase 云端同步（可选，留空则用本地存储）：
 *    把下面两项填好（从你的 Supabase 项目后台获取），即可开启云端同步 + 跨端记忆。
 */
window.APP_CONFIG = {
  // ===== 登录校验（SHA-256，与输入实时对比）=====
  LOGIN_USER: "Taoyuji",
  LOGIN_USER_HASH: "dd600b93c1ba445a04ef9ea309fc9a797fbf5f9b21e5a7fc34c4cf50f2d66840",
  LOGIN_PASS_HASH: "6334534f88805124110394266cc6a710755aa225373d51464a6c3dbc80cc5e65",

  // ===== Supabase（留空 = 本地模式，数据存浏览器 localStorage）=====
  SUPABASE_URL: "",        // 例如 https://xxxx.supabase.co
  SUPABASE_ANON_KEY: "",   // 你的 anon public key

  // ===== 新闻 RSS 代理（无 Supabase 时的兜底方案）=====
  RSS_PROXY: "https://api.allorigins.win/raw?url=",

  // ===== 新闻五大板块 -> RSS 源列表 =====
  FEEDS: {
    ai: [
      "https://www.theverge.com/rss/ai-artificial-intelligence/index.xml",
      "https://feeds.arstechnica.com/arstechnica/index"
    ],
    finance: [
      "https://www.cnbc.com/id/10000664/device/rss/rss.html",
      "https://www.investing.com/rss/news.rss"
    ],
    domestic: [
      "http://www.chinanews.com/rss/scroll-news.xml"
    ],
    world: [
      "https://feeds.bbci.co.uk/news/world/rss.xml"
    ],
    health: [
      "https://www.healthline.com/rss"
    ]
  }
};
