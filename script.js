let members = {};
let tweets = [];
let visibleCount = 30;
let loading = false;
let sortOrder = "new"; // 默认新→旧
let currentMember = null;
let currentMonth = null;
let currentTag = null;
let currentFiltered = [];

// ========== JSON 加载 ==========
async function loadJSON(path) {
  try {
    const res = await fetch(path);
    if (!res.ok) return [];
    return await res.json();
  } catch {
    return [];
  }
}

  function getLatestMonthsFromData(tweets, count=3){
  const months = [...new Set(tweets.map(t=>t.month))];
  return months.sort((a,b)=>b.localeCompare(a)).slice(0,count);
}

// ========== 加载指定月份推文 ==========
async function loadTweetsByMonth(months = null) {
  const now = new Date();
  const monthsToLoad = [];

  if (months) {
    monthsToLoad.push(...months);
  } else {
    // 默认加载最近 3 个月
    for (let i = 0; i < 3; i++) {
      const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
      const y = d.getFullYear();
      const m = String(d.getMonth() + 1).padStart(2, "0");
      monthsToLoad.push(`${y}-${m}`);
    }
  }

  // 并行加载
  const promises = monthsToLoad.map(m =>
    loadJSON(`data/${m}.json`).then(data => {
      data.forEach(t => t.month = m);
      return data;
    })
  );

  const results = await Promise.all(promises);
  results.forEach(arr => tweets = tweets.concat(arr));

  // 默认按日期排序
  tweets.sort((a, b) => new Date(b.date) - new Date(a.date));
}

// ========== 初始化 ==========
async function init() {
  // 先渲染空壳
  renderMemberSidebar();
  renderMonthSidebar();
  renderCurrent();

  // 并行加载成员 JSON
  const membersPromise = loadJSON("members.json");

  // 先加载所有月份 JSON，不排序也不显示，只为计算最近三个月
  const now = new Date();
  const startYear = 2024;
  const monthsData = [];

  for (let y=startYear; y<=now.getFullYear(); y++){
    for (let m=1; m<=12; m++){
      const month = `${y}-${String(m).padStart(2,"0")}`;
      monthsData.push(loadJSON(`data/${month}.json`).then(data=>{
        if(data.length>0){
          data.forEach(t=>t.month=month);
          tweets = tweets.concat(data);
        }
      }));
    }
  }

  await Promise.all(monthsData);

  // 获取最近三个月
  const latestMonths = getLatestMonthsFromData(tweets, 3);

  // 只保留最近三个月推文
  tweets = tweets.filter(t => latestMonths.includes(t.month))
                 .sort((a,b)=> new Date(b.date)-new Date(a.date));

  // 加载成员数据
  const memberData = await membersPromise;
  memberData.forEach(m => members[m.id] = m);

  // 数据加载完成后刷新界面
  renderMemberSidebar();
  renderMonthSidebar();
  applyFilters();

  // 首页 icon 点击
  const homeIcon = document.getElementById("homeIcon");
  if (homeIcon) {
    homeIcon.addEventListener("click", () => {
      window.scrollTo(0, 0);
      applyFilters();
    });
  }

  // 搜索框
  const searchInput = document.getElementById("searchInput");
  if (searchInput) {
    searchInput.addEventListener("input", () => {
      visibleCount = 30;
      applyFilters();
    });
  }

  // 排序下拉
  const sortSelect = document.getElementById("sortSelect");
  if (sortSelect) {
    sortSelect.addEventListener("change", e => {
      sortOrder = e.target.value;
      visibleCount = 30;
      applyFilters(currentMember, currentMonth, currentTag);
    });
  }

  // 夜间模式
  const darkToggle = document.getElementById("darkToggle");
  if (darkToggle) {
    darkToggle.addEventListener("click", () => {
      document.body.classList.toggle("dark");
    });
  }

  // 懒加载更多推文
  window.addEventListener("scroll", () => {
    if (loading) return;
    if (window.innerHeight + window.scrollY >= document.body.offsetHeight - 200) {
      loading = true;
      visibleCount += 30;
      renderCurrent();
      loading = false;
    }
  });

  // 背景加载剩余月份 JSON
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

  // 分批并行加载，防止阻塞
  const batchSize = 3;
  for (let i = 0; i < monthsToLoad.length; i += batchSize) {
    const batch = monthsToLoad.slice(i, i + batchSize);
    const promises = batch.map(m => loadJSON(`data/${m}.json`).then(data => {
      data.forEach(t => t.month = m);
      return data;
    }));
    const results = await Promise.all(promises);
    results.forEach(arr => tweets = tweets.concat(arr));

    // 按日期排序
    tweets.sort((a, b) => new Date(b.date) - new Date(a.date));

    // 如果侧边栏已经显示，则更新
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
    if (!grouped[year]) grouped[year] = [];
    if (!grouped[year].includes(t.month)) grouped[year].push(t.month);
    counts[t.month] = (counts[t.month] || 0) + 1;
  });

  const years = Object.keys(grouped).sort((a, b) => b - a);
  years.forEach(year => {
    const yearDiv = document.createElement("div");
    yearDiv.className = "year-item";

    const header = document.createElement("div");
    header.className = "year-header";
    header.innerHTML = `${year} <span class="toggle-arrow">▼</span>`;

    const monthsContainer = document.createElement("div");
    monthsContainer.className = "months-container";
    monthsContainer.style.display = "none";

    grouped[year].sort((a, b) => b.localeCompare(a)).forEach(month => {
      const monthBtn = document.createElement("div");
      monthBtn.className = "month-btn";
      monthBtn.textContent = `${month} (${counts[month]})`;
      monthBtn.addEventListener("click", () => {
        visibleCount = 30;
        currentMonth = month;
        applyFilters(currentMember, currentMonth, currentTag);
        window.scrollTo(0, 0);
      });
      monthsContainer.appendChild(monthBtn);
    });

    header.addEventListener("click", () => {
      const isHidden = monthsContainer.style.display === "none";
      monthsContainer.style.display = isHidden ? "block" : "none";
      header.querySelector(".toggle-arrow").textContent = isHidden ? "▲" : "▼";
    });

    yearDiv.appendChild(header);
    yearDiv.appendChild(monthsContainer);
    sidebar.appendChild(yearDiv);
  });
}

function renderMemberSidebar() {
  const sidebar = document.getElementById("memberSidebar");
  if (!sidebar) return;
  sidebar.innerHTML = "";

  Object.values(members).forEach(m => {
    const btn = document.createElement("div");
    btn.className = "member-btn";
    const img = document.createElement("img");
    img.src = m.avatar;
    img.title = m.name;
    img.loading = "lazy"; // 延迟加载
    btn.appendChild(img);
    btn.addEventListener("click", () => {
      visibleCount = 30;
      currentMember = m.id;
      applyFilters(currentMember, currentMonth, currentTag);
      window.scrollTo(0, 0);
    });
    sidebar.appendChild(btn);
  });
}

// ========== 筛选和排序 ==========
function applyFilters(tag = null) {
  const search = document.getElementById("searchInput")?.value.toLowerCase() || "";
  const member = currentMember || "";
  const month = currentMonth || "";

  currentFiltered = tweets.filter(t =>
    (member === "" || t.member === member) &&
    (month === "" || t.month === month) &&
    t.translation.toLowerCase().includes(search) &&
    (tag === null || (t.tags && t.tags.includes(tag)))
  );

  currentFiltered.sort((a, b) =>
    sortOrder === "new" ? new Date(b.date) - new Date(a.date)
      : new Date(a.date) - new Date(b.date)
  );

  visibleCount = 30;
  renderCurrent();
}

// ========== 渲染推文 ==========
function renderCurrent() {
  const container = document.getElementById("tweetContainer");
  if (!container) return;
  container.innerHTML = "";

  const fragment = document.createDocumentFragment();
  currentFiltered.slice(0, visibleCount).forEach(t => {
    const tweetEl = renderTweet(t);
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
        applyFilters(null, null, tag);
        window.scrollTo(0, 0);
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

// ========== 排序图标 ==========
const sortToggle = document.getElementById("sortToggle");
const sortLabel = document.getElementById("sortLabel");

if (sortToggle && sortLabel) {
  sortToggle.addEventListener("click", () => {
    sortOrder = sortOrder === "new" ? "old" : "new";
    sortToggle.textContent = sortOrder === "new" ? "⬇" : "⬆";
    sortLabel.textContent = sortOrder === "new" ? "新 → 旧" : "旧 → 新";
    sortToggle.title = sortOrder === "new" ? "排序：新 → 旧" : "排序：旧 → 新";
    visibleCount = 30;
    applyFilters(currentMember, currentMonth, currentTag);
  });
}

// ========== 启动 ==========
init();
