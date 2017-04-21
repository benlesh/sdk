import {
  CollectionDescription,
  Schematic,
  ResolvedSchematicDescription,
} from './interface';
import {Collection} from './collection';
import {SchematicImpl} from './schematic';


export interface SchematicEngineOptions {
  loadCollection(name: string): CollectionDescription | null;
  loadSchematic(name: string, collection: Collection): ResolvedSchematicDescription | null;
}


export class SchematicEngine {
  constructor(private _options: SchematicEngineOptions) {}


  createCollection(name: string): Collection | null {
    const description = this._options.loadCollection(name);
    if (!description) {
      return null;
    }

    return new Collection(description, this);
  }

  createSchematic(name: string, collection: Collection): Schematic | null {
    const description = this._options.loadSchematic(name, collection);
    if (!description) {
      return null;
    }

    return new SchematicImpl(description, collection);
  }
}
