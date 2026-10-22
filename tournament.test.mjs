import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createTournament, recordRound, advanceRound, standings } from './tournament.mjs';
const racers = Array.from({length:6}, (_, id) => ({ id, name: `R${id}` }));
test('three courses rotate from the selected first course', () => {
  for (let first=0;first<3;first++) {
    const c=createTournament(first,racers);
    assert.equal(c.tracks[0], first);
    assert.equal(new Set(c.tracks).size,3);
    assert.equal(advanceRound(c),false);
  }
});
test('all rounds score exactly once, preserve entrants, and stop at final', () => {
  const c=createTournament(2,racers);
  for(let i=0;i<3;i++) {
    assert.equal(recordRound(c,[0,1,2,3,4,5]),true);
    assert.equal(recordRound(c,[0,1,2,3,4,5]),false);
    assert.equal(advanceRound(c),i<2);
  }
  assert.equal(c.rounds.length,3);
  assert.deepEqual(standings(c).map(r=>r.points),[30,21,15,9,6,3]);
  assert.deepEqual(racers.map(r=>r.id),[0,1,2,3,4,5]);
});
test('ties use place countback then latest round, never player preference', () => {
  const c=createTournament(0,racers);
  recordRound(c,[0,1,2,3,4,5]);advanceRound(c);
  recordRound(c,[1,0,2,3,4,5]);
  assert.equal(standings(c)[0].id,1);
  assert.equal(standings(c)[0].points,17);
});
test('invalid duplicate or unknown entrants do not corrupt scores', () => {
  const c=createTournament(0,racers);
  for(const ids of [[0,0,2,3,4,5],[0,1,2,3,4,9],[0,1]])
    assert.throws(()=>recordRound(c,ids));
  assert.equal(c.rounds.length,0);
  assert.equal(c.entrants.reduce((s,r)=>s+r.points,0),0);
});
