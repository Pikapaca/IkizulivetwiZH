let members = {};
let tweets = [];
let allMonths = [];       // 全部存在推文里的月份
let hiddenLabels = [];    // 全部 hidden_label
let visibleCount = 30;
let loading = false;
let sortOrder = "new"; // 默认新→旧
let currentMember = null;
let currentMonth = null;
let currentTag = null;
let currentFiltered = [];
let currentHiddenLabel = null; // 新增
let observer;

// ========== JSON 加载（容错版） ==========
async function loadJSON(path) {
  try {
    const res = await fetch(path);
    if (!res.ok) {
      console.warn(`加载失败: ${path}, 状态码: ${res.status}`);
      return []; // 文件不存在或网络错误时返回空数组
    }
    return await res.json();
  } catch (e) {
    console.warn(`加载异常: ${path}`, e);
    return []; // 异常时返回空数组
  }
}

// ========== 获取最近几个月 ==========
function getLatestMonthsFromData(tweets, count = 3) {
  const months = [...new Set(tweets.map(t => t.month))];
  return months.sort((a, b) => b.localeCompare(a)).slice(0, count);
}

// ========== 加载指定月份推文 ==========
async function loadTweetsByMonth(months = null) {
  const now = new Date();
  const monthsToLoad = [];

  if (months) {
    monthsToLoad.push(...months);
  } else {
    for (let i = 0; i < 3; i++) {
      const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
      const y = d.getFullYear();
      const m = String(d.getMonth() + 1).padStart(2, "0");
      monthsToLoad.push(`${y}-${m}`);
    }
  }

  const promises = monthsToLoad.map(m =>
    loadJSON(`data/${m}.json`).then(data => {
      data.forEach(t => t.month = m);
      return data;
    })
  );

  const results = await Promise.all(promises);
  results.forEach(arr => tweets = tweets.concat(arr));

tweets = tweets.map((t, idx) => ({ ...t, _idx: idx }));
tweets.sort((a, b) => {
  const timeDiff = new Date(b.date) - new Date(a.date);

  if (timeDiff !== 0) {
    return sortOrder === "new"
      ? timeDiff
      : -timeDiff;
  }

  // 时间相同的情况
  return sortOrder === "new"
    ? b._idx - a._idx   // 新→旧：b 在 a 上面
    : a._idx - b._idx;  // 旧→新：a 在 b 上面
});
}

function generateGlobalArrays() {
  // 月份数组（按降序）
  allMonths = [...new Set(tweets.map(t => t.month))].sort((a, b) => b.localeCompare(a));

  // hidden_label 数组（去重且非空）
  hiddenLabels = [...new Set(
    tweets
      .flatMap(t => Array.isArray(t.hidden_label) ? t.hidden_label : [t.hidden_label])
      .filter(Boolean)
  )];
}

// ========== 初始化 ==========
async function init() {
  renderMemberSidebar();
  renderMonthSidebar();
  renderCurrent();


  const membersPromise = loadJSON("members.json");

  // 先加载所有月份 JSON 仅用于计算最近三个月
  const now = new Date();
  const startYear = 2024;
  const monthsData = [];

  for (let y = startYear; y <= now.getFullYear(); y++) {
    for (let m = 1; m <= 12; m++) {
      const month = `${y}-${String(m).padStart(2, "0")}`;
      monthsData.push(loadJSON(`data/${month}.json`).then(data => {
        if (data.length > 0) {
          data.forEach(t => t.month = month);
          tweets = tweets.concat(data);
        }
      }));
    }
  }

  await Promise.all(monthsData);

  // 最近三个月
  const latestMonths = getLatestMonthsFromData(tweets, 3);
  tweets = tweets.filter(t => latestMonths.includes(t.month))
                 .sort((a, b) => new Date(b.date) - new Date(a.date))
                 .map((t, idx) => ({
                   ...t,
                   _idx: idx,
                   _jumpId: `tweet-${t.member}-${t.date}-${idx}`.replace(/[^a-zA-Z0-9_-]/g, "-")
                 }));

  // 成员数据
  const memberData = await membersPromise;
  memberData.forEach(m => members[m.id] = m);

  renderMemberSidebar();
  renderMonthSidebar();
  applyFilters();



const mobileMonthBtn = document.getElementById("mobileMonthBtn");
const monthSidebar = document.getElementById("monthSidebar");
const monthOverlay = document.getElementById("monthOverlay");

function isMobileView() {
  return window.innerWidth <= 768;
}

function openMonthSidebar() {
  if (!monthSidebar) return;
  monthSidebar.classList.add("mobile-open");
  if (isMobileView() && monthOverlay) {
    monthOverlay.classList.add("show");
  }
}

function closeMonthSidebar() {
  if (!monthSidebar) return;
  monthSidebar.classList.remove("mobile-open");
  if (monthOverlay) {
    monthOverlay.classList.remove("show");
  }
}

function toggleMonthSidebar() {
  if (!isMobileView() || !monthSidebar) return;

  const isOpen = monthSidebar.classList.contains("mobile-open");
  if (isOpen) {
    closeMonthSidebar();
  } else {
    openMonthSidebar();
  }
}

if (mobileMonthBtn && monthSidebar) {
  mobileMonthBtn.addEventListener("click", (e) => {
    e.stopPropagation();
    toggleMonthSidebar();
  });
}

if (monthOverlay) {
  monthOverlay.addEventListener("click", () => {
    closeMonthSidebar();
  });
}



// 手机端“重要事件”按钮
const mobileImportantBtn = document.getElementById("mobileImportantBtn");
if (mobileImportantBtn) {
  mobileImportantBtn.addEventListener("click", () => {
    const hiddenLabelsList = document.getElementById("hiddenLabelsList");
    if (hiddenLabelsList) {
      hiddenLabelsList.classList.toggle("show");
    }
  });
}


  // 首页
  document.getElementById("homeIcon")?.addEventListener("click", () => {
    window.scrollTo(0, 0);
  currentMember = null;
  currentMonth = null;
  currentTag = null;
  currentHiddenLabel = null; // 清空 hidden_label 筛选

   const monthSelect = document.getElementById("monthSelect");
  if (monthSelect) monthSelect.value = "";

    applyFilters();
  });



// 搜索 + 清除按钮
const searchInput = document.getElementById("searchInput");
const searchClear = document.getElementById("searchClear");

function updateSearchClearBtn() {
  if (!searchInput || !searchClear) return;
  searchClear.style.display = searchInput.value ? "block" : "none";
}

// 输入时筛选 + 更新清除按钮显示
searchInput?.addEventListener("input", () => {
  visibleCount = 30;
  applyFilters();
  const container = document.getElementById("tweetContainer");
  if (container) container.scrollTop = 0;
  updateSearchClearBtn();
});

// 点击 × 清空搜索并刷新
searchClear?.addEventListener("click", () => {
  if (!searchInput) return;
  searchInput.value = "";
  visibleCount = 30;
  applyFilters();
  const container = document.getElementById("tweetContainer");
  if (container) container.scrollTop = 0;
  updateSearchClearBtn();
  searchInput.focus();
});

// 初始化一次（页面刚打开时）
updateSearchClearBtn();

  // 排序下拉
  document.getElementById("sortSelect")?.addEventListener("change", e => {
    sortOrder = e.target.value;
    visibleCount = 30;
    applyFilters(currentMember, currentMonth, currentTag, currentHiddenLabel);
    const container = document.getElementById("tweetContainer");
    if (container) container.scrollTop = 0;
  });

// 夜间模式
document.getElementById("darkToggle")?.addEventListener("click", () => {
  document.body.classList.toggle("dark");
  updateDarkButton();
});


  // 后台异步加载剩余月份
loadRemainingMonths().then(() => {
  visibleCount = 30; // 重置可见条数
renderCurrent();
  // 追加新推文后更新
  applyFilters(currentMember, currentMonth, currentTag, currentHiddenLabel);
});

setupLazyLoadObserver(); // 初始化 scroll observer

// —— 新增手机端夜间模式 emoji 按钮显示控制 —— //
updateDarkButton(); // 初始化按钮显示（根据屏幕宽度和 dark class）
window.addEventListener("resize", updateDarkButton); // 窗口变化时刷新按钮
}

// ========== 背景加载剩余月份 ==========
async function loadRemainingMonths() {
  const now = new Date();
  const startYear = 2024;
  const loadedMonths = new Set(tweets.map(t => t.month));
  const monthsToLoad = [];

  for (let y = startYear; y <= now.getFullYear(); y++) {
    for (let m = 1; m <= 12; m++) {
      const month = `${y}-${String(m).padStart(2, "0")}`;
      if (!loadedMonths.has(month)) monthsToLoad.push(month);
    }
  }

  const batchSize = 3;
  for (let i = 0; i < monthsToLoad.length; i += batchSize) {
    const batch = monthsToLoad.slice(i, i + batchSize);
    const promises = batch.map(m => loadJSON(`data/${m}.json`).then(data => {
      data.forEach(t => t.month = m);
      return data;
    }));
    const results = await Promise.all(promises);
    results.forEach(arr => tweets = tweets.concat(arr));
        tweets = tweets.map((t, idx) => ({
      ...t,
      _idx: idx,
      _jumpId: `tweet-${t.member}-${t.date}-${idx}`.replace(/[^a-zA-Z0-9_-]/g, "-")
    }));
        tweets.sort((a, b) => {
           const timeDiff = new Date(b.date) - new Date(a.date);

  if (timeDiff !== 0) {
    return sortOrder === "new"
      ? timeDiff
      : -timeDiff;
  }

  // 时间相同的情况
  return sortOrder === "new"
    ? b._idx - a._idx   // 新→旧：b 在 a 上面
    : a._idx - b._idx;  // 旧→新：a 在 b 上面
});

    renderMonthSidebar();
  }
}

// ========== 渲染侧边栏 ==========
function renderMonthSidebar() {
  const sidebar = document.getElementById("monthSidebar");
  if (!sidebar) return;
  sidebar.innerHTML = "";

const counts = {};

// 侧边栏计数不统计 hidden:true
const sidebarTweets = tweets.filter(t => t.hidden !== true);

sidebarTweets.forEach(t => {
  counts[t.month] = (counts[t.month] || 0) + 1;
});

// 单个月份下拉
const monthSelect = document.createElement("select");
monthSelect.id = "monthSelect";
monthSelect.className = "month-select";

const defaultOption = document.createElement("option");
defaultOption.value = "";
defaultOption.textContent = "年-月";
monthSelect.appendChild(defaultOption);

[...new Set(sidebarTweets.map(t => t.month))]
  .sort((a, b) => b.localeCompare(a))
  .forEach(month => {
    const option = document.createElement("option");
    option.value = month;
    option.textContent = `${month} (${counts[month] || 0})`;
    if (currentMonth === month) option.selected = true;
    monthSelect.appendChild(option);
  });

monthSelect.addEventListener("change", () => {
  visibleCount = 30;
  currentMonth = monthSelect.value || null;
  applyFilters(currentMember, currentMonth, currentTag, currentHiddenLabel);

  const container = document.getElementById("tweetContainer");
  if (container) container.scrollTop = 0;

  if (window.innerWidth <= 768) {
    closeMonthSidebar();
  }
});

sidebar.appendChild(monthSelect);


     // 重要事件按钮
const importantBtn = document.createElement("button");
importantBtn.id = "importantBtn";
importantBtn.textContent = "重要事件";
importantBtn.style.marginTop = "10px";
sidebar.appendChild(importantBtn);

// hidden_label 列表
const hiddenLabelsList = document.createElement("ul");
hiddenLabelsList.id = "hiddenLabelsList";
hiddenLabelsList.style.paddingLeft = "10px";
sidebar.appendChild(hiddenLabelsList);

// 获取所有 hidden_label（去重非空）
hiddenLabels = [...new Set(
 tweets.flatMap(t => Array.isArray(t.hidden_label) ? t.hidden_label : [t.hidden_label])
          .filter(Boolean)
)];

// 生成列表
hiddenLabels.forEach(label => {
  const li = document.createElement("li");
  li.textContent = label;
  li.style.cursor = "pointer";
  li.style.margin = "3px 0";

  li.addEventListener("click", () => {
  visibleCount = 30;
  currentHiddenLabel = label; // 保存当前选中的 hidden_label
  applyFilters(currentMember, currentMonth, currentTag, currentHiddenLabel);
  const container = document.getElementById("tweetContainer");
    if (container) container.scrollTop = 0;
});


  hiddenLabelsList.appendChild(li);
});

// 按钮点击 → 切换 show class
importantBtn.addEventListener("click", () => {
  hiddenLabelsList.classList.toggle("show");
});
}






function renderMemberSidebar() {
  const sidebar = document.getElementById("memberSidebar");
  if (!sidebar) return;
  sidebar.innerHTML = "";

  const modal = document.getElementById("guideModal");
  const close = modal ? modal.querySelector(".close-btn") : null;

  // ===== ① 先创建 guide 按钮（永远第一个）=====
  const guideBtn = document.createElement("button");
  guideBtn.id = "guideBtn";
  guideBtn.textContent = "网页指南";
  sidebar.appendChild(guideBtn);

  if (modal) {
    guideBtn.onclick = () => {
      modal.style.display = "flex";
    };
  }

  if (close) {
    close.onclick = () => {
      modal.style.display = "none";
    };
  }

  // 只绑定一次 window 监听
  if (!window._guideModalBound && modal) {
    window.addEventListener("click", e => {
      if (e.target === modal) {
        modal.style.display = "none";
      }
    });
    window._guideModalBound = true;
  }

  // ===== ② 再渲染成员 =====
  Object.values(members).slice(0, 10).forEach(m => {
    const btn = document.createElement("div");
    btn.className = "member-btn";

    const img = document.createElement("img");
    img.src = m.avatar;
    img.title = m.name;
    img.loading = "lazy";

    btn.appendChild(img);

    btn.onclick = () => {
      visibleCount = 30;
      currentMember = m.id;
      applyFilters(currentMember, currentMonth, currentTag, currentHiddenLabel);

      const container = document.getElementById("tweetContainer");
      if (container) container.scrollTop = 0;
    };

    sidebar.appendChild(btn);
  });
}


    // ✅ 在 DOM 创建后再加载 guide.json 
loadJSON("guide.json").then(data => {
  if (!data) return;

  const guideTitleEl = document.getElementById("guideTitle");
  guideTitleEl.textContent = data.title || "指南"; // 标题通常不需要 Markdown

  const listEl = document.getElementById("guideList");
  listEl.innerHTML = "";

  (data.items || []).forEach(item => {
    const li = document.createElement("li");
    li.innerHTML = marked.parse(item); // <-- 改成 innerHTML + marked.parse()
    listEl.appendChild(li);
  });
    }).catch(() => console.warn("guide.json 加载失败"));


// ========== 筛选和排序（支持隐藏 label + 原文检索） ==========
function applyFilters(memberFilter = null, monthFilter = null, tagFilter = null, hiddenLabelFilter = null, resetVisible = true) {
  const search = document.getElementById("searchInput")?.value.toLowerCase() || "";
  const member = memberFilter || currentMember || "";
  const month = monthFilter || currentMonth || "";
  const tag = tagFilter || currentTag || "";
  const hiddenLabel = hiddenLabelFilter || ""; // 可选过滤

 
  currentFiltered = tweets.filter(t => {
   // 1️⃣ 过滤 hidden
  if (t.hidden === true) return false;
  // 成员筛选
  if (member && t.member !== member) return false;
  // 月份筛选
  if (month && t.month !== month) return false;
  // 标签筛选
  if (tag && (!t.tags || !t.tags.includes(tag))) return false;
  // 隐藏 label 筛选
if (hiddenLabel) {
  if (!t.hidden_label) return false;

  const labels = Array.isArray(t.hidden_label)
    ? t.hidden_label
    : [t.hidden_label];

  if (!labels.includes(hiddenLabel)) return false;
}
  // 搜索匹配 translation 或 original
  if (search) {
    const translationMatch = t.translation.toLowerCase().includes(search);
    const originalMatch = t.original ? t.original.toLowerCase().includes(search) : false;
    if (!translationMatch && !originalMatch) return false;
  }
  return true;
});


  // 排序
  currentFiltered.sort((a,b)=> {
    const timeDiff = new Date(b.date) - new Date(a.date);

  if (timeDiff !== 0) {
    return sortOrder === "new"
      ? timeDiff
      : -timeDiff;
  }

  // 时间相同
  return sortOrder === "new"
    ? b._idx - a._idx
    : a._idx - b._idx;
});


  if (resetVisible) {
    visibleCount = 30;
  }
  renderCurrent();

}


// ========== 渲染推文 ==========
function renderCurrent() {
    const container = document.getElementById("tweetContainer");
    if (!container) return;

    let sentinel = document.getElementById("lazySentinel");

    // 如果 sentinel 不存在或不在 container 内，创建并 append
    if (!sentinel || sentinel.parentNode !== container) {
        sentinel = document.createElement("div");
        sentinel.id = "lazySentinel";
        sentinel.style.height = "1px";
        container.appendChild(sentinel);
    }

    // 清空推文，保留 sentinel
    Array.from(container.children).forEach(c => {
        if (c !== sentinel) container.removeChild(c);
    });

    const fragment = document.createDocumentFragment();
    const list = currentFiltered; 
    list.slice(0, visibleCount).forEach(t => {
        const tweetEl = renderTweet(t);
        attachAnnotations(tweetEl, t.annotations || []);
        fragment.appendChild(tweetEl);
    });

    container.insertBefore(fragment, sentinel);
}



function setupLazyLoadObserver() {
  const sentinel = document.getElementById("lazySentinel");
  if (!sentinel) return;

  if (!observer) {
    observer = new IntersectionObserver(entries => {
      entries.forEach(entry => {
        if (entry.isIntersecting) {
          loadMoreTweets();
        }
      });
    }, { root: null, rootMargin: "200px", threshold: 0 });
  }

  observer.observe(sentinel);
}

function renderMoreTweets() {
    const container = document.getElementById("tweetContainer");
    if (!container) return;

    let sentinel = document.getElementById("lazySentinel");
    if (!sentinel || sentinel.parentNode !== container) {
        sentinel = document.createElement("div");
        sentinel.id = "lazySentinel";
        sentinel.style.height = "1px";
        container.appendChild(sentinel);
    }

    const fragment = document.createDocumentFragment();
    const list = currentFiltered; 

    // 只渲染新增部分
    const start = visibleCount - 30; // 上一次加载结束的位置
    const end = Math.min(visibleCount, list.length);
    list.slice(start, end).forEach(t => {
        const tweetEl = renderTweet(t);
        attachAnnotations(tweetEl, t.annotations || []);
        fragment.appendChild(tweetEl);
    });

    container.insertBefore(fragment, sentinel);
}

function loadMoreTweets() {
  if (loading) return;
  const list = currentFiltered; // currentFiltered 已经保证无筛选时等于 tweets
  if (visibleCount >= list.length) return;

  loading = true;
  const oldVisibleCount = visibleCount;
  visibleCount += 30;
  renderMoreTweets();
  loading = false;
}



function renderTweet(t) {
  const container = document.createElement("div");
  container.className = "tweet";
  container.id = t._jumpId || "";

  if (t.deleted) {
    container.classList.add("deleted");
  }  

  const m = members[t.member];
  if (!m) return container;

  const avatar = document.createElement("img");
  avatar.src = m.avatar;
  avatar.className = "avatar";
  avatar.loading = "lazy";

  const body = document.createElement("div");
  body.className = "tweet-body";

  const header = document.createElement("div");
  header.className = "tweet-header";
  header.innerHTML = `<span class="tweet-name">${m.name}</span> <span class="tweet-id">${m.displayId ? '@'+m.displayId : ''}</span>`;

  const content = document.createElement("div");
  content.className = "tweet-content";
  content.textContent = t.translation;

  // ===== 原文容器（默认隐藏）=====
const original = document.createElement("div");
original.className = "tweet-original";
original.textContent = t.original || "";
original.style.display = "none";

// ===== 右上角按钮 =====
const originalBtn = document.createElement("button");
originalBtn.className = "original-toggle-btn";
originalBtn.textContent = "🇯🇵";
originalBtn.title = "显示原文";

originalBtn.addEventListener("click", (e) => {
  e.stopPropagation();

  const isHidden = original.style.display === "none";
  original.style.display = isHidden ? "block" : "none";

  originalBtn.title = isHidden ? "收起原文" : "显示原文";
});

  body.appendChild(originalBtn);  // 按钮  
  body.appendChild(header);
  
  body.appendChild(content);      // 翻译
  

  if (t.tags?.length) {
    const tagContainer = document.createElement("div");
    t.tags.forEach(tag => {
      const tagEl = document.createElement("span");
      tagEl.className = "tweet-tag";
      tagEl.textContent = `#${tag}`;
      tagEl.addEventListener("click", () => {
        visibleCount = 30;
        applyFilters(null,null,tag);
        const container = document.getElementById("tweetContainer");
    if (container) container.scrollTop = 0;
      });
      tagContainer.appendChild(tagEl);
    });
    body.appendChild(tagContainer);
  }

    if (t.images?.length) {
  const imagesContainer = document.createElement("div");
  imagesContainer.className = "tweet-images";

  t.images.forEach(src => {
    const img = document.createElement("img");
    img.src = src;
    img.loading = "lazy";
    img.className = "tweet-image";
    imagesContainer.appendChild(img);
  });

  body.appendChild(imagesContainer);
}
 
  const date = document.createElement("span");
  date.className = "tweet-date jump-text";
  date.textContent = t.date;
  date.dataset.target = t._jumpId || "";

  date.addEventListener("click", (e) => {
    e.stopPropagation();
    if (!date.dataset.target) return;
    jumpToTweet(date.dataset.target);
  });

  body.appendChild(date);

  if (t.deleted) {
    const deletedNote = document.createElement("div");
    deletedNote.className = "deleted-note";
    deletedNote.textContent = "（已删除）";
    body.appendChild(deletedNote);
  }

  body.appendChild(original);     // 原文

  // ===== 引用推文处理 =====
  if (t.quotedId) {
  const quotedContainer = document.createElement("div");
  quotedContainer.className = "tweet-quoted";

  // 优先通过 quotedId 查找列表内推文
  const quotedTweet = tweets.find(x => x.id === t.quotedId);

  if (quotedTweet) {
    // 已在列表里的引用，复用 renderTweet
    const innerTweet = renderTweet(quotedTweet);
    innerTweet.classList.add("tweet-quoted-inner");
    quotedContainer.appendChild(innerTweet);


    // 如果引用推文也有原文，显示原文按钮
    if (quotedTweet.quotedOriginal) {
      const qOriginal = document.createElement("div");
      qOriginal.className = "tweet-original";
      qOriginal.textContent = quotedTweet.quotedOriginal;
      qOriginal.style.display = "none";

      const qBtn = document.createElement("button");
      qBtn.className = "original-toggle-btn";
      qBtn.textContent = "🇯🇵";
      qBtn.title = "显示原文";

      qBtn.addEventListener("click", (e) => {
        e.stopPropagation();
        const isHidden = qOriginal.style.display === "none";
        qOriginal.style.display = isHidden ? "block" : "none";
        qBtn.title = isHidden ? "收起原文" : "显示原文";
      });

      quotedContainer.appendChild(qBtn);
      quotedContainer.appendChild(qOriginal);
      
    
    }
  }

  body.appendChild(quotedContainer);
}


  
  container.appendChild(avatar);
  container.appendChild(body);
  return container;
}

function jumpToTweet(targetId) {
  currentMember = null;
  currentMonth = null;
  currentTag = null;
  currentHiddenLabel = null;

  const monthSelect = document.getElementById("monthSelect");
  if (monthSelect) monthSelect.value = "";

  const searchInput = document.getElementById("searchInput");
  if (searchInput) searchInput.value = "";

  const searchClear = document.getElementById("searchClear");
  if (searchClear) searchClear.style.display = "none";

  const container = document.getElementById("tweetContainer");
  if (container) container.scrollTop = 0;

  // 回到 no filter 列表
  applyFilters(null, null, null, null, true);

  // 在 no filter 列表中找到目标推文的位置
  const targetIndex = currentFiltered.findIndex(t => t._jumpId === targetId);
  console.log("jump targetId:", targetId);
  console.log("jump targetIndex:", targetIndex);
  console.log("jump target tweet:", currentFiltered[targetIndex]);

  if (targetIndex === -1) return;

  // 一次性把可见条数扩到能包含目标的位置
  visibleCount = Math.ceil((targetIndex + 1) / 30) * 30;
  renderCurrent();

  const el = document.getElementById(targetId);
  console.log("jump target element:", el);

  if (!el) return;

  console.log("element text:", el.querySelector(".tweet-content")?.textContent);
  console.log("element date:", el.querySelector(".tweet-date")?.textContent);

requestAnimationFrame(() => {
  const tweetContainer = document.getElementById("tweetContainer");
  if (!tweetContainer) return;

  const scrollToEl = () => {
    const elRect = el.getBoundingClientRect();
    const containerRect = tweetContainer.getBoundingClientRect();

    const targetTop =
      tweetContainer.scrollTop +
      (elRect.top - containerRect.top) -
      20;

    tweetContainer.scrollTo({
      top: targetTop,
      behavior: "auto"
    });
  };

  let lastTop = null;
  let stableCount = 0;
  let tries = 0;
  const maxTries = 20;

  const correctUntilStable = () => {
    const currentTop = el.getBoundingClientRect().top;

    scrollToEl();

    const newTop = el.getBoundingClientRect().top;

    if (lastTop !== null && Math.abs(newTop - lastTop) < 1) {
      stableCount++;
    } else {
      stableCount = 0;
    }

    lastTop = newTop;
    tries++;

    if (stableCount >= 2 || tries >= maxTries) return;

    setTimeout(correctUntilStable, 100);
  };

  correctUntilStable();
});
// ===== 图片弹窗 Lightbox =====
function setupImageLightbox() {
  // 1) 创建 modal（只创建一次）
  let modal = document.getElementById("imgModal");
  if (!modal) {
    modal = document.createElement("div");
    modal.id = "imgModal";
    modal.innerHTML = `<img alt="preview">`;
    document.body.appendChild(modal);
  }

  const modalImg = modal.querySelector("img");

  // 2) 点击遮罩空白处关闭（点图片本身不关闭）
  modal.addEventListener("click", (e) => {
    if (e.target === modal) closeModal();
  });

  // 3) ESC 关闭
  document.addEventListener("keydown", (e) => {
    if (e.key === "Escape") closeModal();
  });

  function openModal(src) {
    modalImg.src = src;
    modal.classList.add("show");
    // 防止打开后背景还能滚动（尤其手机）
    document.body.style.overflow = "hidden";
  }

  function closeModal() {
    modal.classList.remove("show");
    modalImg.src = ""; // 释放引用
    document.body.style.overflow = "";
  }

  // 4) 事件委托：推文图片点击打开
  const container = document.getElementById("tweetContainer");
  if (!container) return;

  container.addEventListener("click", (e) => {
    const img = e.target.closest && e.target.closest("img.tweet-image");
    if (!img) return;

    e.stopPropagation();
    openModal(img.src);
  });
}

// ✅ 在 init() 的最后调用一次（DOM 都准备好后）
setupImageLightbox();



// -------- 新增注释功能 --------
function attachAnnotations(container, annotations = []) {
  if (!annotations.length) return;
  
  annotations.forEach(item => {
    const { term, definition } = item;
    const regex = new RegExp(`(${term})`, "g");

    const walker = document.createTreeWalker(container, NodeFilter.SHOW_TEXT, null, false);
    const nodes = [];
    while(walker.nextNode()) nodes.push(walker.currentNode);

    nodes.forEach(textNode => {
      if (!regex.test(textNode.textContent)) return;

      const frag = document.createDocumentFragment();
      let lastIndex = 0;

      textNode.textContent.replace(regex, (match, p1, offset) => {
        if (offset > lastIndex) {
          frag.appendChild(document.createTextNode(textNode.textContent.slice(lastIndex, offset)));
        }

        const span = document.createElement("span");
        span.className = "annotated";
        span.textContent = match;

        const tooltip = document.createElement("div");
        tooltip.className = "annotation-tooltip";

// 文字容器
        const textEl = document.createElement("div");
        textEl.className = "anno-text";
        textEl.textContent = definition ?? "";
        tooltip.appendChild(textEl);

// 图片容器
        const imgs = Array.isArray(item.anno_image) ? item.anno_image : [];
        if (imgs.length) {
        const imgWrap = document.createElement("div");
        imgWrap.className = "anno-images";

        imgs.forEach(src => {
          const img = document.createElement("img");
          img.src = src;
          img.alt = "";
          img.loading = "lazy";
          imgWrap.appendChild(img);
      });

       tooltip.appendChild(imgWrap);
      }

       document.body.appendChild(tooltip);

        span.addEventListener("click", e => {
          e.stopPropagation();
          const isVisible = tooltip.style.display === "block";
          document.querySelectorAll(".annotation-tooltip").forEach(t => t.style.display = "none");
          if (!isVisible) {
            const rect = span.getBoundingClientRect();
            tooltip.style.top = (rect.bottom + window.scrollY + 5) + "px";
            tooltip.style.left = (rect.left + window.scrollX) + "px";
            tooltip.style.display = "block";
          } else {
            tooltip.style.display = "none";
          }
        });

        frag.appendChild(span);
        lastIndex = offset + match.length;
      });

      if (lastIndex < textNode.textContent.length) {
        frag.appendChild(document.createTextNode(textNode.textContent.slice(lastIndex)));
      }

      textNode.replaceWith(frag);
    });
  });
}

document.addEventListener("click", () => {
  document.querySelectorAll(".annotation-tooltip").forEach(t => t.style.display = "none");
});

// ========== 排序图标 ==========
const sortToggle = document.getElementById("sortToggle");
const sortLabel = document.getElementById("sortLabel");

if(sortToggle && sortLabel) {
  sortToggle.addEventListener("click", () => {
    sortOrder = sortOrder==="new"?"old":"new";
    sortToggle.textContent = sortOrder==="new"?"⬇":"⬆";
    sortLabel.textContent = sortOrder==="new"?"新 → 旧":"旧 → 新";
    sortToggle.title = sortOrder==="new"?"排序：新 → 旧":"排序：旧 → 新";
    visibleCount = 30;
    applyFilters(currentMember, currentMonth, currentTag, currentHiddenLabel);
    const container = document.getElementById("tweetContainer");
    if (container) container.scrollTop = 0;
  });
}

function updateDarkButton() {
  const darkBtn = document.getElementById("darkToggle");
  if (!darkBtn) return;

  const isMobile = window.innerWidth <= 768;
  const isDark = document.body.classList.contains("dark");

  if (isMobile) {
    darkBtn.textContent = isDark ? "☀️" : "🌙";
  } else {
    darkBtn.textContent = isDark ? "日间模式" : "夜间模式";
  }
}
// ========== 启动 ==========
init();
