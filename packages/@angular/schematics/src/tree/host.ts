import {FileSystemTree} from './filesystem';
import {FileDoesNotExistException} from './virtual';

import {existsSync, readFileSync} from 'fs';
import {Minimatch} from 'minimatch';
import {resolve} from 'path';


export class HostFileSystemEntryMap extends FileSystemTree {
  constructor(path: string, protected _root: string = path) {
    super(path, false);
    if (!existsSync(path)) {
      throw new FileDoesNotExistException(path);
    }
  }

  find(glob = '**'): string[] {
    const m = new Minimatch(glob, { dot: true });
    const list: string[] = new Array(64);
    this._recursiveFileList(this._path, list);

    list
      .filter(x => m.match(x) && !(x in this._cacheMap))
      .forEach(fullName => {
        const entryName = fullName.substr(this._root.length);
        const systemName = resolve(fullName);
        this._lazyFileExists(entryName, () => readFileSync(systemName));
      });

    return super.find(glob);
  }
}
