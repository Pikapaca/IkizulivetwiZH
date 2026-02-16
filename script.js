let members = {};
let tweets = [];
let currentFiltered = [];
let visibleCount = 30;
let loading = false;

// 安全加载 JSON
async function loadJSON(path) {
  try {
    const res = await fetch(path);
    if(!res.ok) return []; // 文件不存在时返回空数组
    return await res.json();
  } catch(e) {
    console.warn(`Failed to load ${path}:`, e);
    return [];
  }
}

// 初始化
async function init() {
  const memberData = await loadJSON("members.json");
  memberData.forEach(m => {
    members[m.id] = m;

    // 添加成员筛选下拉（如果有的话）
    const opt = document.createElement("option");
    opt.value = m.id;
    opt.textContent = m.name;
    const memberFilter = document.getElementById("memberFilter");
    if(memberFilter) memberFilter.appendChild(opt);
  });

  await loadAllTweets();
  applyFilters();
}

// 加载所有月份的推文
async function loadAllTweets() {
  const now = new Date();
  const startYear = 2024;

  for(let y = startYear; y <= now.getFullYear(); y++){
    for(let m = 1; m <= 12; m++){
      const month = `${y}-${String(m).padStart(2,"0")}`;
      const data = await loadJSON(`data/${month}.json`);
      data.forEach(t => t.month = month);
      tweets = tweets.concat(data);

      // 添加月份下拉（如果有的话）
      const opt = document.createElement("option");
      opt.value = month;
      opt.textContent = month;
      const monthFilter = document.getElementById("monthFilter");
      if(monthFilter) monthFilter.appendChild(opt);
    }
  }

  // 按日期倒序
  tweets.sort((a,b)=> new Date(b.date)-new Date(a.date));
}

// 应用筛选
function applyFilters(tag=null){
  const search = document.getElementById("searchInput")?.value.toLowerCase() || "";
  const member = document.getElementById("memberFilter")?.value || "";
  const month = document.getElementById("monthFilter")?.value || "";
  const sort = document.getElementById("sortOrder")?.value || "new";

  currentFiltered = tweets.filter(t =>
    (member === "" || t.member === member) &&
    (month === "" || t.month === month) &&
    t.translation.toLowerCase().includes(search) &&
    (tag===null || (t.tags && t.tags.includes(tag)))
  );

  currentFiltered.sort((a,b)=> sort==="new"? new Date(b.date)-new Date(a.date)
                                          : new Date(a.date)-new Date(b.date));
  visibleCount = 30;
  renderCurrent();
}

// 渲染当前推文
function renderCurrent(){
  const container = document.getElementById("tweetContainer");
  if(!container) return;
  container.innerHTML = "";
  currentFiltered.slice(0,visibleCount).forEach(renderTweet);
}

// 渲染单条推文
function renderTweet(t){
  const container = document.getElementById("tweetContainer");
  if(!container) return;
  const m = members[t.member];
  if(!m) return;

  const tweet = document.createElement("div");
  tweet.className = "tweet";

  const avatar = document.createElement("img");
  avatar.src = m.avatar;
  avatar.className = "avatar";

  const body = document.createElement("div");
  body.className = "tweet-body";

  // 名字 + ID
  const header = document.createElement("div");
  header.className = "tweet-header";
  header.innerHTML = `<span class="tweet-name">${m.name}</span>
                      <span class="tweet-id">${m.displayId? '@'+m.displayId : ''}</span>`;

  // 内容
  const content = document.createElement("div");
  content.className = "tweet-content";
  content.textContent = t.translation;

  // tags（正文之后，日期之前）
  if(t.tags && t.tags.length>0){
    const tagContainer = document.createElement("div");
    tagContainer.className = "tweet-tags";
    t.tags.forEach(tag=>{
      const tagEl = document.createElement("span");
      tagEl.className = "tweet-tag";
      tagEl.textContent = `#${tag}`;
      tagEl.addEventListener("click",()=>{
        document.getElementById("searchInput").value = "";
        document.getElementById("memberFilter").value = "";
        document.getElementById("monthFilter").value = "";
        visibleCount = 30;
        applyFilters(tag);
        window.scrollTo({top:0, behavior:"smooth"});
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

// 搜索 / 筛选 / 排序监听
["searchInput","memberFilter","monthFilter","sortOrder"].forEach(id=>{
  const el = document.getElementById(id);
  if(el){
    el.addEventListener(id==="searchInput"?"input":"change", ()=>{
      visibleCount = 30;
      applyFilters();
    });
  }
});

// 夜间模式
const darkToggle = document.getElementById("darkToggle");
if(darkToggle){
  darkToggle.addEventListener("click", ()=>{
    document.body.classList.toggle("dark");
  });
}

// header icon 回到首页
const homeIcon = document.getElementById("homeIcon");
if(homeIcon){
  homeIcon.addEventListener("click", ()=>{
    window.scrollTo({top:0, behavior:"smooth"});
  });
}

// 初始化
init();