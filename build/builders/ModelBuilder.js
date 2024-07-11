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
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.ModelBuilder = void 0;
const fs_1 = require("fs");
const path_1 = __importDefault(require("path"));
const ts = __importStar(require("typescript"));
const pluralize_1 = __importDefault(require("pluralize"));
const lint_1 = require("../lint");
const Builder_1 = require("./Builder");
const utils_1 = require("./utils");
const foreignKeyDecorator = 'ForeignKey';
/**
 * @class ModelGenerator
 * @constructor
 * @param {Dialect} dialect
 */
class ModelBuilder extends Builder_1.Builder {
    constructor(config, dialect) {
        // Force 'public' schema on Postgres if not specified
        if (dialect.name === 'postgres' && config.metadata && !config.metadata.schema) {
            config.metadata.schema = 'public';
        }
        super(config, dialect);
    }
    /**
     * Build column class member
     * @param {IColumnMetadata} col
     * @param {Dialect} dialect
     */
    static buildColumnPropertyDecl(col, dialect) {
        var _a;
        const buildColumnDecoratorProps = (col) => {
            const props = {
                ...col.originName && col.name !== col.originName && { field: col.originName },
                ...col.primaryKey && { primaryKey: col.primaryKey },
                ...col.autoIncrement && { autoIncrement: col.autoIncrement },
                ...col.allowNull && { allowNull: col.allowNull },
                ...col.dataType && { type: col.dataType },
                ...col.comment && { comment: col.comment },
                ...col.defaultValue !== undefined && { defaultValue: dialect.mapDefaultValueToSequelize(col.defaultValue) },
            };
            return props;
        };
        const buildIndexDecoratorProps = (index) => {
            const props = {
                name: index.name,
                ...index.using && { using: index.using },
                ...index.collation && { order: index.collation === 'A' ? 'ASC' : 'DESC' },
                unique: index.unique,
            };
            return props;
        };
        return ts.factory.createPropertyDeclaration([
            ...(col.foreignKey ?
                [(0, utils_1.generateArrowDecorator)(foreignKeyDecorator, [col.foreignKey.targetModel])]
                : []),
            (0, utils_1.generateObjectLiteralDecorator)('Column', buildColumnDecoratorProps(col)),
            ...(col.indices && col.indices.length ?
                col.indices.map(index => (0, utils_1.generateObjectLiteralDecorator)('Index', buildIndexDecoratorProps(index)))
                : [])
        ], col.name, (col.autoIncrement || col.allowNull || col.defaultValue !== undefined) ?
            ts.factory.createToken(ts.SyntaxKind.QuestionToken) : ts.factory.createToken(ts.SyntaxKind.ExclamationToken), ts.factory.createTypeReferenceNode((_a = dialect.mapDbTypeToJs(col.type)) !== null && _a !== void 0 ? _a : 'any', undefined), undefined);
    }
    /**
     * Build association class member
     * @param {IAssociationMetadata} association
     */
    static buildAssociationPropertyDecl(association) {
        const { associationName, targetModel, joinModel } = association;
        const targetModels = [targetModel];
        joinModel && targetModels.push(joinModel);
        return ts.factory.createPropertyDeclaration([
            ...(association.sourceKey ?
                [
                    (0, utils_1.generateArrowDecorator)(associationName, targetModels, { sourceKey: association.sourceKey })
                ]
                : [
                    (0, utils_1.generateArrowDecorator)(associationName, targetModels)
                ]),
        ], associationName.includes('Many') ?
            pluralize_1.default.plural(targetModel) : pluralize_1.default.singular(targetModel), ts.factory.createToken(ts.SyntaxKind.QuestionToken), associationName.includes('Many') ?
            ts.factory.createArrayTypeNode(ts.factory.createTypeReferenceNode(targetModel, undefined)) :
            ts.factory.createTypeReferenceNode(targetModel, undefined), undefined);
    }
    /**
     * Build table class declaration
     * @param {ITableMetadata} tableMetadata
     * @param {Dialect} dialect
     * @param {boolean} strict
     */
    static buildTableClassDeclaration(tableMetadata, dialect, strict = true) {
        var _a, _b;
        const { originName: tableName, name, columns } = tableMetadata;
        let generatedCode = '';
        // Named imports from sequelize-typescript
        generatedCode += (0, utils_1.nodeToString)((0, utils_1.generateNamedImports)([
            'Model',
            'Table',
            'Column',
            'DataType',
            'Index',
            'Sequelize',
            foreignKeyDecorator,
            ...new Set((_a = tableMetadata.associations) === null || _a === void 0 ? void 0 : _a.map(a => a.associationName)),
        ], 'sequelize-typescript'));
        generatedCode += '\n';
        // Named imports for associations
        const importModels = new Set();
        // Add models for associations
        (_b = tableMetadata.associations) === null || _b === void 0 ? void 0 : _b.forEach(a => {
            importModels.add(a.targetModel);
            a.joinModel && importModels.add(a.joinModel);
        });
        // Add models for foreign keys
        Object.values(tableMetadata.columns).forEach(col => {
            col.foreignKey && importModels.add(col.foreignKey.targetModel);
        });
        [...importModels].forEach(modelName => {
            generatedCode += (0, utils_1.nodeToString)((0, utils_1.generateNamedImports)([modelName], `./${modelName}`));
            generatedCode += '\n';
        });
        const attributesInterfaceName = `${name}Attributes`;
        if (strict) {
            generatedCode += '\n';
            const attributesInterface = ts.factory.createInterfaceDeclaration([
                ts.factory.createToken(ts.SyntaxKind.ExportKeyword),
            ], ts.factory.createIdentifier(attributesInterfaceName), undefined, undefined, [
                ...(Object.values(columns).map(c => {
                    var _a;
                    return ts.factory.createPropertySignature(undefined, ts.factory.createIdentifier(c.name), c.autoIncrement || c.allowNull || c.defaultValue !== undefined ?
                        ts.factory.createToken(ts.SyntaxKind.QuestionToken) : undefined, ts.factory.createTypeReferenceNode((_a = dialect.mapDbTypeToJs(c.type)) !== null && _a !== void 0 ? _a : 'any', undefined));
                }))
            ]);
            generatedCode += (0, utils_1.nodeToString)(attributesInterface);
            generatedCode += '\n';
        }
        const classDecl = ts.factory.createClassDeclaration([
            // @Table decorator
            (0, utils_1.generateObjectLiteralDecorator)('Table', {
                tableName: tableName,
                ...tableMetadata.schema && { schema: tableMetadata.schema },
                timestamps: tableMetadata.timestamps,
                ...tableMetadata.comment && { comment: tableMetadata.comment },
            }),
            // Export modifier
            ts.factory.createToken(ts.SyntaxKind.ExportKeyword),
        ], name, undefined, !strict ? [
            ts.factory.createHeritageClause(ts.SyntaxKind.ExtendsKeyword, [
                ts.factory.createExpressionWithTypeArguments(ts.factory.createIdentifier('Model'), [])
            ])
        ] : [
            ts.factory.createHeritageClause(ts.SyntaxKind.ExtendsKeyword, [
                ts.factory.createExpressionWithTypeArguments(ts.factory.createIdentifier('Model'), [
                    ts.factory.createTypeReferenceNode(ts.factory.createIdentifier(attributesInterfaceName), undefined),
                    ts.factory.createTypeReferenceNode(ts.factory.createIdentifier(attributesInterfaceName), undefined)
                ])
            ]),
            ts.factory.createHeritageClause(ts.SyntaxKind.ImplementsKeyword, [
                ts.factory.createExpressionWithTypeArguments(ts.factory.createIdentifier(attributesInterfaceName), undefined)
            ])
        ], 
        // Class members
        [
            ...Object.values(columns).map(col => this.buildColumnPropertyDecl(col, dialect)),
            ...tableMetadata.associations && tableMetadata.associations.length ?
                tableMetadata.associations.map(a => this.buildAssociationPropertyDecl(a)) : []
        ]);
        generatedCode += '\n';
        generatedCode += (0, utils_1.nodeToString)(classDecl);
        return generatedCode;
    }
    /**
     * Build main index file
     * @param {ITableMetadata[]} tablesMetadata
     * @returns {string}
     */
    static buildIndexExports(tablesMetadata) {
        return Object.values(tablesMetadata)
            .map(t => (0, utils_1.nodeToString)((0, utils_1.generateIndexExport)(t.name)))
            .join('\n');
    }
    /**
     * Build models files using the given configuration and dialect
     * @returns {Promise<void>}
     */
    async build() {
        const { clean, outDir } = this.config.output;
        const writePromises = [];
        if (this.config.connection.logging) {
            console.log('CONFIGURATION', this.config);
        }
        console.log(`Fetching metadata from source`);
        const tablesMetadata = await this.dialect.buildTablesMetadata(this.config);
        if (Object.keys(tablesMetadata).length === 0) {
            console.warn(`Couldn't find any table for database ${this.config.connection.database} and provided filters`);
            return;
        }
        // Check if output dir exists
        try {
            await fs_1.promises.access(outDir);
        }
        catch (err) {
            if (err.code && err.code === 'ENOENT') {
                await fs_1.promises.mkdir(outDir, { recursive: true });
            }
            else {
                console.error(err);
                process.exit(1);
            }
        }
        // Clean files if required
        if (clean) {
            console.log(`Cleaning output dir`);
            for (const file of await fs_1.promises.readdir(outDir)) {
                await fs_1.promises.unlink(path_1.default.join(outDir, file));
            }
        }
        // Build model files
        for (const tableMetadata of Object.values(tablesMetadata)) {
            console.log(`Processing table ${tableMetadata.originName}`);
            const tableClassDecl = ModelBuilder.buildTableClassDeclaration(tableMetadata, this.dialect, this.config.strict);
            writePromises.push((async () => {
                const outPath = path_1.default.join(outDir, `${tableMetadata.name}.ts`);
                await fs_1.promises.writeFile(outPath, tableClassDecl, { flag: 'w' });
                console.log(`Generated model file at ${outPath}`);
            })());
        }
        // Build index file
        writePromises.push((async () => {
            const indexPath = path_1.default.join(outDir, 'index.ts');
            const indexContent = ModelBuilder.buildIndexExports(tablesMetadata);
            await fs_1.promises.writeFile(indexPath, indexContent);
            console.log(`Generated index file at ${indexPath}`);
        })());
        await Promise.all(writePromises);
        // Lint files
        try {
            let linter;
            if (this.config.lintOptions) {
                linter = new lint_1.Linter(this.config.lintOptions);
            }
            else {
                linter = new lint_1.Linter();
            }
            console.log(`Linting files`);
            await linter.lintFiles([path_1.default.join(outDir, '*.ts')]);
        }
        catch (err) {
            // Handle unsupported global eslint usage
            if (err.code && err.code === 'MODULE_NOT_FOUND') {
                let msg = `\n[WARNING] Linting models skipped: dependency not found.\n`;
                msg += `Linting models globally is not supported (eslint library does not support global plugins).\n`;
                msg += `If you have installed the library globally (--global flag) and you want to automatically lint your generated models,\n`;
                msg += `please install the following packages locally: npm install -S typescript eslint @typescript-eslint/parser\n`;
                console.warn(msg);
            }
            else {
                throw err;
            }
        }
    }
}
exports.ModelBuilder = ModelBuilder;