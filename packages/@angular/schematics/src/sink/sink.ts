import { Action, UnknownActionException } from '../action';
import {
  ContentIndexOutOfBoundException,
  FileAlreadyExistException,
  FileDoesNotExistException,
  VirtualTree,
} from '../tree/virtual';
import {Tree} from '../interface';

import {Observable} from 'rxjs/Observable';
import 'rxjs/add/operator/concatMap';
import 'rxjs/add/operator/toPromise';


export interface Sink {
  preValidate: () => void;
  validateAction: (action: Action) => void | Promise<void>;
  postValidate: () => void;

  preCommitAction: (action: Action) => void | Promise<Action | void> | Action;
  preCommit: () => void | Promise<void>;
  postCommit: () => void | Promise<void>;

  commit(tree: Tree, force?: boolean): Promise<void>;
}


const Noop: any = function() {};


export abstract class SimpleSinkBase implements Sink {
  preValidate: () => void = Noop;
  validateAction: (action: Action) => void | Promise<void> = Noop;
  postValidate: () => void = Noop;

  preCommitAction: (action: Action) => void | Promise<Action | void> | Action = Noop;
  postCommitAction: (action: Action) => void | Promise<void> = Noop;
  preCommit: () => void | Promise<void> = Noop;
  postCommit: () => void | Promise<void> = Noop;

  protected abstract _validateFileExists(p: string): Promise<boolean>;
  protected abstract _validateFileIndex(p: string, index: number): Promise<boolean>;

  protected abstract _fileExists(path: string, content: Buffer): Promise<void>;
  protected abstract _overwriteFile(path: string, content: Buffer): Promise<void>;
  protected abstract _createFile(path: string, content: Buffer): Promise<void>;
  protected abstract _renameFile(path: string, to: string): Promise<void>;
  protected abstract _deleteFile(path: string): Promise<void>;
  protected abstract _insertContentLeft(path: string, index: number,
                                        content: Buffer): Promise<void>;
  protected abstract _insertContentRight(path: string, index: number,
                                         content: Buffer): Promise<void>;
  protected abstract _removeContent(path: string, index: number, length: number): Promise<void>;

  protected abstract _done(): Promise<void>;


  private _validateSingleAction(action: Action): Promise<void> {
    switch (action.kind) {
      case 'f':
        return Promise.resolve();
      case 'o':
        return this._validateFileExists(action.path)
          .then(b => { if (!b) { throw new FileDoesNotExistException(action.path); } });
      case 'c':
        return this._validateFileExists(action.path)
          .then(b => { if (b) { throw new FileAlreadyExistException(action.path); } });
      case 'r':
        return this._validateFileExists(action.path)
          .then(b => { if (!b) { throw new FileDoesNotExistException(action.path); } })
          .then(() => this._validateFileExists(action.to))
          .then(b => { if (b) { throw new FileAlreadyExistException(action.to); } });
      case 'd':
        return this._validateFileExists(action.path)
          .then(b => { if (!b) { throw new FileDoesNotExistException(action.path); } });
      // case 'il':
      // case 'ir':
      //   return this._validateFileExists(action.path)
      //     .then(b => { if (!b) { throw new FileDoesNotExistException(action.path); } })
      //     .then(() => this._validateFileIndex(action.path, action.index))
      //     .then(b => { if (!b) {
      //       throw new ContentIndexOutOfBoundException(action.path, action.index);
      //     } });
      // case 'x':
      //   return this._validateFileExists(action.path)
      //     .then((b) => { if (!b) { throw new FileDoesNotExistException(action.path); } })
      //     .then(() => this._validateFileIndex(action.path, action.index))
      //     .then(b => { if (!b) {
      //       throw new ContentIndexOutOfBoundException(action.path, action.index);
      //     } })
      //     .then(() => this._validateFileIndex(action.path, action.index + action.length))
      //     .then(b => { if (!b) {
      //       throw new ContentIndexOutOfBoundException(action.path, action.index + action.length);
      //     } });

      default: throw new UnknownActionException(action);
    }
  }


  validate(actions: Observable<Action>): Promise<void> {
    return Promise.resolve()
      .then(() => this.preValidate())
      .then(() => actions.concatMap((action) => {
        return Promise.all([this.validateAction(action), this._validateSingleAction(action)]);
      }).toPromise())
      .then(() => this.postValidate());
  }

  private _commitSingleAction(action: Action, force: boolean): Promise<void> {
    return Promise.resolve()
      .then(() => {
        if (!force) {
          return this.validateAction(action);
        }
      })
      .then(() => {
        if (!force) {
          return this._validateSingleAction(action);
        }
      })
      .then(() => {
        switch (action.kind) {
          case 'f': return this._fileExists(action.path, action.content);
          case 'o': return this._overwriteFile(action.path, action.content);
          case 'c': return this._createFile(action.path, action.content);
          case 'r': return this._renameFile(action.path, action.to);
          case 'd': return this._deleteFile(action.path);
          // case 'il': return this._insertContentLeft(action.path, action.index, action.content);
          // case 'ir': return this._insertContentRight(action.path, action.index, action.content);
          // case 'x': return this._removeContent(action.path, action.index, action.length);
        }
      });
  }

  commit(fem: Tree, force = false): Promise<void> {
    const map = new VirtualTree(fem);
    const actions = Observable.from(map.actions);
    return Promise.resolve()
      .then(() => this.preCommit())
      .then(() => actions.concatMap((action: Action) => {
        return Promise.resolve(action)
          .then((action) => this.preCommitAction(action))
          .then((maybeAction: void | Action): Promise<Action> => {
            return this._commitSingleAction(maybeAction || action, force)
              .then(() => maybeAction);
          })
          .then(maybeAction => this.postCommitAction(maybeAction || action));
      }).toPromise())
      .then(() => this._done())
      .then(() => this.postCommit());
  }
}
