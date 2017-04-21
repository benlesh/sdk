import {FileDoesNotExistException, VirtualTree} from './virtual';
import {Tree} from '../index';
import {MergeStrategy} from '../interface';


describe('VirtualTree', () => {
  describe('exists()', () => {
    it('works', () => {
      const tree = new VirtualTree();
      tree.create('/some/file', 'some _content');
      expect(tree.exists('/some/file')).toBe(true);
      expect(tree.exists('/other/file')).toBe(false);
    });
  });
  describe('read()', () => {
    it('works', () => {
      const tree = new VirtualTree();
      tree.create('/some/file', 'some _content');
      expect(tree.read('/some/file') !.toString()).toBe('some _content');
      expect(tree.read('/other/file')).toBe(null);
    });
  });
  describe('find()', () => {
    it('works', () => {
      const tree = new VirtualTree();
      tree.create('/some/file', 'some _content');
      tree.create('/some/other-file', 'some _content');
      tree.create('/some/other-file2', 'some _content');

      expect(tree.find('/some/file')).toEqual(['/some/file']);
      expect(tree.find('/some/*')).toEqual(['/some/file', '/some/other-file', '/some/other-file2']);
      expect(tree.find('/some/**/*')).toEqual([
        '/some/file', '/some/other-file', '/some/other-file2'
      ]);
      expect(tree.find('/some/**')).toEqual([
        '/some/file', '/some/other-file', '/some/other-file2'
      ]);
      expect(tree.find('/other/file')).toEqual([]);
    });
  });

  describe('overwrite()', () => {
    it('works', () => {
      const tree = new VirtualTree();
      tree.create('/some/file', 'some content');
      tree.overwrite('/some/file', 'some other content');

      expect(tree.read('/some/file') !.toString()).toEqual('some other content');
    });
  });

  describe('insertContent()', () => {
    it('works', () => {
      const tree = new VirtualTree();
      tree.create('/some/file', 'some _content');
      const recorder = tree.beginUpdate('/some/file');
      recorder.insertLeft(4, ' hello');
      tree.commitUpdate(recorder);

      expect(tree.actions.length).toBe(1);
    });

    it('throws when the file does not exist', () => {
      const tree = new VirtualTree();
      expect(() => tree.beginUpdate('/some/file'))
        .toThrow(new FileDoesNotExistException('/some/file'));
    });
  });

  describe('combinatorics', () => {
    it('works', () => {
      const tree = new VirtualTree();
      tree.create('file1', 'some _content');
      tree.create('file2', 'some _content');
      tree.create('file3', 'some _content');

      const [tree1, tree2] = Tree.partition(tree, '/file1');
      expect(tree1.exists('file1')).toBe(false);
      expect(tree1.exists('file2')).toBe(true);
      expect(tree1.exists('file3')).toBe(true);

      expect(tree2.exists('file1')).toBe(true);
      expect(tree2.exists('file2')).toBe(false);
      expect(tree2.exists('file3')).toBe(false);

      const tree3 = Tree.merge(tree1, tree2, MergeStrategy.Error);
      expect(tree.find().sort()).toEqual(tree3.find().sort());
    });
  });
});
