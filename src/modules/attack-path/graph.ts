import { GraphNode } from './attack-path.types';

export function buildGraph(
  resources: any[],
  relationships: any[],
  findings: any[]
): Map<number, GraphNode> {
  const nodes = new Map<number, GraphNode>();

  for (const r of resources) {
    nodes.set(r.id, {
      dbId: r.id,
      resourceId: r.resource_id,
      resourceType: r.resource_type,
      findings: [],
      edges: [],
    });
  }

  for (const f of findings) {
    const node = nodes.get(f.resource_id);
    if (node) {
      node.findings.push({
        id: f.id,
        ruleId: f.rule_id,
        severity: f.severity,
      });
    }
  }

  for (const rel of relationships) {
    const source = nodes.get(rel.resource_a_id);
    if (source) {
      source.edges.push({
        targetNodeId: rel.resource_b_id,
        relationType: rel.relation_type,
      });
    }
  }

  return nodes;
}

const MAX_PATH_LENGTH = 5;
const MAX_VISITED = 100;

export function traverseAttackPaths(nodes: Map<number, GraphNode>): GraphNode[][] {
  const paths: GraphNode[][] = [];
  const discoveredPaths = new Set<string>();

  // Identify seeds: nodes with at least one HIGH finding
  const seeds: GraphNode[] = [];
  for (const node of nodes.values()) {
    if (node.findings.some((f) => f.severity === 'HIGH')) {
      seeds.push(node);
    }
  }

  for (const seed of seeds) {
    const visited = new Set<number>();
    visited.add(seed.dbId);
    
    const queue: { current: GraphNode; path: GraphNode[] }[] = [
      { current: seed, path: [seed] },
    ];
    let visitedCount = 1;

    while (queue.length > 0) {
      const { current, path } = queue.shift()!;

      // Check if current path is valid: at least 2 findings
      let findingNodesCount = 0;
      for (const node of path) {
        if (node.findings.length > 0) findingNodesCount++;
      }

      if (path.length > 1 && findingNodesCount >= 2) {
        const pathIdentity = path.map((n) => n.dbId).join('->');
        if (!discoveredPaths.has(pathIdentity)) {
          discoveredPaths.add(pathIdentity);
          paths.push([...path]);
        }
      }

      if (path.length >= MAX_PATH_LENGTH) {
        continue;
      }

      for (const edge of current.edges) {
        const neighbor = nodes.get(edge.targetNodeId);
        if (!neighbor) continue;

        if (!visited.has(neighbor.dbId)) {
          visited.add(neighbor.dbId);
          visitedCount++;
          queue.push({ current: neighbor, path: [...path, neighbor] });

          if (visitedCount >= MAX_VISITED) break;
        }
      }
      if (visitedCount >= MAX_VISITED) break;
    }
  }

  return paths;
}
