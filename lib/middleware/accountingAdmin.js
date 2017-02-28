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
    db = require('../db/db'),
    Joi = require('joi'),
    notifier = require('../util/notifier');

var notificationSchema = Joi.object.keys({
    orderId: Joi.string().min(1).required(),
    productId: Joi.string().min(1).required(),
    customer: Joi.string().min(1).required(),
    acquisition: Joi.object().keys({
        roleId: Joi.string().min(1).required(),
        domain: Joi.string().min(1).required(),
        servicePath: Joi.string().min(1).required(),
        unit: Joi.any().valid(config.accounting.modules)
    })
});

var deletionSchema = Joi.object.keys({
    orderId: Joi.string().min(1).required(),
    productId: Joi.string().min(1).required(),
});

var tokenSchema = Joi.object.keys({
    apiKey: Joi.string().min(1).required()
});

function getAccountingUnits(req, res) {
    res.status(200).json({
        units: config.accounting.modules
    });
}

function getAcquisitions(req, res) {
    notifier.notifyAllUsage((err) => {
        if(err) {
            res.status(400).json({
                error: 'Error notifying usage: ' + err
            });
        } else {
            res.status(200).send('');
        }
    });
}

function processNotification(req, res, schema, dbMethod, errMsg) {
    var notification = req.body;

    // Validate notification structure
    Joi.validate(notification, schema, function (err) {
        if (err) {
            // Invalid JSON request
            res.status(422).json({
                error: 'Invalid request body'
            })
        } else {
            // Save new accounting object
            // TODO: Validate fields to send informative errors
            dbMethod(notification, (err) => {
                if (err) {
                    res.status(400).json({
                        error: errMsg
                    });
                } else {
                    res.status(201).send();
                }
            });
        }
    });
}

function notifyAcquisition(req, res) {
    processNotification(req, res, notificationSchema, db.addAcquisition, 'Error saving new acquisition');
}

function deleteAcquisition(req, res) {
    var processDeletion = function(notification, callback) {
        async.series([
            (callback) => {
                notifier.notifyUsage(notification, callback);
            },
            (callback) => {
                db.deleteAcquisition(notification, callback);
            }
        ], callback);
    };

    processNotification(req, res, deletionSchema, processDeletion, 'Error deleting acquisition');
}

function saveToken(req, res) {
    processNotification(req, res, tokenSchema, db.addToken, 'Error saving new token');
}

function loadContextRoutes(router) {
    // TODO: Handle init error
    db.init(() => {
        router.get('/accounting/units', getAccountingUnits);
        router.get('/accounting/acquisitions', getAcquisitions);
        router.post('/accounting/acquisitions', notifyAcquisition);
        router.delete('/accounting/acquisitions', deleteAcquisition);
        router.post('/accounting/token', saveToken);
    });
}

exports.loadContextRoutes = loadContextRoutes;