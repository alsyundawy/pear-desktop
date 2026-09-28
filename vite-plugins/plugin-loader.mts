import { readFileSync } from 'node:fs';
import { resolve, basename, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

import {
  Project,
  ts,
  VariableDeclarationKind,
  Node,
  type ObjectLiteralExpression,
  type SourceFile,
  type ObjectLiteralElementLike,
} from 'ts-morph';

import type { PluginOption } from 'vite';

export type PluginLoaderMode = 'backend' | 'preload' | 'renderer' | 'none';

// Initialize a global project instance to reuse across load calls
const __dirname = dirname(fileURLToPath(import.meta.url));
const globalProject = new Project({
  tsConfigFilePath: resolve(__dirname, '..', 'tsconfig.json'),
  skipAddingFilesFromTsConfig: true,
  skipLoadingLibFiles: true,
  skipFileDependencyResolution: true,
});

// Helper to extract a property’s name from its node
const getPropertyName = (prop: Node): string | null => {
  const kind = prop.getKind();
  if (
    kind === ts.SyntaxKind.PropertyAssignment ||
    kind === ts.SyntaxKind.ShorthandPropertyAssignment ||
    kind === ts.SyntaxKind.MethodDeclaration
  ) {
    return prop.getFirstChildByKindOrThrow(ts.SyntaxKind.Identifier).getText();
  }
  return null;
};

const ALL_CONTEXTS = ['backend', 'preload', 'renderer', 'menu'] as const;

function extractObjectExpression(
  node: Node | undefined,
): ObjectLiteralExpression | undefined {
  if (!node) return undefined;
  if (Node.isObjectLiteralExpression(node)) {
    return node;
  }
  if (Node.isCallExpression(node)) {
    const args = node.getArguments();
    if (
      args.length === 1 &&
      node.getExpression().getText() === 'createPlugin' &&
      Node.isObjectLiteralExpression(args[0])
    ) {
      return args[0];
    }
  }
  return undefined;
}

function findPluginObjectLiteral(
  src: SourceFile,
): ObjectLiteralExpression | undefined {
  // Check for `export default ...`
  const defaultExport = src.getExportAssignment((ea) => !ea.isExportEquals());
  if (defaultExport) {
    const expr = extractObjectExpression(defaultExport.getExpression());
    if (expr) return expr;
  }

  // Check for a named export aliased as 'default'
  const defaultDeclarations = src.getExportedDeclarations().get('default');
  if (defaultDeclarations && defaultDeclarations.length > 0) {
    return extractObjectExpression(defaultDeclarations[0]);
  }

  return undefined;
}

function buildPropertyMap(
  objExpr: ObjectLiteralExpression,
): Map<string, ObjectLiteralElementLike> {
  const propMap = new Map<string, ObjectLiteralElementLike>();
  for (const prop of objExpr.getProperties()) {
    const name = getPropertyName(prop);
    if (name) propMap.set(name, prop);
  }
  return propMap;
}

function stripUnusedContexts(
  propMap: Map<string, ObjectLiteralElementLike>,
  mode: PluginLoaderMode,
) {
  for (const ctx of ALL_CONTEXTS) {
    if (mode === 'none' && propMap.has(ctx)) {
      propMap.get(ctx)?.remove();
      continue;
    }
    if (ctx === mode || (ctx === 'menu' && mode === 'backend')) {
      continue;
    }
    if (propMap.has(ctx)) {
      propMap.get(ctx)?.remove();
    }
  }
}

function createStubStatement(
  src: SourceFile,
  objExpr: ObjectLiteralExpression,
  mode: PluginLoaderMode,
) {
  const varStmt = src.addVariableStatement({
    isExported: true,
    declarationKind: VariableDeclarationKind.Const,
    declarations: [
      {
        name: 'pluginStub',
        initializer: (writer) => writer.write(objExpr.getText()),
      },
    ],
  });
  const stubObjExpr = varStmt
    .getDeclarations()[0]
    .getInitializerIfKindOrThrow(ts.SyntaxKind.ObjectLiteralExpression);

  const stubMap = buildPropertyMap(stubObjExpr);
  const stubContexts =
    mode === 'backend'
      ? ALL_CONTEXTS.filter((ctx) => ctx !== 'menu')
      : ALL_CONTEXTS;

  for (const ctx of stubContexts) {
    stubMap.get(ctx)?.remove();
  }
}

export default function pluginLoader(
  mode: PluginLoaderMode,
): PluginOption {
  return {
    name: 'ytm-plugin-loader',
    load: {
      filter: {
        id: /(?:\/plugins\/[^/]+\/index\.(?:js|ts|jsx|tsx)|\/plugins\/[^/]+\.(?:js|ts|jsx|tsx))$/,
      },
      handler(id) {
        const fileContent = readFileSync(id, 'utf8');
        const src = globalProject.createSourceFile(
          '_pf' + basename(id),
          fileContent,
          { overwrite: true },
        );

        const objExpr = findPluginObjectLiteral(src);
        if (!objExpr) return null;

        const propMap = buildPropertyMap(objExpr);
        stripUnusedContexts(propMap, mode);
        createStubStatement(src, objExpr, mode);

        return {
          code: src.getText(),
        };
      },
    },
  };
}
