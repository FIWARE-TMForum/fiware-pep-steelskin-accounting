/* Copyright (c) 2017 CoNWeT Lab., Universidad Politécnica de Madrid
 *
 * This file is part of fiware-pep-steelskin-accounting
 *
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the GNU Affero General Public License as
 * published by the Free Software Foundation, either version 3 of the
 * License, or (at your option) any later version.
 *
 * This program is distributed in the hope that it will be useful,
 * but WITHOUT ANY WARRANTY; without even the implied warranty of
 * MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
 * GNU Affero General Public License for more details.
 *
 * You should have received a copy of the GNU Affero General Public License
 * along with this program.  If not, see <http://www.gnu.org/licenses/>.
 */

'use strict';

var async = require('async'),
    config = require('../../config'),
    mysql = require('mysql');

var pool = mysql.createPool({
    connectionLimit: 100,
    host: config.accounting.db.host,
    port: config.accounting.db.port,
    user: config.accounting.db.user,
    password: config.accounting.db.passwd,
    database: config.accounting.db.database
});

function handleQuery(query, values, callback) {
    pool.getConnection(function(err, connection) {
        if (err) {
            callback('Error connecting with the database');
        } else {
            connection.query(query, function(err, results) {
                connection.release();

                if (err) {
                    callback('Error executing query');
                } else {
                    callback(null, results);
                }
            });
        }
    });
}

exports.init = function (callback) {
    async.series([
        (callback) => {
            handleQuery('CREATE TABLE IF NOT EXISTS accounting ( \
                    orderId             VARCHAR(255), \
                    productId           VARCHAR(255), \
                    domain              VARCHAR(255), \
                    service             VARCHAR(255), \
                    roleId              VARCHAR(255), \
                    customer            VARCHAR(255), \
                    unit                VARCHAR(10), \
                    value               INT, \
                    correlationNumber   INT, \
                    PRIMARY KEY (orderId, productId) \
            )', callback)
        }
    ], callback);
};

exports.addAcquisition = function (acquisition, callback) {
    var query = 'INSERT INTO accounting VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)';
    var values = [
        acquisition.orderId,
        acquisition.productId,
        acquisition.domain,
        acquisition.servicePath,
        acquisition.roleId,
        acquisition.customer,
        acquisition.unit,
        0,  // Correlation number
        0   // Value
    ];

    handleQuery(query, values, callback);
};

exports.getAccounting = function (customer, callback) {

};

exports.deleteAccounting = function () {

};
