function stable(value) {
  if (Array.isArray(value)) return value.map(stable);
  if (value && typeof value === 'object') {
    return Object.fromEntries(Object.keys(value).sort().map(key => [key, stable(value[key])]));
  }
  return value;
}

export function nodeExecutionKey(node) {
  return JSON.stringify([node.type, stable(node.data?.config ?? {})]);
}

function edgeExecutionKey(edge) {
  return JSON.stringify([edge.id, edge.source, edge.target, edge.sourceHandle || 'main', edge.targetHandle || 'input']);
}

export function changedExecutionNodes(previous, current) {
  const oldNodes = new Map(previous.nodes.map(node => [node.id, nodeExecutionKey(node)]));
  const oldEdges = new Set(previous.edges.map(edgeExecutionKey));
  const newEdges = new Set(current.edges.map(edgeExecutionKey));
  const changed = new Set(current.nodes.filter(node => oldNodes.get(node.id) !== nodeExecutionKey(node)).map(node => node.id));
  for (const edge of previous.edges) {
    if (!newEdges.has(edgeExecutionKey(edge))) changed.add(edge.target);
  }
  for (const edge of current.edges) {
    if (!oldEdges.has(edgeExecutionKey(edge))) changed.add(edge.target);
  }
  const outgoing = new Map();
  for (const edge of current.edges) {
    if (!outgoing.has(edge.source)) outgoing.set(edge.source, []);
    outgoing.get(edge.source).push(edge.target);
  }
  for (const id of changed) {
    for (const target of outgoing.get(id) ?? []) changed.add(target);
  }
  return changed;
}
