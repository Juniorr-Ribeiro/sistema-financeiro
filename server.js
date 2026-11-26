const express = require("express");
const fs = require("fs");
const path = require("path");
const crypto = require("crypto");
const { seedData } = require("./seed");

const app = express();
const PORT = process.env.PORT || 3000;

// Access password: must be provided through the APP_PASSWORD environment variable.
// There is intentionally no default value.
const APP_PASSWORD = process.env.APP_PASSWORD;
if (!APP_PASSWORD || APP_PASSWORD.length < 8) {
  console.error("Defina a variavel de ambiente APP_PASSWORD (minimo 8 caracteres).");
  process.exit(1);
}
const SALT = process.env.SESSION_SALT || "controle-financeiro-v1";

// Token de sessao derivado da senha (estavel entre reinicios).
const AUTH_TOKEN = crypto
  .createHash("sha256")
  .update(APP_PASSWORD + SALT)
  .digest("hex");

// ---- Persistencia em arquivo JSON ----
const DATA_DIR = path.join(__dirname, "data");
const DATA_FILE = path.join(DATA_DIR, "db.json");

function ensureData() {
  if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });
  if (!fs.existsSync(DATA_FILE)) {
    fs.writeFileSync(DATA_FILE, JSON.stringify(seedData(), null, 2), "utf8");
  }
}

function readData() {
  ensureData();
  try {
    return JSON.parse(fs.readFileSync(DATA_FILE, "utf8"));
  } catch (e) {
    console.error("Erro lendo db.json, recriando seed:", e.message);
    const fresh = seedData();
    fs.writeFileSync(DATA_FILE, JSON.stringify(fresh, null, 2), "utf8");
    return fresh;
  }
}

function writeData(data) {
  ensureData();
  const tmp = DATA_FILE + ".tmp";
  fs.writeFileSync(tmp, JSON.stringify(data, null, 2), "utf8");
  fs.renameSync(tmp, DATA_FILE); // escrita atomica
}

// ---- Middlewares ----
app.use(express.json({ limit: "5mb" }));

function parseCookies(req) {
  const header = req.headers.cookie || "";
  return Object.fromEntries(
    header
      .split(";")
      .map((c) => c.trim())
      .filter(Boolean)
      .map((c) => {
        const i = c.indexOf("=");
        return [c.slice(0, i), decodeURIComponent(c.slice(i + 1))];
      })
  );
}

function isAuthed(req) {
  const cookies = parseCookies(req);
  return cookies.auth === AUTH_TOKEN;
}

function requireAuth(req, res, next) {
  if (isAuthed(req)) return next();
  res.status(401).json({ error: "Nao autorizado" });
}

// ---- Rotas de autenticacao ----
app.post("/api/login", (req, res) => {
  const { password } = req.body || {};
  const given = Buffer.from(String(password || ""));
  const expected = Buffer.from(APP_PASSWORD);
  const ok = given.length === expected.length && crypto.timingSafeEqual(given, expected);
  if (ok) {
    res.setHeader(
      "Set-Cookie",
      `auth=${AUTH_TOKEN}; HttpOnly; SameSite=Lax; Path=/; Max-Age=${60 * 60 * 24 * 30}`
    );
    return res.json({ ok: true });
  }
  res.status(401).json({ error: "Senha incorreta" });
});

app.post("/api/logout", (req, res) => {
  res.setHeader("Set-Cookie", "auth=; HttpOnly; SameSite=Lax; Path=/; Max-Age=0");
  res.json({ ok: true });
});

app.get("/api/me", (req, res) => {
  res.json({ authed: isAuthed(req) });
});

// ---- Rotas de dados ----
app.get("/api/data", requireAuth, (req, res) => {
  res.json(readData());
});

app.post("/api/data", requireAuth, (req, res) => {
  const data = req.body;
  if (!data || typeof data !== "object" || !data.months) {
    return res.status(400).json({ error: "Dados invalidos" });
  }
  writeData(data);
  res.json({ ok: true });
});

// ---- Frontend ----
app.use(express.static(path.join(__dirname, "public")));

app.get("*", (req, res) => {
  res.sendFile(path.join(__dirname, "public", "index.html"));
});

ensureData();
app.listen(PORT, () => {
  console.log(`Controle Financeiro rodando na porta ${PORT}`);
});
