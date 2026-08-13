let me=null,games=[],current=null,busy=false,turbo=false,cat="all",bet=1;
const $=s=>document.querySelector(s);
async function api(u,o={}){const r=await fetch(u,{headers:{"Content-Type":"application/json"},...o});const d=await r.json();if(!r.ok)throw Error(d.error||"ERROR");return d}
function showAuth(){$("#auth").classList.remove("hidden");$("#app").classList.add("hidden")}
function showApp(){$("#auth").classList.add("hidden");$("#app").classList.remove("hidden");update()}
async function boot(){try{me=(await api("/api/me")).user;showApp();load()}catch{showAuth()}}
document.querySelectorAll(".tabs button").forEach(b=>b.onclick=()=>{document.querySelectorAll(".tabs button").forEach(x=>x.classList.remove("active"));b.classList.add("active");$("#login").classList.toggle("hidden",b.dataset.tab!=="login");$("#signup").classList.toggle("hidden",b.dataset.tab!=="signup")});
$("#login").onsubmit=async e=>{e.preventDefault();try{me=(await api("/api/login",{method:"POST",body:JSON.stringify(Object.fromEntries(new FormData(e.target)))})).user;showApp();load()}catch(x){$("#msg").textContent=x.message}};
$("#signup").onsubmit=async e=>{e.preventDefault();try{me=(await api("/api/register",{method:"POST",body:JSON.stringify(Object.fromEntries(new FormData(e.target)))})).user;showApp();load()}catch(x){$("#msg").textContent=x.message}};
$("#logout").onclick=async()=>{await api("/api/logout",{method:"POST"});location.reload()};
function update(){$("#credit").textContent=Number(me.credit).toFixed(2);$("#gcredit").textContent=Number(me.credit).toFixed(2);$("#stats").innerHTML=[["CREDIT",me.credit.toFixed(2)],["PLAYER",me.displayName],["ID",me.id]].map(x=>`<div class="stat"><b>${x[1]}</b><small>${x[0]}</small></div>`).join("")}
async function load(){games=(await api("/api/games")).games;renderGames();const r=await api("/api/leaderboard");$("#rank").innerHTML=r.players.map((p,i)=>`<tr><td>#${i+1}</td><td>${p.name}</td><td>${Number(p.credit).toFixed(2)} CREDIT</td></tr>`).join("")}
function renderGames(){const q=$("#search").value.toLowerCase();let arr=games.filter(g=>(cat==="all"||g.category===cat)&&g.name.toLowerCase().includes(q));$("#grid").innerHTML=arr.map(g=>`<article class="card"><div class="icon">${g.icon}</div><h3>${g.name}</h3><p>${g.mode}</p><button class="play" onclick="openGame('${g.id}')">PLAY</button></article>`).join("")}
$("#search").oninput=renderGames;document.querySelectorAll(".cats button").forEach(b=>b.onclick=()=>{document.querySelectorAll(".cats button").forEach(x=>x.classList.remove("active"));b.classList.add("active");cat=b.dataset.cat;renderGames()});
function openGame(id){current=games.find(g=>g.id===id);$("#modal").classList.remove("hidden");$("#title").innerHTML=`<div class="tag">${current.mode}</div><h2>${current.icon} ${current.name}</h2>`;bet=Math.max(Number(current.config.min_bet)||0.10,1); if(bet>Number(current.config.max_round_cost)) bet=Number(current.config.min_bet)||0.10; syncBet(); draw();$("#result").textContent=""}
$("#close").onclick=()=>$("#modal").classList.add("hidden");
function symbols(){return["🗿","💎","👑","🐍","🔥","🌿","🪙","A","K","Q","J","10"]}
function grid(){const s=symbols();return Array.from({length:6},()=>Array.from({length:5},()=>s[Math.floor(Math.random()*s.length)]))}
function draw(g=grid()){ $("#reels").innerHTML=g.map(c=>`<div class="reel">${c.map(x=>`<div class="cell">${x}</div>`).join("")}</div>`).join("")}
$("#spin").onclick=async()=>{if(busy)return;busy=true;$("#spin").disabled=true;const cost=bet;$("#result").textContent="";let n=0,final=grid();const t=setInterval(()=>{draw(grid());n++;if(n>=(turbo?8:18)){clearInterval(t);finish(final,cost)}},turbo?40:65)};
async function finish(final,cost){try{const d=await api("/api/games/"+current.id+"/play",{method:"POST",body:JSON.stringify({cost})});me.credit=d.credit;update();draw(final);$("#result").textContent=d.tier==="NONE"?`−${d.cost.toFixed(2)} CREDIT`:d.tier==="NORMAL"?`+${d.reward.toFixed(2)} CREDIT`:`${d.tier}  +${d.reward.toFixed(2)} CREDIT`;load()}catch(e){$("#result").textContent=e.message}busy=false;$("#spin").disabled=false}
$("#turbo").onclick=()=>{turbo=!turbo;$("#turbo").textContent=turbo?"⚡ TURBO ON":"⚡ TURBO"};
$("#paytable").onclick=()=>alert("PAYTABLE\nNormal reward: configurable\nBIG / MEGA / EPIC: configurable\nCREDIT is fictional arcade score.");
$("#history").onclick=async()=>{const d=await api("/api/history");alert(d.history.map(h=>`${h.game_id} | cost ${h.cost} | reward ${h.reward} | ${h.tier}`).join("\n")||"No history yet")};
boot();

function syncBet(){
  if(!current)return;
  const min=Number(current.config.min_bet)||0.10;
  const max=Number(current.config.max_round_cost)||10;
  bet=Math.min(max,Math.max(min,Number(bet.toFixed(2))));
  $("#betValue").textContent=bet.toFixed(2);
}
function changeBet(dir){
  if(!current)return;
  const min=Number(current.config.min_bet)||0.10, max=Number(current.config.max_round_cost)||10;
  const step=Number(current.config.bet_step)||0.10;
  const next=Number((bet+dir*step).toFixed(2));
  bet=Math.min(max,Math.max(min,next)); syncBet();
}
$("#betMinus").onclick=()=>changeBet(-1);
$("#betPlus").onclick=()=>changeBet(1);
