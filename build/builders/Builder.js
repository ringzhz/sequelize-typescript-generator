"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.Builder = void 0;
/**
 * @class Builder
 * @constructor
 * @param {IConfig} config
 * @param {Dialect} dialect
 */
class Builder {
    constructor(config, dialect) {
        this._config = config;
        this._dialect = dialect;
    }
    get config() {
        return this._config;
    }
    set config(value) {
        this._config = value;
    }
    get dialect() {
        return this._dialect;
    }
    set dialect(value) {
        this._dialect = value;
    }
}
exports.Builder = Builder;
