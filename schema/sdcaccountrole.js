/*
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/.
 */

/*
 * Copyright (c) 2014, Joyent, Inc.
 */

/*
 * This file defines schema for sdcAccountRole, objectclass added to all the
 * groups of a given account. These entries are simmilar to GroupOfUniqueNames
 * object class.
 *
 * Purpose of this class is to ensure an account group has both, an
 * account attribute and one or more unique members and referenced roles.
 */

var assert = require('assert');
var util = require('util');

var ldap = require('ldapjs');

var Validator = require('../lib/schema/validator');

var UUID_RE = /^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/;


// --- API

function SDCAccountRole() {
    Validator.call(this, {
        name: 'sdcaccountrole',
        required: {
            name: 1,
            account: 1,
            uuid: 1
        },
        optional: {
            uniquemember: 1000000,
            memberpolicy: 1000000,
            uniquememberdefault: 1000000
        }
    });
}
util.inherits(SDCAccountRole, Validator);

SDCAccountRole.prototype.validate =
function validate(entry, config, changes, callback) {
    var attrs = entry.attributes;
    var errors = [];
    var members = attrs.uniquemember || [];
    var policies = attrs.memberpolicy || [];
    var defaultMembers = attrs.uniquememberdefault || [];
    var i, j, k;

    members.sort();
    for (i = 0; i < members.length; i++) {
        if (members.indexOf(members[i], i + 1) !== -1) {
            return callback(new ldap.ConstraintViolationError(members[i] +
                                                         ' is not unique'));
        }
    }

    defaultMembers.sort();
    for (k = 0; k < defaultMembers.length; k++) {
        if (defaultMembers.indexOf(defaultMembers[k], k + 1) !== -1) {
            return callback(new ldap.ConstraintViolationError(
                        defaultMembers[k] + ' is not unique'));
        }

        if (members.indexOf(defaultMembers[k]) === -1) {
            return callback(new ldap.ConstraintViolationError(
                        defaultMembers[k] + ' is not valid'));
        }
    }

    policies.sort();
    for (j = 0; j < policies.length; j++) {
        if (policies.indexOf(policies[j], j + 1) !== -1) {
            return callback(new ldap.ConstraintViolationError(policies[j] +
                                                         ' is not unique'));
        }
    }

    var account = attrs.account[0];
    if (!UUID_RE.test(account)) {
        errors.push('account: ' + account + ' is invalid');
    }

    var dn = (typeof (entry.dn) === 'string') ?
        ldap.parseDN(entry.dn) : entry.dn;

    if (dn.rdns[1].uuid && dn.rdns[1].uuid !== account) {
        errors.push('dn: ' + entry.dn + ' is invalid');
    }

    if (attrs.uuid) {
        var uuid = attrs.uuid[0];
        if (!UUID_RE.test(uuid)) {
            errors.push('uuid: ' + uuid + ' is invalid');
        }

        if (dn.rdns[0]['role-uuid'] && dn.rdns[0]['role-uuid'] !== uuid) {
            errors.push('dn: ' + entry.dn + ' is invalid');
        }

        if (changes && changes.some(function (c) {
            return (c._modification.type === 'uuid');
        })) {
            errors.push('uuid cannot be modified');
        }
    }

    if (errors.length) {
        return callback(new ldap.ConstraintViolationError(errors.join('\n')));
    }

    return callback();
};


// --- Exports

module.exports = {

    createInstance: function createInstance() {
        return new SDCAccountRole();
    }

};
