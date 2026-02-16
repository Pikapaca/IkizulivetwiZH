let members = {};
let tweets = [];
let visibleCount = 30;
let loading = false;

async function loadJSON(path) {
  return fetch(path).then(r => r.json());
}

async function init() {
  const memberData = await loadJSON("members.json");

  memberData.forEach(m => {
    members[m.id] = m;

    const opt = document.createElement("option");
    opt.value = m.id;
    opt.textContent = m.name;
    document.getElementById("memberFilter").appendChild(opt);
  });

  await loadAllTweets();
  render();
}

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
        document.getElementById("monthFilter").appendChild(opt);

      } catch {}
    }
  }

  tweets.sort((a,b)=> new Date(b.date)-new Date(a.date));
}

function render() {
  let currentFiltered = []; // 当前渲染的推文数组（搜索、筛选、tag 都统一）
let visibleCount = 30;
let loading = false;

// 原有 init() 保持不变
async function init() {
  const memberData = await loadJSON("members.json");
  memberData.forEach(m => {
    members[m.id] = m;
    const opt = document.createElement("option");
    opt.value = m.id;
    opt.textContent = m.name;
    document.getElementById("memberFilter").appendChild(opt);
  });

  await loadAllTweets();
  applyFilters(); // 初始化渲染
}

// 点击 tag / 搜索 / 筛选统一调用
function applyFilters(tag=null) {
  const search = document.getElementById("searchInput").value.toLowerCase();
  const member = document.getElementById("memberFilter").value;
  const month = document.getElementById("monthFilter").value;

  currentFiltered = tweets.filter(t =>
    (member === "" || t.member === member) &&
    (month === "" || t.month === month) &&
    t.translation.toLowerCase().includes(search) &&
    (tag === null || (t.tags && t.tags.includes(tag)))
  );

  const sort = document.getElementById("sortOrder").value;
  currentFiltered.sort((a,b) => sort==="new"? new Date(b.date)-new Date(a.date)
                                          : new Date(a.date)-new Date(b.date));
  visibleCount = 30;
  renderCurrent();
}

// 根据 currentFiltered 渲染页面
function renderCurrent() {
  const container = document.getElementById("tweetContainer");
  container.innerHTML = "";

  currentFiltered.slice(0, visibleCount).forEach(renderTweet);
}

// 渲染单条推文
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
                      <span class="tweet-id">${m.displayId ? '@'+m.displayId : ''}</span>`;

  // 正文
  const content = document.createElement("div");
  content.className = "tweet-content";
  content.textContent = t.translation;

  // tags
  if (t.tags && t.tags.length > 0) {
    const tagContainer = document.createElement("div");
    tagContainer.className = "tweet-tags";
    t.tags.forEach(tag=>{
      const tagEl = document.createElement("span");
      tagEl.className = "tweet-tag";
      tagEl.textContent = `#${tag}`;
      tagEl.addEventListener("click", ()=>{
        document.getElementById("searchInput").value = "";
        document.getElementById("memberFilter").value = "";
        document.getElementById("monthFilter").value = "";
        visibleCount = 30;
        applyFilters(tag);
        window.scrollTo(0,0); // 点击 tag 回到顶部
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
window.addEventListener("scroll",()=>{
  if(loading) return;
  if(window.innerHeight + window.scrollY >= document.body.offsetHeight - 200){
    loading = true;
    visibleCount += 30;
    renderCurrent();
    loading = false;
  }
});

// 搜索 / 成员 / 月份 / 排序变化都调用 applyFilters()
document.getElementById("searchInput").addEventListener("input",()=> applyFilters());
document.getElementById("memberFilter").addEventListener("change",()=> applyFilters());
document.getElementById("monthFilter").addEventListener("change",()=> applyFilters());
document.getElementById("sortOrder").addEventListener("change",()=> applyFilters());


/* 懒加载 */
window.addEventListener("scroll",()=>{
  if(loading) return;
  if(window.innerHeight+window.scrollY>=document.body.offsetHeight-200){
    loading=true;
    visibleCount+=30;
    render();
    loading=false;
  }
});

/* 筛选监听 */
document.getElementById("searchInput").addEventListener("input",()=>{visibleCount=30;render();});
document.getElementById("memberFilter").addEventListener("change",()=>{visibleCount=30;render();});
document.getElementById("monthFilter").addEventListener("change",()=>{visibleCount=30;render();});
document.getElementById("sortOrder").addEventListener("change",()=>{visibleCount=30;render();});

/* 夜间模式 */
document.getElementById("darkToggle").addEventListener("click",()=>{
  document.body.classList.toggle("dark");
});

init();

/* 菜单开关 */
document.getElementById("menuToggle").addEventListener("click",()=>{
  document.getElementById("sidebar").classList.toggle("active");
});

/* 导航高亮 */
document.querySelectorAll(".nav-item").forEach(item=>{
  item.addEventListener("click",()=>{
    document.querySelectorAll(".nav-item").forEach(i=>i.classList.remove("active"));
    item.classList.add("active");
    document.querySelector(".page-title").textContent = item.innerText;
  });
});

// 初始化
init();  // 确保 init() 调用在最后
