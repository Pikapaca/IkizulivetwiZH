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
  hiddenLabels = [...new Set(tweets.map(t => t.hidden_label).filter(Boolean))];
}

// ========== 初始化 ==========
async function init() {
  renderMemberSidebar();
  renderMonthSidebar();
  renderCurrent();

  // guide.json
  loadJSON("guide.json").then(data => {
    if (!data) return;
    document.getElementById("guideTitle").textContent = data.title || "指南";
    const listEl = document.getElementById("guideList");
    listEl.innerHTML = "";
    (data.items || []).forEach(item => {
      const li = document.createElement("li");
      li.textContent = item;
      listEl.appendChild(li);
    });
  }).catch(() => console.warn("guide.json 加载失败"));

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
  });

  // 排序下拉
  document.getElementById("sortSelect")?.addEventListener("change", e => {
    sortOrder = e.target.value;
    visibleCount = 30;
    applyFilters(currentMember, currentMonth, currentTag);
  });

  // 夜间模式
  document.getElementById("darkToggle")?.addEventListener("click", () => {
    document.body.classList.toggle("dark");
  });

  // 懒加载
  window.addEventListener("scroll", () => {
    if (loading) return;
    if (window.innerHeight + window.scrollY >= document.body.offsetHeight - 200) {
      loading = true;
      visibleCount += 30;
      renderCurrent();
      loading = false;
    }
  });

  // 背景加载剩余月份
  loadRemainingMonths();
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
        applyFilters(currentMember, currentMonth, currentTag);
        window.scrollTo(0,0);
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
hiddenLabels = [...new Set(tweets.map(t => t.hidden_label).filter(Boolean))];

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
  window.scrollTo(0,0);
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

  // 先获取 modal（必须在外层作用域）
  const modal = document.getElementById("guideModal");
  const close = modal ? modal.querySelector(".close-btn") : null;

  // 渲染成员头像
  Object.values(members).forEach(m => {
    const btn = document.createElement("div");
    btn.className = "member-btn";
    const img = document.createElement("img");
    img.src = m.avatar;
    img.title = m.name;
    img.loading = "lazy";
    btn.appendChild(img);
    btn.addEventListener("click", () => {
      visibleCount = 30;
      currentMember = m.id;
      applyFilters(currentMember, currentMonth, currentTag, currentHiddenLabel);
      window.scrollTo(0,0);
    });
    sidebar.appendChild(btn);
  });

  // 只创建按钮，不创建 modal
  if (!document.getElementById("guideBtn")) {
    const btn = document.createElement("button");
    btn.id = "guideBtn";
    btn.textContent = "指南";
    sidebar.appendChild(btn);

    if (modal) {
      btn.addEventListener("click", () => {
        modal.style.display = "flex";
      });

      if (close) {
        close.addEventListener("click", () => {
          modal.style.display = "none";
        });
      }

      window.addEventListener("click", e => {
        if (e.target === modal) modal.style.display = "none";
      });
    }
  }
}


    // ✅ 在 DOM 创建后再加载 guide.json 
   loadJSON("guide.json").then(data => {
      if (!data) return;
      document.getElementById("guideTitle").textContent = data.title || "指南";
      const listEl = document.getElementById("guideList");
      listEl.innerHTML = "";
      (data.items || []).forEach(item => {
        const li = document.createElement("li");
        li.textContent = item;
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
    if (member !== "" && t.member !== member) return false;
    // 月份筛选
    if (month !== "" && t.month !== month) return false;
    // 标签筛选
    if (tag !== "" && (!t.tags || !t.tags.includes(tag))) return false;
    // 隐藏 label 筛选（安全处理）
    if (hiddenLabel !== "" && (!t.hidden_label || t.hidden_label !== hiddenLabel)) return false;
    // 搜索匹配 translation 或 original
    const translationMatch = t.translation.toLowerCase().includes(search);
    const originalMatch = t.original ? t.original.toLowerCase().includes(search) : false;
    return translationMatch || originalMatch;
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


  renderCurrent();
}


// ========== 渲染推文 ==========
function renderCurrent() {
  const container = document.getElementById("tweetContainer");
  if (!container) return;

  container.innerHTML = "";
  const fragment = document.createDocumentFragment();
  currentFiltered.slice(0, visibleCount).forEach(t => {
     const tweetEl = renderTweet(t)


 // ✅ 添加注释功能
    attachAnnotations(tweetEl, t.annotations || []);

    fragment.appendChild(tweetEl);
  });

  container.appendChild(fragment);
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
        window.scrollTo(0,0);
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
    applyFilters(currentMember, currentMonth, currentTag);
  });
}

// ========== 启动 ==========
init();
