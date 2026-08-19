(function () {
  "use strict";
  const CFG = window.APP_CONFIG || {};
  const DATA = window.DATA || { quotes: [], ece: [] };
  const useSupabase = !!(CFG.SUPABASE_URL && CFG.SUPABASE_ANON_KEY);
  let sb = null, session = null;

  // Supabase SDK 按需动态加载（本地模式零外链，不受 CDN 影响）
  function loadSupabaseSDK() {
    return new Promise((resolve, reject) => {
      if (window.supabase) return resolve(window.supabase);
      const s = document.createElement("script");
      s.src = "https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2";
      s.onload = () => resolve(window.supabase);
      s.onerror = () => reject(new Error("SDK 加载失败"));
      document.head.appendChild(s);
    });
  }
  if (useSupabase) {
    loadSupabaseSDK()
      .then((sdk) => { sb = sdk.createClient(CFG.SUPABASE_URL, CFG.SUPABASE_ANON_KEY); initAuth(); })
      .catch(() => { $("authArea").innerHTML = '<span class="badge warn">云端连接失败·已用本地模式</span>'; });
  }

  // ---------- 轻提示 toast（替代 alert） ----------
  function toast(msg, type) {
    const wrap = $("toastWrap");
    if (!wrap) return;
    const t = document.createElement("div");
    t.className = "toast" + (type ? " " + type : "");
    t.innerHTML = '<svg viewBox="0 0 24 24" width="15" height="15" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round">' +
      (type === "warn"
        ? '<path d="M12 8v5M12 16.5v.5"/><circle cx="12" cy="12" r="9"/>'
        : '<path d="M20 6L9 17l-5-5"/>') + '</svg><span>' + esc(msg) + '</span>';
    wrap.appendChild(t);
    requestAnimationFrame(() => t.classList.add("show"));
    setTimeout(() => {
      t.classList.remove("show");
      setTimeout(() => t.remove(), 350);
    }, 2400);
  }

  const $ = (id) => document.getElementById(id);
  const esc = (s) => (s == null ? "" : String(s)).replace(/[<>&"]/g, (c) => ({ "<": "&lt;", ">": "&gt;", "&": "&amp;", '"': "&quot;" }[c]));
  const pad = (n) => String(n).padStart(2, "0");
  const todayStr = () => {
    const d = new Date();
    return d.getFullYear() + "-" + pad(d.getMonth() + 1) + "-" + pad(d.getDate());
  };
  const TODAY = todayStr();
  const weekday = () => ["日", "一", "二", "三", "四", "五", "六"][new Date().getDay()];
  const dayIndex = () => Math.floor(Date.now() / 86400000);
  const addDays = (date, n) => { const d = new Date(date); d.setDate(d.getDate() + n); return d; };
  const dateStr = (d) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;

  let currentView = "agenda";
  let currentRange = "today";

  // ---------- 登录门（固定账号密码，SHA-256 校验，记住登录态） ----------
  const AUTH_KEY = "wb_auth_ok";
  async function sha256(str) {
    const buf = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(str));
    return Array.from(new Uint8Array(buf)).map((b) => b.toString(16).padStart(2, "0")).join("");
  }
  function isAuthed() {
    try { return localStorage.getItem(AUTH_KEY) === "1"; } catch (e) { return true; }
  }
  function showGate() { $("loginGate").classList.remove("hidden"); }
  function hideGate() { $("loginGate").classList.add("hidden"); }
  $("loginForm").onsubmit = async (e) => {
    e.preventDefault();
    if (!window.crypto || !crypto.subtle) {
      $("loginErr").textContent = "当前环境不支持登录校验（需 HTTPS 打开）。";
      return;
    }
    const u = $("loginUser").value.trim();
    const p = $("loginPass").value;
    try {
      const uh = await sha256(u);
      const ph = await sha256(p);
      if (uh !== CFG.LOGIN_USER_HASH || ph !== CFG.LOGIN_PASS_HASH) throw new Error("auth fail");
      localStorage.setItem(AUTH_KEY, "1");
      document.querySelector(".app").style.visibility = "";
      hideGate();
      $("loginErr").textContent = "";
      $("loginPass").value = "";
      toast("欢迎回来，T先生");
    } catch (err) {
      $("loginErr").textContent = "用户名或密码不对，再试一次。";
      const g = $("loginGate");
      g.classList.remove("shake"); void g.offsetWidth; g.classList.add("shake");
    }
  };
  $("logoutBtn").onclick = () => {
    localStorage.removeItem(AUTH_KEY);
    $("loginUser").value = ""; $("loginPass").value = ""; $("loginErr").textContent = "";
    document.querySelector(".app").style.visibility = "hidden";
    showGate();
    closeNav();
  };
  // 启动时：已登录直接进；未登录显示登录页并隐藏主界面
  if (isAuthed()) { hideGate(); }
  else { showGate(); document.querySelector(".app").style.visibility = "hidden"; }

  // ---------- 板块内搜索（新闻 / 幼教） ----------
  let newsFilter = "";
  let eceFilter = "";
  $("newsSearch").oninput = (e) => { newsFilter = e.target.value.trim(); loadNews(); };
  $("eceSearch").oninput = (e) => { eceFilter = e.target.value.trim(); renderEce(); };

  // ---------- 数据备份（导出 / 导入） ----------
  $("exportBtn").onclick = () => {
    const dump = { app: "T先生的工作台", exportedAt: new Date().toISOString(), data: {} };
    for (let i = 0; i < localStorage.length; i++) {
      const k = localStorage.key(i);
      if (k && k.indexOf("wb_") === 0 && k !== AUTH_KEY) dump.data[k] = localStorage.getItem(k);
    }
    const blob = new Blob([JSON.stringify(dump, null, 2)], { type: "application/json" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = "T先生工作台备份_" + TODAY.replace(/-/g, "") + ".json";
    a.click();
    URL.revokeObjectURL(a.href);
    toast("备份已下载，请妥善保存");
  };
  $("importBtn").onclick = () => $("importFile").click();
  $("importFile").onchange = (e) => {
    const f = e.target.files[0];
    if (!f) return;
    const r = new FileReader();
    r.onload = () => {
      try {
        const dump = JSON.parse(r.result);
        if (!dump || !dump.data) throw new Error("bad format");
        Object.keys(dump.data).forEach((k) => localStorage.setItem(k, dump.data[k]));
        toast("恢复完成，即将刷新");
        setTimeout(() => location.reload(), 900);
      } catch (err) {
        toast("文件不是有效的备份", "warn");
      }
    };
    r.readAsText(f);
    e.target.value = "";
  };

  // ---------- 存储层 ----------
  async function load(kind, fallback) {
    if (useSupabase && session) {
      const { data } = await sb.from("app_data").select("payload")
        .eq("uid", session.user.id).eq("date", TODAY).eq("kind", kind).maybeSingle();
      return data && data.payload != null ? data.payload : fallback;
    }
    const v = localStorage.getItem("wb_" + kind + "_" + TODAY);
    return v ? JSON.parse(v) : fallback;
  }
  async function save(kind, payload) {
    if (useSupabase && session) {
      await sb.from("app_data").upsert(
        { uid: session.user.id, date: TODAY, kind, payload, updated_at: new Date().toISOString() },
        { onConflict: "uid,date,kind" }
      );
      return;
    }
    localStorage.setItem("wb_" + kind + "_" + TODAY, JSON.stringify(payload));
  }
  // agenda 全周期存储（30天内）
  async function loadAgendaAll() {
    if (useSupabase && session) {
      const { data } = await sb.from("agenda_items").select("*").eq("uid", session.user.id);
      return data || [];
    }
    const v = localStorage.getItem("wb_agenda_all");
    return v ? JSON.parse(v) : [];
  }
  async function saveAgendaAll(arr) {
    if (useSupabase && session) {
      // 简化：用 delete + insert
      await sb.from("agenda_items").delete().eq("uid", session.user.id);
      if (arr.length) {
        await sb.from("agenda_items").insert(arr.map((x) => ({ ...x, uid: session.user.id })));
      }
      return;
    }
    localStorage.setItem("wb_agenda_all", JSON.stringify(arr));
  }

  // ---------- 登录 ----------
  async function initAuth() {
    if (!useSupabase) {
      $("authArea").innerHTML = '<span class="badge warn">本地模式</span>';
      $("storageMode").textContent = "数据仅存当前浏览器；开通云端请按 README 配置 Supabase";
      return;
    }
    $("storageMode").textContent = "云端同步 · Supabase";
    const { data } = await sb.auth.getSession();
    session = data.session;
    renderAuth();
    sb.auth.onAuthStateChange((_e, s) => {
      session = s; renderAuth();
      if (s) showView(currentView);
    });
  }
  function renderAuth() {
    const a = $("authArea");
    if (session) {
      a.innerHTML = '<span class="badge ok">' + esc(session.user.email) + '</span> <button id="logoutBtn" class="mini">退出</button>';
      $("logoutBtn").onclick = async () => { await sb.auth.signOut(); };
    } else {
      a.innerHTML = '<input id="email" placeholder="邮箱" /><input id="pw" type="password" placeholder="密码" />' +
        '<button id="loginBtn" class="mini">登录</button><button id="signupBtn" class="mini">注册</button>';
      $("loginBtn").onclick = async () => {
        const { error } = await sb.auth.signInWithPassword({ email: $("email").value, password: $("pw").value });
        if (error) alert("登录失败：" + error.message);
      };
      $("signupBtn").onclick = async () => {
        const { error } = await sb.auth.signUp({ email: $("email").value, password: $("pw").value });
        if (error) alert("注册失败：" + error.message);
        else alert("注册成功，请查收验证邮件后登录（同一账号可在手机/电脑登录）。");
      };
    }
  }

  // ---------- feeds.json ----------
  let feedsCache = null;
  async function loadFeeds() {
    if (feedsCache) return feedsCache;
    try {
      const res = await fetch("feeds.json?ts=" + Date.now());
      if (!res.ok) throw new Error("feeds fetch fail");
      feedsCache = await res.json();
      return feedsCache;
    } catch (e) { feedsCache = null; return null; }
  }

  // ---------- 计划日程（每日事项） ----------
  async function getAgenda() {
    return await loadAgendaAll();
  }
  async function addAgenda(date, label) {
    const items = await getAgenda();
    items.push({ id: Date.now() + "-" + Math.random().toString(36).slice(2, 6), date, label, done: false, createdAt: new Date().toISOString() });
    await saveAgendaAll(items);
    return items;
  }

  function updateKpis(all) {
    const todayItems = all.filter((x) => x.date === TODAY);
    const todayDone = todayItems.filter((x) => x.done).length;
    $("kpiDone").textContent = todayDone + "/" + todayItems.length;
    const thisMonth = new Date().toISOString().slice(0, 7);
    const monthDone = all.filter((x) => x.done && (x.date || "").startsWith(thisMonth)).length;
    $("kpiMonth").textContent = monthDone + " 件";
    const in7 = dateStr(addDays(TODAY, 7));
    const weekItems = all.filter((x) => !x.done && x.date >= TODAY && x.date <= in7).length;
    $("kpiWeek").textContent = weekItems + " 件";
  }

  async function renderAgenda() {
    const all = await getAgenda();
    const list = $("agendaList");

    // KPI
    updateKpis(all);

    // 月历条
    renderCalStrip(all);

    // 根据当前 range 过滤
    let filtered = todayItems;
    $("agendaLabel").textContent = "今日待办";
    if (currentRange === "week") {
      const start = TODAY;
      const end = dateStr(addDays(TODAY, 7));
      filtered = all.filter((x) => x.date >= start && x.date <= end);
      $("agendaLabel").textContent = "近一周待办";
    } else if (currentRange === "month") {
      const start = TODAY;
      const end = dateStr(addDays(TODAY, 30));
      filtered = all.filter((x) => x.date >= start && x.date <= end);
      $("agendaLabel").textContent = "近一月待办";
    }

    list.innerHTML = "";
    filtered.sort((a, b) => (a.date || "").localeCompare(b.date || ""));
    if (!filtered.length) {
      list.innerHTML = '<li class="empty">还没有事务，点上面的「＋ 添加事务」先写下一件。</li>';
      return;
    }
    filtered.forEach((it, i) => {
      const li = document.createElement("li");
      li.className = "agenda-row rise" + (it.done ? " done" : "");
      li.style.animationDelay = Math.min(i * 0.06, 0.4) + "s";
      const dStr = it.date;
      const showDate = dStr && dStr !== TODAY;
      li.innerHTML =
        '<button class="ag-check' + (it.done ? " done" : "") + '" aria-label="完成"></button>' +
        (showDate ? '<span class="date-chip">' + esc(dStr.slice(5)) + '</span>' : '') +
        '<span class="label">' + esc(it.label) + '</span>' +
        '<button class="ag-del" title="删除">✕</button>';
      li.querySelector(".ag-check").onclick = async () => {
        it.done = !it.done;
        await saveAgendaAll(all);
        // 局部更新该行 + 刷新 KPI（不重绘整个列表）
        li.classList.toggle("done", it.done);
        li.querySelector(".ag-check").classList.toggle("done", it.done);
        updateKpis(all);
      };
      li.querySelector(".ag-del").onclick = async (e) => {
        e.stopPropagation();
        const idx = all.indexOf(it);
        if (idx > -1) all.splice(idx, 1);
        await saveAgendaAll(all);
        renderAgenda();
      };
      list.appendChild(li);
    });
  }

  function renderCalStrip(all) {
    const wrap = $("calStrip");
    wrap.innerHTML = "";
    const today = new Date();
    for (let i = 0; i < 30; i++) {
      const d = addDays(today, i - 2); // 从前两天开始
      const ds = dateStr(d);
      const has = all.some((x) => x.date === ds);
      const isToday = ds === TODAY;
      const div = document.createElement("button");
      div.className = "cal-day" + (isToday ? " today" : (has ? " has" : ""));
      div.innerHTML = '<span class="d">' + ["日","一","二","三","四","五","六"][d.getDay()] + '</span>' +
        '<span class="n">' + d.getDate() + '</span>' +
        '<span class="dot-count"></span>';
      div.onclick = () => {
        $("agDate").value = ds;
      };
      wrap.appendChild(div);
    }
  }

  $("agendaForm").onsubmit = async (e) => {
    e.preventDefault();
    const text = $("agText").value.trim();
    if (!text) return;
    const date = $("agDate").value || TODAY;
    await addAgenda(date, text);
    $("agText").value = "";
    renderAgenda();
  };

  document.querySelectorAll(".range-tabs .rtab").forEach((b) => {
    b.onclick = () => {
      if (b.classList.contains("js-add")) {
        $("agDate").value = TODAY;
        $("agText").focus();
        return;
      }
      document.querySelectorAll(".range-tabs .rtab").forEach((x) => x.classList.toggle("active", x === b));
      currentRange = b.dataset.range;
      renderAgenda();
    };
  });

  // ---------- 今日计划 ----------
  async function renderPlans() {
    const items = await load("plans", []);
    const list = $("planList");
    list.innerHTML = "";
    if (!items.length) { list.innerHTML = '<li class="empty">还没有计划，先写下第一条吧。</li>'; return; }
    items.sort((a, b) => (a.time || "").localeCompare(b.time || ""));
    items.forEach((it, i) => {
      const li = document.createElement("li");
      li.className = "plan-item rise" + (it.done ? " done" : "");
      li.style.animationDelay = Math.min(i * 0.06, 0.4) + "s";
      const time = it.time ? '<span class="ptime">' + esc(it.time) + "</span>" : '<span class="ptime">·</span>';
      li.innerHTML = '<button class="plan-check" aria-label="完成"></button>' + time + '<span class="ptext">' + esc(it.text) + '</span><button class="del" title="删除">✕</button>';
      // 勾选：局部更新该行（避免整列表重绘导致动画重放）
      const toggle = () => {
        items[i].done = !items[i].done;
        save("plans", items);
        li.classList.toggle("done", items[i].done);
      };
      li.querySelector(".plan-check").onclick = toggle;
      li.querySelector(".ptext").onclick = toggle;
      li.querySelector(".del").onclick = (e) => { e.stopPropagation(); items.splice(i, 1); save("plans", items); renderPlans(); };
      list.appendChild(li);
    });
  }
  $("planForm").onsubmit = async (e) => {
    e.preventDefault();
    const text = $("planInput").value.trim();
    if (!text) return;
    const items = await load("plans", []);
    items.push({ time: $("planTime").value, text, done: false });
    await save("plans", items);
    $("planInput").value = ""; $("planTime").value = "";
    document.querySelectorAll(".time-chips button").forEach((b) => b.classList.remove("active"));
    renderPlans();
  };
  // 时间 chip 选择交互
  document.querySelectorAll(".time-chips button").forEach((b) => {
    b.onclick = () => {
      document.querySelectorAll(".time-chips button").forEach((x) => x.classList.toggle("active", x === b));
      $("planTime").value = b.dataset.t;
    };
  });

  // ---------- 锻炼记录：4 板块 ----------
  let sportsDraft = [];
  async function renderExercise() {
    const ex = await load("exercise", null);
    if (ex) {
      $("exSteps").value = ex.steps || "";
      $("exFeel").value = ex.feel || "";
      $("exTomorrow").value = ex.tomorrow || "";
      sportsDraft = ex.sports || [];
    } else {
      sportsDraft = [];
    }
    drawSportRows();
    drawStepRing();
  }
  function drawSportRows() {
    const box = $("sportRows");
    box.innerHTML = "";
    if (!sportsDraft.length) {
      sportsDraft = [{ name: "", min: "", kcal: "" }];
    }
    sportsDraft.forEach((sp, idx) => {
      const tpl = $("sportTpl");
      const node = tpl.content.firstElementChild.cloneNode(true);
      node.querySelector(".sp-name").value = sp.name || "";
      node.querySelector(".sp-min").value = sp.min || "";
      node.querySelector(".sp-kcal").value = sp.kcal || "";
      node.querySelector(".sp-name").oninput = (e) => { sportsDraft[idx].name = e.target.value; };
      node.querySelector(".sp-min").oninput = (e) => { sportsDraft[idx].min = e.target.value; };
      node.querySelector(".sp-kcal").oninput = (e) => { sportsDraft[idx].kcal = e.target.value; };
      node.querySelector(".sp-del").onclick = () => {
        sportsDraft.splice(idx, 1);
        drawSportRows();
      };
      box.appendChild(node);
    });
    drawStepRing();
  }
  function drawStepRing() {
    const val = parseInt($("exSteps").value || "0", 10) || 0;
    const target = 8000;
    const pct = Math.min(100, Math.round((val / target) * 100));
    $("stepVal").textContent = val;
    $("stepRing").style.setProperty("--p", pct);
  }
  $("exSteps").oninput = drawStepRing;
  $("addSportBtn").onclick = () => {
    sportsDraft.push({ name: "", min: "", kcal: "" });
    drawSportRows();
  };
  $("saveExerciseBtn").onclick = async () => {
    const ex = {
      steps: $("exSteps").value,
      sports: sportsDraft.filter((s) => s.name || s.min || s.kcal),
      feel: $("exFeel").value,
      tomorrow: $("exTomorrow").value,
      source: "manual",
      at: new Date().toISOString(),
    };
    await save("exercise", ex);
    toast("今日锻炼记录已保存");
  };

  // ---------- 领导金句：每日搜索入库 + 换一批 ----------
  let quoteOffset = 0;
  function quotePool() {
    // 池子 = 今日 feeds 搜索结果（主） + 内置兜底（去重补充），点"换一批"在池内轮换
    const f = feedsCache && feedsCache.sections && feedsCache.sections.quotes;
    const pool = [];
    if (f && f.length) pool.push(...f);
    (DATA.quotes || []).forEach((q) => { if (!pool.some((x) => x.text === q.text)) pool.push(q); });
    return pool;
  }
  function renderQuotes() {
    const pool = quotePool();
    const list = $("quoteList");
    list.innerHTML = "";
    if (!pool.length) {
      list.innerHTML = '<p class="muted">今日金句生成中，稍后再来看看。</p>';
      return;
    }
    const n = pool.length;
    const three = [];
    for (let i = 0; i < Math.min(3, n); i++) three.push(pool[(quoteOffset + i) % n]);
    three.forEach((q, i) => {
      const c = document.createElement("div");
      c.className = "quote-card rise";
      c.style.animationDelay = (i * 0.12) + "s";
      c.innerHTML = '<blockquote>' + esc(q.text) + '</blockquote>' + (q.scene ? '<span class="tag">风格：' + esc(q.scene) + '</span>' : '');
      list.appendChild(c);
    });
  }
  $("quoteShuffle").onclick = () => {
    const pool = quotePool();
    if (!pool.length) return;
    quoteOffset = (quoteOffset + 3) % pool.length;
    renderQuotes();
  };

  // ---------- 幼教推文：5 条/天（feeds 优先，直接展示今日搜到的 5 条） ----------
  function pickEce() {
    const f = feedsCache && feedsCache.sections && feedsCache.sections.ece;
    if (f && f.length) return f.slice(0, 5);
    return DATA.ece || [];
  }
  function renderEce() {
    let arr = pickEce();
    if (eceFilter) {
      const kw = eceFilter.toLowerCase();
      arr = arr.filter((it) => ((it.title || "") + (it.summary || "") + (it.tag || "") + (it.source || "")).toLowerCase().includes(kw));
    }
    const list = $("eceList");
    list.innerHTML = "";
    if (!arr.length) {
      list.innerHTML = '<p class="muted">' + (eceFilter ? '没有匹配「' + esc(eceFilter) + '」的推文，换个词试试。' : '今日推文生成中，稍后再来看看。') + '</p>';
      return;
    }
    const five = [];
    for (let i = 0; i < Math.min(5, arr.length); i++) five.push(arr[(dayIndex() * 5 + i) % arr.length]);
    five.forEach((it, i) => {
      const a = document.createElement("a");
      a.className = "ece-card rise";
      a.style.animationDelay = (i * 0.09) + "s";
      a.href = it.link || ("https://www.baidu.com/s?wd=" + encodeURIComponent(it.title));
      a.target = "_blank"; a.rel = "noopener";
      // 小图（用渐变 + 字母）
      const first = esc((it.title || "·")[0]);
      a.innerHTML =
        '<div class="ece-thumb">' +
          '<svg viewBox="0 0 60 60" width="44" height="44">' +
            '<text x="50%" y="56%" text-anchor="middle" font-family="serif" font-size="36" fill="#c17a4e">' + first + '</text>' +
          '</svg>' +
        '</div>' +
        '<div class="ece-body">' +
          '<h3>' + esc(it.title) + '</h3>' +
          '<p class="ece-sum">' + esc(it.summary || it.body || '') + '</p>' +
          '<div class="ece-meta">' + (it.tag ? '<span class="ece-tag">' + esc(it.tag) + '</span>' : '') + '<span>' + esc(it.source || '公众号/小红书') + '</span></div>' +
        '</div>';
      list.appendChild(a);
    });
  }

  // ---------- 计划日程首屏 ----------
  function renderAgendaHero() {
    const h = new Date().getHours();
    const greet = h < 6 ? "夜深了，T先生" : h < 11 ? "早安，T先生" : h < 14 ? "午安，T先生" : h < 18 ? "下午好，T先生" : "晚上好，T先生";
    $("greeting").textContent = greet;
    $("todayBig").textContent = TODAY + "  ·  星期" + weekday();
    const lines = [
      "把近几天的事，按节奏看一眼。",
      "日程在，不慌；一件件做完，就是答案。",
      "慢慢来，把重要的事排在看得见的地方。"
    ];
    $("agendaHero").textContent = lines[dayIndex() % lines.length];
    $("moodLine").textContent = ["今日心情：晴，万里无云", "今日心情：多云，偶有风", "今日心情：微风，宜专注"][dayIndex() % 3];
    $("weatherText").textContent = ["愿君今日好", "微风不燥", "宜专注"][dayIndex() % 3];
  }

  // ---------- 新闻窗口（5 板块） ----------
  const SECTION_NAMES = { ai: "AI", finance: "金融", domestic: "国内", world: "国际", health: "养生" };
  async function loadNews() {
    const tabs = $("newsTabs"); tabs.innerHTML = "";
    const body = $("newsBody"); body.innerHTML = '<p class="muted">加载中…</p>';
    const sections = CFG.FEEDS || {};
    let first = true;

    const f = feedsCache || (await loadFeeds());
    feedsCache = f;
    const feedsSections = (f && f.sections) || {};

    for (const [sec, urls] of Object.entries(sections)) {
      const btn = document.createElement("button");
      btn.className = "tab" + (first ? " active" : "");
      btn.textContent = SECTION_NAMES[sec] || sec;
      const secBody = document.createElement("div");
      secBody.className = "sec-body" + (first ? "" : " hidden");
      body.appendChild(secBody);
      btn.onclick = () => {
        document.querySelectorAll(".tab").forEach((b) => b.classList.remove("active"));
        btn.classList.add("active");
        document.querySelectorAll(".sec-body").forEach((b) => b.classList.add("hidden"));
        secBody.classList.remove("hidden");
      };
      tabs.appendChild(btn);
      first = false;

      let feedItems = feedsSections[sec] || [];
      if (newsFilter) {
        const kw = newsFilter.toLowerCase();
        feedItems = feedItems.filter((it) => ((it.title || "") + (it.summary || "")).toLowerCase().includes(kw));
      }
      if (feedItems.length) {
        secBody.innerHTML = '<p class="muted small">更新于 ' + (f.date || "今日") + ' · 共 ' + feedItems.length + ' 条</p>' +
          '<ul class="news-list">' + feedItems.map((it) =>
            '<li><a href="' + esc(it.link) + '" target="_blank" rel="noopener"><b>' + esc(it.title) + '</b>' +
            (it.summary ? '<span class="news-sum">' + esc(it.summary) + '</span>' : '') +
            ' <span class="ext">↗</span></a></li>'
          ).join("") + "</ul>";
        continue;
      }

      const items = [];
      for (const url of urls) {
        try {
          const res = await fetch((CFG.RSS_PROXY || "") + encodeURIComponent(url));
          const text = await res.text();
          const xml = new DOMParser().parseFromString(text, "text/xml");
          xml.querySelectorAll("item, entry").forEach((el) => {
            const title = (el.querySelector("title") || {}).textContent || "";
            const le = el.querySelector("link");
            const link = le ? (le.getAttribute("href") || le.textContent || "") : "";
            if (title && link) items.push({ title: title.trim(), link: link.trim() });
          });
        } catch (e) {}
      }
      let shown = items;
      if (newsFilter) {
        const kw = newsFilter.toLowerCase();
        shown = items.filter((it) => (it.title || "").toLowerCase().includes(kw));
      }
      if (!shown.length) {
        secBody.innerHTML = '<p class="muted">' + (newsFilter ? '没有匹配「' + esc(newsFilter) + '」的新闻，换个词试试。' : '暂无可读内容，等待每天 7:00 的定时任务更新。') + '</p>';
      } else {
        secBody.innerHTML = '<ul class="news-list">' + shown.slice(0, 12).map((it) =>
          '<li><a href="' + esc(it.link) + '" target="_blank" rel="noopener">' + esc(it.title) + ' <span class="ext">↗</span></a></li>'
        ).join("") + "</ul>";
      }
    }
  }
  $("newsRefresh").onclick = async () => { feedsCache = null; await loadFeeds(); loadNews(); };

  // ---------- 导航 / 视图 ----------
  function showView(name) {
    currentView = name;
    document.querySelectorAll(".nav a").forEach((a) => a.classList.toggle("active", a.dataset.view === name));
    document.querySelectorAll(".view").forEach((v) => v.classList.toggle("hidden", v.dataset.view !== name));
    // 视图切换淡入（强制 reflow 以重放动画）
    const target = document.querySelector('.view[data-view="' + name + '"]');
    if (target) {
      target.classList.remove("view-in");
      void target.offsetWidth;
      target.classList.add("view-in");
    }
    if (name === "agenda") { renderAgendaHero(); renderAgenda(); }
    if (name === "plans") renderPlans();
    if (name === "exercise") renderExercise();
    if (name === "quotes") renderQuotes();
    if (name === "ece") renderEce();
    if (name === "news") loadNews();
    closeNav();
    window.scrollTo(0, 0);
  }
  document.querySelectorAll(".nav a").forEach((a) => a.onclick = (e) => { e.preventDefault(); showView(a.dataset.view); });
  document.querySelectorAll("[data-go]").forEach((b) => b.onclick = () => showView(b.dataset.go));

  function openNav() { document.body.classList.add("nav-open"); }
  function closeNav() { document.body.classList.remove("nav-open"); }
  $("menuBtn").onclick = openNav;
  $("backdrop").onclick = closeNav;

  // ---------- 启动 ----------
  $("todayLabel").textContent = TODAY + " · 星期" + weekday();
  $("agDate").value = TODAY;
  if (!useSupabase) initAuth(); // 本地模式徽章（云端模式在 SDK 动态加载完成后自动调用）

  // 立即渲染首屏（不等待 feeds.json，避免白屏）；feeds 到位后刷新内容区
  showView("agenda");
  (async () => {
    await loadFeeds();
    if (currentView === "quotes") renderQuotes();
    else if (currentView === "ece") renderEce();
    else if (currentView === "news") loadNews();
  })();

  if ("serviceWorker" in navigator) {
    navigator.serviceWorker.register("sw.js").catch(() => {});
  }
})();
