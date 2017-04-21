import {VirtualTree} from './virtual';

import {statSync, readdirSync, readFileSync} from 'fs';
import {join, resolve} from 'path';
import {normalizePath} from '../utility/path';


export class FileSystemTree extends VirtualTree {
  constructor(protected _path: string, shouldInitialize = true) {
    super();
    if (process.platform == 'win32') {
      this._path = _path.replace(/\\/g, '/').replace(/^\w:/, '/');
    }
    this._path = normalizePath(this._path.replace(/\/$/, ''));

    if (shouldInitialize) {
      const list: string[] = new Array(32);
      this._recursiveFileList(_path, list);
      list.forEach(fullName => {
        const entryName = fullName.substr(this._path.length);
        const systemName = resolve(fullName);
        this.create(entryName, readFileSync(systemName));
      });
    }
  }

  protected _recursiveFileList(path: string, list: string[] = []) {
    function recurse(path: string) {
      for (const name of readdirSync(path)) {
        const fullName = join(path, name);
        const systemName = resolve(fullName);
        if (statSync(systemName).isDirectory()) {
          recurse(fullName);
        } else {
          list.push(fullName);
        }
      }
    }

    if (statSync(resolve(path)).isDirectory()) {
      recurse(path);
    } else {
      list.push(path);
    }
  }
}
