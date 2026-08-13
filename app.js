let me = null;
let games = [];
let current = null;
let busy = false;
let turbo = false;
let cat = "all";
let bet = 1;

const $ = s => document.querySelector(s);

const STORAGE = {
  users: "neon_royale_users",
  session: "neon_royale_session",
  history: "neon_royale_history",
  leaderboard: "neon_royale_leaderboard"
};


/* =========================
   STORAGE
========================= */

function read(key, fallback) {
  try {
    const value = localStorage.getItem(key);
    return value ? JSON.parse(value) : fallback;
  } catch {
    return fallback;
  }
}

function write(key, value) {
  localStorage.setItem(key, JSON.stringify(value));
}

function users() {
  return read(STORAGE.users, []);
}

function saveUsers(value) {
  write(STORAGE.users, value);
}

function currentSession() {
  const username = localStorage.getItem(STORAGE.session);

  if (!username) return null;

  return users().find(
    x => x.username === username
  ) || null;
}


/* =========================
   DEFAULT GAMES
========================= */

const DEFAULT_GAMES = [
  ["aztec-cascade", "AZTEC CASCADE", "🗿", "REELS", "reel"],
  ["temple-wheel", "TEMPLE WHEEL", "🎡", "SPECIAL", "special"],
  ["golden-cards", "GOLDEN CARDS", "🃏", "ARCADE", "arcade"],
  ["aztec-dice", "AZTEC DICE", "🎲", "SPECIAL", "special"],
  ["emerald-match", "EMERALD MATCH", "💎", "ARCADE", "arcade"],
  ["temple-run", "TEMPLE RUN", "🏃", "ARCADE", "arcade"],
  ["relic-hunt", "RELIC HUNT", "🏺", "SPECIAL", "special"],
  ["serpent-memory", "SERPENT MEMORY", "🐍", "ARCADE", "arcade"],
  ["golden-drop", "GOLDEN DROP", "🪙", "ARCADE", "arcade"],
  ["temple-boss", "TEMPLE BOSS", "👹", "SPECIAL", "special"]
].map(x => ({
  id: x[0],
  name: x[1],
  icon: x[2],
  mode: x[3],
  category: x[4],

  config: {
    min_bet: 1,
    max_round_cost: 10,
    bet_step: 1
  }
}));


function ensureDemoData() {
  if (!localStorage.getItem(STORAGE.users)) {
    saveUsers([]);
  }

  if (!localStorage.getItem(STORAGE.history)) {
    write(STORAGE.history, []);
  }

  if (!localStorage.getItem(STORAGE.leaderboard)) {
    write(STORAGE.leaderboard, []);
  }
}


/* =========================
   AUTH UI
========================= */

function showAuth() {
  $("#auth").classList.remove("hidden");
  $("#app").classList.add("hidden");
}

function showApp() {
  $("#auth").classList.add("hidden");
  $("#app").classList.remove("hidden");
  update();
}


/* =========================
   BOOT
========================= */

function boot() {
  ensureDemoData();

  const session = currentSession();

  if (session) {
    me = session;
    showApp();
    load();
  } else {
    showAuth();
  }
}


/* =========================
   TABS
========================= */

document
  .querySelectorAll(".tabs button")
  .forEach(button => {

    button.onclick = () => {

      document
        .querySelectorAll(".tabs button")
        .forEach(x =>
          x.classList.remove("active")
        );

      button.classList.add("active");

      $("#login").classList.toggle(
        "hidden",
        button.dataset.tab !== "login"
      );

      $("#signup").classList.toggle(
        "hidden",
        button.dataset.tab !== "signup"
      );

      $("#msg").textContent = "";
    };
  });


/* =========================
   LOGIN
========================= */

$("#login").onsubmit = e => {
  e.preventDefault();

  const data =
    Object.fromEntries(
      new FormData(e.target)
    );

  const user = users().find(
    x =>
      x.username.toLowerCase() ===
        data.username.toLowerCase() &&
      x.password === data.password
  );

  if (!user) {
    $("#msg").textContent =
      "Invalid username or password";
    return;
  }

  me = user;

  localStorage.setItem(
    STORAGE.session,
    user.username
  );

  showApp();
  load();
};


/* =========================
   SIGN UP
========================= */

$("#signup").onsubmit = e => {
  e.preventDefault();

  const data =
    Object.fromEntries(
      new FormData(e.target)
    );

  if (data.password.length < 6) {
    $("#msg").textContent =
      "Password must be at least 6 characters";
    return;
  }

  const list = users();

  if (
    list.some(
      x =>
        x.username.toLowerCase() ===
        data.username.toLowerCase()
    )
  ) {
    $("#msg").textContent =
      "Username already exists";
    return;
  }

  const user = {
    id: Date.now(),
    username: data.username,
    displayName: data.displayName,
    password: data.password,

    // fictional arcade credit
    credit: 0,

    gamesPlayed: 0,
    bestScore: 0,
    xp: 0
  };

  list.push(user);
  saveUsers(list);

  me = user;

  localStorage.setItem(
    STORAGE.session,
    user.username
  );

  showApp();
  load();
};


/* =========================
   LOGOUT
========================= */

$("#logout").onclick = () => {

  localStorage.removeItem(
    STORAGE.session
  );

  me = null;

  location.reload();
};


/* =========================
   SAVE CURRENT USER
========================= */

function saveCurrentUser() {

  const list = users();

  const index =
    list.findIndex(
      x =>
        x.username === me.username
    );

  if (index === -1) return;

  list[index] = me;

  saveUsers(list);
}


/* =========================
   PLAYER UPDATE
========================= */

function update() {

  if (!me) return;

  const credit =
    Number(me.credit || 0);

  $("#credit").textContent =
    credit.toFixed(2);

  $("#gcredit").textContent =
    credit.toFixed(2);

  $("#stats").innerHTML = [
    ["CREDIT", credit.toFixed(2)],
    ["PLAYER", me.displayName],
    ["ID", me.id]
  ]
    .map(
      x =>
        `<div class="stat">
          <b>${escapeHTML(x[1])}</b>
          <small>${escapeHTML(x[0])}</small>
        </div>`
    )
    .join("");
}


/* =========================
   LOAD
========================= */

function load() {

  games = DEFAULT_GAMES;

  renderGames();
  renderLeaderboard();
}


/* =========================
   GAMES
========================= */

function renderGames() {

  const q =
    ($("#search").value || "")
      .toLowerCase()
      .trim();

  const arr =
    games.filter(game => {

      const categoryOK =
        cat === "all" ||
        game.category === cat;

      const searchOK =
        !q ||
        game.name
          .toLowerCase()
          .includes(q);

      return categoryOK && searchOK;
    });

  $("#grid").innerHTML =
    arr.map(
      game =>
        `<article class="card">
          <div class="icon">
            ${game.icon}
          </div>

          <h3>
            ${escapeHTML(game.name)}
          </h3>

          <p>
            ${escapeHTML(game.mode)}
          </p>

          <button
            class="play"
            onclick="openGame('${game.id}')"
          >
            PLAY
          </button>
        </article>`
    ).join("");
}


$("#search").oninput =
  renderGames;


document
  .querySelectorAll(".cats button")
  .forEach(button => {

    button.onclick = () => {

      document
        .querySelectorAll(".cats button")
        .forEach(x =>
          x.classList.remove("active")
        );

      button.classList.add("active");

      cat = button.dataset.cat;

      renderGames();
    };
  });


/* =========================
   OPEN GAME
========================= */

function openGame(id) {

  current =
    games.find(
      game => game.id === id
    );

  if (!current) return;

  $("#modal")
    .classList
    .remove("hidden");

  $("#title").innerHTML =
    `<div class="tag">
      ${escapeHTML(current.mode)}
    </div>

    <h2>
      ${current.icon}
      ${escapeHTML(current.name)}
    </h2>`;

  bet =
    Number(current.config.min_bet) || 1;

  syncBet();

  draw();

  $("#result").textContent = "";
}


$("#close").onclick = () => {
  $("#modal").classList.add("hidden");
};


/* =========================
   SYMBOLS
========================= */

function symbols() {

  return [
    "🗿",
    "💎",
    "👑",
    "🐍",
    "🔥",
    "🌿",
    "🪙",
    "A",
    "K",
    "Q",
    "J",
    "10"
  ];
}


function grid() {

  const list = symbols();

  return Array.from(
    { length: 6 },
    () =>
      Array.from(
        { length: 5 },
        () =>
          list[
            Math.floor(
              Math.random() *
              list.length
            )
          ]
      )
  );
}


function draw(g = grid()) {

  $("#reels").innerHTML =
    g.map(
      column =>
        `<div class="reel">
          ${column
            .map(
              symbol =>
                `<div class="cell">
                  ${symbol}
                </div>`
            )
            .join("")}
        </div>`
    ).join("");
}


/* =========================
   SPIN
========================= */

$("#spin").onclick = () => {

  if (busy) return;

  if (!me) {
    $("#result").textContent =
      "Please login first.";
    return;
  }

  const credit =
    Number(me.credit || 0);

  const cost =
    Number(bet || 0);

  /*
    IMPORTANT:
    0 CREDIT cannot play.
  */

  if (credit <= 0) {

    $("#result").textContent =
      "CREDIT ไม่พอ";

    return;
  }

  if (credit < cost) {

    $("#result").textContent =
      `CREDIT ไม่พอ — ต้องใช้ ${cost.toFixed(2)}`;

    return;
  }


  /* หัก credit ก่อนเริ่มรอบ */

  me.credit =
    Number(
      (credit - cost).toFixed(2)
    );

  saveCurrentUser();
  update();


  busy = true;

  $("#spin").disabled = true;

  $("#result").textContent = "";


  let n = 0;

  const finalGrid = grid();

  const timer =
    setInterval(() => {

      draw(grid());

      n++;

      if (
        n >=
        (turbo ? 8 : 18)
      ) {

        clearInterval(timer);

        finish(
          finalGrid,
          cost
        );
      }

    }, turbo ? 40 : 65);
};


/* =========================
   FINISH
========================= */

function finish(
  finalGrid,
  cost
) {

  const reward =
    calculateReward();


  /*
    เพิ่มเฉพาะ reward
    หลังจากหัก cost ไปแล้ว
  */

  me.credit =
    Number(
      (
        Number(me.credit || 0) +
        reward
      ).toFixed(2)
    );


  me.gamesPlayed =
    Number(me.gamesPlayed || 0) + 1;


  me.bestScore =
    Math.max(
      Number(me.bestScore || 0),
      reward
    );


  me.xp =
    Number(me.xp || 0) +
    Math.max(
      1,
      Math.floor(reward / 10)
    );


  saveCurrentUser();


  addHistory({
    game_id: current.id,
    cost,
    reward,
    created_at:
      new Date().toISOString()
  });


  draw(finalGrid);


  if (reward >= 250) {

    $("#result").textContent =
      `TREASURE! +${reward.toFixed(2)} CREDIT`;

  } else {

    $("#result").textContent =
      `+${reward.toFixed(2)} CREDIT`;
  }


  update();
  renderLeaderboard();


  busy = false;

  $("#spin").disabled = false;
}


/* =========================
   REWARD
========================= */

function calculateReward() {

  const roll =
    Math.random();

  if (roll < 0.05)
    return 500;

  if (roll < 0.15)
    return 250;

  if (roll < 0.35)
    return 100;

  if (roll < 0.65)
    return 50;

  return 10;
}


/* =========================
   TURBO
========================= */

$("#turbo").onclick = () => {

  turbo = !turbo;

  $("#turbo").textContent =
    turbo
      ? "⚡ TURBO ON"
      : "⚡ TURBO";
};


/* =========================
   PAYTABLE
========================= */

$("#paytable").onclick = () => {

  alert(
`ARCADE SCORE

10   — Common
50   — Rare
100  — Epic
250  — Treasure
500  — Legendary

CREDIT เป็นคะแนนสมมติในเกมเท่านั้น`
  );
};


/* =========================
   HISTORY
========================= */

$("#history").onclick = () => {

  const history =
    read(STORAGE.history, [])
      .filter(
        x =>
          x.username ===
          me.username
      );

  if (!history.length) {

    alert("No history yet");

    return;
  }

  alert(
    history
      .slice()
      .reverse()
      .map(
        h =>
          `${h.game_id} | cost ${Number(h.cost).toFixed(2)} | reward ${Number(h.reward).toFixed(2)}`
      )
      .join("\n")
  );
};


function addHistory(entry) {

  const history =
    read(STORAGE.history, []);

  history.push({
    ...entry,
    username: me.username
  });

  write(
    STORAGE.history,
    history.slice(-100)
  );
}


/* =========================
   LEADERBOARD
========================= */

function renderLeaderboard() {

  const board =
    read(
      STORAGE.leaderboard,
      []
    );

  const players = [
    ...board,
    {
      name:
        me?.displayName || "YOU",
      credit:
        me?.credit || 0
    }
  ];


  players.sort(
    (a, b) =>
      Number(b.credit) -
      Number(a.credit)
  );


  $("#rank").innerHTML =
    players
      .slice(0, 10)
      .map(
        (p, i) =>
          `<tr>
            <td>#${i + 1}</td>
            <td>${escapeHTML(p.name)}</td>
            <td>${Number(p.credit).toFixed(2)} CREDIT</td>
          </tr>`
      )
      .join("");
}


/* =========================
   BET / PLAY COST
========================= */

function syncBet() {

  if (!current) return;

  const min =
    Number(
      current.config.min_bet
    ) || 1;

  const max =
    Number(
      current.config.max_round_cost
    ) || 10;


  bet =
    Math.min(
      max,
      Math.max(
        min,
        Number(bet.toFixed(2))
      )
    );


  $("#betValue").textContent =
    bet.toFixed(2);
}


function changeBet(direction) {

  if (!current) return;

  const min =
    Number(
      current.config.min_bet
    ) || 1;

  const max =
    Number(
      current.config.max_round_cost
    ) || 10;

  const step =
    Number(
      current.config.bet_step
    ) || 1;


  const next =
    Number(
      (
        bet +
        direction * step
      ).toFixed(2)
    );


  bet =
    Math.min(
      max,
      Math.max(
        min,
        next
      )
    );


  syncBet();
}


$("#betMinus").onclick =
  () => changeBet(-1);

$("#betPlus").onclick =
  () => changeBet(1);


/* =========================
   ESCAPE HTML
========================= */

function escapeHTML(value) {

  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}


/* =========================
   START
========================= */

boot();
