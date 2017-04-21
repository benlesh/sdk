import {VirtualFileSystemSink} from './virtual-filesystem';

import {join} from 'path';
import {Observable} from 'rxjs';
import {Subject} from 'rxjs';



export interface DryRunEvent {
  kind: 'delete' | 'create' | 'update' | 'rename';
  absolutePath: string;
  path: string;
  absoluteTo?: string;
  to?: string;
  content: Buffer | null;
}


export class DryRunSink extends VirtualFileSystemSink {
  private _subject = new Subject<DryRunEvent>();
  readonly reporter: Observable<DryRunEvent> = this._subject.asObservable();

  constructor(root: string = '') { super(root); }

  _done() {
    this._filesToDelete.forEach(path => {
      // Check if this is a renaming.
      for (const [from, _] of this._filesToRename) {
        if (from == path) {
          // The event is sent later on.
          return;
        }
      }

      const absolutePath = join(this._root, path);
      const content = null;
      this._subject.next({ kind: 'delete', path, absolutePath, content });
    });
    this._filesToCreate.forEach((content, path) => {
      // Check if this is a renaming.
      for (const [_, to] of this._filesToRename) {
        if (to == path) {
          // The event is sent later on.
          return;
        }
      }

      const absolutePath = join(this._root, path);
      this._subject.next({ kind: 'create', path, absolutePath, content: content.generate() });
    });
    this._filesToUpdate.forEach((content, path) => {
      const absolutePath = join(this._root, path);
      this._subject.next({ kind: 'update', path, absolutePath, content: content.generate() });
    });
    this._filesToRename.forEach(([path, to]) => {
      const absolutePath = join(this._root, path);
      const absoluteTo = join(this._root, to);
      this._subject.next({ kind: 'rename', path, absolutePath, to, absoluteTo, content: null });
    });

    this._subject.complete();
    return Promise.resolve();
  }
}

