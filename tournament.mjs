export const POINTS = Object.freeze([10, 7, 5, 3, 2, 1]);

export function createTournament(firstTrack, racers) {
  return {
    tracks: [0, 1, 2].map((offset) => (firstTrack + offset) % 3),
    round: 0,
    rounds: [],
    entrants: racers.map(({ id, name }) => ({ id, name, points: 0, places: [] })),
  };
}

// Finishing racers precede the remaining field, ordered by race progress.
// The race freezes on player finish, so that snapshot determines round points.
export function recordRound(cup, ids) {
  if (cup.rounds.length > cup.round) return false;
  if (cup.round >= cup.tracks.length || ids.length !== cup.entrants.length ||
      new Set(ids).size !== ids.length ||
      ids.some((id) => !cup.entrants.some((r) => r.id === id))) {
    throw new Error("잘못된 라운드 순위입니다.");
  }
  cup.rounds.push([...ids]);
  ids.forEach((id, place) => {
    const racer = cup.entrants.find((r) => r.id === id);
    racer.points += POINTS[place];
    racer.places.push(place + 1);
  });
  return true;
}

export function standings(cup) {
  return [...cup.entrants].sort((a, b) => {
    if (a.points !== b.points) return b.points - a.points;
    // Count back wins, then seconds, etc.; latest round decides remaining ties.
    for (let place = 1; place <= POINTS.length; place++) {
      const diff = b.places.filter((p) => p === place).length -
        a.places.filter((p) => p === place).length;
      if (diff) return diff;
    }
    return (a.places.at(-1) ?? 0) - (b.places.at(-1) ?? 0) || a.id - b.id;
  });
}

export function advanceRound(cup) {
  if (cup.rounds.length !== cup.round + 1 || cup.round + 1 >= cup.tracks.length)
    return false;
  cup.round++;
  return true;
}
