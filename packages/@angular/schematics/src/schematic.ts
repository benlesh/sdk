import {Collection} from './collection';
import {SchematicContextImpl} from './context';
import {
  Schematic,
  ResolvedSchematicDescription,
  SchematicContext,
  MergeStrategy,
  Tree
} from './interface';
import {BaseException} from './exception';
import {callRule} from '../rules/base';

import {Observable} from 'rxjs/Observable';
import 'rxjs/add/observable/fromPromise';


export class InvalidSchematicsNameException extends BaseException {
  constructor(path: string, name: string) {
    super(`Schematics at path "${path}" has invalid name "${name}".`);
  }
}


export class SchematicImpl implements Schematic {
  constructor(private _descriptor: ResolvedSchematicDescription,
              private _collection: Collection) {
    if (!_descriptor.name.match(/^[-_.a-zA-Z0-9]+$/)) {
      throw new InvalidSchematicsNameException(_descriptor.path, _descriptor.name);
    }
  }

  get name() { return this._descriptor.name; }
  get description() { return this._descriptor.description; }
  get path() { return this._descriptor.path; }
  get collection() { return this._collection; }

  call(parentContext: Partial<SchematicContext>): Observable<Tree> {
    return callRule(this._descriptor.rule,
      host,
      new SchematicContextImpl(this, host, parentContext.strategy || MergeStrategy.Default));
  }
}
