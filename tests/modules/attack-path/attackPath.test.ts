import { buildGraph, traverseAttackPaths } from '../../../src/modules/attack-path/graph';
import { GraphNode } from '../../../src/modules/attack-path/attack-path.types';

describe('Attack Path Correlation Engine', () => {
  describe('Graph Construction', () => {
    it('should build a directed graph from resources, relationships, and findings', () => {
      const resources = [
        { id: 1, resource_id: 'sg-001', resource_type: 'SECURITY_GROUP' },
        { id: 2, resource_id: 'i-001', resource_type: 'EC2_INSTANCE' },
      ];
      const relationships = [
        { resource_a_id: 1, resource_b_id: 2, relation_type: 'ATTACHED_TO' }
      ];
      const findings = [
        { id: 101, resource_id: 1, rule_id: 'SG-001', severity: 'HIGH' }
      ];

      const graph = buildGraph(resources, relationships, findings);

      expect(graph.size).toBe(2);
      
      const sgNode = graph.get(1)!;
      expect(sgNode.resourceType).toBe('SECURITY_GROUP');
      expect(sgNode.edges.length).toBe(1);
      expect(sgNode.edges[0].targetNodeId).toBe(2);
      expect(sgNode.edges[0].relationType).toBe('ATTACHED_TO');
      expect(sgNode.findings.length).toBe(1);
      expect(sgNode.findings[0].severity).toBe('HIGH');

      const ec2Node = graph.get(2)!;
      expect(ec2Node.resourceType).toBe('EC2_INSTANCE');
      expect(ec2Node.edges.length).toBe(0); // Directed graph
      expect(ec2Node.findings.length).toBe(0);
    });
  });

  describe('Traversal and Path Quality', () => {
    it('should find meaningful paths with at least 2 findings', () => {
      const resources = [
        { id: 1, resource_id: 'sg-001', resource_type: 'SECURITY_GROUP' },
        { id: 2, resource_id: 'i-001', resource_type: 'EC2_INSTANCE' },
        { id: 3, resource_id: 's3-001', resource_type: 'S3_BUCKET' },
      ];
      const relationships = [
        { resource_a_id: 1, resource_b_id: 2, relation_type: 'ATTACHED_TO' },
        { resource_a_id: 2, resource_b_id: 3, relation_type: 'ACCESSES' },
      ];
      const findings = [
        { id: 101, resource_id: 1, rule_id: 'SG-001', severity: 'HIGH' },
        { id: 102, resource_id: 3, rule_id: 'S3-001', severity: 'HIGH' },
      ];

      const graph = buildGraph(resources, relationships, findings);
      const paths = traverseAttackPaths(graph);

      // SG -> EC2 -> S3 has findings on ends
      expect(paths.length).toBe(1);
      expect(paths[0].length).toBe(3);
      expect(paths[0][0].dbId).toBe(1);
      expect(paths[0][2].dbId).toBe(3);
    });

    it('should NOT create paths for unconnected findings', () => {
      const resources = [
        { id: 1, resource_id: 'sg-001', resource_type: 'SECURITY_GROUP' },
        { id: 2, resource_id: 's3-001', resource_type: 'S3_BUCKET' },
      ];
      const relationships: any[] = [];
      const findings = [
        { id: 101, resource_id: 1, rule_id: 'SG-001', severity: 'HIGH' },
        { id: 102, resource_id: 2, rule_id: 'S3-001', severity: 'HIGH' },
      ];

      const graph = buildGraph(resources, relationships, findings);
      const paths = traverseAttackPaths(graph);

      expect(paths.length).toBe(0);
    });

    it('should terminate traversal on cycles', () => {
      const resources = [
        { id: 1, resource_id: 'r1', resource_type: 'RES' },
        { id: 2, resource_id: 'r2', resource_type: 'RES' },
        { id: 3, resource_id: 'r3', resource_type: 'RES' },
      ];
      // A -> B -> C -> A
      const relationships = [
        { resource_a_id: 1, resource_b_id: 2, relation_type: 'LINK' },
        { resource_a_id: 2, resource_b_id: 3, relation_type: 'LINK' },
        { resource_a_id: 3, resource_b_id: 1, relation_type: 'LINK' },
      ];
      const findings = [
        { id: 101, resource_id: 1, rule_id: 'F-001', severity: 'HIGH' },
        { id: 102, resource_id: 2, rule_id: 'F-002', severity: 'HIGH' },
      ];

      const graph = buildGraph(resources, relationships, findings);
      const paths = traverseAttackPaths(graph);

      // A -> B has findings
      expect(paths.length).toBeGreaterThan(0);
      
      // Path lengths should not exceed the number of unique nodes due to cycle detection
      for (const path of paths) {
        expect(path.length).toBeLessThanOrEqual(3);
      }
    });

    it('should seed only from HIGH findings', () => {
      const resources = [
        { id: 1, resource_id: 'r1', resource_type: 'RES' },
        { id: 2, resource_id: 'r2', resource_type: 'RES' },
      ];
      const relationships = [
        { resource_a_id: 1, resource_b_id: 2, relation_type: 'LINK' },
      ];
      const findings = [
        { id: 101, resource_id: 1, rule_id: 'F-001', severity: 'MEDIUM' },
        { id: 102, resource_id: 2, rule_id: 'F-002', severity: 'HIGH' },
      ];

      const graph = buildGraph(resources, relationships, findings);
      const paths = traverseAttackPaths(graph);

      // Path from 2 -> ? doesn't go anywhere.
      // 1 -> 2 is connected, but 1 is not HIGH so it doesn't seed.
      // Therefore no paths should be found!
      expect(paths.length).toBe(0);
    });
    it('should respect relationship directionality (A -> B != B -> A)', () => {
      const resources = [
        { id: 1, resource_id: 'r1', resource_type: 'RES' },
        { id: 2, resource_id: 'r2', resource_type: 'RES' },
      ];
      // Directed edge 1 -> 2
      const relationships = [
        { resource_a_id: 1, resource_b_id: 2, relation_type: 'ATTACHED_TO' },
      ];
      const findings = [
        { id: 101, resource_id: 1, rule_id: 'F-001', severity: 'HIGH' },
        { id: 102, resource_id: 2, rule_id: 'F-002', severity: 'HIGH' },
      ];

      const graph = buildGraph(resources, relationships, findings);
      const paths = traverseAttackPaths(graph);

      // Traversal 1 -> 2 should work
      expect(paths.length).toBe(1);
      expect(paths[0][0].dbId).toBe(1);
      expect(paths[0][1].dbId).toBe(2);

      // Try with edge 2 -> 1 instead, but seeding from 1
      const reversedRelationships = [
        { resource_a_id: 2, resource_b_id: 1, relation_type: 'ATTACHED_TO' },
      ];
      const reversedGraph = buildGraph(resources, reversedRelationships, findings);
      const reversedPaths = traverseAttackPaths(reversedGraph);

      // Path from 2 -> 1 exists, but what if we only consider path 1 -> 2?
      // Since 2 is also HIGH severity, it seeds its own path! 
      // Seed 2: 2 -> 1 (Valid path!)
      // Seed 1: no outgoing edges, so 1 -> nothing.
      // We expect the path to be 2 -> 1, NOT 1 -> 2.
      expect(reversedPaths.length).toBe(1);
      expect(reversedPaths[0][0].dbId).toBe(2);
      expect(reversedPaths[0][1].dbId).toBe(1);
    });
  });
});
