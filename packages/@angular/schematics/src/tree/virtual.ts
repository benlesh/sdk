import {TreeBase} from './base';
import {
  Action,
  CreateFileAction,
  DeleteFileAction,
  FileExistsAction,
  isContentAction,
  OverwriteFileAction,
  RenameFileAction,
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
export class ContentIndexOutOfBoundException extends BaseException {
  constructor(path: string, index: number) {
    super(`Index ${index} is outside the boundary of content at path "${path}".`);
  }
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
  protected _actions: Action[] = [];
  protected _cacheMap = new Map<string, FileEntry>();

  constructor(from: Tree | null = null, onlyPaths: string[] | null = null) {
    super();

    // Make a copy of the internal cache. Wheeee!
    if (from) {
      const files = onlyPaths || from.find();
      if (from instanceof TreeBase) {
        for (const path of files) {
          const content = from.read(path);
          if (content) {
            this._cacheMap.set(path, new SimpleFileEntry(path, content));
          }
        }

        this._actions = [...from.actions.filter(action => files.some(p => p == action.path))];
      } else {
        for (const path of files) {
          const content = from.read(path);
          if (content) {
            this.create(path, content);
          }
        }
      }
    }
  }

  protected _normalizePath(path: string) {
    return normalizePath(path);
  }

  get files() { return [...this._cacheMap.keys()]; }

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

    // Optimize the actions to remove duplicated information. We go until either we meet a
    // create or overwrite or rename action with the proper path, then replace the kind of this
    // one and remove the old ones. Along the way we remove all content affecting actions.
    let kind = 'o';
    for (let i = this._actions.length - 1; i >= 0; i--) {
      const action = this._actions[i];
      if (isContentAction(action)) {
        this._actions.splice(i, 1);
      } else if (action.kind == 'r' && action.to == path) {
        // When at the first rename.
        // TODO: consider an optimization where we continue going on.
        break;
      } else if (action.kind == 'c' && action.path == path) {
        kind = 'c';
        this._actions.splice(i, 1);
        break;
      }
    }

    if (typeof content == 'string') {
      content = new Buffer(content, 'utf-8');
    }

    this._actions.push({ kind, path, content } as OverwriteFileAction | CreateFileAction);
    this._cacheMap.set(path, new SimpleFileEntry(path, content));
  }

  // Change structure of the host.
  protected _lazyFileExists(path: string, loader: (path?: string) => Buffer) {
    path = this._normalizePath(path);
    const entry = this._cacheMap.get(path);
    if (entry) {
      return;
    }

    const newEntry = new LazyFileEntry(path, loader);
    const action: FileExistsAction = {
      kind: 'f',
      path,
      get content() { return newEntry.content; }
    };
    this._actions.push(action);
    this._cacheMap.set(path, newEntry);
  }

  protected _fileExists(path: string, content: Buffer): void {
    path = this._normalizePath(path);
    const entry = this._cacheMap.get(path);
    if (entry) {
      return;
    }

    const action: FileExistsAction = { kind: 'f', path, content };
    this._actions.push(action);
    this._cacheMap.set(path, new SimpleFileEntry(path, content));
  }

  protected _overwriteFile(path: string, content: Buffer): void {
    path = this._normalizePath(path);
    if (!this._cacheMap.has(path)) {
      throw new FileDoesNotExistException(path);
    }

    const action: FileExistsAction = { kind: 'f', path, content };
    this._actions.push(action);
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
    const action: CreateFileAction = { kind: 'c', path, content: content as Buffer };
    this._actions.push(action);
    this._cacheMap.set(path, new SimpleFileEntry(path, content as Buffer));
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

    // Optimize rename by changing the action.
    let shouldGenerateNewaction = true;
    for (let i = this._actions.length - 1; i >= 0; i--) {
      const action = this._actions[i];
      if (action.kind == 'c' && action.path == path) {
        action.path = to;
        shouldGenerateNewaction = false;
        break;
      } else if (action.kind == 'r' && action.to == path) {
        action.to = to;
        shouldGenerateNewaction = false;
        break;
      } else if (action.path == path) {
        break;
      }
    }

    if (shouldGenerateNewaction) {
      const action: RenameFileAction = { kind: 'r', path, to };
      this._actions.push(action);
    }
    this._cacheMap.set(to, this._cacheMap.get(path) !);
    this._cacheMap.delete(path);
  }

  delete(path: string): void {
    path = this._normalizePath(path);
    if (!this._cacheMap.has(path)) {
      throw new FileDoesNotExistException(path);
    }

    for (let i = this._actions.length - 1; i >= 0; i--) {
      const action = this._actions[i];
      if (action.path !== path || (action.kind == 'r' && action.to !== path)) {
        continue;
      }

      switch (action.kind) {
        case 'f': break;
        case 'c':
          // It's as if it never existed.
          for (let j = i; j < this._actions.length; j++) {
            if (this._actions[j].path == path) {
              this._actions.splice(j, 1);
              j--;
            }
          }
          return;
        case 'r':
          break;
      }
    }

    const action: DeleteFileAction = { kind: 'd', path };
    this._actions.push(action);
    this._cacheMap.delete(path);
  }

  // Returns an ordered list of Action to get this host.
  get actions(): Action[] {
    return [...this._actions];
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
      if (strategy == MergeStrategy.ContentOnly && !isContentAction(action)) {
        continue;
      }

      switch (action.kind) {
        case 'f':
          tree._fileExists(action.path, action.content);
          break;
        case 'o':
          tree.overwrite(action.path, action.content);
          break;

        case 'c':
          if (tree.exists(action.path)) {
            switch (strategy) {
              case MergeStrategy.Error: throw new FileAlreadyExistException(action.path);
              case MergeStrategy.Overwrite: tree.overwrite(action.path, action.content); break;
            }
          } else {
            tree.create(action.path, action.content);
          }
          break;
        case 'r': tree.rename(action.path, action.to); break;
        case 'd': tree.delete(action.path); break;
        // case 'il': tree.insertContentLeft(action.path, action.index, action.content); break;
        // case 'ir': tree.insertContentRight(action.path, action.index, action.content); break;
        // case 'x': tree.removeContent(action.path, action.index, action.length); break;

        default: throw new UnknownActionException(action);
      }
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
