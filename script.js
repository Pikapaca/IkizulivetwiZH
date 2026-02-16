// ========== 全局变量 ==========
let members = {};
let tweets = [];
let currentFiltered = [];
let visibleCount = 30;
let loading = false;

// ========== 加载 JSON ==========
async function loadJSON(path) {
  return fetch(path).then(r => r.json());
}

// ========== 初始化 ==========
async function init() {
  // 加载成员
  const memberData = await loadJSON("members.json");
  memberData.forEach(m => {
    members[m.id] = m;
    const opt = document.createElement("option");
    opt.value = m.id;
    opt.textContent = m.name;
    document.getElementById("memberFilter").appendChild(opt);
  });

  // 加载所有推文
  await loadAllTweets();

  // 初次渲染
  applyFilters();
}

// ========== 加载所有月份推文 ==========
async function loadAllTweets() {
  const now = new Date();
  const startYear = 2024;

  for (let y = startYear; y <= now.getFullYear(); y++) {
    for (let m = 1; m <= 12; m++) {
      const month = `${y}-${String(m).padStart(2, "0")}`;
      try {
        const data = await loadJSON(`data/${month}.json`);
        data.forEach(t => t.month = month);
        tweets = tweets.concat(data);

        const opt = document.createElement("option");
        opt.value = month;
        opt.textContent = month;
        document.getElementById("monthFilter").appendChild(opt);
      } catch {}
    }
  }

  // 按时间倒序
  tweets.sort((a,b)=> new Date(b.date)-new Date(a.date));
}

// ========== 过滤和排序 ==========
function applyFilters(tag=null) {
  const search = document.getElementById("searchInput").value.toLowerCase();
  const member = document.getElementById("memberFilter").value;
  const month = document.getElementById("monthFilter").value;
  const sort = document.getElementById("sortOrder").value;

  currentFiltered = tweets.filter(t =>
    (member === "" || t.member === member) &&
    (month === "" || t.month === month) &&
    t.translation.toLowerCase().includes(search) &&
    (tag === null || (t.tags && t.tags.includes(tag)))
  );

  currentFiltered.sort((a,b)=> sort==="new"? new Date(b.date)-new Date(a.date)
                                           : new Date(a.date)-new Date(b.date));

  visibleCount = 30;
  renderCurrent();
}

// ========== 渲染当前推文 ==========
function renderCurrent() {
  const container = document.getElementById("tweetContainer");
  container.innerHTML = "";
  currentFiltered.slice(0, visibleCount).forEach(renderTweet);
}

// ========== 渲染单条推文 ==========
function renderTweet(t) {
  const container = document.getElementById("tweetContainer");
  const m = members[t.member];
  if (!m) return;

  const tweet = document.createElement("div");
  tweet.className = "tweet";

  // 头像
  const avatar = document.createElement("img");
  avatar.src = m.avatar;
  avatar.className = "avatar";

  const body = document.createElement("div");
  body.className = "tweet-body";

  // 名字 + displayId
  const header = document.createElement("div");
  header.className = "tweet-header";
  header.innerHTML = `<span class="tweet-name">${m.name}</span>
                      <span class="tweet-id">${m.displayId ? m.displayId : ''}</span>`;

  // 正文
  const content = document.createElement("div");
  content.className = "tweet-content";
  content.textContent = t.translation;

  // tags
  if (t.tags && t.tags.length > 0) {
    const tagContainer = document.createElement("div");
    tagContainer.className = "tweet-tags";
    t.tags.forEach(tag => {
      const tagEl = document.createElement("span");
      tagEl.className = "tweet-tag";
      tagEl.textContent = `#${tag}`;
      tagEl.addEventListener("click", ()=>{
        document.getElementById("searchInput").value = "";
        document.getElementById("memberFilter").value = "";
        document.getElementById("monthFilter").value = "";
        applyFilters(tag);
        window.scrollTo(0,0);
      });
      tagContainer.appendChild(tagEl);
    });
    body.appendChild(tagContainer);
  }

  // 日期
  const date = document.createElement("div");
  date.className = "tweet-date";
  date.textContent = t.date;

  // 拼装
  body.appendChild(header);
  body.appendChild(content);
  body.appendChild(date);
  tweet.appendChild(avatar);
  tweet.appendChild(body);
  container.appendChild(tweet);
}

// ========== 懒加载 ==========
window.addEventListener("scroll", ()=>{
  if(loading) return;
  if(window.innerHeight + window.scrollY >= document.body.offsetHeight - 200){
    loading = true;
    visibleCount += 30;
    renderCurrent();
    loading = false;
  }
});

// ========== 输入 / 筛选事件 ==========
document.getElementById("searchInput").addEventListener("input", ()=> applyFilters());
document.getElementById("memberFilter").addEventListener("change", ()=> applyFilters());
document.getElementById("monthFilter").addEventListener("change", ()=> applyFilters());
document.getElementById("sortOrder").addEventListener("change", ()=> applyFilters());

// ========== 夜间模式 ==========
document.getElementById("darkToggle").addEventListener("click", ()=>{
  document.body.classList.toggle("dark");
});

// ========== 菜单开关 ==========
document.getElementById("menuToggle").addEventListener("click", ()=>{
  document.getElementById("sidebar").classList.toggle("active");
});

// ========== 导航高亮 ==========
document.querySelectorAll(".nav-item").forEach(item => {
  item.addEventListener("click", ()=>{
    document.querySelectorAll(".nav-item").forEach(i => i.classList.remove("active"));
    item.classList.add("active");
    document.querySelector(".page-title").textContent = item.innerText;
  });
});

/* 首页图标点击回到首页 - 新增代码 */
const homeIcon = document.getElementById("homeIcon");
if(homeIcon){
  homeIcon.addEventListener("click", ()=>{
    // 回到页面顶部
    window.scrollTo(0,0);

    // 重置导航高亮
    document.querySelectorAll(".nav-item").forEach(i => i.classList.remove("active"));
    const homeNav = document.querySelector('.nav-item[data-page="home"]');
    if(homeNav) homeNav.classList.add("active");
  });
}

// ========== 初始化入口 ==========
init();
