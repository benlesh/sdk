import {DryRunSink} from './dryrun';
import {FileSystemTree} from '../tree/filesystem';

import {join} from 'path';

import 'rxjs/add/operator/toArray';
import 'rxjs/add/operator/toPromise';

const temp = require('temp');


const root = join((global as any)._SdkRoot, 'tests/@angular/schematics/assets/1/');


describe('DryRunSink', () => {
  let outputRoot: string;

  beforeEach(() => {
    outputRoot = temp.mkdirSync('schematics-spec-');
  });

  it('works', done => {
    const tree = new FileSystemTree(root);

    tree.create('/test', 'testing 1 2');
    const recorder = tree.beginUpdate('/test');
    recorder.insertLeft(8, 'testing ');
    tree.commitUpdate(recorder);

    const files = ['/hello', '/sub/directory/file2', '/sub/file1', '/test'];
    expect(tree.find()).toEqual(files);

    const sink = new DryRunSink(outputRoot);
    sink.reporter
      .toArray()
      .toPromise()
      .then(infos => {
        expect(infos.length).toBe(4);
        for (const info of infos) {
          expect(info.kind).toBe('create');
        }
      })
      .then(done, done.fail);

    sink.commit(tree)
      .then(() => {}, done.fail);
  });
});
