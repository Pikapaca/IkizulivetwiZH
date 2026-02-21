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
                 .sort((a, b) => new Date(b.date) - new Date(a.date));

  // 成员数据
  const memberData = await membersPromise;
  memberData.forEach(m => members[m.id] = m);

  renderMemberSidebar();
  renderMonthSidebar();
  applyFilters();



const mobileMonthBtn = document.getElementById("mobileMonthBtn");
const monthSidebar = document.getElementById("monthSidebar");
if (mobileMonthBtn && monthSidebar) {
  mobileMonthBtn.addEventListener("click", () => {
    monthSidebar.classList.toggle("mobile-open");
  });
}



// 手机端“重要事件”按钮
const mobileImportantBtn = document.getElementById("mobileImportantBtn");
const hiddenLabelsList = document.getElementById("hiddenLabelsList");
if (mobileImportantBtn && hiddenLabelsList) {
  mobileImportantBtn.addEventListener("click", () => {
    hiddenLabelsList.classList.toggle("show");
  });
}


  // 首页
  document.getElementById("homeIcon")?.addEventListener("click", () => {
    window.scrollTo(0, 0);
  currentMember = null;
  currentMonth = null;
  currentTag = null;
  currentHiddenLabel = null; // 清空 hidden_label 筛选
    applyFilters();
  });



  // 搜索
  document.getElementById("searchInput")?.addEventListener("input", () => {
    visibleCount = 30;
    applyFilters();
    const container = document.getElementById("tweetContainer");
    if (container) container.scrollTop = 0;
  });

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

    renderMonthSidebar();
  }
}

// ========== 渲染侧边栏 ==========
function renderMonthSidebar() {
  const sidebar = document.getElementById("monthSidebar");
  if (!sidebar) return;
  sidebar.innerHTML = "";

  const grouped = {};
  const counts = {};
  tweets.forEach(t => {
    const year = t.month.split("-")[0];
    grouped[year] = grouped[year] || [];
    if (!grouped[year].includes(t.month)) grouped[year].push(t.month);
    counts[t.month] = (counts[t.month] || 0) + 1;
  });

  Object.keys(grouped).sort((a,b)=>b-a).forEach(year => {
    const yearDiv = document.createElement("div");
    yearDiv.className = "year-item";

    const header = document.createElement("div");
    header.className = "year-header";
    header.innerHTML = `${year} <span class="toggle-arrow">▼</span>`;

    const monthsContainer = document.createElement("div");
    monthsContainer.className = "months-container";
    monthsContainer.style.display = "none";

    header.addEventListener("click", () => {
      const isHidden = monthsContainer.style.display === "none";
      monthsContainer.style.display = isHidden ? "block" : "none";
      header.classList.toggle("expanded", isHidden);
      header.querySelector(".toggle-arrow").textContent = isHidden ? "▲" : "▼";
    });

    grouped[year].sort((a,b)=>b.localeCompare(a)).forEach(month => {
      const monthBtn = document.createElement("div");
      monthBtn.className = "month-btn";
      monthBtn.textContent = `${month} (${counts[month]})`;
      monthBtn.addEventListener("click", () => {
        visibleCount = 30;
        currentMonth = month;
        applyFilters(currentMember, currentMonth, currentTag, currentHiddenLabel);
        const container = document.getElementById("tweetContainer");
    if (container) container.scrollTop = 0;
      });
      monthsContainer.appendChild(monthBtn);
    });

    yearDiv.appendChild(header);
    yearDiv.appendChild(monthsContainer);
    sidebar.appendChild(yearDiv);
  });


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
  li.style.color = "blue";
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
  guideBtn.textContent = "指南";
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
function applyFilters(memberFilter = null, monthFilter = null, tagFilter = null, hiddenLabelFilter = null) {
  const search = document.getElementById("searchInput")?.value.toLowerCase() || "";
  const member = memberFilter || currentMember || "";
  const month = monthFilter || currentMonth || "";
  const tag = tagFilter || currentTag || "";
  const hiddenLabel = hiddenLabelFilter || ""; // 可选过滤

 
  currentFiltered = tweets.filter(t => {
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


  visibleCount = 30;
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

  body.appendChild(header);
  body.appendChild(content);

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

  const date = document.createElement("div");
  date.className = "tweet-date";
  date.textContent = t.date;
  body.appendChild(date);

  container.appendChild(avatar);
  container.appendChild(body);
  return container;
}

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
        tooltip.textContent = definition;
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
