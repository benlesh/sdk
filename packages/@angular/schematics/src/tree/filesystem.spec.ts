import {FileSystemTree} from './filesystem';

import {join} from 'path';


const root = join((global as any)._SdkRoot, 'tests/@angular/schematics/assets/1/');

describe('FileSystem', () => {
  it('can create files', () => {
    const tree = new FileSystemTree(root, true);
    expect(tree.find()).toEqual(['/hello', '/sub/directory/file2', '/sub/file1']);
  });
});
