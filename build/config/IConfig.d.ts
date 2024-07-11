import { Options } from 'sequelize';
import { ESLint } from 'eslint';
export type TransformCase = 'UPPER' | 'LOWER' | 'UNDERSCORE' | 'CAMEL' | 'PASCAL' | 'CONST';
export declare enum TransformTarget {
    MODEL = "model",
    COLUMN = "column"
}
export type TransformMap = {
    [key in TransformTarget]: TransformCase;
};
export type TransformFn = (value: string, target: TransformTarget) => string;
export declare const TransformCases: Set<TransformCase>;
export interface IConfigMetadata {
    schema?: 'public' | string;
    tables?: string[];
    skipTables?: string[];
    indices?: boolean;
    timestamps?: boolean;
    case?: TransformCase | TransformMap | TransformFn;
    associationsFile?: string;
    noViews?: boolean;
}
export interface IConfigOutput {
    clean?: boolean;
    outDir: string;
}
export interface IConfig {
    connection: Options;
    metadata?: IConfigMetadata;
    output: IConfigOutput;
    lintOptions?: ESLint.Options;
    strict?: boolean;
}