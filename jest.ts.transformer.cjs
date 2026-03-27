const ts = require('typescript');

module.exports = {
  process(sourceText, sourcePath) {
    const transpiled = ts.transpileModule(sourceText, {
      fileName: sourcePath,
      compilerOptions: {
        module: ts.ModuleKind.CommonJS,
        target: ts.ScriptTarget.ES2021,
        experimentalDecorators: true,
        emitDecoratorMetadata: true,
        esModuleInterop: true,
      },
    });

    return {
      code: transpiled.outputText,
    };
  },
};
