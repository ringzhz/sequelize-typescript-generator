"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.Dialect = void 0;
const connection_1 = require("../connection");
const AssociationsParser_1 = require("./AssociationsParser");
const utils_1 = require("./utils");
class Dialect {
    /**
     * @constructor
     * @param {DialectName} name
     * @protected
     */
    constructor(name) {
        this.name = name;
    }
    /**
     * Build tables metadata for the specific dialect and schema
     * @param {IConfig} config
     * @returns {Promise<ITableMetadata[]>}
     */
    async buildTablesMetadata(config) {
        var _a, _b, _c, _d, _e, _f, _g, _h;
        let connection;
        const tablesMetadata = {};
        try {
            // Set schema for Postgres to 'public' if not provided
            if (config.connection.dialect === 'postgres' && !((_a = config.metadata) === null || _a === void 0 ? void 0 : _a.schema)) {
                config.metadata = {
                    ...config.metadata,
                    ...{ schema: 'public' },
                };
            }
            connection = (0, connection_1.createConnection)(config.connection);
            await connection.authenticate();
            let tables = await this.fetchTables(connection, config);
            // Apply filters
            tables = tables
                .filter(({ name }) => {
                var _a, _b;
                if ((_b = (_a = config.metadata) === null || _a === void 0 ? void 0 : _a.tables) === null || _b === void 0 ? void 0 : _b.length) {
                    return config.metadata.tables.includes(name.toLowerCase());
                }
                else {
                    return true;
                }
            }).filter(({ name }) => {
                var _a, _b;
                if ((_b = (_a = config.metadata) === null || _a === void 0 ? void 0 : _a.skipTables) === null || _b === void 0 ? void 0 : _b.length) {
                    return !(config.metadata.skipTables.includes(name.toLowerCase()));
                }
                else {
                    return true;
                }
            });
            for (const { name: tableName, comment: tableComment } of tables) {
                const columnsMetadata = await this.fetchColumnsMetadata(connection, config, tableName);
                // Fetch indices metadata if required
                if ((_b = config.metadata) === null || _b === void 0 ? void 0 : _b.indices) {
                    for (const column of columnsMetadata) {
                        column.indices = await this.fetchColumnIndexMetadata(connection, config, tableName, column.name);
                    }
                }
                const tableMetadata = {
                    originName: tableName,
                    name: tableName,
                    ...((_c = config.metadata) === null || _c === void 0 ? void 0 : _c.schema) && { schema: config.metadata.schema },
                    timestamps: (_e = (_d = config.metadata) === null || _d === void 0 ? void 0 : _d.timestamps) !== null && _e !== void 0 ? _e : false,
                    columns: {},
                    comment: tableComment !== null && tableComment !== void 0 ? tableComment : undefined,
                };
                for (const columnMetadata of columnsMetadata) {
                    tableMetadata.columns[columnMetadata.name] = columnMetadata;
                }
                tablesMetadata[tableMetadata.originName] = tableMetadata;
            }
        }
        catch (err) {
            console.error(err);
            process.exit(1);
        }
        finally {
            connection && await connection.close();
        }
        // Apply associations if required
        if ((_f = config.metadata) === null || _f === void 0 ? void 0 : _f.associationsFile) {
            const parsedAssociations = AssociationsParser_1.AssociationsParser.parse((_g = config.metadata) === null || _g === void 0 ? void 0 : _g.associationsFile);
            for (const [tableName, association] of Object.entries(parsedAssociations)) {
                if (!tablesMetadata[tableName]) {
                    console.warn('[WARNING]', `Associated table ${tableName} not found among (${Object.keys(tablesMetadata).join(', ')})`);
                    continue;
                }
                // Attach associations to table
                tablesMetadata[tableName].associations = association.associations;
                const { columns } = tablesMetadata[tableName];
                // Override foreign keys
                for (const { name: columnName, targetModel } of association.foreignKeys) {
                    if (!columns[columnName]) {
                        console.warn('[WARNING]', `Foreign key column ${columnName} not found among (${Object.keys(columns).join(', ')})`);
                        continue;
                    }
                    columns[columnName].foreignKey = {
                        name: columnName,
                        targetModel: targetModel
                    };
                }
            }
        }
        // Apply transformations if required
        if ((_h = config.metadata) === null || _h === void 0 ? void 0 : _h.case) {
            for (const [tableName, tableMetadata] of Object.entries(tablesMetadata)) {
                tablesMetadata[tableName] = (0, utils_1.caseTransformer)(tableMetadata, config.metadata.case);
            }
        }
        return tablesMetadata;
    }
}
exports.Dialect = Dialect;
/**
 * Accepted dialects
 */
Dialect.dialects = new Set([
    'postgres',
    'mysql',
    'mariadb',
    'sqlite',
    'mssql',
]);
