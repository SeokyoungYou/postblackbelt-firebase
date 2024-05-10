"use strict";
/* eslint-disable import/no-unresolved */
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
exports.transformData = exports.startFullIndexByUser = exports.indexStartFullIndex = exports.indexExecuteIndex = void 0;
const algoliasearch_1 = require("algoliasearch");
const functions = require("firebase-functions");
const firestore_1 = require("firebase-admin/firestore");
const firebase = require("firebase-admin");
const config_1 = require("./config");
const extract_1 = require("./extract");
const version_1 = require("./version");
const logs = require("./logs");
const DOCS_PER_INDEXING = 250;
const clientExecuteIndex = (0, algoliasearch_1.default)(config_1.default.algoliaAppId, config_1.default.algoliaAPIKeyExecuteIndexOperation);
clientExecuteIndex.addAlgoliaAgent("firestore_integration", version_1.version);
exports.indexExecuteIndex = clientExecuteIndex.initIndex(config_1.default.algoliaIndexName);
const clientStartFullIndex = (0, algoliasearch_1.default)(config_1.default.algoliaAppId, config_1.default.algoliaAPIKeyStartFullIndexByUser);
clientStartFullIndex.addAlgoliaAgent("firestore_integration", version_1.version);
exports.indexStartFullIndex = clientStartFullIndex.initIndex(config_1.default.algoliaIndexName);
firebase.initializeApp();
const db = (0, firestore_1.getFirestore)(config_1.default.databaseId);
logs.init();
exports.startFullIndexByUser = functions
    .region(config_1.default.location)
    .runWith({
    timeoutSeconds: 540,
    memory: "512MB",
})
    .firestore.document(config_1.default.startAlgoliaCollectionPath)
    .onCreate(async (snap, context) => {
    logs.start();
    const userEmail = context.params.userEmail;
    logs.debug("Processing userEmail: " + userEmail);
    const collectionName = `diarysV2/${userEmail}/diaryV2`;
    logs.debug("Accessing Firestore collection: " + collectionName);
    const collectionRef = db.collection(collectionName);
    const snapshot = await collectionRef.get();
    if (snapshot.empty) {
        console.log("No matching documents found in the collection.");
        logs.warn("No documents to index for collection: " + collectionName);
        return;
    }
    logs.info(`Found ${snapshot.docs.length} documents to index.`);
    const indexUpdates = snapshot.docs.map(async (doc) => {
        const documentId = doc.id;
        logs.debug("Processing document ID: " + documentId);
        try {
            const payload = await (0, extract_1.getPayload)(doc);
            const additionalData = (0, extract_1.getAdditionalAlgoliaDataFullIndex)(context, documentId);
            const result = {
                ...payload,
                ...additionalData,
            };
            logs.debug("Processing document: " + result);
            // if (getObjectSizeInBytes(data) < PAYLOAD_MAX_SIZE) {
            //   return data;
            // } else {
            //   throw new Error(PAYLOAD_TOO_LARGE_ERR_MSG);
            // }
            return result;
        }
        catch (e) {
            logs.error(e);
            throw e; // Rethrow to handle in the outer catch block
        }
    });
    const results = await Promise.all(indexUpdates);
    logs.info("Processing documents...", results);
    try {
        // TODO: 인덱싱 250개씩만 처리하도록 수정
        await exports.indexStartFullIndex.partialUpdateObjects(results, {
            createIfNotExists: true,
        });
        logs.info("All documents indexed successfully.");
    }
    catch (e) {
        console.error("An error occurred while processing documents: ", e);
        logs.error(e);
    }
});
exports.transformData = functions
    .region(config_1.default.location)
    .https.onRequest((request, response) => {
    if (request.method !== "POST") {
        response.status(405).send("Method Not Allowed");
        return;
    }
    try {
        const payload = request.body.data;
        const transformedPayload = (0, extract_1.transformToAloglia)(payload);
        response.json({ result: transformedPayload });
    }
    catch (error) {
        console.error("Error transforming data:", error);
        response.status(500).send("Internal Server Error");
    }
});
