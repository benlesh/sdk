import { Action, UnknownActionException } from '../action';
import {
  FileAlreadyExistException,
  FileDoesNotExistException,
  VirtualTree,
} from '../tree/virtual';
import {Tree} from '../interface';

import {Observable} from 'rxjs/Observable';
import 'rxjs/add/operator/concatMap';
import 'rxjs/add/operator/last';


export interface Sink {
  preValidate: () => void;
  validateAction: (action: Action) => void | Observable<void>;
  postValidate: () => void;

  preCommitAction: (action: Action) => void | Observable<Action | void> | Action;
  preCommit: () => void | Observable<void>;
  postCommit: () => void | Observable<void>;

  commit(tree: Tree, force?: boolean): Observable<void>;
}


const Noop: any = function() {};


export abstract class SimpleSinkBase implements Sink {
  preValidate: () => void | Observable<void> = Noop;
  validateAction: (action: Action) => void | Observable<void> = Noop;
  postValidate: () => void | Observable<void> = Noop;

  preCommitAction: (action: Action) => void | Observable<Action | void> | Action = Noop;
  postCommitAction: (action: Action) => void | Observable<void> = Noop;
  preCommit: () => void | Observable<void> = Noop;
  postCommit: () => void | Observable<void> = Noop;

  protected abstract _validateFileExists(p: string): Observable<boolean>;

  protected abstract _fileExists(path: string, content: Buffer): Observable<void>;
  protected abstract _overwriteFile(path: string, content: Buffer): Observable<void>;
  protected abstract _createFile(path: string, content: Buffer): Observable<void>;
  protected abstract _renameFile(path: string, to: string): Observable<void>;
  protected abstract _deleteFile(path: string): Observable<void>;

  protected abstract _done(): Observable<void>;


  private _validateSingleAction(action: Action): Observable<void> {
    switch (action.kind) {
      case 'f':
        return Observable.empty<void>();
      case 'o':
        return this._validateFileExists(action.path)
          .map(b => { if (!b) { throw new FileDoesNotExistException(action.path); } });
      case 'c':
        return this._validateFileExists(action.path)
          .map(b => { if (b) { throw new FileAlreadyExistException(action.path); } });
      case 'r':
        return this._validateFileExists(action.path)
          .map(b => { if (!b) { throw new FileDoesNotExistException(action.path); } })
          .mergeMap(() => this._validateFileExists(action.to))
          .map(b => { if (b) { throw new FileAlreadyExistException(action.to); } });
      case 'd':
        return this._validateFileExists(action.path)
          .map(b => { if (!b) { throw new FileDoesNotExistException(action.path); } });

      default: throw new UnknownActionException(action);
    }
  }


  validate(actions: Observable<Action>): Observable<void> {
    return (this.preValidate() || Observable.empty<void>())
      .mergeMap(() => actions.mergeMap((action) => {
        return Observable.from(this.validateAction(action) || Observable.empty<void>())
          .concat(Observable.from(this._validateSingleAction(action) || Observable.empty<void>()));
      }))
      .last()
      .mergeMap(() => this.postValidate() || Observable.empty<void>());
  }

  private _commitSingleAction(action: Action, force: boolean): Observable<void> {
    return Observable.empty<void>()
      .concat(new Observable(observer => {
        if (!force) {
          observer.complete();
          return;
        }

        let validated = this.validateAction(action);
        if (validated instanceof Observable) {
          validated.subscribe({ complete() { observer.complete(); }});
        } else {
          observer.complete();
        }
      }))
      .concat(new Observable(observer => {
        if (!force) {
          observer.complete();
          return;
        }

        let validated = this._validateSingleAction(action);
        validated.subscribe({ complete() { observer.complete(); }});
      }))
      .concat(new Observable(observer => {
        let committed = null;
        switch (action.kind) {
          case 'f': committed = this._fileExists(action.path, action.content); break;
          case 'o': committed = this._overwriteFile(action.path, action.content); break;
          case 'c': committed = this._createFile(action.path, action.content); break;
          case 'r': committed = this._renameFile(action.path, action.to); break;
          case 'd': committed = this._deleteFile(action.path); break;
        }

        if (committed) {
          committed.subscribe({ complete() { observer.complete(); } });
        } else {
          observer.complete();
        }
      }));
  }

  commit(tree: Tree, force = false): Observable<void> {
    const map = new VirtualTree(tree);
    const actions = Observable.from(map.actions);
    return (this.preCommit() || Observable.of<void>())
      .mergeMap(() => actions.concatMap((action: Action) => {
        const maybeAction = this.preCommitAction(action);
        if (maybeAction === undefined || maybeAction === null) {
          return Observable.of(action);
        } else if (maybeAction instanceof Observable) {
          return maybeAction.map(maybeAction => maybeAction || action);
        } else {
          return Observable.of(maybeAction);
        }
      }))
      .mergeMap(action => {
        this._commitSingleAction(action, force);
        return Observable.of(action);
      })
      .mergeMap(action => {
        const maybeObservable = this.postCommitAction(action);
        if (maybeObservable instanceof Observable) {
          return maybeObservable;
        } else {
          return Observable.empty<void>();
        }
      })
      .last()
      .mergeMap(() => this._done())
      .mergeMap(() => {
        const maybeObservable = this.postCommit();
        if (maybeObservable instanceof Observable) {
          return maybeObservable;
        } else {
          return Observable.empty<void>();
        }
      })
      .map(() => {});
      // .then(() => actions.concatMap((action: Action) => {
      //   return Promise.resolve(action)
      //     .then((action) => this.preCommitAction(action))
      //     .then((maybeAction: void | Action): Promise<Action> => {
      //       return this._commitSingleAction(maybeAction || action, force)
      //         .then(() => maybeAction);
      //     })
      //     .then(maybeAction => this.postCommitAction(maybeAction || action));
      // }).toPromise())
      // .then(() => this._done())
      // .then(() => this.postCommit());
  }
}
