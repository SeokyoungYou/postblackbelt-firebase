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
exports.enqueueNext = exports.fullIndexingComplete = exports.fieldNotExist = exports.deleteIndex = exports.updateIndex = exports.createIndex = exports.debug = exports.info = exports.error = exports.warn = exports.start = exports.init = exports.obfuscatedConfig = void 0;
const firebase_functions_1 = require("firebase-functions");
const config_1 = require("./config");
exports.obfuscatedConfig = {
    ...config_1.default,
    algoliaAPIKey: "********",
};
const init = () => {
    firebase_functions_1.logger.info("Initializing extension with configuration", exports.obfuscatedConfig);
};
exports.init = init;
const start = () => {
    firebase_functions_1.logger.info("Started extension execution with configuration", exports.obfuscatedConfig);
};
exports.start = start;
const warn = (...args) => {
    firebase_functions_1.logger.warn(args);
};
exports.warn = warn;
const error = (err) => {
    firebase_functions_1.logger.error("Error when performing Algolia index", err);
};
exports.error = error;
const info = (...args) => {
    firebase_functions_1.logger.info(args);
};
exports.info = info;
const debug = (...args) => {
    firebase_functions_1.logger.debug(args);
};
exports.debug = debug;
const createIndex = (id, data) => {
    firebase_functions_1.logger.info(`Creating new Algolia index for document ${id}`, data);
};
exports.createIndex = createIndex;
const updateIndex = (id, data) => {
    firebase_functions_1.logger.info(`Updating existing Algolia index for document ${id}`, data);
};
exports.updateIndex = updateIndex;
const deleteIndex = (id) => {
    firebase_functions_1.logger.info(`Deleting existing Algolia index for document ${id}`);
};
exports.deleteIndex = deleteIndex;
const fieldNotExist = (field) => {
    firebase_functions_1.logger.warn(`The field "${field}" was specified in the extension config but was not found on collection data.`);
};
exports.fieldNotExist = fieldNotExist;
const fullIndexingComplete = (successCount, errorCount) => {
    firebase_functions_1.logger.info(`Finished full indexing data. ${successCount} translations succeeded, ${errorCount} errors.`);
};
exports.fullIndexingComplete = fullIndexingComplete;
const enqueueNext = (offset) => {
    firebase_functions_1.logger.info(`About to enqueue next task, starting at offset ${offset}`);
};
exports.enqueueNext = enqueueNext;
