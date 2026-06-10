export function createRegistry() {
  const bySub = new Map();

  function add(sub, connection) {
    if (!bySub.has(sub)) bySub.set(sub, new Set());
    bySub.get(sub).add(connection);
  }

  function remove(sub, connection) {
    const set = bySub.get(sub);
    if (!set) return;
    set.delete(connection);
    if (!set.size) bySub.delete(sub);
  }

  function peers(sub, except) {
    const set = bySub.get(sub);
    if (!set) return [];
    const out = [];
    for (const c of set) if (c !== except) out.push(c);
    return out;
  }

  function countSub(sub) {
    const set = bySub.get(sub);
    return set ? set.size : 0;
  }

  function totalConnections() {
    let n = 0;
    for (const set of bySub.values()) n += set.size;
    return n;
  }

  return { add, remove, peers, countSub, totalConnections };
}
