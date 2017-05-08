import {FileSystemSink} from './filesystem';
import {FileSystemTree} from '../tree/filesystem';

import * as fs from 'fs';
import * as glob from 'glob';
import {join} from 'path';

const temp = require('temp');


const root = join((global as any)._SdkRoot, 'tests/@angular/schematics/assets/1/');

describe('FileSystemSink', () => {
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

    const sink = new FileSystemSink(outputRoot);
    sink.commit(tree)
      .then(() => {
        const tmpFiles = glob.sync(join(outputRoot, '**/*'), { nodir: true });
        expect(tmpFiles.map(x => x.substr(outputRoot.length))).toEqual(files);
        expect(fs.readFileSync(join(outputRoot, 'test'), 'utf-8')).toBe('testing testing 1 2');
      })
      .then(done, done.fail);
  });
});
