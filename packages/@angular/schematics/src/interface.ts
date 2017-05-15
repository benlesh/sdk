import {Collection} from './collection';
import {Engine} from './engine';
import {
  treeBranchImpl,
  treeEmptyImpl,
  treeMergeImpl,
  treePartitionImpl
} from './tree/static-impl';
import {Observable} from 'rxjs';


export enum MergeStrategy {
  Error = -1,  // Error out if 2 files have the same path.
  Default = 0,  // Uses the default strategy.
  Overwrite = 1,  // Overwrite the file.
}


export interface UpdateRecorder {
  // These just record changes.
  insertLeft(index: number, content: Buffer | string): UpdateRecorder;
  insertRight(index: number, content: Buffer | string): UpdateRecorder;
  remove(index: number, length: number): UpdateRecorder;
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
  abstract commitUpdate(record: UpdateRecorder): void;

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
  static branch(tree: Tree, glob = '**'): Tree {
    return treeBranchImpl(tree, glob);
  }

  // Creates two copies of this host that are disjoint, based on glob.
  static partition(tree: Tree, glob?: string): Tree[] {
    return treePartitionImpl(tree, glob);
  }

  // Creates a new host path 2 hosts.
  static merge(tree: Tree,
               other: Tree,
               strategy: MergeStrategy = MergeStrategy.Default): Tree {
    if (strategy == MergeStrategy.Default) {
      strategy = MergeStrategy.Error;
    }
    return treeMergeImpl(tree, other, strategy);
  }
}


export interface Schematic {
  readonly name: string;
  readonly description: string;
  readonly path: string;
  readonly collection: Collection;

  call(parentContext: Partial<SchematicContext>): Observable<Tree>;
}


export interface SchematicContext {
  readonly engine: Engine;
  readonly schematic: Schematic;
  readonly host: Observable<Tree>;
  readonly strategy: MergeStrategy;
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
