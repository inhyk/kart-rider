import { test } from "node:test";
import assert from "node:assert/strict";
import {
  createRace,
  step,
  useItem,
  hit,
  COURSES,
  ITEMS,
  sample,
  project,
  wrapAngle,
  itemRoll,
  resetPlayer,
  seeded,
  rankOf,
} from "./core.mjs";
const rng = seeded(120);
test("starting grid and exact ties have unique, stable positions", () => {
  const g = createRace();
  assert.equal(rankOf(g, g.racers[0]), 6);
  assert.deepEqual(
    g.racers.map((r) => rankOf(g, r)).sort((a, b) => a - b),
    [1, 2, 3, 4, 5, 6],
  );
  for (const r of g.racers) {
    r.finished = true;
    r.finishTime = 100;
  }
  assert.deepEqual(
    g.racers.map((r) => rankOf(g, r)).sort((a, b) => a - b),
    [1, 2, 3, 4, 5, 6],
  );
});
test("a photo finish uses the crossing time within the physics step", () => {
  const g = race(0, { mode: "speed" }),
    finish = g.course.length * 3;
  g.time = 150;
  place(g, g.racers[0], finish - 0.2, -3);
  g.racers[0].speed = 40;
  g.racers[0].checkpoint = 11;
  place(g, g.racers[1], finish - 0.05, 3);
  g.racers[1].speed = 40;
  g.racers[1].checkpoint = 11;
  step(g, {}, 1 / 60, seeded(1));
  assert.equal(g.mode, "finished");
  assert.equal(g.rank, 2);
  assert.ok(g.racers[1].finishTime < g.racers[0].finishTime);
  assert.ok(g.racers[0].finishTime >= 150 && g.racers[0].finishTime <= g.time);
  assert.deepEqual(g.results, [1, 0]);
});
function race(track = 0, options = {}) {
  const g = createRace({ track, ...options });
  g.mode = "racing";
  return g;
}
function place(g, r, s, lane = 0) {
  const p = sample(g.course, s, lane);
  Object.assign(r, {
    s,
    lane,
    y: p.y,
    groundY: p.y,
    x: p.x,
    z: p.z,
    angle: p.angle,
    moveAngle: p.angle,
  });
}
function simulate(g, seconds, control = () => ({})) {
  for (let t = 0; t < seconds; t += 1 / 120) step(g, control(g), 1 / 120, rng);
}
function autopilot(g) {
  const r = g.racers[0],
    p = sample(g.course, r.s + 14),
    desired = Math.atan2(p.x - r.x, p.z - r.z),
    delta = wrapAngle(desired - r.angle);
  return { left: delta < -0.025, right: delta > 0.025 };
}
test("all courses are distinct, closed and projection round-trips along the ribbon", () => {
  assert.equal(new Set(COURSES.map((t) => Math.round(t.length))).size, 3);
  for (const tr of COURSES) {
    for (const s of [
      0,
      35,
      tr.length * 0.15,
      tr.length * 0.45,
      tr.length * 0.75,
      tr.length - 20,
    ]) {
      for (const lane of [-7, 0, 7]) {
        const p = sample(tr, s, lane),
          q = project(tr, p.x, p.z, s);
        const ds =
          (wrapAngle(((q.s - s) / tr.length) * Math.PI * 2) * tr.length) /
          (Math.PI * 2);
        assert.ok(Math.abs(ds) < 0.5, `${tr.id} s=${s} delta=${ds}`);
        assert.ok(Math.abs(q.lane - lane) < 0.1);
      }
    }
    const a = sample(tr, 0),
      b = sample(tr, tr.length);
    assert.ok(Math.hypot(a.x - b.x, a.z - b.z) < 1e-8);
  }
});
test("countdown and start boost have a valid timing window", () => {
  const g = createRace();
  simulate(g, 2.8);
  step(g, { nitro: true }, 1 / 120);
  simulate(g, 1);
  assert.equal(g.mode, "racing");
  assert.ok(g.launch);
  assert.ok(g.racers[0].boost > 0);
  const early = createRace();
  step(early, { nitro: true }, 1 / 120);
  simulate(early, 4);
  assert.equal(early.launch, false);
});
test("steering changes actual heading and world trajectory; brake reduces speed", () => {
  const g = race();
  simulate(g, 1.5);
  const a = g.racers[0].angle;
  simulate(g, 0.4, () => ({ right: true }));
  assert.ok(wrapAngle(g.racers[0].angle - a) > 0.1);
  const speed = g.racers[0].speed;
  simulate(g, 0.8, () => ({ brake: true }));
  assert.ok(g.racers[0].speed < speed);
});
test("barrier contains a persistently steering car and emits collision feedback", () => {
  const g = race();
  simulate(g, 12, () => ({ right: true }));
  const p = g.racers[0];
  assert.ok(Math.abs(p.lane) < g.course.width + 1.1);
  assert.ok(g.stats.collisions > 0);
  assert.ok(Number.isFinite(p.x) && Number.isFinite(p.z));
});
test("shield blocks once per hit and statuses expire", () => {
  const g = race(),
    p = g.racers[0];
  p.shield = 1;
  assert.equal(hit(g, p), false);
  assert.equal(g.stats.blocks, 1);
  p.shield = 0;
  assert.equal(hit(g, p), true);
  simulate(g, 2);
  assert.equal(p.stun, 0);
});
test("all seven items consume and have their advertised physical effect", () => {
  for (const item of ITEMS) {
    const g = race(),
      p = g.racers[0];
    place(g, p, 50);
    place(g, g.racers[1], 70);
    g.inventory = [item.id];
    g.item = item.id;
    assert.ok(useItem(g));
    assert.equal(g.item, null);
    assert.equal(g.inventory.length, 0);
    assert.equal(useItem(g), false);
    if (["boost", "magnet"].includes(item.id)) assert.ok(p.boost > 0);
    if (item.id === "shield") assert.equal(p.shield, 6);
    if (item.id === "rocket") {
      assert.equal(g.projectiles[0].type, "rocket");
      assert.equal(g.racers[1].stun, 0);
      simulate(g, 1);
      assert.ok(g.stats.hits > 0);
    }
    if (item.id === "water") {
      assert.equal(g.projectiles[0].type, "water");
      simulate(g, 1);
      assert.ok(g.events.some((e) => e.type === "splash"));
    }
    if (item.id === "storm") assert.ok(g.racers[1].stun > 0);
    if (item.id === "banana") assert.equal(g.traps.length, 1);
  }
});
test("inventory holds two slots, swapping and using preserves the second item", () => {
  const g = race();
  g.inventory = ["shield", "boost"];
  g.item = "shield";
  step(g, { swap: true }, 0.01, rng);
  assert.deepEqual(g.inventory, ["boost", "shield"]);
  useItem(g);
  assert.deepEqual(g.inventory, ["shield"]);
  assert.equal(g.item, "shield");
  assert.ok(g.racers[0].boost > 0);
});
test("water leads a moving opponent instead of always landing behind it", () => {
  const g = race(),
    p = g.racers[0],
    target = g.racers[1];
  place(g, p, 50);
  place(g, target, 80);
  target.speed = 36;
  g.inventory = ["water"];
  useItem(g);
  const landing = g.projectiles[0];
  assert.ok(
    Math.hypot(landing.targetX - target.x, landing.targetZ - target.z) > 20,
  );
  simulate(g, 0.9);
  assert.ok(
    target.bubble > 0,
    "a steady opponent should be inside the predicted splash",
  );
  assert.ok(g.stats.hits > 0);
});
test("rank weights favor comeback items and never give leader a storm", () => {
  for (let i = 0; i < 100; i++)
    assert.notEqual(
      itemRoll(1, () => i / 100),
      "storm",
    );
  assert.equal(
    itemRoll(6, () => 0.9999),
    "storm",
  );
});
test("box pickup is based on position and has independent racer cooldown", () => {
  const g = race(),
    p = g.racers[0];
  place(g, p, g.course.boxes[0] - 2);
  step(g, {}, 0.01, () => 0);
  assert.equal(g.inventory.length, 1);
  assert.ok(g.boxCooldown["0:0"] > 0);
  g.inventory = [];
  g.item = null;
  step(g, {}, 0.01);
  assert.equal(g.item, null);
});
test("speed mode prevents item pickups", () => {
  const g = race(0, { mode: "speed" });
  place(g, g.racers[0], g.course.boxes[0] - 2);
  step(g, {}, 0.01);
  assert.equal(g.inventory.length, 0);
});
test("charged drift release grants turbo and full charge grants bounded nitro", () => {
  const g = race(),
    p = g.racers[0];
  p.speed = 35;
  p.drifting = true;
  p.drift = 0.96;
  step(g, {}, 1 / 120);
  assert.equal(g.nitro, 1);
  assert.equal(g.stats.drifts, 1);
  assert.ok(p.boost > 0);
  assert.equal(p.drift, 0);
  step(g, { nitro: true }, 1 / 120);
  assert.equal(g.nitro, 0);
  assert.ok(p.boost > 2);
});
test("countersteering keeps a held drift alive, while stopping cannot cash in a turbo", () => {
  const g = race(0, { mode: "speed" }),
    p = g.racers[0];
  place(g, p, 20);
  p.speed = 35;
  simulate(g, 0.4, () => ({ right: true, drift: true }));
  assert.ok(p.drifting);
  const charge = p.drift;
  simulate(g, 0.25, () => ({ drift: true }));
  assert.ok(p.drifting);
  assert.ok(p.drift >= charge);
  p.drift = 0.95;
  p.speed = 5;
  p.boost = 0;
  g.nitro = 0;
  step(g, { drift: true }, 1 / 120, rng);
  assert.equal(p.drifting, false);
  assert.equal(p.boost, 0);
  assert.equal(g.nitro, 0);
});
test("pause freezes all simulation and completion records the result once", () => {
  const g = race();
  g.mode = "paused";
  const before = structuredClone({ ...g, course: null });
  step(g, {}, 0.05);
  assert.deepEqual({ ...g, course: null }, before);
  g.mode = "racing";
  const p = g.racers[0];
  place(g, p, g.course.length * 3 - 0.1);
  p.speed = 40;
  step(g, {}, 0.05);
  assert.equal(g.mode, "finished");
  assert.deepEqual(g.results, [0]);
  const time = g.time;
  step(g, {}, 0.05);
  assert.equal(g.time, time);
});
test("track reset restores forward heading and a finite center position", () => {
  const g = race();
  g.racers[0].x = 2000;
  resetPlayer(g);
  const r = g.racers[0];
  assert.equal(r.lane, 0);
  assert.equal(r.speed, 0);
  assert.ok(Math.hypot(r.x, r.z) < 100);
});
test("all 3 courses are driveable with real steering from start to finish", () => {
  for (let i = 0; i < 3; i++) {
    const g = race(i, { difficulty: 0, mode: "speed", assist: false });
    simulate(g, 220, autopilot);
    assert.equal(
      g.mode,
      "finished",
      `${g.course.id}: s=${g.racers[0].s}, lane=${g.racers[0].lane}`,
    );
    assert.ok(g.time > 60 && g.time < 220);
    assert.equal(g.racers[0].lapTimes.length, 3);
    assert.ok(g.racers[0].lapTimes.every((t) => t > 0));
    assert.ok(
      Math.abs(
        g.racers[0].lapTimes.reduce((a, b) => a + b, 0) -
          g.racers[0].finishTime,
      ) < 1e-8,
    );
    assert.ok(
      g.stats.collisions < 30,
      `${g.course.id}: ${g.stats.collisions} collisions`,
    );
  }
});
test("crossing the same lap line twice cannot duplicate a lap record", () => {
  const g = race(0, { mode: "speed" }),
    p = g.racers[0];
  g.time = 40;
  place(g, p, g.course.length - 0.1);
  p.checkpoint = 3;
  p.speed = 40;
  step(g, {}, 1 / 60, rng);
  assert.equal(p.lapTimes.length, 1);
  place(g, p, g.course.length - 0.1);
  p.speed = 40;
  step(g, {}, 1 / 60, rng);
  assert.equal(p.lapTimes.length, 1);
});

test("reset cannot erase attacks, keep a turbo, or be spammed", () => {
  const g = race(),
    p = g.racers[0];
  p.stun = 1.5;
  p.bubble = 1.5;
  p.boost = 3;
  assert.equal(resetPlayer(g), true);
  assert.equal(p.stun, 1.5);
  assert.equal(p.bubble, 1.5);
  assert.equal(p.boost, 0);
  assert.equal(resetPlayer(g), false);
  simulate(g, 4.1, autopilot);
  assert.equal(resetPlayer(g), true);
  g.mode = "finished";
  assert.equal(resetPlayer(g), false);
});

test("an attack interrupts drift charge without awarding a release turbo", () => {
  const g = race(),
    p = g.racers[0];
  p.speed = 35;
  p.drifting = true;
  p.drift = 1;
  hit(g, p);
  step(g, {}, 1 / 120);
  assert.equal(g.nitro, 0);
  assert.equal(g.stats.drifts, 0);
  assert.equal(p.boost, 0);
});

test("raised road profiles are smooth, loop continuously, and all racers follow their surface", () => {
  for (const tr of COURSES) {
    let max = 0;
    for (let s = 0; s < tr.length; s += 2) {
      const a = sample(tr, s),
        b = sample(tr, s + 2);
      max = Math.max(max, a.y);
      assert.ok(Math.abs(b.y - a.y) < 0.4);
      assert.ok(a.y >= 0 && a.y <= 12);
    }
    assert.equal(sample(tr, 0).y, sample(tr, tr.length).y);
    if (tr.theme !== "forest") assert.ok(max >= 8);
    const g = race(COURSES.indexOf(tr), { mode: "speed" });
    simulate(g, 35, autopilot);
    for (const r of g.racers) {
      assert.ok(Math.abs(r.groundY - sample(tr, r.s).y) < 1e-8);
      assert.ok(Number.isFinite(r.pitch));
    }
  }
});
test("attacks, recovery and water trajectories respect the height of raised roads", () => {
  const g = race(2),
    p = g.racers[0];
  place(g, p, g.course.length * 0.35);
  p.y = sample(g.course, p.s).y;
  p.groundY = p.y;
  g.inventory = ["water", "banana"];
  useItem(g);
  assert.equal(g.projectiles[0].startY, p.y + 2.5);
  for (let i = 0; i < 90; i++) {
    step(g, {}, 1 / 120);
    for (const shot of g.projectiles) assert.ok(Number.isFinite(shot.y));
  }
  useItem(g);
  assert.ok(g.traps[0].y > 8);
  assert.equal(resetPlayer(g), true);
  assert.equal(p.y, sample(g.course, p.s).y);
  assert.ok(p.y > 8);
});

test('steering assistance never pulls a released heading back toward the road', () => {
  for (let track = 0; track < 3; track++) {
    const g = race(track, { mode: 'speed', assist: true });
    const r = g.racers[0];
    place(g, r, 120, 0);
    r.angle = wrapAngle(r.angle + 0.25);
    r.moveAngle = r.angle;
    r.speed = 8;
    const heading = r.angle, start = r.s;
    simulate(g, 0.3);
    assert.ok(Math.abs(wrapAngle(r.angle - heading)) < 0.000001, 'released heading must stay under player control');
    assert.ok(r.s > start && r.s - start < 10, 'assistance cannot teleport progress back to the goal');
  }
});
