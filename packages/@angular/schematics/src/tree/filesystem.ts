import {VirtualTree} from './virtual';
import {normalizePath} from '../utility/path';


export interface FileSystemTreeHost {
  listDirectory: (path: string) => string[];
  isDirectory: (path: string) => boolean;
  readFile: (path: string) => Buffer;
}


export class FileSystemTree extends VirtualTree {
  constructor(private _host: FileSystemTreeHost, path = '') {
    super();

    const list: string[] = new Array(32);
    this._recursiveFileList(path, list);
    list.forEach(fullName => {
      this._lazyCreate(fullName, (name: string) => _host.readFile(name));
    });
  }

  protected _recursiveFileList(path: string, list: string[] = []) {
    function recurse(p: string) {
      for (const name of this._host.listDirectory(p)) {
        const fullName = normalizePath(p + '/' + name);
        if (this._host.isDirectory(fullName)) {
          recurse(fullName);
        } else {
          list.push(fullName);
        }
      }
    }

    path = normalizePath(path);
    if (this._host.isDirectory(path)) {
      recurse(path);
    } else {
      list.push(path);
    }
  }
}
