"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || function (mod) {
    if (mod && mod.__esModule) return mod;
    var result = {};
    if (mod != null) for (var k in mod) if (k !== "default" && Object.prototype.hasOwnProperty.call(mod, k)) __createBinding(result, mod, k);
    __setModuleDefault(result, mod);
    return result;
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.generateArrowDecorator = exports.generateObjectLiteralDecorator = exports.generateIndexExport = exports.generateNamedImports = exports.nodeToString = void 0;
const ts = __importStar(require("typescript"));
const printer = ts.createPrinter({
    newLine: ts.NewLineKind.LineFeed,
});
/**
 * Returns string representation of typescript node
 * @param node
 * @returns {string}
 */
const nodeToString = (node) => {
    const sourceFile = ts.createSourceFile(`source.ts`, ``, ts.ScriptTarget.Latest, false, ts.ScriptKind.TS);
    const sourceCode = printer.printNode(ts.EmitHint.Unspecified, node, sourceFile);
    // Typescript automatically escape non ASCII characters like 哈 or 😂. This is a workaround to render them properly.
    // Reference: https://github.com/microsoft/TypeScript/issues/36174
    return unescape(sourceCode.replace(/\\u/g, "%u"));
};
exports.nodeToString = nodeToString;
/**
 * Generate named imports code (e.g. `import { Something, Else } from "module"`)
 * @param {string[]} importsSpecifier
 * @param {string} moduleSpecifier
 * @returns {string} Named import code
 */
const generateNamedImports = (importsSpecifier, moduleSpecifier) => {
    return ts.factory.createImportDeclaration(undefined, ts.factory.createImportClause(false, undefined, ts.factory.createNamedImports([
        ...importsSpecifier
            .map(is => ts.factory.createImportSpecifier(false, undefined, ts.factory.createIdentifier(is)))
    ])), ts.factory.createStringLiteral(moduleSpecifier));
};
exports.generateNamedImports = generateNamedImports;
/**
 * Generate model export for index file
 * @param {string} modelFileName
 * @returns {ts.ExportDeclaration}
 */
const generateIndexExport = (modelFileName) => {
    return ts.factory.createExportDeclaration(undefined, false, undefined, ts.factory.createStringLiteral(`./${modelFileName}`));
};
exports.generateIndexExport = generateIndexExport;
/**
 * Generate object literal decorator
 * @param {string} decoratorIdentifier
 * @param {[key: string]: any} props
 * @return {ts.Decorator}
 */
const generateObjectLiteralDecorator = (decoratorIdentifier, props) => {
    const _createPropertyAssignment = (propName, propValue) => {
        let expression;
        switch (typeof propValue) {
            case 'number':
                expression = ts.factory.createNumericLiteral(propValue);
                break;
            case 'string':
                if (propValue.startsWith('DataType.') || propValue.startsWith('Sequelize.')) {
                    expression = ts.factory.createIdentifier(propValue);
                }
                else {
                    expression = ts.factory.createStringLiteral(propValue);
                }
                break;
            case 'boolean':
                if (propValue) {
                    expression = ts.factory.createTrue();
                }
                else {
                    expression = ts.factory.createFalse();
                }
                break;
            default:
                expression = ts.factory.createIdentifier(propValue);
        }
        return ts.factory.createPropertyAssignment(propName, expression);
    };
    return ts.factory.createDecorator(ts.factory.createCallExpression(ts.factory.createIdentifier(decoratorIdentifier), undefined, [
        ts.factory.createObjectLiteralExpression([
            ...Object.entries(props)
                .map(e => _createPropertyAssignment(e[0], e[1]))
        ])
    ]));
};
exports.generateObjectLiteralDecorator = generateObjectLiteralDecorator;
/**
 * Generate arrow decorator
 * @param {string} decoratorIdentifier
 * @param {string[]} arrowTargetIdentifiers
 * @param {object} objectLiteralProps
 * @returns {ts.Decorator}
 */
const generateArrowDecorator = (decoratorIdentifier, arrowTargetIdentifiers, objectLiteralProps) => {
    const argumentsArray = arrowTargetIdentifiers.map(t => ts.factory.createArrowFunction(undefined, undefined, [], undefined, ts.factory.createToken(ts.SyntaxKind.EqualsGreaterThanToken), ts.factory.createIdentifier(t)));
    objectLiteralProps && argumentsArray.push(ts.factory.createObjectLiteralExpression([
        ...Object.entries(objectLiteralProps).map(e => {
            let initializer;
            switch (typeof e[1]) {
                case 'number':
                    initializer = ts.factory.createNumericLiteral(e[1]);
                    break;
                case 'boolean':
                    initializer = e[1] ? ts.factory.createTrue() : ts.factory.createFalse();
                    break;
                default:
                    initializer = ts.factory.createStringLiteral(e[1]);
                    break;
            }
            return ts.factory.createPropertyAssignment(e[0], initializer);
        }),
    ]));
    return ts.factory.createDecorator(ts.factory.createCallExpression(ts.factory.createIdentifier(decoratorIdentifier), undefined, argumentsArray));
};
exports.generateArrowDecorator = generateArrowDecorator;
