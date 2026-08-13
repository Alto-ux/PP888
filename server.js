const express=require("express");
const session=require("express-session");
const bcrypt=require("bcryptjs");
const Database=require("better-sqlite3");
const path=require("path");
const crypto=require("crypto");

const app=express(), db=new Database(path.join(__dirname,"neon-royale.db"));
db.pragma("journal_mode=WAL");
db.exec(`
CREATE TABLE IF NOT EXISTS users(
 id INTEGER PRIMARY KEY AUTOINCREMENT, username TEXT UNIQUE NOT NULL,
 display_name TEXT NOT NULL, password_hash TEXT NOT NULL,
 role TEXT NOT NULL DEFAULT 'player', credit REAL NOT NULL DEFAULT 0,
 created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE TABLE IF NOT EXISTS game_config(
 game_id TEXT PRIMARY KEY, enabled INTEGER DEFAULT 1,
 min_reward REAL DEFAULT 0, max_reward REAL DEFAULT 2,
 big_reward REAL DEFAULT 5, mega_reward REAL DEFAULT 10, epic_reward REAL DEFAULT 25,
 big_event_percent REAL DEFAULT 5, mega_event_percent REAL DEFAULT 1,
 epic_event_percent REAL DEFAULT .2, max_round_cost REAL DEFAULT 10, min_bet REAL DEFAULT 0.10, bet_step REAL DEFAULT 0.10
);
CREATE TABLE IF NOT EXISTS history(
 id INTEGER PRIMARY KEY AUTOINCREMENT,user_id INTEGER NOT NULL,game_id TEXT NOT NULL,
 cost REAL NOT NULL,reward REAL NOT NULL,tier TEXT NOT NULL,created_at TEXT DEFAULT CURRENT_TIMESTAMP
);
CREATE TABLE IF NOT EXISTS audit_logs(
 id INTEGER PRIMARY KEY AUTOINCREMENT,admin_id INTEGER,action TEXT NOT NULL,
 target_user_id INTEGER,old_value TEXT,new_value TEXT,created_at TEXT DEFAULT CURRENT_TIMESTAMP
);`);

const GAMES=[
 ["aztec-relics","Aztec Relics","🗿","6×5 Cascade","reel"],
 ["lucky-koi","Lucky Koi","🐟","5×3 Koi Event","reel"],
 ["temple-tiles","Temple Tiles","🀄","Tile Match","reel"],
 ["crystal-fortune","Crystal Fortune","💎","Gem Cluster","reel"],
 ["serpent-gold","Serpent Gold","🐍","Expanding Wild","reel"],
 ["lotus-dream","Lotus Dream","🌸","Chain System","special"],
 ["dragon-forge","Dragon Forge","🐉","Symbol Upgrade","special"],
 ["golden-guardian","Golden Guardian","🦁","Guardian Event","special"],
 ["jungle-relics","Jungle Relics","🌴","Expedition Event","arcade"],
 ["temple-rush","Temple Rush","⚡","Fast Cascade","arcade"]
];
for(const col of ["min_bet","bet_step"]) {
  try { db.exec(`ALTER TABLE game_config ADD COLUMN ${col} REAL DEFAULT 0.10`); } catch(e) {}
}
try { db.exec("ALTER TABLE game_config ADD COLUMN max_round_cost REAL DEFAULT 10"); } catch(e) {}
for(const [id] of GAMES) db.prepare("INSERT OR IGNORE INTO game_config(game_id) VALUES(?)").run(id);
db.prepare("UPDATE game_config SET min_bet=COALESCE(min_bet,0.10), bet_step=COALESCE(bet_step,0.10), max_round_cost=COALESCE(max_round_cost,10)").run();
db.prepare(`INSERT OR IGNORE INTO users(username,display_name,password_hash,role) VALUES('admin','NEON Admin',?,'admin')`).run(bcrypt.hashSync("admin123",10));
db.prepare("UPDATE users SET role='admin', password_hash=? WHERE username='admin'").run(bcrypt.hashSync("admin123",10));

app.use(express.json()); app.use(express.urlencoded({extended:true}));
app.use(session({secret:process.env.SESSION_SECRET||crypto.randomBytes(32).toString("hex"),resave:false,saveUninitialized:false,cookie:{httpOnly:true,sameSite:"lax",maxAge:7*86400000}}));
app.use(express.static(path.join(__dirname,"public")));

const userOut=u=>({id:u.id,username:u.username,displayName:u.display_name,role:u.role,credit:Number(u.credit)});
function requireLogin(req,res,next){if(!req.session.userId)return res.status(401).json({error:"LOGIN_REQUIRED"});next()}
function requireAdmin(req,res,next){if(!req.session.userId)return res.status(401).json({error:"LOGIN_REQUIRED"});const u=db.prepare("SELECT * FROM users WHERE id=?").get(req.session.userId);if(!u||u.role!=="admin")return res.status(403).json({error:"ADMIN_REQUIRED"});req.admin=u;next()}

app.post("/api/register",(req,res)=>{
 const username=String(req.body.username||"").trim().toLowerCase(), name=String(req.body.displayName||username).trim().slice(0,30), pw=String(req.body.password||"");
 if(!/^[a-z0-9_]{3,20}$/.test(username))return res.status(400).json({error:"Username must be 3-20 letters, numbers or _"});
 if(pw.length<6)return res.status(400).json({error:"Password must be at least 6 characters"});
 try{const x=db.prepare("INSERT INTO users(username,display_name,password_hash) VALUES(?,?,?)").run(username,name||username,bcrypt.hashSync(pw,10));req.session.userId=x.lastInsertRowid;res.json({user:userOut(db.prepare("SELECT * FROM users WHERE id=?").get(x.lastInsertRowid))})}
 catch(e){res.status(409).json({error:"Username already exists"})}
});
app.post("/api/login",(req,res)=>{const u=db.prepare("SELECT * FROM users WHERE username=?").get(String(req.body.username||"").trim().toLowerCase());if(!u||!bcrypt.compareSync(String(req.body.password||""),u.password_hash))return res.status(401).json({error:"Invalid login"});req.session.userId=u.id;res.json({user:userOut(u)})});
app.post("/api/logout",(req,res)=>req.session.destroy(()=>res.json({ok:true})));
app.get("/api/me",requireLogin,(req,res)=>res.json({user:userOut(db.prepare("SELECT * FROM users WHERE id=?").get(req.session.userId))}));
app.get("/api/games",(req,res)=>res.json({games:GAMES.map(g=>({id:g[0],name:g[1],icon:g[2],mode:g[3],category:g[4],config:db.prepare("SELECT * FROM game_config WHERE game_id=?").get(g[0])}))}));

app.post("/api/games/:id/play",requireLogin,(req,res)=>{
 const cfg=db.prepare("SELECT * FROM game_config WHERE game_id=? AND enabled=1").get(req.params.id);
 if(!cfg)return res.status(404).json({error:"GAME_UNAVAILABLE"});
 let cost=Number(req.body.cost);
 if(!Number.isFinite(cost)||cost<cfg.min_bet) return res.status(400).json({error:"INVALID_BET"});
 const step=Number(cfg.bet_step)||0.10;
 const steps=Math.round((cost-cfg.min_bet)/step);
 if(Math.abs((cfg.min_bet+steps*step)-cost)>0.000001) return res.status(400).json({error:"INVALID_BET_STEP"});
 cost=Number(Math.min(cost,cfg.max_round_cost).toFixed(2));
 const u=db.prepare("SELECT * FROM users WHERE id=?").get(req.session.userId);
 if(u.credit<cost)return res.status(400).json({error:"NOT_ENOUGH_CREDIT"});
 let tier="NONE", reward=0, r=Math.random()*100;
 if(r<cfg.epic_event_percent){tier="EPIC";reward=cfg.epic_reward}
 else if(r<cfg.epic_event_percent+cfg.mega_event_percent){tier="MEGA";reward=cfg.mega_reward}
 else if(r<cfg.epic_event_percent+cfg.mega_event_percent+cfg.big_event_percent){tier="BIG";reward=cfg.big_reward}
 else if(Math.random()<.55){tier="NORMAL";reward=cfg.min_reward+Math.random()*Math.max(0,cfg.max_reward-cfg.min_reward)}
 reward=Number(reward.toFixed(2));
 const newCredit=Number((u.credit-cost+reward).toFixed(2));
 db.transaction(()=>{
   db.prepare("UPDATE users SET credit=? WHERE id=?").run(newCredit,u.id);
   db.prepare("INSERT INTO history(user_id,game_id,cost,reward,tier) VALUES(?,?,?,?,?)").run(u.id,req.params.id,cost,reward,tier);
 })();
 res.json({tier,reward,cost,credit:newCredit});
});
app.get("/api/history",requireLogin,(req,res)=>res.json({history:db.prepare("SELECT * FROM history WHERE user_id=? ORDER BY id DESC LIMIT 40").all(req.session.userId)}));
app.get("/api/leaderboard",(req,res)=>res.json({players:db.prepare("SELECT display_name name,credit FROM users WHERE role='player' ORDER BY credit DESC LIMIT 20").all()}));

app.get("/api/admin/dashboard",requireAdmin,(req,res)=>res.json({stats:{
 players:db.prepare("SELECT COUNT(*) n FROM users WHERE role='player'").get().n,
 credit:db.prepare("SELECT COALESCE(SUM(credit),0) n FROM users").get().n,
 rounds:db.prepare("SELECT COUNT(*) n FROM history").get().n,
 big:db.prepare("SELECT COUNT(*) n FROM history WHERE tier='BIG'").get().n,
 mega:db.prepare("SELECT COUNT(*) n FROM history WHERE tier='MEGA'").get().n,
 epic:db.prepare("SELECT COUNT(*) n FROM history WHERE tier='EPIC'").get().n
}}));
app.get("/api/admin/players",requireAdmin,(req,res)=>res.json({players:db.prepare("SELECT id,username,display_name,credit,created_at FROM users WHERE role='player' ORDER BY id DESC").all()}));
app.post("/api/admin/players/:id/credit",requireAdmin,(req,res)=>{
 const id=Number(req.params.id),mode=req.body.mode,amount=Number(req.body.amount);
 if(!Number.isFinite(amount)||amount<0)return res.status(400).json({error:"Invalid amount"});
 const u=db.prepare("SELECT * FROM users WHERE id=? AND role='player'").get(id);if(!u)return res.status(404).json({error:"Player not found"});
 const next=mode==="set"?amount:mode==="remove"?Math.max(0,u.credit-amount):u.credit+amount;
 db.prepare("UPDATE users SET credit=? WHERE id=?").run(next,id);
 db.prepare("INSERT INTO audit_logs(admin_id,action,target_user_id,old_value,new_value) VALUES(?,?,?,?,?)").run(req.admin.id,"CREDIT_"+mode.toUpperCase(),id,String(u.credit),String(next));
 res.json({credit:next});
});
app.get("/api/admin/config",requireAdmin,(req,res)=>res.json({config:db.prepare("SELECT * FROM game_config ORDER BY game_id").all()}));
app.put("/api/admin/config/:id",requireAdmin,(req,res)=>{
 const id=req.params.id, old=db.prepare("SELECT * FROM game_config WHERE game_id=?").get(id);if(!old)return res.status(404).json({error:"Game not found"});
 const keys=["min_reward","max_reward","big_reward","mega_reward","epic_reward","big_event_percent","mega_event_percent","epic_event_percent","max_round_cost","min_bet","bet_step"],o={};
 for(const k of keys){o[k]=Number(req.body[k]);if(!Number.isFinite(o[k]))return res.status(400).json({error:"Invalid config"})}
 for(const k of ["big_event_percent","mega_event_percent","epic_event_percent"])o[k]=Math.max(0,Math.min(100,o[k]));
 o.max_round_cost=Math.max(o.min_bet,o.max_round_cost); o.min_bet=Math.max(0.01,o.min_bet); o.bet_step=Math.max(0.01,o.bet_step);
 db.prepare(`UPDATE game_config SET min_reward=@min_reward,max_reward=@max_reward,big_reward=@big_reward,mega_reward=@mega_reward,epic_reward=@epic_reward,big_event_percent=@big_event_percent,mega_event_percent=@mega_event_percent,epic_event_percent=@epic_event_percent,max_round_cost=@max_round_cost,min_bet=@min_bet,bet_step=@bet_step WHERE game_id=@id`).run({...o,id});
 db.prepare("INSERT INTO audit_logs(admin_id,action,old_value,new_value) VALUES(?,?,?,?)").run(req.admin.id,"GAME_CONFIG_UPDATE",JSON.stringify(old),JSON.stringify(o));
 res.json({ok:true});
});
app.get("/api/admin/logs",requireAdmin,(req,res)=>res.json({logs:db.prepare("SELECT * FROM audit_logs ORDER BY id DESC LIMIT 100").all()}));

app.get("/admin",(req,res)=>res.sendFile(path.join(__dirname,"public","admin.html")));
app.get("/admin.html",(req,res)=>res.sendFile(path.join(__dirname,"public","admin.html")));
app.get("*",(req,res)=>res.sendFile(path.join(__dirname,"public","index.html")));
app.listen(process.env.PORT||3000,()=>console.log("NEON ROYALE V7 → http://localhost:"+(process.env.PORT||3000)));
