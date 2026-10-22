import { createTournament, recordRound, standings, advanceRound, POINTS } from "./tournament.mjs";
import { Engine, Vector3 } from "./graphics.js";
import {
  COURSES,
  ITEMS,
  KARTS,
  DRIVERS,
  createRace,
  step,
  resetPlayer,
  sample,
  wrapAngle,
  rankOf,
} from "./core.mjs";
import { createWorld } from "./world.js";
import { createEffects } from "./effects.js";
import { AudioManager } from "./audio.js";
const $ = (id) => document.getElementById(id),
  canvas = $("game"),
  coarse = matchMedia("(pointer:coarse)").matches;
const settings = {
  track: 0,
  kart: 0,
  color: 0,
  difficulty: 1,
  mode: "item",
  assist: true,
};
try {
  Object.assign(
    settings,
    JSON.parse(localStorage.getItem("pocket-gp-settings-v2") || "{}"),
  );
} catch {}
for (const [k, max] of [
  ["track", 2],
  ["kart", 2],
  ["color", 5],
  ["difficulty", 2],
])
  if (!Number.isInteger(settings[k]) || settings[k] < 0 || settings[k] > max)
    settings[k] = 0;
if (!["item", "speed"].includes(settings.mode)) settings.mode = "item";
settings.assist = !!settings.assist;
const input = {
  left: false,
  right: false,
  drift: false,
  brake: false,
  item: false,
  nitro: false,
  swap: false,
};
const flowCanvas = $("speedlines"),
  flow = flowCanvas.getContext("2d");
function resizeFlow() {
  flowCanvas.width = Math.min(innerWidth, 1800);
  flowCanvas.height = Math.min(innerHeight, 1200);
}
resizeFlow();
const audio = new AudioManager();
let engine,
  world,
  fx,
  G = null,
  cup = null,
  nextRoundIn = null,
  last = performance.now(),
  elapsed = 0,
  accum = 0,
  hudAt = 0,
  renderAt = 0,
  lastCount = 4,
  lastLap = 1,
  lapUntil = 0,
  shownResult = false,
  camAngle = 0,
  farCamera = false,
  menuTime = 0,
  changing = false,
  frames = 0,
  fps = 60,
  quality = 1,
  slowSeconds = 0,
  fastSeconds = 0;
function fail(error) {
  console.error(error);
  $("loading").hidden = true;
  $("fatal").hidden = false;
  $("fatalmessage").textContent = String(error?.message || error).slice(0, 350);
}
window.addEventListener("error", (e) => fail(e.error || e.message));
window.addEventListener("unhandledrejection", (e) => fail(e.reason));
function saveSettings() {
  try {
    localStorage.setItem("pocket-gp-settings-v2", JSON.stringify(settings));
  } catch {}
}
function format(t) {
  return (
    String(Math.floor(t / 60)).padStart(2, "0") +
    ":" +
    (t % 60).toFixed(2).padStart(5, "0")
  );
}
function clearInput() {
  for (const k of Object.keys(input)) input[k] = false;
}
function rebuild() {
  changing = true;
  $("loading").hidden = false;
  if (world) world.scene.dispose();
  world = createWorld(engine, COURSES[settings.track], {
    ...settings,
    mobile: coarse,
  });
  fx = createEffects(world, audio);
  const tr = COURSES[settings.track],
    r = createRace(settings).racers[0];
  for (let i = 0; i < 6; i++) {
    const p = sample(tr, -20 - i * 8, i === 0 ? 0 : i % 2 ? 4 : -4);
    world.karts[i].update(
      { ...r, id: i, x: p.x, z: p.z, angle: p.angle, steer: 0 },
      0,
      0.016,
    );
  }
  camAngle = r.angle;
  menuTime = 0;
  drawCourseCards();
  $("previewname").textContent = [
    "CLOVER PARK",
    "SUNSET CANYON",
    "NEON HARBOR",
  ][settings.track];
  $("previewsubtitle").textContent = tr.subtitle;
  $("tracklabel").textContent = tr.name;
  changing = false;
  cameraStep(0.016);
  world.scene.render();
  const current = world;
  world.scene.executeWhenReady(() => {
    let warmed = 0;
    const reveal = () => {
      if (world !== current) return;
      world.scene.render();
      if (++warmed < 4) {
        requestAnimationFrame(reveal);
        return;
      }
      requestAnimationFrame(() => {
        if (world === current) $("loading").hidden = true;
      });
    };
    requestAnimationFrame(reveal);
  }, true);
}
function drawCourseCards() {
  document.querySelectorAll("[data-track]").forEach((b) => {
    b.classList.toggle("selected", +b.dataset.track === settings.track);
    b.setAttribute("aria-pressed", String(+b.dataset.track === settings.track));
  });
  document.querySelectorAll("[data-kart]").forEach((b) => {
    b.classList.toggle("selected", +b.dataset.kart === settings.kart);
    b.setAttribute("aria-pressed", String(+b.dataset.kart === settings.kart));
  });
  document.querySelectorAll("[data-paint]").forEach((b) => {
    b.classList.toggle("selected", +b.dataset.paint === settings.color);
    b.setAttribute("aria-pressed", String(+b.dataset.paint === settings.color));
  });
  $("kartstat").replaceChildren(
    ...["최고속도", "가속", "코너링"].map((name, i) => {
      const a = document.createElement("span"),
        b = document.createElement("i");
      a.textContent = name;
      b.textContent =
        "●".repeat(KARTS[settings.kart].stars[i]) +
        "○".repeat(5 - KARTS[settings.kart].stars[i]);
      a.append(b);
      return a;
    }),
  );
}
function makeUI() {
  for (let i = 0; i < COURSES.length; i++) {
    const tr = COURSES[i],
      b = document.createElement("button");
    b.dataset.track = i;
    b.title = tr.subtitle;
    const c = document.createElement("canvas");
    c.width = 180;
    c.height = 180;
    drawMiniMap(c, tr, null, true);
    const emoji = document.createElement("span"),
      name = document.createElement("b"),
      sub = document.createElement("small");
    emoji.textContent = tr.emoji;
    name.textContent = tr.name;
    sub.textContent = ["첫 레이스에 추천", "협곡의 연속 코너", "항구의 헤어핀"][
      i
    ];
    b.append(c, emoji, name, sub);
    b.onclick = () => {
      if (changing) return;
      settings.track = i;
      saveSettings();
      rebuild();
      audio.effect("pickup");
    };
    $("tracks").append(b);
  }
  for (let i = 0; i < KARTS.length; i++) {
    const k = KARTS[i],
      b = document.createElement("button");
    b.dataset.kart = i;
    b.textContent = k.name;
    const s = document.createElement("small");
    s.textContent = k.desc;
    b.append(s);
    b.onclick = () => {
      settings.kart = i;
      saveSettings();
      rebuild();
    };
    $("karts").append(b);
  }
  for (let i = 0; i < DRIVERS.length; i++) {
    const b = document.createElement("button");
    b.style.background = DRIVERS[i].color;
    b.dataset.paint = i;
    b.title = ["코랄", "로즈", "민트", "라벤더", "망고", "스카이"][i];
    b.setAttribute("aria-label", b.title + " 색상");
    b.onclick = () => {
      settings.color = i;
      saveSettings();
      rebuild();
    };
    $("paints").append(b);
  }
  for (const it of ITEMS) {
    const a = document.createElement("div"),
      s = document.createElement("span"),
      b = document.createElement("b"),
      d = document.createElement("small");
    s.textContent = it.icon;
    b.textContent = it.name;
    d.textContent = it.desc;
    a.append(s, b, d);
    $("itemguide").append(a);
  }
  $("difficulty").value = settings.difficulty;
  $("mode").value = settings.mode;
  $("assist").checked = settings.assist;
  $("difficulty").onchange = (e) => {
    settings.difficulty = +e.target.value;
    saveSettings();
  };
  $("mode").onchange = (e) => {
    settings.mode = e.target.value;
    saveSettings();
  };
  $("assist").onchange = (e) => {
    settings.assist = e.target.checked;
    saveSettings();
  };
  $("sound").textContent = audio.enabled ? "♪ ON" : "♪ OFF";
}
function start() {
  if (changing) return;
  cup = createTournament(settings.track, createRace(settings).racers);
  beginRound();
}
function nextRound() {
  if (!cup || G?.mode !== "finished" || !shownResult) return;
  if (advanceRound(cup)) beginRound();
  else {
    cup = createTournament(cup.tracks[0], G.racers);
    beginRound();
  }
}
function beginRound() {
  if (changing || !cup) return;
  nextRoundIn = null;
  document.querySelector(".round-detail").open = false;
  const track = cup.tracks[cup.round];
  if (settings.track !== track) {
    G = null;
    settings.track = track;
    rebuild();
  }
  audio.start();
  fx.clear();
  G = createRace(settings);
  clearInput();
  shownResult = false;
  lastCount = 4;
  lastLap = 1;
  lapUntil = 0;
  accum = 0;
  last = performance.now();
  $("menu").hidden = true;
  $("helppanel").hidden = true;
  $("results").hidden = true;
  $("pausepanel").hidden = true;
  $("hud").hidden = false;
  $("hud").inert = false;
  $("pause").hidden = false;
  $("camera").hidden = false;
  $("touch").hidden = !coarse;
  $("lapbanner").hidden = true;
  const r = G.racers[0];
  camAngle = r.angle;
  const p = sample(G.course, r.s - 16, r.lane);
  world.camera.position.set(p.x, 8, p.z);
  world.camera.setTarget(new Vector3(r.x, 2, r.z));
  canvas.focus();
  updateHUD();
}
function menu() {
  nextRoundIn = null;
  clearInput();
  G = null;
  if (cup) {
    const firstTrack = cup.tracks[0];
    cup = null;
    if (settings.track !== firstTrack) {
      settings.track = firstTrack;
      rebuild();
    }
  }
  fx.clear();
  $("menu").hidden = false;
  for (const id of [
    "hud",
    "results",
    "pausepanel",
    "touch",
    "helppanel",
    "pause",
    "camera",
  ])
    $(id).hidden = true;
  menuTime = 0;
  audio.update(null);
  $("start").focus({ preventScroll: true });
}
function pause() {
  if (!G || G.mode === "finished") return;
  if (G.mode === "paused") {
    G.mode = G.previousMode;
    $("pausepanel").hidden = true;
    $("touch").hidden = !coarse;
    last = performance.now();
    accum = 0;
    $("hud").inert = false;
    clearInput();
    canvas.focus();
  } else {
    G.previousMode = G.mode;
    G.mode = "paused";
    clearInput();
    $("pausepanel").hidden = false;
    $("recover").hidden = G.previousMode !== "racing";
    $("touch").hidden = true;
    $("hud").inert = true;
    $("resume").focus();
  }
  audio.update(G);
}
function results() {
  const finishTime = G.racers[0].finishTime;
  updateHUD();
  shownResult = true;
  $("results").hidden = false;
  $("hud").inert = true;
  $("touch").hidden = true;
  $("pause").hidden = true;
  $("again").focus();
  $("resulttime").textContent = G.course.name + " · " + format(finishTime);
  $("resultstats").replaceChildren(
    ...[
      [G.stats.drifts, "드리프트 터보"],
      [G.stats.hits, "아이템 명중"],
      [Math.round(G.stats.topSpeed * 3.6), "최고 km/h"],
    ].map(([n, label]) => {
      const a = document.createElement("div"),
        b = document.createElement("b");
      b.textContent = n;
      a.append(b, label);
      return a;
    }),
  );
  const sorted = [...G.racers].sort((a, b) => rankOf(G, a) - rankOf(G, b));
  recordRound(cup, sorted.map((r) => r.id));
  const overall = standings(cup),
    final = cup.rounds.length === cup.tracks.length,
    playerPlace = overall.findIndex((r) => r.id === 0) + 1;
  $("resulttitle").textContent = final
    ? (playerPlace === 1 ? "토너먼트 챔피언!" : `토너먼트 최종 ${playerPlace}위!`)
    : `${cup.round + 1}라운드 · ${G.rank}위 완주!`;
  $("cupeyebrow").textContent = final ? "GRAND PRIX · FINAL RESULTS" : `GRAND PRIX · ROUND ${cup.round + 1} / 3`;
  $("cuptitle").textContent = final ? "🏆 최종 종합 순위" : "🏁 토너먼트 누적 순위";
  $("cupstandings").replaceChildren(...overall.map((r, index) => {
    const row = document.createElement("div");
    row.className = r.id === 0 ? "me" : "";
    const name = document.createElement("span"), scores = document.createElement("small"), total = document.createElement("b");
    name.textContent = `${index + 1}  ${r.name}${r.id === 0 ? " ★" : ""}`;
    scores.textContent = r.places.map((place) => `+${POINTS[place - 1]}`).join(" / ");
    total.textContent = `${r.points}점`;
    row.append(name, scores, total);
    return row;
  }));
  $("cupnext").textContent = final
    ? `우승 · ${overall[0].name} · ${overall[0].points}점`
    : `다음 코스 · ${COURSES[cup.tracks[cup.round + 1]].name}`;
  $("again").textContent = final ? "새 토너먼트 시작 →" : `지금 다음 코스로 (${cup.round + 2}/3) →`;
  nextRoundIn = final ? null : 6;
  $("holdnext").hidden = final;
  $("autonext").textContent = final ? "모든 코스를 완주했어요!" : "6초 뒤 다음 코스로 출발해요";
  $("roundroute").textContent = cup.tracks.map((track, i) => `${i < cup.rounds.length ? "✓ " : ""}${COURSES[track].name}`).join(" → ");
  const laps = G.racers[0].lapTimes,
    bestLap = Math.min(...laps);
  $("laptimes").replaceChildren(
    ...laps.map((time, i) => {
      const cell = document.createElement("div"),
        label = document.createElement("small"),
        value = document.createElement("b");
      label.textContent = `LAP ${i + 1}${time === bestLap ? " · BEST" : ""}`;
      value.textContent = format(time);
      cell.classList.toggle("best-lap", time === bestLap);
      cell.append(label, value);
      return cell;
    }),
  );
  $("standings").replaceChildren(
    ...sorted.map((r, i) => {
      const el = document.createElement("div"),
        left = document.createElement("span"),
        right = document.createElement("span"),
        dot = document.createElement("i");
      el.className = r.id === 0 ? "me" : "";
      dot.style.background =
        r.id === 0 ? DRIVERS[settings.color].color : DRIVERS[r.id].color;
      left.append(dot, `${i + 1}  ${r.name}${r.id === 0 ? " ★" : ""}`);
      right.textContent = r.finished ? format(r.finishTime) : "결승 미도착";
      el.append(left, right);
      return el;
    }),
  );
  try {
    const key = `pocket-gp-best-v2-${settings.track}-${settings.mode}-${settings.difficulty}`,
      old = +localStorage.getItem(key) || Infinity,
      best = Math.min(old, finishTime);
    localStorage.setItem(key, best);
    $("best").textContent =
      "최고 기록 " + format(best) + (finishTime < old ? " · NEW RECORD!" : "");
  } catch {
    $("best").textContent = "";
  }
}
function drawMiniMap(c, tr, g, card = false) {
  const ctx = c.getContext("2d"),
    w = c.width,
    h = c.height;
  ctx.clearRect(0, 0, w, h);
  const xs = tr.samples.map((p) => p.x),
    zs = tr.samples.map((p) => p.z),
    minx = Math.min(...xs),
    maxx = Math.max(...xs),
    minz = Math.min(...zs),
    maxz = Math.max(...zs),
    scale = Math.min((w - 36) / (maxx - minx), (h - 36) / (maxz - minz));
  const pos = (p) => ({
    x: w / 2 + (p.x - (minx + maxx) / 2) * scale,
    y: h / 2 - (p.z - (minz + maxz) / 2) * scale,
  });
  ctx.strokeStyle = card ? "#457961" : "#ffffff42";
  ctx.lineWidth = card ? 7 : 9;
  ctx.lineJoin = "round";
  ctx.lineCap = "round";
  ctx.beginPath();
  for (let i = 0; i < tr.samples.length; i += 3) {
    const p = pos(tr.samples[i]);
    if (i === 0) ctx.moveTo(p.x, p.y);
    else ctx.lineTo(p.x, p.y);
  }
  ctx.closePath();
  ctx.stroke();
  if (!card) {
    const start = pos(sample(tr, 0));
    ctx.fillStyle = "#fff4bc";
    ctx.fillRect(start.x - 4, start.y - 3, 8, 6);
  }
  if (g)
    for (let i = 5; i >= 0; i--) {
      const r = g.racers[i],
        p = pos(r);
      ctx.beginPath();
      ctx.arc(p.x, p.y, i === 0 ? 5.7 : 3.7, 0, Math.PI * 2);
      ctx.fillStyle = i === 0 ? "#fff4ac" : DRIVERS[i].color;
      ctx.fill();
      if (i === 0) {
        ctx.strokeStyle = "#fff";
        ctx.lineWidth = 1.5;
        ctx.stroke();
      }
    }
}
function updateHUD() {
  if (!G) return;
  const p = G.racers[0],
    lap = Math.min(
      G.course.laps,
      Math.floor(Math.max(0, p.s) / G.course.length) + 1,
    );
  $("rank").innerHTML = G.rank + "<span>/ 6</span>";
  $("lap").innerHTML = lap + " <i>/ " + G.course.laps + "</i>";
  $("time").textContent = format(p.finished ? p.finishTime : G.time);
  $("cupround").textContent = `ROUND ${cup ? cup.round + 1 : 1} / 3`;
  $("speed").textContent = Math.round(p.speed * 3.6);
  $("speedarc").setAttribute(
    "stroke-dasharray",
    Math.min(100, (p.speed / 60) * 100) + " 100",
  );
  document.querySelector(".speed").classList.toggle("boosting", p.boost > 0);
  $("driftbar").style.width = p.drift * 100 + "%";
  document.querySelector(".meter").classList.toggle("charged", p.drift >= 0.45);
  document.querySelector(".meter").classList.toggle("super", p.drift >= 0.9);
  $("driftlabel").textContent =
    p.drift >= 0.9
      ? "SUPER TURBO READY!"
      : p.drift >= 0.45
        ? "RELEASE SHIFT → TURBO"
        : "DRIFT → TURBO";
  $("nitrocount").textContent = G.nitro;
  $("nitro").classList.toggle("empty", G.nitro === 0);
  const item = ITEMS.find((i) => i.id === G.inventory[0]),
    second = ITEMS.find((i) => i.id === G.inventory[1]);
  $("itemicon").textContent =
    item?.icon || (G.options.mode === "speed" ? "🏁" : "?");
  $("itemname").textContent =
    item?.name || (G.options.mode === "speed" ? "스피드전" : "아이템 박스");
  $("itemicon2").textContent = second?.icon || "＋";
  $("item").title = item?.desc || "황금 박스를 통과해 아이템을 얻으세요";
  $("touchitem").textContent = item?.icon || "🎁";
  $("touchitem").disabled = G.inventory.length === 0;
  $("toast").textContent = G.toast;
  $("toast").style.opacity = G.toastTime > 0 ? 1 : 0;
  const count = G.mode === "countdown" ? Math.ceil(G.countdown - 0.5) : 0;
  $("countdown").textContent =
    G.mode === "countdown" ? (count > 0 ? count : "GO!") : "";
  if (count !== lastCount && count > 0) {
    audio.effect("count");
    lastCount = count;
  }
  $("warning").hidden = !G.projectiles.some(
    (p) => p.type === "rocket" && p.target === 0,
  );
  const ideal = sample(G.course, p.s).angle;
  $("wrongway").hidden =
    Math.abs(wrapAngle(p.angle - ideal)) < 1.9 ||
    p.speed < 8 ||
    G.mode !== "racing";
  drawMiniMap($("map"), G.course, G);
  if (lap > lastLap) {
    $("lapbanner").textContent =
      lap === G.course.laps ? "FINAL LAP!" : `LAP ${lap} / ${G.course.laps}`;
    lastLap = lap;
    lapUntil = elapsed + 2.3;
    audio.effect("pickup");
  }
  $("lapbanner").hidden = elapsed > lapUntil || lapUntil === 0;
  const sorted = [...G.racers]
    .sort((a, b) => rankOf(G, a) - rankOf(G, b))
    .slice(0, 3);
  $("leaderboard").replaceChildren(
    ...sorted.map((r) => {
      const el = document.createElement("div"),
        dot = document.createElement("i");
      el.className = r.id === 0 ? "me" : "";
      dot.style.background = DRIVERS[r.id].color;
      el.append(dot, rankOf(G, r) + " " + r.name);
      return el;
    }),
  );
}
function cameraStep(dt) {
  const cam = world.camera;
  if (!G) {
    menuTime += dt;
    const tr = COURSES[settings.track],
      p = sample(tr, -20, 0),
      a = p.angle + Math.PI - 0.7 + Math.sin(menuTime * 0.13) * 0.12;
    const distance = 15;
    cam.position.set(
      p.x - Math.sin(a) * distance,
      6.6 + Math.sin(menuTime * 0.18) * 0.4,
      p.z - Math.cos(a) * distance,
    );
    const rightX = Math.cos(a),
      rightZ = -Math.sin(a);
    cam.setTarget(new Vector3(p.x - rightX * 5.5, 2.3, p.z - rightZ * 5.5));
    cam.fov = 0.74;
    for (let i = 0; i < 6; i++) {
      const q = sample(tr, -20 - i * 11, i === 0 ? 0 : i % 2 ? 5 : -5);
      world.karts[i].update({ ...createPreviewRacer(i, q), y: 0 }, elapsed, dt);
    }
    return;
  }
  const r = G.racers[0];
  camAngle = wrapAngle(
    camAngle + wrapAngle(r.moveAngle - camAngle) * (1 - Math.exp(-dt * 5)),
  );
  const portrait = coarse && innerHeight > innerWidth,
    distance = portrait ? (farCamera ? 26 : 20) : farCamera ? 18 : 13.5,
    height = portrait ? (farCamera ? 13 : 10) : farCamera ? 10 : 7.6;
  const desired = new Vector3(
    r.x - Math.sin(camAngle) * distance,
    height + (r.groundY || 0) + ((r.y || 0) - (r.groundY || 0)) * 0.3,
    r.z - Math.cos(camAngle) * distance,
  );
  cam.position = Vector3.Lerp(cam.position, desired, 1 - Math.exp(-dt * 8));
  const ahead = 8 + r.speed * 0.15;
  cam.setTarget(
    new Vector3(
      r.x + Math.sin(camAngle) * ahead,
      (r.y || 0) + 1.7,
      r.z + Math.cos(camAngle) * ahead,
    ),
  );
  cam.fov +=
    ((portrait ? (r.boost > 0 ? 1.09 : 0.98) : r.boost > 0 ? 0.91 : 0.78) -
      cam.fov) *
    (1 - Math.exp(-dt * 3));
  if (r.stun > 0 && r.bubble === 0) {
    cam.position.x += Math.sin(elapsed * 45) * 0.025;
    cam.position.y += Math.cos(elapsed * 38) * 0.025;
  }
}
function drawSpeedLines() {
  const w = flowCanvas.width,
    h = flowCanvas.height;
  flow.clearRect(0, 0, w, h);
  if (!G || G.mode !== "racing") return;
  const p = G.racers[0],
    power = p.boost > 0 ? 1 : Math.max(0, (p.speed - 40) / 20) * 0.35;
  if (power <= 0) return;
  flow.lineWidth = 1.1;
  for (let i = 0; i < 24; i++) {
    const a = (i / 24) * Math.PI * 2 + 0.14,
      r = 0.72 + ((elapsed * 1.5 + i * 0.137) % 1) * 0.6,
      rx = w * 0.6,
      ry = h * 0.55;
    flow.strokeStyle = `rgba(255,250,216,${power * 0.32})`;
    flow.beginPath();
    flow.moveTo(
      w * 0.5 + Math.cos(a) * rx * r,
      h * 0.48 + Math.sin(a) * ry * r,
    );
    flow.lineTo(
      w * 0.5 + Math.cos(a) * rx * (r + 0.18),
      h * 0.48 + Math.sin(a) * ry * (r + 0.18),
    );
    flow.stroke();
  }
}
function createPreviewRacer(id, p) {
  return {
    id,
    x: p.x,
    z: p.z,
    angle: p.angle,
    moveAngle: p.angle,
    speed: 0,
    steer: 0,
    boost: 0,
    shield: 0,
    stun: 0,
    bubble: 0,
    drifting: false,
    driftSide: 0,
  };
}
function bindControls() {
  const keys = {
    ArrowLeft: "left",
    KeyA: "left",
    ArrowRight: "right",
    KeyD: "right",
    ArrowDown: "brake",
    KeyS: "brake",
    ShiftLeft: "drift",
    ShiftRight: "drift",
    KeyE: "item",
    ControlLeft: "item",
    Space: "nitro",
    KeyQ: "swap",
  };
  window.addEventListener("keydown", (e) => {
    const dialog = ["pausepanel", "results", "helppanel"]
      .map($)
      .find((el) => !el.hidden);
    if (e.code === "Tab" && dialog) {
      const buttons = [
        ...dialog.querySelectorAll(
          "button:not([disabled]),a[href],select,input",
        ),
      ].filter((el) => !el.hidden);
      const first = buttons[0],
        last = buttons.at(-1);
      if (
        e.shiftKey &&
        (document.activeElement === first ||
          !dialog.contains(document.activeElement))
      ) {
        e.preventDefault();
        last?.focus();
      } else if (
        !e.shiftKey &&
        (document.activeElement === last ||
          !dialog.contains(document.activeElement))
      ) {
        e.preventDefault();
        first?.focus();
      }
    }
    if (["SELECT", "INPUT"].includes(document.activeElement?.tagName)) return;
    if (keys[e.code] && G && ["racing", "countdown"].includes(G.mode)) {
      e.preventDefault();
      if (!e.repeat || !["item", "nitro", "swap"].includes(keys[e.code]))
        input[keys[e.code]] = true;
    }
    if (e.repeat) return;
    if (e.code === "KeyP" || e.code === "Escape") {
      if (!$("helppanel").hidden) {
        $("helppanel").hidden = true;
        $("menu").hidden = false;
        $("help").focus();
      } else pause();
    }
    if (e.code === "KeyR" && G?.mode === "racing") resetPlayer(G);
    if (e.code === "KeyC") farCamera = !farCamera;
    if (
      e.code === "Enter" &&
      !G &&
      !$("menu").hidden &&
      !["BUTTON", "A"].includes(document.activeElement?.tagName)
    ) {
      e.preventDefault();
      start();
    }
  });
  window.addEventListener("keyup", (e) => {
    if (keys[e.code]) input[keys[e.code]] = false;
  });
  for (const b of document.querySelectorAll("[data-control]")) {
    b.onpointerdown = (e) => {
      e.preventDefault();
      b.setPointerCapture(e.pointerId);
      input[b.dataset.control] = true;
    };
    for (const type of ["pointerup", "pointercancel", "lostpointercapture"])
      b.addEventListener(type, () => (input[b.dataset.control] = false));
  }
  $("start").onclick = start;
  $("again").onclick = nextRound;
  const holdNext = () => {
    if (nextRoundIn === null) return;
    nextRoundIn = null;
    $("autonext").textContent = "준비되면 다음 코스로 출발하세요";
    $("holdnext").hidden = true;
  };
  $("holdnext").onclick = holdNext;
  document.querySelector(".round-detail").addEventListener("toggle", (e) => {
    if (e.target.open) holdNext();
  });
  $("restart").onclick = beginRound;
  $("back").onclick = menu;
  $("quit").onclick = menu;
  $("pause").onclick = pause;
  $("resume").onclick = pause;
  $("recover").onclick = () => {
    if (G?.mode !== "paused") return;
    pause();
    resetPlayer(G);
  };
  $("camera").onclick = () => (farCamera = !farCamera);
  $("item").onclick = $("touchitem").onclick = () => {
    audio.start();
    input.item = true;
  };
  $("nitro").onclick = () => {
    audio.start();
    input.nitro = true;
  };
  $("swap").onclick = () => (input.swap = true);
  $("sound").onclick = () => {
    $("sound").textContent = audio.toggle() ? "♪ ON" : "♪ OFF";
  };
  $("help").onclick = () => {
    $("helppanel").hidden = false;
    $("menu").hidden = true;
    $("closehelp").focus();
  };
  $("closehelp").onclick = () => {
    $("helppanel").hidden = true;
    $("menu").hidden = false;
    $("help").focus();
  };
  window.addEventListener("blur", () => {
    clearInput();
    if (G && ["racing", "countdown"].includes(G.mode)) pause();
  });
  document.addEventListener("visibilitychange", () => {
    if (document.hidden && G && ["racing", "countdown"].includes(G.mode))
      pause();
  });
}
try {
  engine = new Engine(canvas, true, {
    preserveDrawingBuffer: true,
    stencil: true,
    antialias: true,
    powerPreference: "high-performance",
  });
  engine.setHardwareScalingLevel(
    Math.max(1, devicePixelRatio / (coarse ? 1 : 1.4)),
  );
  engine.onContextLostObservable.add(() => {
    if (G && ["racing", "countdown"].includes(G.mode)) pause();
    $("loading").hidden = false;
    $("loading").querySelector("strong").textContent =
      "레이스 화면을 복구하고 있어요";
  });
  engine.onContextRestoredObservable.add(() => {
    if (world) {
      world.scene.executeWhenReady(() => {
        $("loading").hidden = true;
        $("loading").querySelector("strong").textContent =
          "트랙을 준비하고 있어요";
      }, true);
    }
  });
  makeUI();
  rebuild();
  bindControls();
  $("menu").hidden = false;
  engine.runRenderLoop(() => {
    if (changing) return;
    const now = performance.now(),
      raw = (now - last) / 1000;
    last = now;
    const dt = Math.min(0.1, Math.max(0.001, raw));
    elapsed += dt;
    if (G && G.mode !== "paused" && G.mode !== "finished") {
      accum = Math.min(0.25, accum + Math.min(0.25, Math.max(0, raw)));
      while (accum >= 1 / 120) {
        step(G, input, 1 / 120);
        input.item = false;
        input.nitro = false;
        input.swap = false;
        accum -= 1 / 120;
      }
    } else accum = 0;
    world.update(elapsed, G, dt);
    fx.update(G, elapsed, dt);
    cameraStep(dt);
    drawSpeedLines();
    audio.update(G);
    if (G && elapsed - hudAt > 0.08) {
      updateHUD();
      hudAt = elapsed;
    }
    if (G?.mode === "finished" && !shownResult) results();
    if (G?.mode === "finished" && nextRoundIn !== null && !document.hidden) {
      nextRoundIn -= Math.min(0.25, Math.max(0, raw));
      $("autonext").textContent = `${Math.max(0, Math.ceil(nextRoundIn))}초 뒤 다음 코스로 출발해요`;
      if (nextRoundIn <= 0) nextRound();
    }
    // Render the lobby at 30 fps and races at 60; reduce resolution on slow devices.
    if (now - renderAt >= (G && G.mode !== "paused" ? 15 : 32)) {
      world.scene.render();
      renderAt = now;
      frames++;
    }
    if (frames > 120 && !changing && G?.mode === "racing" && raw < 0.25) {
      slowSeconds =
        raw > 0.045 ? slowSeconds + raw : Math.max(0, slowSeconds - raw * 2);
      fastSeconds = raw < 0.023 ? fastSeconds + raw : 0;
      if (slowSeconds > 3 && quality < 1.6) {
        quality = Math.min(1.6, quality + 0.1);
        slowSeconds = 0;
        engine.setHardwareScalingLevel(
          Math.max(1, devicePixelRatio / (coarse ? 1 : 1.4)) * quality,
        );
      }
      if (fastSeconds > 6 && quality > 1) {
        quality = Math.max(1, quality - 0.1);
        fastSeconds = 0;
        engine.setHardwareScalingLevel(
          Math.max(1, devicePixelRatio / (coarse ? 1 : 1.4)) * quality,
        );
      }
    }
    fps += (1 / Math.max(0.001, raw) - fps) * 0.02;
  });
  window.addEventListener("resize", () => {
    engine.resize();
    resizeFlow();
  });
  window.render_game_to_text = () =>
    JSON.stringify(
      G
        ? {
            tournament: cup,
            mode: G.mode,
            track: G.course.id,
            rank: G.rank,
            lap: Math.min(
              3,
              Math.floor(Math.max(0, G.racers[0].s) / G.course.length) + 1,
            ),
            time: G.time,
            inventory: G.inventory,
            drift: G.drift,
            nitro: G.nitro,
            stats: G.stats,
            projectiles: G.projectiles.length,
            traps: G.traps.length,
            racers: G.racers.map((r) => ({
              id: r.id,
              name: r.name,
              s: r.s,
              x: r.x,
              z: r.z,
              angle: r.angle,
              lane: r.lane,
              speed: r.speed,
              shield: r.shield,
              stun: r.stun,
              boost: r.boost,
              finished: r.finished,
            })),
            toast: G.toast,
          }
        : {
            mode: "menu",
            track: settings.track,
            kart: settings.kart,
            fps: Math.round(fps),
          },
    );
  window.__kart = {
    get tournament() { return cup; },
    get audioState() {
      return {
        voices: audio.voices.size,
        state: audio.ctx?.state || "idle",
        enabled: audio.enabled,
      };
    },
    get race() {
      return G;
    },
    get world() {
      return world;
    },
    get scene() {
      return world.scene;
    },
    get input() {
      return input;
    },
    settings,
    start,
    menu,
    reset: () => G && resetPlayer(G),
    step: (seconds, controls = {}) => {
      if (!G) return;
      for (let t = 0; t < seconds; t += 1 / 120) step(G, controls, 1 / 120);
    },
    drive: (seconds) => {
      if (!G) return;
      for (let t = 0; t < seconds && G.mode !== "finished"; t += 1 / 120) {
        const r = G.racers[0],
          p = sample(G.course, r.s + 14),
          a = wrapAngle(Math.atan2(p.x - r.x, p.z - r.z) - r.angle);
        step(G, { left: a < -0.025, right: a > 0.025 }, 1 / 120);
      }
    },
    get fps() {
      return fps;
    },
  };
} catch (error) {
  fail(error);
}
