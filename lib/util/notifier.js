/* Copyright (c) 2015 - 2017 CoNWeT Lab., Universidad Politécnica de Madrid
 *
 * This file belongs to the Accounting Proxy
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

var async = require('async'),
    config = require('../../config'),
    db = require('../db/db'),
    logger = require('logops'),
    request = require('request');


function getAccountingModules() {
    var accountingModules = {};

    // TODO: Validate modules
    config.accounting.modules.forEach(function (module) {
        accountingModules[module] = require('../accounting/' + module);
    });

    return accountingModules;
}

/**
 * Send the usage specification for the unit passed to the Usage Management API.
 *
 * @param  {string}   unit     Accounting unit.
 */
var sendSpecification = function (token, unit, callback) {
    var accountingModules = getAccountingModules();

    if (accountingModules[unit].getSpecification === undefined) {
        return callback('Error, function getSpecification undefined for unit ' + unit);
    } else {

        var specification = accountingModules[unit].getSpecification();

        if (specification === undefined) {
            return callback('Error, specification no available for unit ' + unit);

        } else {

            var protocol = config.accounting.usageAPI.ssl ? 'https' : 'http';
            var options = {
                url: protocol +  '://' + config.accounting.usageAPI.host + ':' +
                config.accounting.usageAPI.port + config.accounting.usageAPI.path + '/usageSpecification',
                json: true,
                method: 'POST',
                headers: {
                    'X-API-KEY': token
                },
                body: specification
            };

            logger.info('Sending specification for unit: [%s]', unit);
            request(options, function (err, resp, body) {

                if (err) {
                    return callback('Error sending the Specification: ' + err.code);

                } else if (resp.statusCode !== 201) {

                    return callback('Error, ' + resp.statusCode + ' ' + resp.statusMessage);

                } else {

                    db.addSpecificationRef(unit, body.href, function (err) {
                        if (err) {
                            return callback(err);
                        } else {
                            return callback(null);
                        }
                    });
                }
            });
        }
    }
};

/**
 * Send the accounting information to the usage API.
 *
 * @param  {Object}   accInfo  Accounting information to notify.
 */
var sendUsage = function (token, accInfo, callback) {

    logger.info('Notifying the accounting...');

    db.getHref(accInfo.unit, function (err, href) {

        if (err) {
            return callback(err);
        } else {

            var protocol = config.accounting.usageAPI.ssl ? 'https' : 'http';
            var bizHost = protocol + '://' + config.accounting.usageAPI.host + ':' + config.accounting.usageAPI.port;

            var body = {
                date: (new Date()).toISOString(),
                type: 'CB',
                status: 'Received',
                usageSpecification: {
                    href: href,
                    name: accInfo.unit
                },
                usageCharacteristic: [
                {
                    name: 'orderId',
                    value: accInfo.orderId
                }, {
                    name: 'productId',
                    value: accInfo.productId
                }, {
                    name: 'correlationNumber',
                    value: accInfo.correlationNumber
                }, {
                    name: 'unit',
                    value: accInfo.unit
                }, {
                    name: 'value',
                    value: accInfo.value
                }
                ],
                relatedParty: [{
                    role: 'customer',
                    id: accInfo.customer,
                    href: bizHost + '/partyManagement/individual/' + accInfo.customer
                }]
            };

            var options = {
                url: bizHost + config.accounting.usageAPI.path + '/usage',
                json: true,
                method: 'POST',
                headers: {
                    'X-API-KEY': token
                },
                body: body
            };

            // Notify usage to the Usage Management API
            request(options, function (err, resp, body) {

                if (err) {
                    return callback('Error notifying usage to the Usage Management API: ' + err.code);
                } else if (resp.statusCode !== 201){
                    return callback('Error notifying usage to the Usage Management API: ' + resp.statusCode + ' ' + resp.statusMessage);
                } else {
                    db.resetAccounting(accInfo.orderId, accInfo.productId, function (err) {
                        if (err) {
                            return callback('Error while resetting the accounting after notifying the usage');
                        } else {
                            return callback(null);
                        }
                    });
                }
            });
        }
    });
};

/**
 * Notify the usage specification for all the accounting units supported by the proxy.
 *
 */
var notifyUsageSpecification = function (token, callback) {
    var units = config.accounting.modules;

    async.each(units, function (unit, taskCallback) {

        db.getHref(unit, function (err, href) {
            if (err) {
                taskCallback(err);
            } else if (href !== null) {
                taskCallback(null);
            } else {
                sendSpecification(token, unit, taskCallback);
            }
        });
    }, callback);
};

/**
 * Notify the accounting value.
 *
 */
var notifyAllUsage = function (callback) {

    db.getToken(function (err, token) {
        if (err) {
            return callback(err);
        } else if (!token) {
            return callback(null);
        } else {

            db.getAllNotificationInfo(function (err, notificationInfo) {

                if (err) {
                    return callback(err);
                } else if (!notificationInfo) { // no info to notify
                    return callback(null);
                } else {

                    // First, Notify the usage specifications
                    notifyUsageSpecification(token, function (err) {

                        if (err) {
                            return callback(err);

                        } else {
                            // Then, notify the usage
                            async.each(notificationInfo, function (info, taskCallback) {
                                sendUsage(token, info, function (err) {
                                    if (err) {
                                        taskCallback(err);
                                    } else {
                                        taskCallback(null);
                                    }
                                });
                            }, callback);
                        }
                    });
                }
            });
        }
    });
};

/**
 * Notifies the accounting information for the API key passed as argument.
 *
 * @param      {Object}    notification    Biz Ecosystem notification.
 */
var notifyUsage = function (notification, callback) {

    db.getToken(function (err, token) {
        if (err) {
            return callback(err);
        } else if (!token) {
            return callback('There is no available token');
        } else {

            db.getNotificationInfo(notification.orderId, notification.productId, function (err, notificationInfo) {
                if (err) {
                    return callback(err);
                } else if (!notificationInfo) {
                    return callback(null); // There is no accounting info to notify
                } else {

                    notifyUsageSpecification(token, function (err) {
                        if (err) {
                            return callback(err);
                        } else {

                            sendUsage(token, notificationInfo, function (err) {
                                if (err) {
                                    return callback(err);
                                } else {
                                    return callback(null);
                                }
                            })
                        }
                    });
                }
            });
        }
    });
};

exports.notifyAllUsage = notifyAllUsage;
exports.notifyUsage = notifyUsage;