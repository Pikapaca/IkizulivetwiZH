let members = {};
let tweets = [];
let visibleCount = 30;
let loading = false;
let sortOrder = "new"; // 默认新→旧
let currentMember = null;
let currentMonth = null;
let currentTag = null;

// 加载 JSON
async function loadJSON(path) {
  try {
    const res = await fetch(path);
    if (!res.ok) return [];
    return await res.json();
  } catch { return []; }
}

// 初始化
async function init() {
  const memberData = await loadJSON("members.json");
  memberData.forEach(m => members[m.id] = m);

  // 加载所有推文
  await loadAllTweets();

  // 渲染侧边栏
  renderMonthSidebar();
  renderMemberSidebar();

  // 初始显示
  applyFilters();

  // 首页 icon 点击
  const homeIcon = document.getElementById("homeIcon");
  if(homeIcon){
    homeIcon.addEventListener("click", ()=>{
      window.scrollTo(0,0);
      applyFilters();
    });
  }

  // 搜索框
  document.getElementById("searchInput").addEventListener("input", ()=>{
    visibleCount = 30;
    applyFilters();
  });

  //排序
 document.getElementById("sortSelect").addEventListener("change", (e)=>{
  sortOrder = e.target.value;
  visibleCount = 30;
  applyFilters(currentMember, currentMonth, currentTag);
});

  // 夜间模式
  document.getElementById("darkToggle").addEventListener("click", ()=>{
    document.body.classList.toggle("dark");
  });

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
}

// 加载所有月份 JSON
async function loadAllTweets() {
  const now = new Date();
  const startYear = 2024;
  for (let y=startYear; y<=now.getFullYear(); y++){
    for (let m=1; m<=12; m++){
      const month = `${y}-${String(m).padStart(2,"0")}`;
      const data = await loadJSON(`data/${month}.json`);
      data.forEach(t => t.month = month);
      tweets = tweets.concat(data);
    }
  }
  tweets.sort((a,b)=> new Date(b.date)-new Date(a.date));
}

// 渲染月份侧边栏
function renderMonthSidebar(){
  const sidebar = document.getElementById("monthSidebar");
  const months = [...new Set(tweets.map(t=>t.month))].sort((a,b)=> new Date(b)-new Date(a));
  months.forEach(m=>{
    const btn = document.createElement("div");
    btn.className = "month-btn";
    btn.textContent = m;
    btn.addEventListener("click", ()=>{
      visibleCount = 30;
      applyFilters(null, m);
      window.scrollTo(0,0);
    });
    sidebar.appendChild(btn);
  });
}

// 渲染成员侧边栏
function renderMemberSidebar(){
  const sidebar = document.getElementById("memberSidebar");
  Object.values(members).forEach(m=>{
    const btn = document.createElement("div");
    btn.className = "member-btn";
    const img = document.createElement("img");
    img.src = m.avatar;
    img.title = m.name;
    btn.appendChild(img);
    btn.addEventListener("click", ()=>{
      visibleCount = 30;
      applyFilters(m.id);
      window.scrollTo(0,0);
    });
    sidebar.appendChild(btn);
  });
}

// 应用筛选
function applyFilters(tag=null) {
  const search = document.getElementById("searchInput").value.toLowerCase();
  const member = currentMember || "";
  const month = currentMonth || "";

  currentFiltered = tweets.filter(t =>
    (member === "" || t.member === member) &&
    (month === "" || t.month === month) &&
    t.translation.toLowerCase().includes(search) &&
    (tag === null || (t.tags && t.tags.includes(tag)))
  );

  // 使用全局 sortOrder，而不是下拉框
  currentFiltered.sort((a,b) => 
    sortOrder === "new" ? new Date(b.date) - new Date(a.date) 
                        : new Date(a.date) - new Date(b.date)
  );

  visibleCount = 30;
  renderCurrent();
}


// 渲染当前推文
function renderCurrent(){
  const container = document.getElementById("tweetContainer");
  container.innerHTML = "";
  currentFiltered.slice(0, visibleCount).forEach(renderTweet);
}

// 渲染单条推文
function renderTweet(t){
  const container = document.getElementById("tweetContainer");
  const m = members[t.member];
  if(!m) return;

  const tweet = document.createElement("div");
  tweet.className = "tweet";

  const avatar = document.createElement("img");
  avatar.src = m.avatar;
  avatar.className = "avatar";

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

  // tag
  if(t.tags && t.tags.length>0){
    const tagContainer = document.createElement("div");
    t.tags.forEach(tag=>{
      const tagEl = document.createElement("span");
      tagEl.className = "tweet-tag";
      tagEl.textContent = `#${tag}`;
      tagEl.addEventListener("click", ()=>{
        visibleCount=30;
        applyFilters(null,null,tag);
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

  body.appendChild(date);
  tweet.appendChild(avatar);
  tweet.appendChild(body);
  container.appendChild(tweet);
}

// 启动
let currentFiltered = [];
init();

const sortToggle = document.getElementById("sortToggle");
const sortLabel = document.getElementById("sortLabel");

if(sortToggle && sortLabel){
  sortToggle.addEventListener("click", () => {
    // 切换排序
    sortOrder = sortOrder === "new" ? "old" : "new";

    // 更新图标
    sortToggle.textContent = sortOrder === "new" ? "⬇" : "⬆";

    // 更新文字提示
    sortLabel.textContent = sortOrder === "new" ? "新 → 旧" : "旧 → 新";

    // 更新 tooltip
    sortToggle.title = sortOrder === "new" ? "排序：新 → 旧" : "排序：旧 → 新";

    // 重置渲染数量并刷新
    visibleCount = 30;
    applyFilters(currentMember, currentMonth, currentTag);
  });
}
