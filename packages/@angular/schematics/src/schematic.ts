import {Tree} from './index';
import {
  Schematic,
  ResolvedSchematicDescription,
  SchematicContext,
  MergeStrategy
} from './interface';
import {BaseException} from './exception';

import {Observable} from 'rxjs/Observable';
import 'rxjs/add/observable/fromPromise';
import {callRule} from '../rules/base';
import {Collection} from './collection';


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

  call(host: Observable<Tree>, parentContext: Partial<SchematicContext>): Observable<Tree> {
    return callRule(this._descriptor.rule, host, {
      schematic: this,
      host,
      strategy: parentContext.strategy || MergeStrategy.Default
    });
  }
}
