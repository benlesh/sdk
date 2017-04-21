import {SimpleSinkBase} from './sink';
import {FileDoesNotExistException} from '../tree/virtual';
import {UpdateBuffer} from '../utility/update-buffer';

import {join} from 'path';


export interface Host {
  unlink(absolutePath: string): Promise<void>;
  exists(absolutePath: string): Promise<boolean>;

  read(absolutePath: string): Promise<Buffer>;
  write(absolutePath: string, content: Buffer): Promise<void>;

  rename(absoluteFromPath: string, absoluteToPath: string): Promise<void>;
}


export abstract class VirtualFileSystemSink extends SimpleSinkBase {
  protected _filesToDelete = new Set<string>();
  protected _filesToRename = new Set<[string, string]>();
  protected _filesExisting = new Map<string, UpdateBuffer>();
  protected _filesToCreate = new Map<string, UpdateBuffer>();
  protected _filesToUpdate = new Map<string, UpdateBuffer>();

  constructor(protected _root: string) { super(); }

  protected _readFile(p: string): Promise<UpdateBuffer> {
    const maybeCreate = this._filesToCreate.get(p);
    if (maybeCreate) {
      return Promise.resolve(maybeCreate);
    }

    const maybeUpdate = this._filesToUpdate.get(p);
    if (maybeUpdate) {
      return Promise.resolve(maybeUpdate);
    }

    const maybeExist = this._filesExisting.get(p);
    if (maybeExist) {
      return Promise.resolve(maybeExist);
    }

    throw new FileDoesNotExistException(p);
  }

  protected _validateFileExists(p: string): Promise<boolean> {
    if (this._filesToCreate.has(p) || this._filesToUpdate.has(p)) {
      return Promise.resolve(true);
    } else if (this._filesToDelete.has(p)) {
      return Promise.resolve(false);
    } else if (this._filesExisting.has(p)) {
      return Promise.resolve(true);
    } else {
      return Promise.resolve(false);
    }
  }

  protected _validateFileIndex(p: string, index: number): Promise<boolean> {
    return this._readFile(p)
      .then(content => index >= 0 && index <= content.length);
  }

  protected _fileExists(path: string, content: Buffer): Promise<void> {
    this._filesExisting.set(path, new UpdateBuffer(content));
    return Promise.resolve();
  }
  protected _overwriteFile(path: string, content: Buffer): Promise<void> {
    this._filesToUpdate.set(path, new UpdateBuffer(content));
    return Promise.resolve();
  }
  protected _createFile(path: string, content: Buffer): Promise<void> {
    this._filesToCreate.set(path, new UpdateBuffer(content));
    return Promise.resolve();
  }
  protected _renameFile(from: string, to: string): Promise<void> {
    this._filesToRename.add([from, to]);

    return this._readFile(from)
      .then(buffer => this._filesToCreate.set(to, buffer))
      .then(() => this._filesToDelete.add(from))
      .then(() => {});
  }
  protected _deleteFile(path: string): Promise<void> {
    if (this._filesToCreate.has(path)) {
      this._filesToCreate.delete(path);
      this._filesToUpdate.delete(path);
    } else {
      this._filesToDelete.add(path);
    }
    return Promise.resolve();
  }
  protected _insertContentLeft(path: string, index: number, content: Buffer): Promise<void> {
    return this._readFile(path).then(c => {
      if (this._filesExisting.has(path)) {
        this._filesExisting.delete(path);
        this._filesToUpdate.set(path, c);
      }
      c.insertLeft(index, content);
    });
  }
  protected _insertContentRight(path: string, index: number, content: Buffer): Promise<void> {
    return this._readFile(path).then(c => {
      if (this._filesExisting.has(path)) {
        this._filesExisting.delete(path);
        this._filesToUpdate.set(path, c);
      }
      c.insertRight(index, content);
    });
  }
  protected _removeContent(path: string, index: number, length: number): Promise<void> {
    return this._readFile(path).then(c => {
      if (this._filesExisting.has(path)) {
        this._filesExisting.delete(path);
        this._filesToUpdate.set(path, c);
      }
      c.remove(index, length);
    });
  }

  protected _commitToHost(host: Host): Promise<void> {
    // Really commit everything to the actual filesystem.
    return Promise.resolve()
      .then(() => {
        const promises: Promise<any>[] = [];
        this._filesToDelete.forEach(path => {
          promises.push(host.unlink(join(this._root, path)));
        });
        return Promise.all(promises);
      })
      .then(() => {
        const promises: Promise<any>[] = [];
        this._filesToCreate.forEach((buffer, path) => {
          promises.push(host.write(join(this._root, path), buffer.generate()));
        });
        return Promise.all(promises);
      })
      .then(() => {
        const promises: Promise<any>[] = [];
        this._filesToUpdate.forEach((buffer, path) => {
          promises.push(host.write(join(this._root, path), buffer.generate()));
        });
        return Promise.all(promises);
      })
      .then(() => {});
  }
}
