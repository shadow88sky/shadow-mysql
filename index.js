'use strict'
const mysql = require('mysql');

/**
 * define class  
 * @param options 
 * {
 *    connectionLimist: xx,
 *    host:xx,
 *    ...
 * }
 */
class Pool {
    constructor(options) {
        //if acquireTimeout is not exists, add 
        if (!!!options.acquireTimeout) options.acquireTimeout = 30000;
        this._pool = mysql.createPool(options);
        //The pool will emit an enqueue event when a callback has been queued to wait for an available connection.
        this._pool.on('enqueue', () => {
            console.log('Waiting for available connection slot');
        })
    }

    //pool.query
    query(sql, cb) {
        if (!!!this._pool) return console.error('pool is not exists');
        let tick = new Date();
        return this._pool.query(sql, (err, rows, fields) => {
            let now = new Date();
            let timediff = now.getTime() - tick.getTime();
            if (err) {
                console.error(`[MySQL]Query error,used time:${timediff} ms,error=${err},sql=${sql}`);
            } else {
                console.log(`[MySQL]Query success,used time:${timediff} ms,sql=${sql}`);
            }
            cb(err, rows, fields);
        });
    }

    //pool.query
    queryAsync(sql) {
        let self = this;
        return new Promise((resolve, reject) => {
            if (!!!self._pool) return console.error('pool is not exists');
            let tick = new Date();
            return self._pool.query(sql, (err, rows, fields) => {
                let now = new Date();
                let timediff = now.getTime() - tick.getTime();
                if (err) {
                    console.error(`[MySQL]Query error,used time:${timediff} ms,error=${err},sql=${sql}`);
                    reject(err);
                } else {
                    //console.log(`[MySQL]Query success,used time:${timediff} ms,sql=${sql}`);
                    resolve(rows);
                }
            });
        })
    }

    /**
     * pool.getConnection
     * @param name: function name
     */
    getConnection(name, cb) {
        if (!!!this._pool) return cb('pool is not exists');
        this._pool.getConnection((err, connection) => {
            let conn = new Connection(connection);
            function releaseError() {
                console.warn(`connection ${name} release timeout!!!`);
            }
            //1分钟仍没关闭句柄，则提示释放链接错误;
            conn._timeout = setTimeout(releaseError, 60000);
            cb(err, conn);
        });
    }

    getConnectionAsync(name) {
        let self = this;
        return new Promise((resolve, reject) => {
            if (!!!self._pool) return reject('pool is not exists');
            self._pool.getConnection((err, connection) => {
                if (err) return reject(err);
                let conn = new Connection(connection);
                function releaseError() {
                    console.warn(`connection ${name} release timeout!!!`);
                }
                //1分钟仍没关闭句柄，则提示释放链接错误;
                conn._timeout = setTimeout(releaseError, 60000);
                resolve(conn);
            });
        })
    }

    //pool.end
    end() {
        if (!!!this._pool) return console.error('pool is not exists');
        this._pool.end((err) => {
            if (err) return console.error(`pool.end is error:${err}`);
            console.log('pool.end success');
        })
    }
}

/**
 * define class 
 */
class Connection {
    constructor(conn) {
        this._conn = conn;
        //用来记录beginTransaction、commit、rollback次数的
        this._transCount = 0;
    }

    //connection.query
    query(sql, cb) {
        if (!!!this._conn) return cb('connection is not exists');
        let tick = new Date();
        return this._conn.query(sql, function (err, results) {
            let now = new Date();
            let timediff = now.getTime() - tick.getTime();
            if (err) {
                console.error(`[MySQL]Query error,used time:${timediff} ms,error=${err},sql=${sql}`);
            } else {
                console.log(`[MySQL]Query success,used time:${timediff} ms,sql=${sql}`);
            }
            cb(err, results);
        });
    }

    queryAsnyc(sql) {
        let self = this;
        return new Promise((resolve, reject) => {
            if (!!!self._conn) return reject('connection is not exists');
            let tick = new Date();
            return self._conn.query(sql, function (err, results) {
                let now = new Date();
                let timediff = now.getTime() - tick.getTime();
                if (err) {
                    console.error(`[MySQL]Query error,used time:${timediff} ms,error=${err},sql=${sql}`);
                    return reject(err);
                } else {
                    console.log(`[MySQL]Query success,used time:${timediff} ms,sql=${sql}`);
                    resolve(results);
                }
            });
        })
    }

    //connection.release
    release() {
        if (!!!this._conn) return console.error('connection is not exists');
        this._conn.release();
        if (this._timeout) clearTimeout(this._timeout);
    }

    //beginTransaction
    beginTransaction(cb) {
        if (!!!this._conn) return console.error('connection is not exists');
        let self = this;
        this._conn.beginTransaction(function (err) {
            if (err) return cb(err);
            if (self._transCount > 0) return cb('Has Opened A Transaction!');
            self._transCount++;
            cb(null);
        })
    }

    beginTransactionAsync() {
        let self = this;
        return new Promise((resolve, reject) => {
            if (!!!self._conn) return console.error('connection is not exists');
            self._conn.beginTransaction(function (err) {
                if (err) return reject(err);
                if (self._transCount > 0) return reject('Has Opened A Transaction!');
                self._transCount++;
                resolve(null);
            })
        })
    }

    //rollback
    rollback() {
        if (this._transCount == 0) return console.error('can not rollback,please open transaction first!');
        this._transCount--;
        this._conn.rollback();
    }

    //commit
    commit(cb) {
        if (this._transCount == 0) return cb('Please open transaction first!');
        this._transCount--;
        this._conn.commit(function (err) {
            if (err) return cb(err);
            cb(null);
        })
    }

    //commit
    commitAsync() {
        let self = this;
        return new Promise((resolve, reject) => {
            if (self._transCount == 0) return reject('Please open transaction first!');
            self._transCount--;
            self._conn.commit(function (err) {
                if (err) return reject(err);
                resolve(null);
            })
        })
    }
}

/***
 *
 * @param obj  json对象
 * @param columns  数组
 */
var convertObjectToSQLStringArray = function (obj, columns) {
    // TODO:转换JSON对象为按照给定列排序的字符串(用于Insert)
    let arrayObj = new Array();
    for (let i = 0; i < columns.length; i++) {
        for (let key in obj) {
            if (key == columns[i]) {
                arrayObj.push(mysql.escape(obj[key]));
            }
        }
    }
    return arrayObj;
}

/**
 * create sql
 */
function makeSQL(sql, options) {
    for (let k in options) {
        if (typeof options[k] != 'function') {
            let reg = new RegExp("@" + k + "@", "g");
            if (typeof options[k] == 'string' && options[k].substr(options[k].length - 1, 1) == '$') {
                options[k] += '$';
            }
            sql = sql.replace(reg, mysql.escape(options[k]));
        }
    }
    return sql;
}

// object转字符串
var convertObjectToSQLStringKV = function (obj, delimiterOP, delimiterEND) {
    // TODO:转换JSON对象为'key[=]val[,]'形式,(用于Where,Update)
    let res = '';
    let end = delimiterEND.trim();
    if (end.indexOf("and") >= 0) end = " " + delimiterEND.trim() + " ";
    for (let key in obj) {
        res += key + delimiterOP + mysql.escape(obj[key]) + end;
    }
    if (res.indexOf("and") > 0) return res.substr(0, res.length - 4);
    else return res.substr(0, res.length - 1);

}

// 条件obj转字符串
var conditionToSQLString = function (condition) {
    let sqlCondition = '';
    if (condition) {
        console.assert(typeof condition == 'object', 'condition is not object!!!');
        for (let key in condition) {
            for (let lkey in condition[key]) {
                switch (lkey) {
                    //小于
                    case 'lt':
                        sqlCondition += ' AND ' + key + ' < ' + mysql.escape(condition[key][lkey]);
                        break;
                    //大于
                    case 'gt':
                        sqlCondition += ' AND ' + key + ' > ' + mysql.escape(condition[key][lkey]);
                        break;
                    //like
                    case 'like':
                        sqlCondition += ' AND ' + key + " like '%" + mysql.escape(condition[key][lkey]).replace(/'/g, '') + "%'";
                        break;
                    //>=
                    case 'gte':
                        sqlCondition += ' AND ' + key + ' >= ' + mysql.escape(condition[key][lkey]);
                        break;
                    //<=
                    case 'lte':
                        sqlCondition += ' AND ' + key + ' <= ' + mysql.escape(condition[key][lkey]);
                        break;
                    default:
                        break;
                }
            }
        }
    }
    return sqlCondition;
}

// create sql:Insert
function makeSQLInsert(table, items) {
    let sql = "INSERT INTO " + mysql.escapeId(table) + " (";
    let values = ") VALUES ";
    let valueString = '';
    let colarray = [];
    if (items instanceof (Array)) {
        // 多行插入模式
        for (let key in items[0]) {
            colarray.push(key);
        }
        for (let i = 0; i < items.length; i++) {
            let value = convertObjectToSQLStringArray(items[i], colarray).join(',');
            valueString += '(' + value + '),';
        }
        sql += colarray.join(',') + values + valueString.substr(0, valueString.length - 1) + ";";
    }
    else {
        // 单行插入模式
        for (let key in items) {
            colarray.push(key);
        }
        valueString += convertObjectToSQLStringArray(items, colarray).join(',');
        sql += colarray.join(',') + values + '(' + valueString + ");";
    }
    return sql;
}
// 创建SQL语句:Update
/**
 *
 * @param table 表名
 * @param items 需要更新的字段及新值{col:newvalue,colb:valueb}
 * @param where
 * @returns {string}
 */
function makeSQLUpdate(table, items, where, condition) {
    let sql = "UPDATE " + mysql.escapeId(table) + " SET " + convertObjectToSQLStringKV(items, '=', ',');
    if (where) {
        sql += ' WHERE ' + convertObjectToSQLStringKV(where, '=', 'and');
    }
    sql += conditionToSQLString(condition);
    return sql;
}

// 创建SQL语句:Select
function makeSQLSelect(table, columns, where, condition) {
    let col = '';
    if (columns instanceof (Array)) {
        col = columns.join(',');
    }
    let sql = "SELECT " + col + " FROM " + mysql.escapeId(table) + " WHERE 1=1 ";
    if (where) {
        sql += " AND " + convertObjectToSQLStringKV(where, '=', 'and');
    }
    sql += conditionToSQLString(condition);
    return sql;
}

// 创建SQL语句:Delete
function makeSQLDelete(table, where, condition) {
    console.assert(typeof table == 'string', table);
    let sql = "DELETE FROM " + mysql.escapeId(table)
    if (where) {
        sql += ' WHERE ' + convertObjectToSQLStringKV(where, '=', 'and');
    }
    sql += conditionToSQLString(condition);
    return sql;
}

exports.Pool = Pool;
exports.makeSQL = makeSQL;
exports.makeSQLInsert = makeSQLInsert;
exports.makeSQLSelect = makeSQLSelect;
exports.makeSQLUpdate = makeSQLUpdate;
exports.makeSQLDelete = makeSQLDelete;
exports.escape = mysql.escape;