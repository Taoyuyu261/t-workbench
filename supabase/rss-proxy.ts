// Supabase 边缘函数：RSS 代理（服务端抓取，绕过浏览器跨域限制）
// 部署：supabase functions deploy rss-proxy
// 调用：{SUPABASE_URL}/functions/v1/rss-proxy?url=<编码后的RSS地址>
// 然后把 config.js 的 RSS_PROXY 改为上面的地址（末尾保留 ?url=）

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

serve(async (req) => {
  const url = new URL(req.url).searchParams.get("url");
  if (!url) return new Response("missing url", { status: 400 });

  try {
    const r = await fetch(url, {
      headers: { "User-Agent": "Mozilla/5.0 (compatible; WorkbenchRSS/1.0)" },
    });
    const t = await r.text();
    return new Response(t, {
      headers: {
        "Access-Control-Allow-Origin": "*",
        "Content-Type": "application/xml; charset=utf-8",
      },
    });
  } catch (e) {
    return new Response("fetch failed: " + String(e), { status: 500 });
  }
});
