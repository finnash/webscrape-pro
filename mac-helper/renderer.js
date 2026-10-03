// Backend (public values — same as the web app)
const SB_URL = "https://uyhducxksctsgoreogef.supabase.co";
const ANON = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InV5aGR1Y3hrc2N0c2dvcmVvZ2VmIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Nzc4MjMzNzIsImV4cCI6MjA5MzM5OTM3Mn0.mmpQBRi8NnqQn-rjUKxx06BzjK3-25DYGlpGB03O-w0";

const $ = (id) => document.getElementById(id);
let cfg = {};
let state = "idle"; // idle | listening | thinking
let level = 0;

/* ---------- Wave animation (single canvas, rAF, no layout work) ---------- */
const cv = $("wave"), cx = cv.getContext("2d");
let analyser, buf, t = 0;
function draw() {
  const W = cv.width, H = cv.height;
  cx.clearRect(0, 0, W, H);
  if (analyser) {
    analyser.getByteTimeDomainData(buf);
    let s = 0; for (let i = 0; i < buf.length; i += 4) { const v = (buf[i] - 128) / 128; s += v * v; }
    level += (Math.min(1, Math.sqrt(s / (buf.length / 4)) * 4) - level) * 0.25;
  } else level += ((state === "thinking" ? 0.35 : 0.08) - level) * 0.05;
  t += state === "thinking" ? 0.06 : 0.035;
  const colors = ["rgba(255,138,61,.9)", "rgba(181,108,255,.75)", "rgba(120,200,255,.55)"];
  colors.forEach((c, k) => {
    cx.beginPath();
    const amp = (H * 0.38) * (0.15 + level) * (1 - k * 0.22);
    for (let x = 0; x <= W; x += 6) {
      const n = x / W, env = Math.sin(Math.PI * n);
      const y = H / 2 + Math.sin(n * (6 + k * 2) + t * (1.4 + k * 0.4) + k) * amp * env;
      x ? cx.lineTo(x, y) : cx.moveTo(x, y);
    }
    cx.strokeStyle = c; cx.lineWidth = 4 - k; cx.shadowColor = c; cx.shadowBlur = 14;
    cx.stroke();
  });
  requestAnimationFrame(draw);
}
requestAnimationFrame(draw);

/* ---------- Auth ---------- */
async function signIn(email, password) {
  const r = await fetch(`${SB_URL}/auth/v1/token?grant_type=password`, {
    method: "POST", headers: { apikey: ANON, "Content-Type": "application/json" }, body: JSON.stringify({ email, password }),
  });
  const j = await r.json();
  if (!r.ok) throw new Error(j.error_description || j.msg || "Sign-in failed");
  return j;
}
async function token() {
  if (cfg.session && cfg.session.expires_at * 1000 > Date.now() + 60000) return cfg.session.access_token;
  const r = await fetch(`${SB_URL}/auth/v1/token?grant_type=refresh_token`, {
    method: "POST", headers: { apikey: ANON, "Content-Type": "application/json" },
    body: JSON.stringify({ refresh_token: cfg.session?.refresh_token }),
  });
  const j = await r.json();
  if (!r.ok) { cfg = await window.meow.setCfg({ session: null }); show(); throw new Error("Please sign in again"); }
  cfg = await window.meow.setCfg({ session: j });
  return j.access_token;
}

/* ---------- Recording ---------- */
let rec, chunks = [], stream;
async function start() {
  stream = await navigator.mediaDevices.getUserMedia({ audio: { echoCancellation: true, noiseSuppression: true } });
  const ac = new AudioContext(); analyser = ac.createAnalyser(); analyser.fftSize = 1024;
  buf = new Uint8Array(analyser.fftSize); ac.createMediaStreamSource(stream).connect(analyser);
  chunks = []; rec = new MediaRecorder(stream, { mimeType: "audio/webm" });
  rec.ondataavailable = (e) => e.data.size && chunks.push(e.data);
  rec.onstop = () => { stream.getTracks().forEach((t) => t.stop()); ac.close(); analyser = null; send(new Blob(chunks, { type: "audio/webm" })); };
  rec.start(); setState("listening", "Listening… press ⌥ Space to send");
  setTimeout(() => rec?.state === "recording" && rec.stop(), 30000); // safety cap
}
function stop() { if (rec?.state === "recording") rec.stop(); }

async function send(payload) {
  setState("thinking", "Working on it…");
  try {
    const isText = typeof payload === "string";
    let body;
    if (isText) body = JSON.stringify({ text: payload });
    else { if (payload.size < 2000) throw new Error("Too short — hold and speak"); body = new FormData(); body.append("file", payload, "voice.webm"); }
    const r = await fetch(`${SB_URL}/functions/v1/voice-command`, {
      method: "POST",
      headers: { Authorization: `Bearer ${await token()}`, apikey: ANON, ...(isText ? { "Content-Type": "application/json" } : {}) },
      body,
    });
    const j = await r.json();
    if (!r.ok) throw new Error(j.error || `Error ${r.status}`);
    const out = `“${j.text}”\n\n${j.summary}\n\n${(j.links || []).slice(0, 5).join("\n")}`;
    $("out").style.display = "block"; $("out").textContent = out;
    setState("idle", "Done ✓");
    window.meow.notify("Meow Voice", j.summary.slice(0, 120));
    if (cfg.hook) fetch(cfg.hook, { method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ username: "Meow Voice", content: out.slice(0, 1900) }) }).catch(() => {});
  } catch (e) { setState("idle", e.message); }
}

function setState(s, msg) {
  state = s; $("mic").classList.toggle("on", s === "listening");
  $("status").textContent = msg; $("status").classList.toggle("shimmer", s === "thinking");
}
function toggle() { if (state === "thinking") return; state === "listening" ? stop() : start().catch((e) => setState("idle", "Mic blocked: " + e.message)); }

/* ---------- UI wiring ---------- */
function show() {
  $("setup").classList.toggle("hidden", !!cfg.session);
  $("main").classList.toggle("hidden", !cfg.session);
  $("who").textContent = cfg.session?.user?.email ?? "";
}
$("save").onclick = async () => {
  $("save").textContent = "Signing in…";
  try {
    const s = await signIn($("email").value.trim(), $("pass").value);
    cfg = await window.meow.setCfg({ session: s, hook: $("hook").value.trim() });
    show();
  } catch (e) { alert(e.message); }
  $("save").textContent = "Sign in";
};
$("mic").onclick = toggle;
$("typed").onkeydown = (e) => { if (e.key === "Enter" && e.target.value.trim() && state !== "thinking") { send(e.target.value.trim()); e.target.value = ""; } };
$("hide").onclick = () => window.meow.hide();
$("quit").onclick = () => window.meow.quit();
window.meow.onToggle(toggle);
window.meow.getCfg().then((c) => { cfg = c; show(); });
