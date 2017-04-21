import {Observable} from 'rxjs';
import {
  treeBranchImpl,
  treeEmptyImpl,
  treeMergeImpl,
  treePartitionImpl
} from './tree/static-impl';
import {Collection} from './collection';


export enum MergeStrategy {
  Overwrite = 0,  // Overwrite the file.
  Error = 1,  // Error out if 2 files have the same path.
  ContentOnly = 2,  // Only apply content changes from the second tree (skip creation)
}


export interface UpdateRecorder {
  // These just record changes.
  insertLeft(index, content): UpdateRecorder;
  insertRight(index, content): UpdateRecorder;
  remove(index, length): UpdateRecorder;
}


export abstract class Tree {
  // Readonly.
  abstract find(glob?: string): string[];
  abstract exists(path: string): boolean;

  // Content access.
  abstract read(path: string): Buffer | null;

  // Change content of host files.
  abstract overwrite(path: string, content: Buffer | string): void;
  abstract beginUpdate(path: string): UpdateRecorder;
  abstract commitUpdate(record: UpdateRecorder);

  // Structural methods.
  abstract copy(from: string, to: string): void;
  abstract create(path: string, content: Buffer | string): void;
  abstract delete(path: string): void;
  abstract rename(from: string, to: string): void;

  static empty(): Tree {
    return treeEmptyImpl();
  }

  // Combinatorics
  // Creates a copy of this host.
  static branch(tree: Tree, glob = '**', resolved = false): Tree {
    return treeBranchImpl(tree, glob, resolved);
  }

  // Creates two copies of this host that are disjoint, based on glob.
  static partition(tree: Tree, glob?: string): Tree[] {
    return treePartitionImpl(tree, glob);
  }

  // Creates a new host path 2 hosts.
  static merge(tree: Tree,
               other: Tree,
               strategy: MergeStrategy = MergeStrategy.Error): Tree {
    return treeMergeImpl(tree, other, strategy);
  }
}


export interface Schematic {
  readonly name: string;
  readonly description: string;
  readonly path: string;
  readonly collection: Collection;

  call(host: Observable<Tree>): Observable<Tree>;
}


export interface SchematicContext {
  schematic: Schematic;
  host: Observable<Tree>;
}


export interface CollectionDescription {
  readonly path: string;
  readonly name?: string;
  readonly version?: string;
  readonly schematics: { [name: string]: SchematicDescription };
}

export interface SchematicDescription {
  readonly factory: string;
  readonly description: string;
  readonly schema?: string;
}

export interface ResolvedSchematicDescription extends SchematicDescription {
  readonly name: string;
  readonly path: string;
  readonly rule: Rule;
}

export type RuleFactory<T> = (options: T) => Rule;

export type Source = (context: SchematicContext) => Tree | Observable<Tree>;
export type Rule = (tree: Tree, context: SchematicContext) => Tree | Observable<Tree>;
