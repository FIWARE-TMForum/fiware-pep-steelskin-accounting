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
            connection.query(query, values, function(err, results) {
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
                    unit                VARCHAR(20), \
                    value               INT, \
                    correlationNumber   INT, \
                    PRIMARY KEY (orderId, productId) \
            )', callback)
        },
        (callback) => {
            handleQuery('CREATE TABLE IF NOT EXISTS token ( \
                    token               VARCHAR(50), \
                    PRIMARY KEY (token) \
            )', callback)
        },
        (callback) => {
            handleQuery('CREATE TABLE IF NOT EXISTS unit ( \
                    unit               VARCHAR(20), \
                    href               VARCHAR(255),\
                    PRIMARY KEY (unit) \
            )', callback)
        }
    ], callback);
};

exports.getToken = function (callback) {
    var query = 'SELECT * FROM token';
    handleQuery(query, [], function(err, token) {
        if (err) {
            callback('Error retrieving api key');
        } else if(!token) {
            callback(null, null);
        } else {
            callback(null, token.token);
        }
    });
};

exports.addToken = function (token, callback) {
    var query = 'INSERT OR REPLACE INTO token VALUES (?)';
    var error = 'Error saving new API Key';

    handleQuery('DELETE FROM token', [], function(err) {
        if (err) {
            callback(error);
        } else {
            handleQuery(query, [token.apiKey], function (err) {
                var errMsg = err ? error : null;
                callback(errMsg);
            })
        }
    });
};

exports.getHref = function (unit, callback) {
    var query = 'SELECT href FROM units WHERE unit=?';
    handleQuery(query, [unit], function (err, href) {
        if (err) {
            callback('Error retrieving href for unit ' + unit);
        } else if(!href) {
            callback(null, null);
        } else {
            callback(null, href.href);
        }
    });
};

exports.addSpecificationRef = function (unit, href, callback) {
    var query = 'INSERT OR REPLACE INTO unit VALUES (?, ?)';
    handleQuery(query, [unit, href], callback);
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

exports.deleteAcquisition = function (acquisition, callback) {
    var query = 'DELETE FROM accounting WHERE orderId = ? AND productId = ?';
    var values = [
        acquisition.orderId,
        acquisition.productId
    ];

    handleQuery(query, values, callback);
};

exports.resetAccounting = function (orderId, productId, callback) {
    var query = 'UPDATE accounting SET value=0, correlationNumber=correlationNumber + 1 WHERE orderId=? AND productId=?';
    handleQuery(query, [orderId, productId], callback)
};

function notificationsHandler(err, notificationInfo, callback) {
    if (err) {
        return callback('Error in database getting the notification information.',  null);
    } else if (!notificationInfo) {
        return callback(null, null);
    } else {
        return callback(null, notificationInfo);
    }
}

exports.getNotificationInfo = function (orderId, productId, callback) {
    var query = 'SELECT orderId, productId, customer, value, correlationNumber, unit \ ' +
        'FROM accounting WHERE orderId=? AND productId=? AND value!=0';

    handleQuery(query, [orderId, productId], (err, notificationInfo) => {
        notificationsHandler(err, notificationInfo, callback)
    });
};

exports.getAllNotificationInfo = function (callback) {
    var query = 'SELECT orderId, productId, customer, value, correlationNumber, unit \ ' +
        'FROM accounting WHERE value!=0';

    handleQuery(query, [], (err, notificationInfo) => {
        notificationsHandler(err, notificationInfo, callback)
    });
};

exports.getAccountingUnit = function (customer, domain, servicePath, callback) {
    var query = 'SELECT unit FROM accounting WHERE customer=? AND domain=? AND service=?';

    handleQuery(query, [customer, domain, servicePath], (err, notificationInfo) => {
        notificationsHandler(err, notificationInfo, callback)
    });
};

exports.makeAccounting = function (orderId, productId, value, callback) {
    var query = 'UPDATE accounting SET value=value+? WHERE orderId=? AND productId=?';

    handleQuery(query, [value, orderId, productId], callback);
};
