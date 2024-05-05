"use strict";
/*
 * Copyright 2021 Algolia
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *    https://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.isValidValue = exports.areFieldsUpdated = exports.getFields = exports.getObjectSizeInBytes = exports.getChangeType = exports.ChangeType = void 0;
const logs = require("./logs");
const processors_1 = require("./processors");
var ChangeType;
(function (ChangeType) {
    ChangeType[ChangeType["CREATE"] = 0] = "CREATE";
    ChangeType[ChangeType["DELETE"] = 1] = "DELETE";
    ChangeType[ChangeType["UPDATE"] = 2] = "UPDATE";
})(ChangeType || (exports.ChangeType = ChangeType = {}));
const getChangeType = (change) => {
    if (!change.after.exists) {
        return ChangeType.DELETE;
    }
    if (!change.before.exists) {
        return ChangeType.CREATE;
    }
    return ChangeType.UPDATE;
};
exports.getChangeType = getChangeType;
const getObjectSizeInBytes = (object) => {
    const recordBuffer = Buffer.from(JSON.stringify(object));
    return recordBuffer.byteLength;
};
exports.getObjectSizeInBytes = getObjectSizeInBytes;
const getFields = () => ["title", "content"];
exports.getFields = getFields;
const areFieldsUpdated = (config, before, after) => {
    const fields = (0, exports.getFields)();
    logs.debug(`fields: ${fields}`);
    // If fields are not configured, then execute update record.
    if (fields.length === 0) {
        return true;
    }
    // If fields are configured, then check the before and after data for the specified fields.
    //  If any changes detected, then execute update record.
    for (const field of fields) {
        const [, beforeFieldValue] = (0, processors_1.valueProcessor)(field, before.get(field));
        const [, afterFieldValue] = (0, processors_1.valueProcessor)(field, after.get(field));
        if (JSON.stringify(beforeFieldValue) !== JSON.stringify(afterFieldValue)) {
            return true;
        }
    }
    return false;
};
exports.areFieldsUpdated = areFieldsUpdated;
const isValidValue = (value) => {
    return typeof value !== undefined && value !== null;
};
exports.isValidValue = isValidValue;
