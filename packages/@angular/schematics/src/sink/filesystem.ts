import {VirtualFileSystemSink} from './virtual-filesystem';

import * as fs from 'fs';
import {dirname, join} from 'path';


function _fsExists(path: string): Promise<boolean> {
  return new Promise(resolve => {
    fs.exists(path, exists => {
      resolve(exists);
    });
  });
}

function _fsDelete(path: string): Promise<void> {
  return new Promise<void>(resolve => {
    fs.unlink(path, (err) => {
      if (err) {
        throw err;
      } else {
        resolve();
      }
    });
  });
}

function _fsMkDir(path: string) {
  const paths = [];
  for (; path != dirname(path); path = dirname(path)) {
    if (fs.existsSync(path)) {
      break;
    }
    paths.unshift(path);
  }
  paths.forEach(path => {
    fs.mkdirSync(path);
  });
}

function _fsWrite(path: string, content: Buffer): Promise<void> {
  return new Promise<void>(resolve => {
    _fsMkDir(dirname(path));

    fs.writeFile(path, content, (err) => {
      if (err) {
        throw err;
      }
      resolve();
    });
  });
}

function _fsRead(path: string): Promise<Buffer> {
  return new Promise(resolve => {
    fs.readFile(path, (err, data) => {
      if (err) {
        throw err;
      }
      resolve(data);
    });
  });
}

function _fsRename(from: string, to: string): Promise<void> {
  return new Promise<void>(resolve => {
    fs.rename(from, to, err => {
      if (err) {
        throw err;
      }
      resolve();
    });
  });
}


export class FileSystemSink extends VirtualFileSystemSink {
  protected _validateFileExists(p: string) {
    return fs.existsSync(join(this._root, p)) ? Promise.resolve(true) : super._validateFileExists(p);
  }

  _done(): Promise<void> {
    return this._commitToHost({
      unlink: (absolutePath: string) => _fsDelete(absolutePath),
      exists: (absolutePath: string) => _fsExists(absolutePath),

      read: (absolutePath: string) => _fsRead(absolutePath),
      write: (absolutePath: string, content: Buffer) => _fsWrite(absolutePath, content),

      rename: (from: string, to: string) => _fsRename(from, to)
    });
  }
}
