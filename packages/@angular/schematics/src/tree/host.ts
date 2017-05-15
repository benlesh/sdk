import {FileSystemTree} from './filesystem';
import {FileAlreadyExistException, LazyFileEntry} from './virtual';


export class InitialHostFileSystemTree extends FileSystemTree {
  _lazyCreate(path: string, loader: (p: string) => Buffer) {
    path = this._normalizePath(path);
    if (this._cacheMap.has(path)) {
      throw new FileAlreadyExistException(path);
    }

    this._actions.exists(path);
    this._cacheMap.set(path, new LazyFileEntry(path, loader));
  }
}
