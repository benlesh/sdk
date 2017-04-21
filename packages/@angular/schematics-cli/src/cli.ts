import {
  Collection,
  SchematicEngine,
  DryRunSink,
  FileSystemSink,
  HostFileSystemEntryMap,
  Rule,
  Tree,
  CollectionDescription,
  RuleFactory,
  SchematicDescription
} from '@angular/schematics';

import * as minimist from 'minimist';
import {posix} from 'path';
import {Observable} from 'rxjs/Observable';
import {ExportStringRef} from './export-ref';

import {SchemaClassFactory} from '@ngtools/json-schema';


require('source-map-support').install({ hookRequire: true });


const join = posix.join;
const argv = minimist(process.argv.slice(2));
let schematicName = argv._.shift();
let collectionName = '@angular/schematics-cli';

function usage() {
  console.log(`
    schematics [CollectionName:]SchematicName [options, ...]
    
    By default, if the collection name is not specified, use the internal collection provided
    by the Schematics CLI.
  `);
}


if (!schematicName) {
  usage();
  process.exit(1);
}

if (schematicName.indexOf(':') != -1) {
  [collectionName, schematicName] = schematicName.split(':', 2);
}

const engine = new SchematicEngine({
  loadCollection(collectionName: string): CollectionDescription {
    let path = collectionName;
    try {
      const pkgJsonSchematics = require(join(collectionName, 'package.json'))['schematics'];
      path = join(collectionName, pkgJsonSchematics);
    } catch (e) {
    }

    const definition = require(path);
    path = require.resolve(path);
    return { ...definition, path };
  },

  loadSchematic(name: string, collection: Collection): SchematicDescription | null {
    const collectionPath = posix.dirname(collection.path);
    const description = collection.getSchematicDescription(schematicName);
    const ref = new ExportStringRef<RuleFactory<any>>(description.factory, collectionPath);

    // Validate the schema.
    if (description.schema) {
      const schema = new ExportStringRef<Object>(description.schema, collectionPath, false).ref;
      const SchemaMetaClass = SchemaClassFactory<any>(schema);
      const schemaClass = new SchemaMetaClass(argv);
      return {name, path: ref.path, rule: ref.ref(schemaClass.$$root()), ...description};
    } else {
      return {name, path: ref.path, rule: ref.ref(argv), ...description};
    }
  }
});


const collection = engine.createCollection(collectionName);
if (argv.listCollection) {
  console.log(collection.getBlueprintNames());
  process.exit(0);
}

const schematic = collection.createSchematic(schematicName, argv);

const dryRunSink = new DryRunSink();
const fsSink = new FileSystemSink(process.cwd());

dryRunSink.reporter.subscribe(event => {
  switch (event.kind) {
    case 'update':
      console.log(`UPDATE ${event.path} (${event.content.length} bytes)`);
      break;
    case 'create':
      console.log(`CREATE ${event.path} (${event.content.length} bytes)`);
      break;
    case 'delete':
      console.log(`DELETE ${event.path} (${event.content.length} bytes)`);
      break;
    case 'rename':
      console.log(`RENAME ${event.path} => ${event.to}`);
      break;
  }
});

schematic.call(Observable.of(new HostFileSystemEntryMap(process.cwd())))
  .toPromise()
  .then((tree: Tree) => {
    if (!argv['dry-run']) {
      return fsSink
        .commit(tree, argv['force'])
        .then(() => tree);
    }
    return tree;
  })
  .then((tree: Tree) => {
    dryRunSink.commit(tree, argv['force']);
  })
  .catch((err: Error) => {
    console.error(err);
  });
