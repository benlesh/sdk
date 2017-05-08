import 'jasmine';

import * as glob from 'glob';
import * as Istanbul from 'istanbul';
import {SpecReporter as JasmineSpecReporter} from 'jasmine-spec-reporter';
import {join, relative} from 'path';
import {Position, SourceMapConsumer, SourceMapGenerator} from 'source-map';


const Jasmine = require('jasmine');

const projectBaseDir = join(__dirname, '../packages');
require('source-map-support').install({
  hookRequire: true
});


declare let global: any & {
  __coverage__: any;
};

const inlineSourceMapRe = /\/\/# sourceMappingURL=data:application\/json;base64,(\S+)$/;


// Use the internal SDK Hook of the require extension installed by our bootstrapping code to add
// Istanbul collection to the code.
const codeMap = new Map<string, { code: string, map: SourceMapConsumer }>();

(global as any)._SdkRequireHook = function(code: string, filename: string) {
  // Skip spec files.
  if (filename.match(/\.spec\.ts$/)) {
    return code;
  }
  if (codeMap.get(filename)) {
    return codeMap.get(filename)!.code;
  }

  const instrumenter = new Istanbul.Instrumenter({
    esModules: true,
    codeGenerationOptions: {
      sourceMap: filename,
      sourceMapWithCode: true
    }
  });
  let instrumentedCode = instrumenter.instrumentSync(code, filename);
  const sourceMapGenerator: SourceMapGenerator = (instrumenter as any).sourceMap;
  const match = code.match(inlineSourceMapRe);

  if (match) {
    // Fix source maps for exception reporting (since the exceptions happen in the instrumented
    // code.
    const sourceMapJson = JSON.parse(Buffer.from(match[1], 'base64').toString());
    const consumer = new SourceMapConsumer(sourceMapJson);
    sourceMapGenerator.applySourceMap(consumer, filename);

    instrumentedCode = instrumentedCode.replace(inlineSourceMapRe, '')
                     + '//# sourceMappingURL=data:application/json;base64,'
                     + new Buffer(sourceMapGenerator.toString()).toString('base64');

    // Keep the consumer from the original source map, because the reports from Istanbul are
    // already mapped against the code.
    codeMap.set(filename, { code: instrumentedCode, original: code, map: consumer });
  }

  return instrumentedCode;
};


// Add the Istanbul reporter.
const istanbulCollector = new Istanbul.Collector({});
const istanbulReporter = new Istanbul.Reporter(undefined, 'coverage/');
istanbulReporter.addAll(['json', 'lcov']);


interface CoverageLocation {
  start: Position;
  end: Position;
}

class IstanbulReporter implements jasmine.CustomReporter {
  // Update a location object from a SourceMap. Will ignore the location if the sourcemap does
  // not have a valid mapping.
  private _updateLocation(consumer: SourceMapConsumer, location: CoverageLocation) {
    const start = consumer.originalPositionFor(location.start);
    const end = consumer.originalPositionFor(location.end);

    // Filter invalid original positions.
    if (start.line !== null && start.column !== null) {
      // Filter unwanted properties.
      location.start = { line: start.line, column: start.column };
    }
    if (end.line !== null && end.column !== null) {
      location.end = { line: end.line, column: end.column };
    }
  }

  private _updateCoverageJsonSourceMap(coverageJson: any) {
    // Update the coverageJson with the SourceMap.
    for (const path of Object.keys(coverageJson)) {
      const entry = codeMap.get(path);
      if (!entry) {
        continue;
      }

      const consumer = entry.map;
      const coverage = coverageJson[path];

      // Update statement maps.
      for (const branchId of Object.keys(coverage.branchMap)) {
        debugger;
        const branch = coverage.branchMap[branchId];
        let line: number | null = null;
        let column = 0;
        do {
          line = consumer.originalPositionFor({ line: branch.line, column: column++ }).line;
        } while (line === null && column < 100);

        branch.line = line;

        for (const location of branch.locations) {
          this._updateLocation(consumer, location);
        }
      }

      for (const id of Object.keys(coverage.statementMap)) {
        const location = coverage.statementMap[id];
        this._updateLocation(consumer, location);
      }

      for (const id of Object.keys(coverage.fnMap)) {
        const fn = coverage.fnMap[id];
        fn.line = consumer.originalPositionFor({ line: fn.line, column: 0 }).line;
        this._updateLocation(consumer, fn.loc);
      }
    }
  }

  jasmineDone(_runDetails: jasmine.RunDetails): void {
    if (global.__coverage__) {
      this._updateCoverageJsonSourceMap(global.__coverage__);
      istanbulCollector.add(global.__coverage__);
    }

    istanbulReporter.write(istanbulCollector, true, () => {});
  }
}


// Create a Jasmine runner and configure it.
const runner = new Jasmine({ projectBaseDir: projectBaseDir });
runner.env.clearReporters();
runner.env.addReporter(new JasmineSpecReporter({
  stacktrace: {
    // Filter all JavaScript files that appear after a TypeScript file (callers) from the stack
    // trace.
    filter: (x: string) => {
      return x.substr(0, x.indexOf('\n', x.indexOf('\n', x.lastIndexOf('.ts:')) + 1));
    }
  },
  suite: {
    displayNumber: true
  },
  summary: {
    displayStacktrace: true,
    displayErrorMessages: true
  }
}));
runner.env.addReporter(new IstanbulReporter());


// Manually set exit code (needed with custom reporters)
runner.onComplete((success: boolean) => {
  process.exitCode = success ? 0 : 1;
});


// Run the tests.
const allTests =
  glob.sync('packages/**/*.spec.ts')
    .map(p => relative(projectBaseDir, p))
    .filter(p => !/schematics-cli\/schematics\//.test(p));

runner.execute(allTests);
