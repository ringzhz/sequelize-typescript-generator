"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.DialectPostgres = void 0;
const sequelize_1 = require("sequelize");
const sequelize_typescript_1 = require("sequelize-typescript");
const Dialect_1 = require("./Dialect");
const utils_1 = require("./utils");
const sequelizeDataTypesMap = {
    int2: sequelize_typescript_1.DataType.INTEGER,
    int4: sequelize_typescript_1.DataType.INTEGER,
    int8: sequelize_typescript_1.DataType.BIGINT,
    numeric: sequelize_typescript_1.DataType.DECIMAL,
    float4: sequelize_typescript_1.DataType.FLOAT,
    float8: sequelize_typescript_1.DataType.DOUBLE,
    money: sequelize_typescript_1.DataType.NUMBER,
    varchar: sequelize_typescript_1.DataType.STRING,
    bpchar: sequelize_typescript_1.DataType.STRING,
    text: sequelize_typescript_1.DataType.STRING,
    bytea: sequelize_typescript_1.DataType.BLOB,
    timestamp: sequelize_typescript_1.DataType.DATE,
    timestamptz: sequelize_typescript_1.DataType.DATE,
    date: sequelize_typescript_1.DataType.STRING,
    time: sequelize_typescript_1.DataType.STRING,
    timetz: sequelize_typescript_1.DataType.STRING,
    // interval: DataType.STRING,
    bool: sequelize_typescript_1.DataType.BOOLEAN,
    point: sequelize_typescript_1.DataType.GEOMETRY,
    line: sequelize_typescript_1.DataType.GEOMETRY,
    lseg: sequelize_typescript_1.DataType.GEOMETRY,
    box: sequelize_typescript_1.DataType.GEOMETRY,
    path: sequelize_typescript_1.DataType.GEOMETRY,
    polygon: sequelize_typescript_1.DataType.GEOMETRY,
    circle: sequelize_typescript_1.DataType.GEOMETRY,
    geometry: sequelize_typescript_1.DataType.GEOMETRY,
    cidr: sequelize_typescript_1.DataType.STRING,
    inet: sequelize_typescript_1.DataType.STRING,
    macaddr: sequelize_typescript_1.DataType.STRING,
    macaddr8: sequelize_typescript_1.DataType.STRING,
    bit: sequelize_typescript_1.DataType.STRING,
    varbit: sequelize_typescript_1.DataType.STRING,
    uuid: sequelize_typescript_1.DataType.UUID,
    xml: sequelize_typescript_1.DataType.STRING,
    json: sequelize_typescript_1.DataType.JSON,
    jsonb: sequelize_typescript_1.DataType.JSONB,
    jsonpath: sequelize_typescript_1.DataType.JSON,
    citext: sequelize_typescript_1.DataType.CITEXT,
};
const jsDataTypesMap = {
    int2: 'number',
    int4: 'number',
    int8: 'string',
    numeric: 'string',
    float4: 'number',
    float8: 'number',
    money: 'string',
    varchar: 'string',
    bpchar: 'string',
    text: 'string',
    bytea: 'Uint8Array',
    timestamp: 'Date',
    timestamptz: 'Date',
    date: 'string',
    time: 'string',
    timetz: 'string',
    interval: 'object',
    bool: 'boolean',
    point: 'object',
    line: 'object',
    lseg: 'object',
    box: 'object',
    path: 'object',
    polygon: 'object',
    circle: 'object',
    geometry: 'object',
    cidr: 'string',
    citext: 'string',
    inet: 'string',
    macaddr: 'string',
    macaddr8: 'string',
    bit: 'string',
    varbit: 'string',
    uuid: 'string',
    xml: 'string',
    json: 'object',
    jsonb: 'object',
    jsonpath: 'object',
};
/**
 * Dialect for Postgres
 * @class DialectPostgres
 */
class DialectPostgres extends Dialect_1.Dialect {
    constructor() {
        super('postgres');
    }
    /**
     * Map database data type to sequelize data type
     * @param {string} dbType
     * @returns {string}
     */
    mapDbTypeToSequelize(dbType) {
        return sequelizeDataTypesMap[dbType];
    }
    /**
     * Map database data type to javascript data type
     * @param {string} dbType
     * @returns {string
     */
    mapDbTypeToJs(dbType) {
        return jsDataTypesMap[dbType];
    }
    /**
     * Map database default values to Sequelize type (e.g. uuid() => DataType.UUIDV4).
     * @param {string} v
     * @returns {string}
     */
    mapDefaultValueToSequelize(v) {
        return v;
    }
    /**
     * Fetch table names for the provided database/schema
     * @param {Sequelize} connection
     * @param {IConfig} config
     * @returns {Promise<ITable[]>}
     */
    async fetchTables(connection, config) {
        const query = `
            SELECT 
                t.table_name                AS table_name,
                obj_description(pc.oid)     AS table_comment
            FROM information_schema.tables t
            JOIN pg_class pc
                ON t.table_name = pc.relname
            WHERE t.table_schema='${config.metadata.schema}' AND pc.relkind = 'r';
        `;
        const tables = (await connection.query(query, {
            type: sequelize_1.QueryTypes.SELECT,
            raw: true,
        })).map(({ table_name, table_comment }) => {
            const t = {
                name: table_name,
                comment: table_comment !== null && table_comment !== void 0 ? table_comment : undefined,
            };
            return t;
        });
        return tables;
    }
    /**
     * Fetch columns metadata for the provided schema and table
     * @param {Sequelize} connection
     * @param {IConfig} config
     * @param {string} table
     * @returns {Promise<IColumnMetadata[]>}
     */
    async fetchColumnsMetadata(connection, config, table) {
        var _a;
        const columnsMetadata = [];
        const query = `
            SELECT
                CASE WHEN (seq.sequence_name IS NOT NULL) THEN TRUE ELSE FALSE END AS is_sequence,
                EXISTS( -- primary key
                   SELECT
                    x.indisprimary
                   FROM pg_attribute a
                    LEFT OUTER JOIN pg_index x
                        ON a.attnum = ANY (x.indkey) AND a.attrelid = x.indrelid
                    WHERE a.attrelid = '${config.metadata.schema}.\"${table}\"'::regclass AND a.attnum > 0
                        AND c.ordinal_position = a.attnum AND x.indisprimary IS TRUE
                ) AS is_primary,
                c.*,
                pgd.description
            FROM information_schema.columns c
            INNER JOIN pg_catalog.pg_statio_all_tables as st
                ON c.table_schema = st.schemaname AND c.table_name = st.relname
            LEFT OUTER JOIN pg_catalog.pg_description pgd
                ON pgd.objoid = st.relid AND pgd.objsubid = c.ordinal_position
            LEFT OUTER JOIN ( -- Sequences (auto increment) metadata
                SELECT seqclass.relname AS sequence_name,
                       pn.nspname       AS schema_name,
                       depclass.relname AS table_name,
                       attrib.attname   AS column_name
                FROM pg_class AS seqclass
                         JOIN pg_sequence AS seq
                              ON (seq.seqrelid = seqclass.relfilenode)
                         JOIN pg_depend AS dep
                              ON (seq.seqrelid = dep.objid)
                         JOIN pg_class AS depclass
                              ON (dep.refobjid = depclass.relfilenode)
                         JOIN pg_attribute AS attrib
                              ON (attrib.attnum = dep.refobjsubid AND attrib.attrelid = dep.refobjid)
                         JOIN pg_namespace pn
                              ON seqclass.relnamespace = pn.oid
                WHERE pn.nspname = '${config.metadata.schema}' AND depclass.relname = '${table}'
            ) seq
                 ON c.table_schema = seq.schema_name AND c.table_name = seq.table_name AND
                    c.column_name = seq.column_name
            WHERE c.table_schema = '${config.metadata.schema}' AND c.table_name = '${table}'
            ORDER BY c.ordinal_position;
        `;
        const columns = await connection.query(query, {
            type: sequelize_1.QueryTypes.SELECT,
            raw: true,
        });
        for (const column of columns) {
            // Unknown data type
            if (!this.mapDbTypeToSequelize(column.udt_name)) {
                (0, utils_1.warnUnknownMappingForDataType)(column.udt_name);
            }
            const columnMetadata = {
                name: column.column_name,
                originName: column.column_name,
                type: column.udt_name,
                typeExt: column.data_type,
                ...this.mapDbTypeToSequelize(column.udt_name) && {
                    dataType: 'DataType.' +
                        this.mapDbTypeToSequelize(column.udt_name).key
                            .split(' ')[0], // avoids 'DOUBLE PRECISION' key to include PRECISION in the mapping
                },
                allowNull: !!column.is_nullable && !column.is_primary,
                primaryKey: column.is_primary,
                autoIncrement: column.is_sequence,
                indices: [],
                comment: (_a = column.description) !== null && _a !== void 0 ? _a : undefined,
            };
            if (column.column_default) {
                columnMetadata.defaultValue = `Sequelize.literal("${column.column_default.replace(/\"/g, '\\\"')}")`;
            }
            // Additional data type information
            switch (column.udt_name) {
                case 'decimal':
                case 'numeric':
                case 'float':
                case 'double':
                    columnMetadata.dataType +=
                        (0, utils_1.generatePrecisionSignature)(column.numeric_precision, column.numeric_scale);
                    break;
                case 'timestamp':
                case 'timestampz':
                    columnMetadata.dataType += (0, utils_1.generatePrecisionSignature)(column.datetime_precision);
                    break;
                case 'bpchar':
                case 'varchar':
                    columnMetadata.dataType += (0, utils_1.generatePrecisionSignature)(column.character_maximum_length);
                    break;
            }
            columnsMetadata.push(columnMetadata);
        }
        return columnsMetadata;
    }
    /**
     * Fetch index metadata for the provided table and column
     * @param {Sequelize} connection
     * @param {IConfig} config
     * @param {string} table
     * @param {string} column
     * @returns {Promise<IIndexMetadata[]>}
     */
    async fetchColumnIndexMetadata(connection, config, table, column) {
        const indicesMetadata = [];
        const query = `
            SELECT pc.relname       AS index_name,
                   am.amname        AS index_type,
                   a.attname        AS column_name,
                   a.attnum         AS ordinal_position,
                   x.indisprimary   AS is_primary,
                   x.indisunique    AS is_unique,
                   x.indisclustered AS is_clustered
            FROM pg_attribute a
            INNER JOIN pg_index x
                ON a.attnum = ANY (x.indkey) AND a.attrelid = x.indrelid
            INNER JOIN pg_class pc
                ON x.indexrelid = pc.oid
            INNER JOIN pg_am am
                ON pc.relam = am.oid
            WHERE a.attrelid = '${config.metadata.schema}.\"${table}\"'::regclass AND a.attnum > 0 
                AND a.attname = '${column}';
        `;
        const indices = await connection.query(query, {
            type: sequelize_1.QueryTypes.SELECT,
            raw: true,
        });
        for (const index of indices) {
            indicesMetadata.push({
                name: index.index_name,
                using: index.index_type,
                unique: index.is_unique,
            });
        }
        return indicesMetadata;
    }
}
exports.DialectPostgres = DialectPostgres;
