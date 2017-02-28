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

var config = require('../../config'),
    db = require('../db/db');

function accounting(error, req, res, next) {
    if (error) {
        // A redirection error happened, send error to next middleware (transformSystemErrors)
        return next(error);
    }

    // Search for the pricing model to monitor
    // TODO: Handle error cases
    db.getAccountingUnit(req.user, req.service, req.subService, function(err, accountingInfo) {
        if (err || !accountingInfo) {
            next();
        } else {
            // Get the related accounting module
            var accountingModule = require('../accounting/' + accountingInfo.unit);

            if (accountingModule && accountingModule.count) {
                var countInfo = {
                    request: req,
                    response: res
                };
                // Make the accounting
                acountingModule.count(countInfo, (err, value) => {
                    if (!err) {
                        db.makeAccounting(accountingInfo.orderId, accountingInfo.productId, value, (err) => {
                            next();
                        });
                    } else {
                        next();
                    }
                });
            } else {
                next();
            }
        }
    });
}

exports.accounting = accounting;