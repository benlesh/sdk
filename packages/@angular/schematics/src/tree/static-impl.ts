import {MergeStrategy, Tree} from '../interface';



export function treeEmptyImpl(): Tree {
  return new (require('./virtual').VirtualTree)();
}

// Combinatorics
// Creates a copy of this host.
export function treeBranchImpl(map: Tree, glob: string): Tree {
  const VirtualTree = require('./virtual').VirtualTree;
  return VirtualTree.branch(map, glob);
}

// Creates two copies of this host that are disjoint, based on glob.
export function treePartitionImpl(map: Tree, glob?: string): Tree[] {
  return (require('./virtual').VirtualTree).partition(map, glob);
}

// Creates a new host path 2 hosts.
export function treeMergeImpl(map: Tree, other: Tree, strategy: MergeStrategy): Tree {
  return (require('./virtual').VirtualTree).merge(map, other, strategy);
}
