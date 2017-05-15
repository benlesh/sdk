import {SchematicEngine} from './engine';
import {MergeStrategy, Schematic, SchematicContext, Tree} from './interface';

import {Observable} from 'rxjs/Observable';


export class SchematicContextImpl implements SchematicContext {
  constructor(private _schematic: Schematic,
              private _host: Observable<Tree> = _parent.host,
              private _strategy = _parent.strategy || MergeStrategy.Default) {}

  get host() { return this._host; }
  get engine(): SchematicEngine { return this._schematic.collection.engine; }
  get schematic() { return this._schematic; }
  get strategy() { return this._strategy; }
}
