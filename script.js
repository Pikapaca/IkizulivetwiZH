let members = {};
let tweets = [];
let currentFiltered = [];
let visibleCount = 30;
let loading = false;

// ======================= 加载 JSON =======================
async function loadJSON(path) {
  return fetch(path).then(r => r.json());
}

// ======================= 初始化 =======================
async function init() {
  const memberData = await loadJSON("members.json");
  memberData.forEach(m => {
    members[m.id] = m;

    const opt = document.createElement("option");
    opt.value = m.id;
    opt.textContent = m.name;
    const memberFilter = document.getElementById("memberFilter");
    if(memberFilter) memberFilter.appendChild(opt);
  });

  await loadAllTweets();
  applyFilters(); // 初始化渲染
}

// ======================= 加载推文 =======================
async function loadAllTweets() {
  const now = new Date();
  const startYear = 2024;

  for (let y = startYear; y <= now.getFullYear(); y++) {
    for (let m = 1; m <= 12; m++) {
      const month = `${y}-${String(m).padStart(2,"0")}`;
      try {
        const data = await loadJSON(`data/${month}.json`);
        data.forEach(t => t.month = month);
        tweets = tweets.concat(data);

        const opt = document.createElement("option");
        opt.value = month;
        opt.textContent = month;
        const monthFilter = document.getElementById("monthFilter");
        if(monthFilter) monthFilter.appendChild(opt);

      } catch(e) {
        // 月份文件可能不存在，忽略
      }
    }
  }

  tweets.sort((a,b)=> new Date(b.date) - new Date(a.date));
}

// ======================= 筛选 & 渲染 =======================
function applyFilters(tag=null) {
  const searchInput = document.getElementById("searchInput");
  const memberFilter = document.getElementById("memberFilter");
  const monthFilter = document.getElementById("monthFilter");
  const sortOrder = document.getElementById("sortOrder");

  const search = searchInput ? searchInput.value.toLowerCase() : "";
  const member = memberFilter ? memberFilter.value : "";
  const month = monthFilter ? monthFilter.value : "";

  currentFiltered = tweets.filter(t =>
    (member === "" || t.member === member) &&
    (month === "" || t.month === month) &&
    t.translation.toLowerCase().includes(search) &&
    (tag === null || (t.tags && t.tags.includes(tag)))
  );

  const sort = sortOrder ? sortOrder.value : "new";
  currentFiltered.sort((a,b) => sort === "new" ? new Date(b.date)-new Date(a.date)
                                               : new Date(a.date)-new Date(b.date));
  visibleCount = 30;
  renderCurrent();
}

function renderCurrent() {
  const container = document.getElementById("tweetContainer");
  if(!container) return;
  container.innerHTML = "";

  currentFiltered.slice(0, visibleCount).forEach(renderTweet);
}

function renderTweet(t) {
  const container = document.getElementById("tweetContainer");
  if(!container) return;

  const m = members[t.member];
  if(!m) return;

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
                      <span class="tweet-id">${m.displayId ? '@'+m.displayId : ''}</span>`;

  // 正文
  const content = document.createElement("div");
  content.className = "tweet-content";
  content.textContent = t.translation;

  // tags
  if(t.tags && t.tags.length > 0){
    const tagContainer = document.createElement("div");
    tagContainer.className = "tweet-tags";
    t.tags.forEach(tag=>{
      const tagEl = document.createElement("span");
      tagEl.className = "tweet-tag";
      tagEl.textContent = `#${tag}`;
      tagEl.addEventListener("click", ()=>{
        const searchInput = document.getElementById("searchInput");
        const memberFilter = document.getElementById("memberFilter");
        const monthFilter = document.getElementById("monthFilter");
        if(searchInput) searchInput.value = "";
        if(memberFilter) memberFilter.value = "";
        if(monthFilter) monthFilter.value = "";
        visibleCount = 30;
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
  
if (t.tags && t.tags.length > 0) {
  body.appendChild(tagContainer); // 标签
}

body.appendChild(date);

  tweet.appendChild(avatar);
  tweet.appendChild(body);
  container.appendChild(tweet);
}

// ======================= DOM 加载后绑定事件 =======================
window.addEventListener("DOMContentLoaded", ()=>{

  // 懒加载
  window.addEventListener("scroll", ()=>{
    if(loading) return;
    if(window.innerHeight + window.scrollY >= document.body.offsetHeight - 200){
      loading = true;
      visibleCount += 30;
      renderCurrent();
      loading = false;
    }
  });

  // 搜索 / 成员 / 月份 / 排序变化
  const searchInput = document.getElementById("searchInput");
  const memberFilter = document.getElementById("memberFilter");
  const monthFilter = document.getElementById("monthFilter");
  const sortOrder = document.getElementById("sortOrder");

  if(searchInput) searchInput.addEventListener("input", ()=> applyFilters());
  if(memberFilter) memberFilter.addEventListener("change", ()=> applyFilters());
  if(monthFilter) monthFilter.addEventListener("change", ()=> applyFilters());
  if(sortOrder) sortOrder.addEventListener("change", ()=> applyFilters());

  // 夜间模式
  const darkToggle = document.getElementById("darkToggle");
  if(darkToggle) darkToggle.addEventListener("click", ()=> document.body.classList.toggle("dark"));

  // 菜单开关
  const menuToggle = document.getElementById("menuToggle");
  if(menuToggle) menuToggle.addEventListener("click", ()=>{
    const sidebar = document.getElementById("sidebar");
    if(sidebar) sidebar.classList.toggle("active");
  });

  // 导航高亮
  document.querySelectorAll(".nav-item").forEach(item=>{
    item.addEventListener("click", ()=>{
      document.querySelectorAll(".nav-item").forEach(i=>i.classList.remove("active"));
      item.classList.add("active");
      const pageTitle = document.querySelector(".page-title");
      if(pageTitle) pageTitle.textContent = item.innerText;
    });
  });

  // 首页图标点击回到首页
  const homeIcon = document.getElementById("homeIcon");
  if(homeIcon){
    homeIcon.addEventListener("click", ()=>{
      window.scrollTo(0,0);
      document.querySelectorAll(".nav-item").forEach(i => i.classList.remove("active"));
      const homeNav = document.querySelector('.nav-item[data-page="home"]');
      if(homeNav) homeNav.classList.add("active");
    });
  }

});

// ======================= 初始化 =======================
init();
