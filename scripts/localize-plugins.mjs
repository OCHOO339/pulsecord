// SPDX-License-Identifier: GPL-3.0-or-later
import { createRequire } from 'node:module';
import { readFileSync, writeFileSync, readdirSync } from 'node:fs';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
const require = createRequire(new URL('../upstream/equicord/package.json', import.meta.url));
const ts = require('typescript');
export function restorePluginUi(base) {
    const files = execFileSync('git', ['-C', base, 'ls-files', 'src/components/settings/tabs/plugins'], { encoding: 'utf8' }).trim().split('\n').filter(file => file.endsWith('.tsx'));
    for (const file of files) writeFileSync(path.join(base, file), execFileSync('git', ['-C', base, 'show', `HEAD:${file}`]));
}

// Transform only static UI literals. IDs, URLs, settings values, user input,
// authors and plugin names remain untouched. Never crawl the Discord DOM.
export function localizeUi(source, filename) {
    const ast = ts.createSourceFile(filename, source, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
    const edits = [];
    const replace = (node, value) => edits.push([node.getStart(ast), node.end, value]);
    const attributes = new Set(['placeholder', 'title', 'text', 'aria-label', 'tooltip', 'message']);
    const properties = new Set(['label', 'placeholder', 'confirmText', 'cancelText']);
    function visit(node) {
        if (ts.isJsxText(node)) {
            const text = node.text.replace(/\s+/g, ' ').trim();
            const tag = node.parent.openingElement?.tagName?.getText(ast);
            if (tag === 'ExampleWiggle') {
                replace(node, `{translateUi(${JSON.stringify(text)})}`);
                return;
            }
            if (text && /[A-Za-zÀ-ÿ]/.test(text) && !['code', 'pre'].includes(tag)) {
                const leading = /^ +\S/.test(node.text) ? '{" "}' : '';
                const trailing = /\S +$/.test(node.text) ? '{" "}' : '';
                replace(node, `${leading}<PluginText text={${JSON.stringify(text)}} />${trailing}`);
            }
        } else if (ts.isJsxAttribute(node) && attributes.has(node.name.getText(ast)) && node.initializer && ts.isStringLiteral(node.initializer)) {
            replace(node.initializer, `{translateUi(${JSON.stringify(node.initializer.text)})}`);
        } else if (ts.isJsxAttribute(node) && attributes.has(node.name.getText(ast)) && node.initializer && ts.isJsxExpression(node.initializer) && node.initializer.expression && ts.isConditionalExpression(node.initializer.expression)) {
            for (const branch of [node.initializer.expression.whenTrue, node.initializer.expression.whenFalse]) {
                if (ts.isStringLiteral(branch)) replace(branch, `translateUi(${JSON.stringify(branch.text)})`);
            }
        } else if (ts.isPropertyAssignment(node) && properties.has(node.name.getText(ast)) && ts.isStringLiteral(node.initializer)) {
            replace(node.initializer, `translateUi(${JSON.stringify(node.initializer.text)})`);
        }
        ts.forEachChild(node, visit);
    }
    visit(ast);
    if (!edits.length) return source;
    for (const [start, end, value] of edits.sort((a, b) => b[0] - a[0])) source = source.slice(0, start) + value + source.slice(end);
    const existing = new Set();
    for (const node of ast.statements) if (ts.isImportDeclaration(node) && node.moduleSpecifier.text === '@pulsecord/localization') {
        for (const element of node.importClause?.namedBindings?.elements ?? []) existing.add(element.name.text);
    }
    const imports = ['PluginText', 'translateUi'].filter(name => !existing.has(name));
    return (imports.length ? `import { ${imports.join(', ')} } from "@pulsecord/localization";\n` : '') + source;
}
export function prepareCustomPluginLocalization(base) {
    function walk(dir) {
        for (const entry of readdirSync(dir, { withFileTypes: true })) {
            const file = path.join(dir, entry.name);
            if (entry.isDirectory()) walk(file);
            else if (entry.name.endsWith('.tsx') && !entry.name.startsWith('localization')) {
                writeFileSync(file, localizeUi(readFileSync(file, 'utf8'), file));
            }
        }
    }
    for (const folder of ['plugins', 'equicordplugins', 'userplugins']) walk(path.join(base, 'src', folder));
}
export function preparePluginLocalization(base) {
    const directory = path.join(base, 'src/components/settings/tabs/plugins');
    function walk(dir) {
        for (const entry of readdirSync(dir, { withFileTypes: true })) {
            const file = path.join(dir, entry.name);
            if (entry.isDirectory()) walk(file);
            else if (entry.name.endsWith('.tsx')) writeFileSync(file, localizeUi(readFileSync(file, 'utf8'), file));
        }
    }
    walk(directory);
}
