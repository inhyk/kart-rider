import {
  COURSES,
  sample,
  project,
  curvature,
  wrapAngle,
  mod,
} from "./tracks.mjs";
export { COURSES, sample, project, curvature, wrapAngle, mod };
export const ITEMS = [
  {
    id: "rocket",
    icon: "🚀",
    name: "유도 미사일",
    desc: "앞 카트를 추격하는 미사일",
    color: "#f48e72",
  },
  {
    id: "water",
    icon: "💧",
    name: "물풍선",
    desc: "앞쪽에 터져 주변 카트를 가둬요",
    color: "#78d5ef",
  },
  {
    id: "banana",
    icon: "🍌",
    name: "바나나",
    desc: "뒤에 놓는 미끄러운 함정",
    color: "#f7d873",
  },
  {
    id: "boost",
    icon: "⚡",
    name: "터보 부스터",
    desc: "3초 동안 최고 속도 돌파",
    color: "#ffcc68",
  },
  {
    id: "shield",
    icon: "🛡️",
    name: "방어막",
    desc: "6초 동안 공격을 막아요",
    color: "#90e4e5",
  },
  {
    id: "magnet",
    icon: "🧲",
    name: "자석",
    desc: "앞 카트를 향해 강하게 가속",
    color: "#e59bd0",
  },
  {
    id: "storm",
    icon: "⛈️",
    name: "번개 구름",
    desc: "모든 상대에게 번개 공격",
    color: "#bca5ee",
  },
];
export const DRIVERS = [
  { name: "나", color: "#ed7b61" },
  { name: "로지", color: "#e1a0ba" },
  { name: "민트", color: "#65b59a" },
  { name: "루나", color: "#9999d8" },
  { name: "망고", color: "#edbf5d" },
  { name: "코코", color: "#73b4cf" },
];
export const KARTS = [
  {
    id: "comet",
    name: "코멧",
    desc: "균형 잡힌 올라운더",
    speed: 40,
    accel: 16,
    grip: 1,
    steer: 1,
    stars: [4, 4, 4],
  },
  {
    id: "cloud",
    name: "클라우드",
    desc: "다루기 쉬운 코너 전문가",
    speed: 38,
    accel: 18,
    grip: 1.2,
    steer: 1.12,
    stars: [3, 5, 5],
  },
  {
    id: "bolt",
    name: "볼트",
    desc: "직선에서 빛나는 스피드",
    speed: 43,
    accel: 14,
    grip: 0.9,
    steer: 0.92,
    stars: [5, 3, 3],
  },
];
export const LEVELS = [
  { name: "가볍게", speed: 33, items: 0.65 },
  { name: "신나게", speed: 36, items: 1 },
  { name: "치열하게", speed: 40, items: 1.25 },
];
export function seeded(seed = 12345) {
  return () => {
    seed |= 0;
    seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
export function createRace(options = {}) {
  if (typeof options === "number") options = { track: options };
  const base = COURSES[options.track || 0],
    laps = Number.isInteger(options.laps) && options.laps >= 1 && options.laps <= 3 ? options.laps : base.laps,
    tr = { ...base, laps },
    g = {
      version: 2,
      track: options.track || 0,
      course: tr,
      options: {
        difficulty: 1,
        kart: 0,
        color: 0,
        mode: "item",
        assist: true,
        ...options,
      },
      mode: "countdown",
      countdown: 3.5,
      time: 0,
      rank: 6,
      item: null,
      inventory: [],
      drift: 0,
      nitro: 0,
      toast: "출발! 코너에서 드리프트를 모아 보세요",
      toastTime: 3,
      events: [],
      eventId: 0,
      projectiles: [],
      traps: [],
      boxCooldown: {},
      results: [],
      stats: {
        items: 0,
        hits: 0,
        blocks: 0,
        drifts: 0,
        collisions: 0,
        topSpeed: 0,
      },
      racers: [],
      launch: false,
      launchPressed: false,
    };
  for (let i = 0; i < 6; i++) {
    const grid = i === 0 ? 5 : i - 1,
      s = -Math.floor(grid / 2) * 8 - 8,
      lane = grid % 2 ? 4 : -4,
      p = sample(tr, s, lane);
    g.racers.push({
      id: i,
      grid,
      name: DRIVERS[i].name,
      s,
      lane,
      x: p.x,
      z: p.z,
      y: p.y,
      groundY: p.y,
      pitch: 0,
      angle: p.angle,
      moveAngle: p.angle,
      speed: 0,
      steer: 0,
      boost: 0,
      shield: 0,
      stun: 0,
      bubble: 0,
      magnet: 0,
      magnetTarget: null,
      drift: 0,
      driftSide: 0,
      drifting: false,
      wasDrifting: false,
      air: 0,
      finished: false,
      finishTime: 0,
      lapTimes: [],
      lapStart: 0,
      checkpoint: 0,
      item: null,
      itemAt: 2 + i * 0.35,
      aiLane: lane,
      collideCooldown: 0,
      resetCooldown: 0,
    });
  }
  return g;
}
export function notify(g, t, seconds = 2.7) {
  g.toast = t;
  g.toastTime = seconds;
}
export function event(g, type, x, z, extra = {}) {
  const e = {
    id: ++g.eventId,
    type,
    x,
    z,
    y: g.racers[extra.target]?.groundY || 0,
    age: 0,
    life: 1,
    ...extra,
  };
  g.events.push(e);
  return e;
}
export function rankOf(g, r) {
  return (
    1 +
    g.racers.filter(
      (o) =>
        o.id !== r.id &&
        ((o.finished && !r.finished) ||
          (o.finished === r.finished &&
            (r.finished
              ? o.finishTime < r.finishTime ||
                (o.finishTime === r.finishTime && o.grid < r.grid)
              : o.s > r.s || (o.s === r.s && o.grid < r.grid)))),
    ).length
  );
}
export function itemRoll(rank, rng = Math.random) {
  const weights =
    rank <= 2
      ? [2, 2, 6, 2, 6, 1, 0]
      : rank <= 4
        ? [5, 4, 3, 5, 4, 3, 1]
        : [5, 5, 1, 7, 2, 6, 3];
  let n = rng() * weights.reduce((a, b) => a + b, 0);
  for (let i = 0; i < weights.length; i++) {
    n -= weights[i];
    if (n < 0) return ITEMS[i].id;
  }
  return "boost";
}
export function hit(g, r, duration = 1.2, type = "rocket", attacker = -1) {
  if (r.finished) return false;
  if (r.shield > 0) {
    event(g, "block", r.x, r.z, { target: r.id, color: "#9af8eb" });
    if (r.id === 0) {
      g.stats.blocks++;
      notify(g, "🛡️ 방어 성공!");
    }
    return false;
  }
  if (r.stun > 0.2) return false;
  r.drifting = false;
  r.drift = 0;
  if (r.id === 0) g.drift = 0;
  r.stun = duration;
  r.speed *= type === "water" ? 0.28 : 0.45;
  if (type === "water") r.bubble = duration;
  event(g, type === "water" ? "splash" : "impact", r.x, r.z, {
    target: r.id,
    color: type === "water" ? "#6ddaf4" : "#ffcb6d",
  });
  if (r.id === 0) {
    notify(
      g,
      type === "water"
        ? "💧 물방울에 갇혔어요!"
        : "💥 피격! 금방 다시 출발해요",
    );
  }
  if (attacker === 0) g.stats.hits++;
  return true;
}
export function useItem(g, id = 0) {
  if (g.mode !== "racing") return false;
  const r = g.racers[id],
    item = id === 0 ? g.inventory.shift() : r.item;
  if (!item || r.finished) return false;
  if (id === 0) {
    g.item = g.inventory[0] || null;
    g.stats.items++;
    notify(
      g,
      ITEMS.find((i) => i.id === item).icon +
        " " +
        ITEMS.find((i) => i.id === item).name +
        "!",
    );
  } else r.item = null;
  const ahead = g.racers
      .filter((o) => o.id !== id && !o.finished && o.s > r.s)
      .sort((a, b) => a.s - b.s),
    target = ahead[0];
  event(g, "use", r.x, r.z, { target: id, item, life: 0.4 });
  if (item === "boost") {
    r.boost = Math.max(r.boost, 3);
    event(g, "boost", r.x, r.z, { target: id, life: 0.5 });
  }
  if (item === "shield") r.shield = 6;
  if (item === "magnet") {
    r.magnetTarget = target?.id ?? null;
    r.magnet = target ? 4 : 2;
    r.boost = Math.max(r.boost, target ? 4 : 2);
    if (id === 0 && !target) notify(g, "🧲 앞 카트가 없어서 짧은 가속!");
  }
  if (item === "rocket") {
    if (target) {
      g.projectiles.push({
        type: "rocket",
        owner: id,
        target: target.id,
        x: r.x,
        z: r.z,
        y: r.y + 2.5,
        angle: r.angle,
        age: 0,
        life: 8,
      });
      if (target.id === 0) notify(g, "⚠ 미사일 접근! 방어막을 쓰세요", 2);
    } else if (id === 0) notify(g, "🚀 앞에 조준할 카트가 없어요");
  }
  if (item === "water") {
    const p =
      target && target.s - r.s < 140
        ? sample(g.course, target.s + target.speed * 0.85, target.lane)
        : sample(g.course, r.s + 70, r.lane);
    g.projectiles.push({
      type: "water",
      owner: id,
      x: r.x,
      z: r.z,
      startX: r.x,
      startZ: r.z,
      targetX: p.x,
      targetZ: p.z,
      startY: r.y + 2.5,
      targetY: p.y || 0,
      y: r.y + 2.5,
      age: 0,
      life: 0.85,
    });
  }
  if (item === "banana") {
    const p = sample(g.course, r.s - 6, r.lane);
    g.traps.push({
      id: ++g.eventId,
      owner: id,
      x: p.x,
      z: p.z,
      y: p.y,
      age: 0,
      life: 25,
    });
    event(g, "drop", p.x, p.z, { y: p.y, life: 0.35 });
  }
  if (item === "storm") {
    for (const o of g.racers)
      if (o.id !== id && !o.finished) {
        event(g, "lightning", o.x, o.z, { target: o.id, life: 0.7 });
        hit(g, o, 1.1, "storm", id);
      }
  }
  return true;
}
function timers(r, dt) {
  for (const k of [
    "boost",
    "shield",
    "stun",
    "bubble",
    "magnet",
    "collideCooldown",
    "resetCooldown",
  ])
    r[k] = Math.max(0, r[k] - dt);
}
function playerStep(g, r, input, dt) {
  const tr = g.course,
    kart = KARTS[g.options.kart] || KARTS[0];
  const turn = (input.right ? 1 : 0) - (input.left ? 1 : 0);
  // Assistance stabilizes manual input; it must never aim toward the road.
  const response = g.options.assist ? 16 : 10;
  r.steer += (turn - r.steer) * (1 - Math.exp(-response * dt));
  if (g.options.assist && !turn && !input.drift)
    r.steer *= Math.exp(-20 * dt);
  const was = r.drifting;
  r.drifting =
    !!input.drift &&
    (was || Math.abs(r.steer) > 0.2) &&
    r.speed > 13 &&
    r.stun === 0;
  if (r.drifting && !was) {
    r.driftSide = Math.sign(r.steer);
    r.air = 0.15;
    event(g, "hop", r.x, r.z, { target: 0, life: 0.15 });
  }
  if (r.drifting) {
    const slip = Math.abs(wrapAngle(r.angle - r.moveAngle));
    const load = Math.min(1, Math.abs(r.steer) * 3 + slip * 2);
    r.drift = Math.min(
      1,
      r.drift + dt * (0.4 + Math.abs(r.steer) * 0.15) * load,
    );
  } else if (was) {
    if (!input.drift && r.speed > 13 && r.stun === 0 && r.drift >= 0.45) {
      const strong = r.drift >= 0.9;
      r.boost = Math.max(r.boost, strong ? 2.1 : 1.2);
      g.stats.drifts++;
      if (strong) {
        g.nitro = Math.min(3, g.nitro + 1);
        notify(g, "🔥 슈퍼 드리프트! 니트로 +1");
      } else notify(g, "✨ 미니 터보!");
      event(g, "driftBoost", r.x, r.z, { target: 0, strong, life: 0.7 });
    }
    r.drift = 0;
  }
  g.drift = r.drift;
  let max = kart.speed + (r.boost > 0 ? 15 : 0) - (r.pitch || 0) * 10;
  if (input.brake) max = 9;
  if (r.stun > 0) max = 7;
  const acceleration = r.speed < max ? kart.accel : 24;
  r.speed += Math.max(
    -acceleration * dt,
    Math.min(acceleration * dt, max - r.speed),
  );
  const yaw =
    r.steer *
    (0.55 + Math.min(1, r.speed / 30) * 0.8) *
    kart.steer *
    (r.drifting ? 1.25 : 1) *
    (r.stun > 0 ? 0.25 : 1);
  r.angle = wrapAngle(r.angle + yaw * dt);
  const grip = r.drifting ? 2.1 : (g.options.assist ? 12 : 9) * kart.grip;
  r.moveAngle = wrapAngle(
    r.moveAngle + wrapAngle(r.angle - r.moveAngle) * (1 - Math.exp(-grip * dt)),
  );
  r.x += Math.sin(r.moveAngle) * r.speed * dt;
  r.z += Math.cos(r.moveAngle) * r.speed * dt;
  const p = project(tr, r.x, r.z, r.s);
  let delta =
    mod(p.s - mod(r.s, tr.length) + tr.length / 2, tr.length) - tr.length / 2;
  if (Math.abs(delta) < r.speed * dt * 4 + 3) r.s += delta;
  r.lane = p.lane;
  if (Math.abs(r.lane) > tr.width - 1.6) {
    r.speed *= Math.pow(0.978, dt * 60);
  }
  if (Math.abs(r.lane) > tr.width + 1) {
    const side = Math.sign(r.lane),
      border = tr.width + 0.8;
    r.x = p.x + p.nx * side * border;
    r.z = p.z + p.nz * side * border;
    r.lane = side * border;
    r.angle = wrapAngle(
      r.angle + wrapAngle(p.angle - r.angle) * Math.min(1, dt * 7),
    );
    r.moveAngle = wrapAngle(
      r.moveAngle + wrapAngle(p.angle - r.moveAngle) * Math.min(1, dt * 10),
    );
    if (r.collideCooldown === 0) {
      r.speed *= 0.68;
      r.collideCooldown = 0.8;
      g.stats.collisions++;
      event(g, "wall", r.x, r.z, { target: 0, life: 0.4 });
    }
  }
  r.air = Math.max(0, r.air - dt);
  r.groundY = sample(tr, r.s).y;
  r.pitch = Math.atan2(sample(tr, r.s + 4).y - sample(tr, r.s - 4).y, 8);
  r.y = r.groundY + (r.air > 0 ? Math.sin((r.air / 0.15) * Math.PI) * 0.8 : 0);
  g.stats.topSpeed = Math.max(g.stats.topSpeed, r.speed);
}
function aiStep(g, r, dt, rng) {
  const tr = g.course,
    level = LEVELS[g.options.difficulty] || LEVELS[1],
    bend = Math.abs(curvature(tr, r.s + 18)),
    rubber = Math.max(-2, Math.min(2, (g.racers[0].s - r.s) / 200));
  const desired =
    level.speed +
    rubber +
    (r.id % 3) * 0.5 -
    Math.min(9, bend * 190) +
    (r.boost > 0 ? 14 : 0);
  const max = r.stun > 0 ? 7 : desired;
  r.speed += (max - r.speed) * (1 - Math.exp(-dt * 1.7));
  if (r.stun === 0) {
    r.aiLane = Math.sin(g.time * 0.18 + r.id * 2.1) * (tr.width - 4) * 0.72;
    const obstacle = g.traps.find((t) => Math.hypot(t.x - r.x, t.z - r.z) < 24);
    if (obstacle && g.options.difficulty > 0) {
      const p = project(tr, obstacle.x, obstacle.z);
      r.aiLane = p.lane > 0 ? -5 : 5;
    }
  }
  r.lane += (r.aiLane - r.lane) * (1 - Math.exp(-dt * 1.4));
  r.s += r.speed * dt;
  const p = sample(tr, r.s, r.lane);
  r.x = p.x;
  r.z = p.z;
  r.groundY = p.y;
  r.y = p.y;
  r.pitch = Math.atan2(sample(tr, r.s + 4).y - sample(tr, r.s - 4).y, 8);
  r.angle = p.angle;
  r.moveAngle = p.angle;
  r.drifting = bend > 0.012 && r.speed > 25;
  r.drift = r.drifting ? 0.7 : 0;
  if (r.item && g.time > r.itemAt && r.stun === 0) {
    if (r.item === "shield" && g.projectiles.some((p) => p.target === r.id))
      useItem(g, r.id);
    else if (rng() < dt * 0.75 * level.items) useItem(g, r.id);
  }
}
function collect(g, r, dt, rng) {
  if (g.options.mode === "speed" || r.finished) return;
  for (let j = 0; j < g.course.boxes.length; j++) {
    const s = g.course.boxes[j],
      d = mod(s - r.s, g.course.length),
      key = j + ":" + r.id;
    if (
      d < 5.5 &&
      Math.abs(r.lane) < g.course.width - 2 &&
      !(g.boxCooldown[key] > 0)
    ) {
      if (r.id === 0 && g.inventory.length < 2) {
        const item = itemRoll(rankOf(g, r), rng);
        g.inventory.push(item);
        g.item = g.inventory[0];
        notify(g, "🎁 " + ITEMS.find((i) => i.id === item).name + " 획득!");
        event(g, "pickup", r.x, r.z, { target: 0, item, life: 0.6 });
        g.boxCooldown[key] = 3;
      } else if (r.id !== 0 && !r.item) {
        r.item = itemRoll(rankOf(g, r), rng);
        r.itemAt = g.time + 0.8 + rng() * 1.7;
        g.boxCooldown[key] = 3;
      }
    }
  }
}
function projectiles(g, dt) {
  for (const p of g.projectiles) {
    p.age += dt;
    if (p.type === "rocket") {
      const r = g.racers[p.target],
        dx = r.x - p.x,
        dz = r.z - p.z,
        dist = Math.hypot(dx, dz);
      p.angle = Math.atan2(dx, dz);
      p.y += (r.y + 2.5 - p.y) * (1 - Math.exp(-dt * 5));
      if (dist < 4 && Math.abs(r.y + 2.5 - p.y) < 4) {
        hit(g, r, 1.3, "rocket", p.owner);
        p.life = 0;
      } else {
        const step = Math.min(dist, 64 * dt);
        p.x += (dx / dist) * step;
        p.z += (dz / dist) * step;
      }
    } else if (p.type === "water") {
      const t = Math.min(1, p.age / 0.85);
      p.x = p.startX + (p.targetX - p.startX) * t;
      p.z = p.startZ + (p.targetZ - p.startZ) * t;
      p.y =
        p.startY + (p.targetY + 2 - p.startY) * t + Math.sin(t * Math.PI) * 18;
      if (t >= 1) {
        event(g, "splash", p.x, p.z, { radius: 13, y: p.targetY, life: 1.2 });
        for (const r of g.racers)
          if (
            r.id !== p.owner &&
            Math.hypot(r.x - p.x, r.z - p.z, r.groundY - p.targetY) < 15
          )
            hit(g, r, 1.65, "water", p.owner);
      }
    }
  }
  g.projectiles = g.projectiles.filter((p) => p.age < p.life);
  for (const trap of g.traps) {
    trap.age += dt;
    for (const r of g.racers)
      if (
        !r.finished &&
        (r.id !== trap.owner || trap.age > 1) &&
        Math.hypot(r.x - trap.x, r.z - trap.z, r.groundY - trap.y) < 3.5
      ) {
        hit(g, r, 1.3, "banana", trap.owner);
        trap.life = 0;
        break;
      }
  }
  g.traps = g.traps.filter((t) => t.age < t.life);
}
export function step(g, input = {}, dt = 1 / 60, rng = Math.random) {
  dt = Math.max(0, Math.min(0.05, dt));
  if (!dt || ["paused", "finished"].includes(g.mode)) return;
  if (g.mode === "countdown") {
    g.countdown -= dt;
    if (input.nitro && !g.launchPressed) {
      g.launchPressed = true;
      if (g.countdown < 0.8 && g.countdown > 0.08) g.launch = true;
    }
    if (g.countdown <= 0) {
      g.mode = "racing";
      for (const r of g.racers) if (r.id !== 0) r.speed = 5;
      if (g.launch) {
        g.racers[0].boost = 1.7;
        notify(g, "🚦 완벽한 출발! 스타트 부스트");
      } else notify(g, "GO! 첫 코너를 향해!");
      event(g, "start", 0, 0, { life: 1 });
    }
    return;
  }
  g.time += dt;
  g.toastTime = Math.max(0, g.toastTime - dt);
  for (const e of g.events) e.age += dt;
  g.events = g.events.filter((e) => e.age < e.life);
  for (const key in g.boxCooldown)
    g.boxCooldown[key] = Math.max(0, g.boxCooldown[key] - dt);
  const p = g.racers[0];
  if (input.swap && g.inventory.length > 1) {
    g.inventory.reverse();
    g.item = g.inventory[0];
  }
  if (input.item) useItem(g);
  if (input.nitro && g.nitro > 0 && p.stun === 0) {
    g.nitro--;
    p.boost = Math.max(p.boost, 2.7);
    notify(g, "⚡ 니트로 부스트!");
    event(g, "boost", p.x, p.z, { target: 0, life: 0.5 });
  }
  for (const r of g.racers) {
    if (r.finished) continue;
    const previousS = r.s;
    timers(r, dt);
    if (r.id === 0) playerStep(g, r, input, dt);
    else aiStep(g, r, dt, rng);
    collect(g, r, dt, rng);
    const check = Math.floor(Math.max(0, r.s) / (g.course.length / 4));
    if (check > r.checkpoint) r.checkpoint = check;
    const nextLap = r.lapTimes.length + 1;
    if (
      nextLap <= g.course.laps &&
      r.s >= g.course.length * nextLap &&
      r.checkpoint >= nextLap * 4
    ) {
      const fraction = Math.max(
        0,
        Math.min(
          1,
          (g.course.length * nextLap - previousS) /
            Math.max(0.000001, r.s - previousS),
        ),
      );
      const crossedAt = g.time - dt + fraction * dt;
      r.lapTimes.push(crossedAt - r.lapStart);
      r.lapStart = crossedAt;
    }
    if (
      r.s >= g.course.length * g.course.laps &&
      r.checkpoint >= g.course.laps * 4
    ) {
      r.finished = true;
      const finishS = g.course.length * g.course.laps;
      const fraction = Math.max(
        0,
        Math.min(
          1,
          (finishS - previousS) / Math.max(0.000001, r.s - previousS),
        ),
      );
      r.finishTime = g.time - dt + fraction * dt;
      g.results.push(r.id);
      event(g, "finish", r.x, r.z, { target: r.id, life: 2 });
      if (r.id === 0) {
        g.mode = "finished";
      }
    }
  }
  // Gentle kart contact: a nudge rather than a hard stop.
  if (!p.finished && p.collideCooldown === 0)
    for (const r of g.racers.slice(1)) {
      if (!r.finished && Math.hypot(p.x - r.x, p.z - r.z) < 3.2) {
        const dx = p.x - r.x,
          dz = p.z - r.z,
          len = Math.hypot(dx, dz) || 1;
        p.x += (dx / len) * 0.6;
        p.z += (dz / len) * 0.6;
        p.speed *= 0.92;
        p.collideCooldown = 0.3;
        event(g, "bump", p.x, p.z, { life: 0.25 });
        break;
      }
    }
  projectiles(g, dt);
  g.rank = rankOf(g, p);
  if (g.mode === "finished") {
    g.results.sort((a, b) => rankOf(g, g.racers[a]) - rankOf(g, g.racers[b]));
    notify(
      g,
      g.rank === 1
        ? "🏆 우승! 멋진 레이스였어요!"
        : "🏁 완주! 끝까지 잘 달렸어요!",
    );
  }
}
export function resetPlayer(g) {
  if (g.mode !== "racing") return false;
  const r = g.racers[0];
  if (r.resetCooldown > 0) {
    notify(g, "복귀는 잠시 후 다시 사용할 수 있어요", 1);
    return false;
  }
  const p = sample(g.course, r.s, 0);
  r.x = p.x;
  r.z = p.z;
  r.angle = p.angle;
  r.moveAngle = p.angle;
  r.lane = 0;
  r.speed = 0;
  r.drifting = false;
  r.drift = 0;
  g.drift = 0;
  r.boost = 0;
  r.magnet = 0;
  r.air = 0;
  r.y = p.y;
  r.groundY = p.y;
  r.pitch = Math.atan2(
    sample(g.course, r.s + 4).y - sample(g.course, r.s - 4).y,
    8,
  );
  r.steer = 0;
  r.resetCooldown = 4;
  r.stun = Math.max(r.stun, 0.7);
  notify(g, "트랙 중앙으로 돌아왔어요");
  event(g, "reset", r.x, r.z, { target: 0, life: 0.5 });
  return true;
}
