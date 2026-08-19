# 副园长个人工作台

一个手机/电脑都能用的个人工作台：每日计划、锻炼记录（对接小米手环 8）、领导金句、学前教育每日推文、新闻窗口（AI / 金融 / 国内 / 国际 / 养生）。数据可云端持久化、跨端同步。

---

## 一、现在就能用（无需任何配置）

直接打开 `index.html`（或访问已部署的网址）即可。此时为**本地模式**：
- 所有数据存在你当前这个浏览器的本地存储里；
- 换设备、清缓存、用无痕模式 → 数据看不到。**这正是不开云端时的"没有记忆"状态**，不是 bug。

要真正"有记忆、跨端"，请按第二步开启 Supabase。

---

## 二、开启云端同步（永久记忆 + 电脑手机同一份数据）

1. 打开 https://supabase.com ，用邮箱注册一个免费项目（Free 套餐足够个人用）。
2. 项目后台 → **SQL Editor** → 粘贴 `supabase/schema.sql` 全部内容并执行，创建数据表并开启行级安全。
3. 项目后台 → **Authentication → Providers**，确认 Email 已开启。
4. 项目后台 → **Project Settings → API**，复制：
   - `Project URL` → 填进 `config.js` 的 `SUPABASE_URL`
   - `anon public key` → 填进 `config.js` 的 `SUPABASE_ANON_KEY`
5. 重新打开工作台，用同一个邮箱注册/登录，手机和电脑登录同一账号即可共享数据。

> 数据按"用户 + 日期"隔离存储，每天一份，长期保留。

---

## 三、永久部署（电脑 + 手机长期可访问）

CloudStudio 预览方便，但沙箱不保证"永久"。真正永久的免费组合是：**静态托管（前端） + Supabase（数据）**。

任选其一托管前端（把整个 `workbench/` 目录传上去）：
- **Netlify**：拖拽 `workbench/` 文件夹到 https://app.netlify.com/drop 即可，自动生成永久网址。
- **GitHub Pages**：把 `workbench/` 推到仓库，开启 Pages。
- **CloudStudio**：当前已部署，适合先看效果。

手机端：用手机浏览器打开该网址 → 点"添加到主屏幕"，即变成一个 App 图标，体验接近原生。

---

## 四、小米手环 8 自动同步（诚实说明）

网页**无法直接读取** Health Connect（安卓原生 API）。可行链路如下，需你在安卓手机上配置一次：

1. 手机装 **小米运动健康**，确保手环数据已同步到手机；
2. 在手机"设置 → 健康数据共享"中开启 **Health Connect**，并授权小米运动健康写入；
3. 用自动化工具（如 **Tasker** 或 **Automate by LlamaLab**）定时读取 Health Connect 的步数/心率/睡眠，调用下面的接口写入 Supabase：

```
POST {SUPABASE_URL}/rest/v1/app_data
Headers:
  apikey: {SUPABASE_ANON_KEY}
  Authorization: Bearer {登录用户的JWT}
  Content-Type: application/json
Body:
{
  "uid": "{用户ID}",
  "date": "2026-08-18",
  "kind": "exercise",
  "payload": { "steps": 8000, "hr": 70, "sleep": 420, "active": 30, "source": "auto" }
}
```

> 注意：Bearer 需要登录用户的 JWT（有时效）。最稳妥的生产做法是由一个**带服务密钥的小后端**来写，避免在前端暴露密钥。当前网页端"手动录入"已可用且零风险，建议作为日常主力；自动同步作为进阶项按需搭建。

---

## 五、自定义内容

- **领导金句 / 幼教推文**：编辑 `data.js`，往 `quotes` / `ece` 数组加对象即可，系统按日期自动轮换。
- **新闻源**：编辑 `config.js` 的 `FEEDS`，按板块增删 RSS 地址。国内部分源可能不稳定或被跨域拦截，可替换为你能访问的源；也可把 `RSS_PROXY` 改成你自己的 Supabase 边缘函数（见 `supabase/rss-proxy.ts`），更稳。

---

## 六、已知限制

- 本地模式数据不跨设备；开启 Supabase 后解决。
- 新闻依赖外部 RSS，个别源可能失效，属正常现象，替换源即可。
- 自动同步需安卓端手动配置，非开箱即用。
