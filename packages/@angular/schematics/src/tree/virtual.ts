import {TreeBase} from './base';
import {
  Action,
  ActionArray,
  UnknownActionException
} from '../action';
import {BaseException} from '../exception';
import {normalizePath} from '../utility/path';

import {Minimatch} from 'minimatch';
import {MergeStrategy, Tree, UpdateRecorder} from '../interface';
import {UpdateBuffer} from '../utility/update-buffer';


// Exceptions
export class FileDoesNotExistException extends BaseException {
  constructor(path: string) { super(`Path "${path}" does not exist.`); }
}
export class FileAlreadyExistException extends BaseException {
  constructor(path: string) { super(`Path "${path}" already exist.`); }
}
export class ContentHasMutatedException extends BaseException {
  constructor(path: string) {
    super(`Content at path "${path}" has changed between the start and the end of an update.`);
  }
}
export class InvalidUpdateRecordException extends BaseException {
  constructor(_record: UpdateRecorder) {
    super(`Invalid record instance.`);
  }
}


export interface FileEntry {
  readonly path: string;
  readonly content: Buffer;
}


export class SimpleFileEntry implements FileEntry {
  constructor(private _path: string, private _content: Buffer) {}

  get path() { return this._path; }
  get content() { return this._content; }
}


export class LazyFileEntry implements FileEntry {
  private _content: Buffer | null = null;

  constructor(private _path: string, private _load: (path?: string) => Buffer) {}

  get path() { return this._path; }
  get content() { return this._content || (this._content = this._load(this._path)); }
}


export class UpdateRecorderBase implements UpdateRecorder {
  protected _path: string;
  protected _original: Buffer;
  protected _content: UpdateBuffer;

  constructor(entry: FileEntry) {
    this._original = new Buffer(entry.content);
    this._content = new UpdateBuffer(entry.content);
    this._path = entry.path;
  }

  get path() { return this._path; }

  // These just record changes.
  insertLeft(index: number, content: Buffer | string): UpdateRecorder {
    this._content.insertLeft(index, typeof content == 'string' ? new Buffer(content) : content);
    return this;
  }
  insertRight(index: number, content: Buffer | string): UpdateRecorder {
    this._content.insertRight(index, typeof content == 'string' ? new Buffer(content) : content);
    return this;
  }
  remove(index: number, length: number): UpdateRecorder {
    this._content.remove(index, length);
    return this;
  }

  apply(content: Buffer): Buffer {
    if (!content.equals(this._content.original)) {
      throw new ContentHasMutatedException(this.path);
    }
    return this._content.generate();
  }
}


export class VirtualTree extends TreeBase {
  protected _actions = new ActionArray();
  protected _cacheMap = new Map<string, FileEntry>();

  constructor(from: Tree | null = null, onlyPaths: string[] | null = null) {
    super();

    // Make a copy of the internal cache. Wheeee!
    if (from) {
      const files = onlyPaths || from.find();
      for (const path of files) {
        const content = from.read(path);
        if (content) {
          this.create(path, content);
          this._actions.exists(path);
        }
      }
    }
  }

  /**
   * Normalize the path. Made available to subclasses to overloader.
   * @param path The path to normalize.
   * @returns {string} A path that is resolved and normalized.
   */
  protected _normalizePath(path: string) {
    return normalizePath(path);
  }

  /**
   * A list of file names contained by this Tree.
   * @returns {[string]} File names.
   */
  get files(): string[] { return [...this._cacheMap.keys()]; }

  find(glob = '**'): string[] {
    // Fast track the default case.
    if (glob == '**') {
      return this.files;
    }

    glob = this._normalizePath(glob);
    const m = new Minimatch(glob, { dot: true });
    return this.files.filter(path => m.match(path));
  }

  exists(path: string): boolean {
    return this._cacheMap.has(this._normalizePath(path));
  }

  read(path: string): Buffer | null {
    path = this._normalizePath(path);
    const entry = this._cacheMap.get(path);
    return entry ? entry.content : null;
  }

  beginUpdate(path: string): UpdateRecorder {
    const entry = this._cacheMap.get(path);
    if (!entry) {
      throw new FileDoesNotExistException(path);
    }
    return new UpdateRecorderBase(entry);
  }
  commitUpdate(record: UpdateRecorder) {
    if (record instanceof UpdateRecorderBase) {
      const path = record.path;
      const entry = this._cacheMap.get(path);
      if (!entry) {
        throw new ContentHasMutatedException(path);
      } else {
        const newContent = record.apply(entry.content);
        this.overwrite(path, newContent);
      }
    } else {
      throw new InvalidUpdateRecordException(record);
    }
  }


  overwrite(path: string, content: Buffer | string): void {
    path = this._normalizePath(path);
    if (!this._cacheMap.has(path)) {
      throw new FileDoesNotExistException(path);
    }

    if (typeof content == 'string') {
      content = new Buffer(content, 'utf-8');
    }

    // Update the action buffer.
    this._cacheMap.set(path, new SimpleFileEntry(path, content));
  }

  create(path: string, content: Buffer | string): void {
    path = this._normalizePath(path);
    if (this._cacheMap.has(path)) {
      throw new FileAlreadyExistException(path);
    }
    if (typeof content == 'string') {
      content = new Buffer(content);
    }
    this._actions.create(path, content);
    this._cacheMap.set(path, new SimpleFileEntry(path, content as Buffer));
  }
  _lazyCreate(path: string, loader: (p: string) => Buffer) {
    path = this._normalizePath(path);
    if (this._cacheMap.has(path)) {
      throw new FileAlreadyExistException(path);
    }
    const content = loader(path);
    this._actions.create(path, content);
    this._cacheMap.set(path, new SimpleFileEntry(path, content));
  }

  copy(path: string, to: string): void {
    const content = this.read(path);
    if (!content) {
      throw new FileDoesNotExistException(path);
    }
    this.create(to, content);
  }

  rename(path: string, to: string): void {
    path = this._normalizePath(path);
    to = this._normalizePath(to);
    if (!this._cacheMap.has(path)) {
      throw new FileDoesNotExistException(path);
    }
    if (path === to) {
      // Nothing to do.
      return;
    }
    if (this._cacheMap.has(to)) {
      throw new FileAlreadyExistException(to);
    }

    this._actions.rename(path, to);
    this._cacheMap.set(to, this._cacheMap.get(path) !);
    this._cacheMap.delete(path);
  }

  delete(path: string): void {
    path = this._normalizePath(path);
    if (!this._cacheMap.has(path)) {
      throw new FileDoesNotExistException(path);
    }

    this._actions.delete(path);
    this._cacheMap.delete(path);
  }

  apply(action: Action, strategy: MergeStrategy) {
    switch (action.kind) {
      case 'f':
        if (!this.exists(action.path)) {
          this._actions.exists(action.path);
        }
        break;

      case 'o':
        this.overwrite(action.path, action.content);
        break;

      case 'c':
        if (this.exists(action.path)) {
          switch (strategy) {
            case MergeStrategy.Error: throw new FileAlreadyExistException(action.path);
            case MergeStrategy.Overwrite: this.overwrite(action.path, action.content); break;
          }
        } else {
          this.create(action.path, action.content);
        }
        break;

      case 'r': this.rename(action.path, action.to); break;
      case 'd': this.delete(action.path); break;

      default: throw new UnknownActionException(action);
    }
  }

  // Returns an ordered list of Action to get this host.
  get actions(): Action[] {
    return this._actions.toArray();
  }


  // Combinatorics
  static branch(map: Tree, glob: string): VirtualTree {
    return new VirtualTree(map, map.find(glob));
  }

  // Partition this host into 2 copies.
  static partition(map: Tree, glob?: string): VirtualTree[] {
    const pathsToCopy = map.find(glob);
    const otherPaths = map.find().filter(x => !pathsToCopy.some(y => x == y));

    return [
      new VirtualTree(map, otherPaths),
      new VirtualTree(map, pathsToCopy)
    ];
  }

  private static _mergeBase(tree: VirtualTree,
                            other: TreeBase,
                            strategy: MergeStrategy) {
    // Replay actions of the other map.
    for (let action of other.actions) {
      tree.apply(action, strategy);
    }
  }

  private static _mergeNonBase(tree: VirtualTree,
                               other: Tree,
                               strategy: MergeStrategy) {
    other.find().forEach(path => {
      if (tree.exists(path)) {
        switch (strategy) {
          case MergeStrategy.Error: throw new FileAlreadyExistException(path);
          case MergeStrategy.Overwrite: tree.overwrite(path, other.read(path) !);
        }
      } else {
        tree.create(path, other.read(path) !);
      }
    });
  }

  // Creates a new host from 2 hosts.
  static merge(tree: Tree, other: Tree, strategy: MergeStrategy) {
    // Create a branch first, to get a copy.
    const newTree = new VirtualTree(tree);
    if (other instanceof TreeBase) {
      this._mergeBase(newTree, other, strategy);
    } else {
      this._mergeNonBase(newTree, other, strategy);
    }
    return newTree;
  }
}
