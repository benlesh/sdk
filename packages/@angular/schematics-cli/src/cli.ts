import {
  Collection,
  SchematicEngine,
  DryRunSink,
  FileSystemSink,
  HostFileSystemEntryMap,
  Tree,
  InvalidSchematicException,
  CollectionDescription,
  ResolvedSchematicDescription,
  RuleFactory,
} from '@angular/schematics';

import * as minimist from 'minimist';
import {posix} from 'path';
import {Observable} from 'rxjs/Observable';
import {ExportStringRef} from './export-ref';

import {SchemaClassFactory} from '@ngtools/json-schema';
import {MergeStrategy} from '../../schematics/src/interface';


require('source-map-support').install({
  environment: 'node',
  hookRequire: true
});


const join = posix.join;

function usage() {
  console.log(`
    schematics [CollectionName:]SchematicName [options, ...]
    
    By default, if the collection name is not specified, use the internal collection provided
    by the Schematics CLI.
  `);
}

function parseSchematicName(schematic: string | null): { collection: string, schematic: string } {
  let collection = '@angular/schematics-cli';

  if (!schematic) {
    usage();
    process.exit(1);

    // Throws here to indicate to TypeScript this code path is of the type `never`.
    throw 1;
  }

  if (schematic.indexOf(':') != -1) {
    [collection, schematic] = schematicName.split(':', 2);

    if (!schematic) {
      usage();
      process.exit(2);

      // Throws here to indicate to TypeScript this code path is of the type `never`.
      throw 2;
    }
  }

  return { collection, schematic };
}


const argv = minimist(process.argv.slice(2));
const {
  collection: collectionName,
  schematic: schematicName
} = parseSchematicName(argv._.shift() || null);


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

  loadSchematic<T>(name: string,
                   collection: Collection,
                   options: T): ResolvedSchematicDescription | null {
    const collectionPath = posix.dirname(collection.path);
    const description = collection.getSchematicDescription(schematicName);

    if (!description) {
      throw new InvalidSchematicException(name);
    }

    const ref = new ExportStringRef<RuleFactory<T>>(description.factory, collectionPath);

    // Validate the schema.
    if (description.schema) {
      const schema = new ExportStringRef<Object>(description.schema, collectionPath, false).ref;
      const SchemaMetaClass = SchemaClassFactory<T>(schema);
      const schemaClass = new SchemaMetaClass(options);
      return {name, path: ref.path, rule: ref.ref(schemaClass.$$root()), ...description};
    } else {
      return {name, path: ref.path, rule: ref.ref(options), ...description};
    }
  }
});


const collection = engine.createCollection(collectionName);
if (collection === null) {
  console.log(`Invalid collection name: "${collectionName}".`);
  process.exit(3);
}
if (argv.listCollection) {
  console.log(collection !.listSchematicNames());
  process.exit(0);
}

const schematic = collection !.createSchematic(schematicName, argv);



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
      console.log(`DELETE ${event.path}`);
      break;
    case 'rename':
      console.log(`RENAME ${event.path} => ${event.to}`);
      break;
  }
});

const force = argv['force'];
schematic.call(Observable.of(new HostFileSystemEntryMap(process.cwd())), {
  strategy: force ? MergeStrategy.Overwrite : MergeStrategy.Default
})
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
    dryRunSink.commit(tree, true);
  })
  .catch((err: Error) => {
    console.error(err);
  });
