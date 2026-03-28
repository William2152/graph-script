import { FlowEdgeDecl, FlowNodeDecl } from './flow-types';

/**
 * Topological ordering with cycle fallback for flow nodes.
 */
export function topologicalOrder(nodes: FlowNodeDecl[], edges: FlowEdgeDecl[]): string[] {
  const adjacency = new Map<string, string[]>();
  const indegree = new Map<string, number>();

  nodes.forEach((node) => {
    adjacency.set(node.id, []);
    indegree.set(node.id, 0);
  });

  edges.forEach((edge) => {
    adjacency.get(edge.from)?.push(edge.to);
    indegree.set(edge.to, (indegree.get(edge.to) ?? 0) + 1);
  });

  let frontier = nodes.filter((node) => (indegree.get(node.id) ?? 0) === 0).map((node) => node.id);
  if (!frontier.length) frontier = nodes.map((node) => node.id);
  const ordered: string[] = [];
  const assigned = new Set<string>();

  while (frontier.length) {
    const current = frontier.shift()!;
    if (assigned.has(current)) continue;
    ordered.push(current);
    assigned.add(current);
    (adjacency.get(current) ?? []).forEach((neighbor) => {
      indegree.set(neighbor, (indegree.get(neighbor) ?? 1) - 1);
      if ((indegree.get(neighbor) ?? 0) <= 0) frontier.push(neighbor);
    });
    if (!frontier.length && assigned.size < nodes.length) {
      const fallback = nodes.find((node) => !assigned.has(node.id));
      if (fallback) frontier.push(fallback.id);
    }
  }

  return ordered;
}
