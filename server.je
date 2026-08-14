const express = require("express");
const fs = require("fs");
const path = require("path");
const crypto = require("crypto");

const app = express();

const PORT = process.env.PORT || 3000;
const DIR =
  process.env.DATA_DIR || path.join(__dirname, "data");
const FILE = path.join(DIR, "store.json");

// =========================
// DATA
// =========================

fs.mkdirSync(DIR, { recursive: true });

const games = [
  ["aztec-gold", "AZTEC GOLD", "REELS", "👑"],
  ["dragon-empire", "DRAGON EMPIRE", "REELS", "🐉"],
  ["thunder-temple", "THUNDER TEMPLE", "REELS", "⚡"],
  ["ocean-treasure", "OCEAN TREASURE", "SPECIAL", "🌊"],
  ["desert-king", "DESERT KING", "REELS", "🏜️"],
  ["samurai-fortune", "SAMURAI FORTUNE", "REELS", "⚔️"],
  ["greek-myth", "GREEK MYTH", "REELS", "🏛️"],
  ["volcano-quest", "VOLCANO QUEST", "SPECIAL", "🌋"],
  ["cosmic-gems", "COSMIC GEMS", "SPECIAL", "💎"],
  ["pirate-treasure", "PIRATE TREASURE", "REELS", "🏴‍☠️"]
].map((x) => ({
  id: x[0],
  name: x[1],
  category: x[2],
  icon: x[3],

  // SCORE ONLY
  minBet: 1,
  maxBet: 100,
  betStep: 1,

  // FREE SPIN
  scatterNeeded: 4,
  freeSpins: 10,

  payout: {
    normal: 1.5,
    big: 5,
    mega: 20,
    epic: 50
  },

  chances: {
    normal: 22,
    big: 8,
    mega: 2.5,
    epic: 0.5
  }
}));

let db;

try {
  db = JSON.parse(fs.readFileSync(FILE, "utf8"));
} catch {
  db = {
    users: [],
    sessions: {},
    history: [],
    settings: {
      signupScore: 1000,
      enabled: true
    },
    games
  };

  save();
}

function save() {
  fs.writeFileSync(
    FILE,
    JSON.stringify(db, null, 2),
    "utf8"
  );
}

// =========================
// HELPERS
// =========================

const id = () =>
  crypto.randomUUID();

const tok = () =>
  crypto.randomBytes(24).toString("hex");

const hash = (s) =>
  crypto
    .createHash("sha256")
    .update(String(s))
    .digest("hex");

function sess(req) {
  const token =
    req.headers["x-session-token"];

  return token
    ? db.sessions[token]
    : null;
}

function auth(req, res, next) {
  const s = sess(req);

  const u =
    s &&
    db.users.find(
      (x) => x.id === s.userId
    );

  if (!u) {
    return res
      .status(401)
      .json({
        error: "LOGIN_REQUIRED"
      });
  }

  req.user = u;
  next();
}

function adm(req, res, next) {
  const s = sess(req);

  if (!s?.admin) {
    return res
      .status(401)
      .json({
        error: "ADMIN_REQUIRED"
      });
  }

  next();
}

function pub(u) {
  return {
    id: u.id,
    username: u.username,
    displayName: u.displayName,
    score: Number(u.score.toFixed(2))
  };
}

// =========================
// MIDDLEWARE
// =========================

app.use(express.json());

app.use(
  express.static(
    path.join(__dirname, "public")
  )
);

// =========================
// USER API
// =========================

app.post("/api/register", (req, res) => {
  const {
    username,
    displayName,
    password
  } = req.body || {};

  const un = String(
    username || ""
  )
    .trim()
    .toLowerCase();

  if (
    !/^[a-z0-9_]{3,20}$/.test(un) ||
    String(password || "").length < 6
  ) {
    return res
      .status(400)
      .json({
        error:
          "Username 3-20 ตัว และ Password อย่างน้อย 6 ตัว"
      });
  }

  if (
    db.users.some(
      (u) => u.username === un
    )
  ) {
    return res
      .status(409)
      .json({
        error:
          "Username นี้มีอยู่แล้ว"
      });
  }

  const u = {
    id: id(),
    username: un,
    displayName: String(
      displayName || un
    ).slice(0, 30),
    password: hash(password),
    score: Number(
      db.settings.signupScore
    ),
    createdAt: Date.now()
  };

  db.users.push(u);

  const t = tok();

  db.sessions[t] = {
    userId: u.id
  };

  save();

  res.json({
    user: pub(u),
    token: t
  });
});

app.post("/api/login", (req, res) => {
  const username = String(
    req.body?.username || ""
  )
    .trim()
    .toLowerCase();

  const password = String(
    req.body?.password || ""
  );

  const u = db.users.find(
    (x) => x.username === username
  );

  if (
    !u ||
    u.password !== hash(password)
  ) {
    return res
      .status(401)
      .json({
        error:
          "Username หรือ Password ไม่ถูกต้อง"
      });
  }

  const t = tok();

  db.sessions[t] = {
    userId: u.id
  };

  save();

  res.json({
    user: pub(u),
    token: t
  });
});

app.post(
  "/api/logout",
  auth,
  (req, res) => {
    const token =
      req.headers["x-session-token"];

    delete db.sessions[token];

    save();

    res.json({
      ok: true
    });
  }
);

app.get(
  "/api/me",
  auth,
  (req, res) => {
    res.json({
      user: pub(req.user)
    });
  }
);

// =========================
// GAMES
// =========================

app.get(
  "/api/games",
  auth,
  (req, res) => {
    res.json({
      games: db.games
    });
  }
);

function pick(g) {
  const r =
    Math.random() * 100;

  const c = g.chances;

  if (r < c.epic)
    return "EPIC";

  if (
    r <
    c.epic +
      c.mega
  )
    return "MEGA";

  if (
    r <
    c.epic +
      c.mega +
      c.big
  )
    return "BIG";

  if (
    r <
    c.epic +
      c.mega +
      c.big +
      c.normal
  )
    return "NORMAL";

  return "NONE";
}

app.post(
  "/api/games/:id/play",
  auth,
  (req, res) => {
    if (!db.settings.enabled) {
      return res
        .status(403)
        .json({
          error:
            "เกมถูกปิด"
        });
    }

    const g = db.games.find(
      (x) =>
        x.id === req.params.id
    );

    if (!g) {
      return res
        .status(404)
        .json({
          error:
            "GAME_NOT_FOUND"
        });
    }

    let cost = Number(
      req.body?.cost
    );

    if (
      !Number.isFinite(cost) ||
      cost <= 0
    ) {
      cost = g.minBet;
    }

    cost = Math.min(
      g.maxBet,
      Math.max(
        g.minBet,
        cost
      )
    );

    if (
      req.user.score < cost
    ) {
      return res
        .status(400)
        .json({
          error:
            "SCORE NOT ENOUGH"
        });
    }

    const tier = pick(g);

    const multiplier = {
      NONE: 0,
      NORMAL: g.payout.normal,
      BIG: g.payout.big,
      MEGA: g.payout.mega,
      EPIC: g.payout.epic
    }[tier];

    const reward = Number(
      (
        cost * multiplier
      ).toFixed(2)
    );

    req.user.score = Number(
      (
        req.user.score -
        cost +
        reward
      ).toFixed(2)
    );

    // Scatter
    const scatter =
      Math.floor(
        Math.random() * 6
      );

    const free =
      scatter >=
      g.scatterNeeded
        ? g.freeSpins
        : 0;

    db.history.unshift({
      id: id(),
      userId: req.user.id,
      gameId: g.id,
      cost,
      reward,
      tier,
      scatter,
      free,
      at: Date.now()
    });

    save();

    res.json({
      score: req.user.score,
      cost,
      reward,
      tier,
      scatter,
      free
    });
  }
);

// =========================
// HISTORY
// =========================

app.get(
  "/api/history",
  auth,
  (req, res) => {
    res.json({
      history:
        db.history
          .filter(
            (x) =>
              x.userId ===
              req.user.id
          )
          .slice(0, 50)
    });
  }
);

// =========================
// ADMIN LOGIN
// =========================

app.post(
  "/api/admin/login",
  (req, res) => {
    const username = String(
      req.body?.username || ""
    );

    const password = String(
      req.body?.password || ""
    );

    const adminUser =
      process.env.ADMIN_USER ||
      "admin";

    const adminPass =
      process.env.ADMIN_PASS ||
      "admin123";

    if (
      username !== adminUser ||
      password !== adminPass
    ) {
      return res
        .status(401)
        .json({
          error:
            "ADMIN_LOGIN_FAILED"
        });
    }

    const t = tok();

    db.sessions[t] = {
      admin: true
    };

    save();

    res.json({
      token: t
    });
  }
);

// =========================
// ADMIN API
// =========================

app.get(
  "/api/admin/overview",
  adm,
  (req, res) => {
    res.json({
      users:
        db.users.map(pub),
      games: db.games,
      settings:
        db.settings
    });
  }
);

app.patch(
  "/api/admin/settings",
  adm,
  (req, res) => {
    if (
      req.body?.signupScore !=
      null
    ) {
      db.settings.signupScore =
        Math.max(
          0,
          Number(
            req.body.signupScore
          ) || 0
        );
    }

    if (
      req.body?.enabled !=
      null
    ) {
      db.settings.enabled =
        Boolean(
          req.body.enabled
        );
    }

    save();

    res.json({
      ok: true
    });
  }
);

app.patch(
  "/api/admin/users/:id",
  adm,
  (req, res) => {
    const u = db.users.find(
      (x) =>
        x.id ===
        req.params.id
    );

    if (!u) {
      return res
        .status(404)
        .json({
          error:
            "USER_NOT_FOUND"
        });
    }

    if (
      req.body?.score !=
      null
    ) {
      u.score = Math.max(
        0,
        Number(
          req.body.score
        ) || 0
      );
    }

    save();

    res.json({
      user: pub(u)
    });
  }
);

app.patch(
  "/api/admin/games/:id",
  adm,
  (req, res) => {
    const g = db.games.find(
      (x) =>
        x.id ===
        req.params.id
    );

    if (!g) {
      return res
        .status(404)
        .json({
          error:
            "GAME_NOT_FOUND"
        });
    }

    for (
      const k of [
        "minBet",
        "maxBet",
        "betStep",
        "scatterNeeded",
        "freeSpins"
      ]
    ) {
      if (
        req.body?.[k] !=
        null
      ) {
        g[k] = Math.max(
          0,
          Number(
            req.body[k]
          ) || 0
        );
      }
    }

    for (
      const group of [
        "payout",
        "chances"
      ]
    ) {
      if (
        req.body?.[group]
      ) {
        for (
          const k of Object.keys(
            req.body[group]
          )
        ) {
          if (
            g[group][k] !=
            null
          ) {
            g[group][k] =
              Math.max(
                0,
                Number(
                  req.body[group][k]
                ) || 0
              );
          }
        }
      }
    }

    save();

    res.json({
      game: g
    });
  }
);

// =========================
// ADMIN PAGE
// =========================

app.get(
  "/admin",
  (req, res) => {
    res.sendFile(
      path.join(
        __dirname,
        "public",
        "admin.html"
      )
    );
  }
);

app.get(
  "/admin.html",
  (req, res) => {
    res.sendFile(
      path.join(
        __dirname,
        "public",
        "admin.html"
      )
    );
  }
);

// =========================
// SPA FALLBACK
// Express 5 compatible
// =========================

app.use(
  (req, res) => {
    res.sendFile(
      path.join(
        __dirname,
        "public",
        "index.html"
      )
    );
  }
);

// =========================
// START
// =========================

app.listen(
  PORT,
  "0.0.0.0",
  () => {
    console.log(
      `NEON ROYALE V8 running on port ${PORT}`
    );
  }
);
