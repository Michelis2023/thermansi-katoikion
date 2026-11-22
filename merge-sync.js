function same(a, b) {
  if (a === b) return true;
  if (!a || !b || typeof a !== 'object' || typeof b !== 'object') return false;
  if (Array.isArray(a) !== Array.isArray(b)) return false;
  const keys = Object.keys(a);
  return keys.length === Object.keys(b).length
    && keys.every(key => Object.hasOwn(b, key) && same(a[key], b[key]));
}

function mergeValue(base, local, remote) {
  if (same(local, remote) || same(remote, base)) return local;
  if (same(local, base)) return remote;

  if ([base, local, remote].every(Array.isArray)) {
    // Measurements depend on the previous reading and silo stock. Keep only
    // compatible histories, never concatenate two branches of readings.
    const [shorter, longer] = local.length <= remote.length ? [local, remote] : [remote, local];
    if (shorter.length >= base.length && base.every((row, i) => same(row, shorter[i]))
        && shorter.every((row, i) => same(row, longer[i]))) return longer;
  } else if ([base, local, remote].every(value => value && typeof value === 'object' && !Array.isArray(value))) {
    const fields = new Set([...Object.keys(base), ...Object.keys(local), ...Object.keys(remote)]);
    return Object.fromEntries([...fields].map(key => [
      key, mergeValue(base[key], local[key], remote[key])
    ]).filter(([, value]) => value !== undefined));
  }

  throw Error('Conflicting changes');
}

export function mergePayloads(base, local, remote) {
  try {
    return JSON.stringify(mergeValue(JSON.parse(base), JSON.parse(local), JSON.parse(remote)));
  } catch {
    return null;
  }
}
