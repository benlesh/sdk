import {HostFileSystemEntryMap} from './host';

import {join} from 'path';


const root = join((global as any)._SdkRoot, 'tests/@angular/schematics/assets/1/');

describe('HostFileSystem', () => {
  it('works', () => {
    const tree = new HostFileSystemEntryMap(root, root);
    expect(tree.find()).toEqual(['/hello', '/sub/directory/file2', '/sub/file1']);
  });
});
