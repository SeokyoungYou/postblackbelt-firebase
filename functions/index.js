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
exports.startFullIndexByUser = exports.executeIndexOperation = exports.index = void 0;
const algoliasearch_1 = require("algoliasearch");
const functions = require("firebase-functions");
const firestore_1 = require("firebase-admin/firestore");
const firebase = require("firebase-admin");
const config_1 = require("./config");
const extract_1 = require("./extract");
const util_1 = require("./util");
const version_1 = require("./version");
const logs = require("./logs");
const DOCS_PER_INDEXING = 250;
const client = (0, algoliasearch_1.default)(config_1.default.algoliaAppId, config_1.default.algoliaAPIKey);
client.addAlgoliaAgent("firestore_integration", version_1.version);
exports.index = client.initIndex(config_1.default.algoliaIndexName);
firebase.initializeApp();
const firestoreDB = (0, firestore_1.getFirestore)(config_1.default.databaseId);
logs.init();
const handleCreateDocument = async (snapshot, context) => {
    try {
        const data = await (0, extract_1.default)(snapshot, context);
        logs.debug({
            ...data,
        });
        logs.createIndex(snapshot.id, data);
        await exports.index.partialUpdateObject(data, { createIfNotExists: true });
    }
    catch (e) {
        logs.error(e);
    }
};
const handleUpdateDocument = async (before, after, context) => {
    try {
        if ((0, util_1.areFieldsUpdated)(config_1.default, before, after)) {
            logs.debug("Detected a change, execute indexing");
            const beforeData = await before.data();
            // loop through the after data snapshot to see if any properties were removed
            const undefinedAttrs = beforeData
                ? Object.keys(beforeData).filter((key) => after.get(key) === undefined || after.get(key) === null)
                : [];
            logs.debug("undefinedAttrs", undefinedAttrs);
            // if no attributes were removed, then use partial update of the record.
            if (undefinedAttrs.length === 0) {
                const data = await (0, extract_1.default)(after, context);
                logs.updateIndex(after.id, data);
                logs.debug("execute partialUpdateObject");
                await exports.index.partialUpdateObject(data, { createIfNotExists: true });
            }
            // if an attribute was removed, then use save object of the record.
            else {
                const data = await (0, extract_1.default)(after, context);
                // delete null value attributes before saving.
                undefinedAttrs.forEach((attr) => delete data[attr]);
                logs.updateIndex(after.id, data);
                logs.debug("execute saveObject");
                await exports.index.saveObject(data);
            }
        }
    }
    catch (e) {
        logs.error(e);
    }
};
const handleDeleteDocument = async (deletedObjectID) => {
    try {
        logs.deleteIndex(deletedObjectID);
        await exports.index.deleteObject(deletedObjectID);
    }
    catch (e) {
        logs.error(e);
    }
};
// export const executeIndexOperation = functions.handler.firestore.document
//   .onWrite(async (change: Change<DocumentSnapshot>, context: EventContext): Promise<void> => {
exports.executeIndexOperation = functions
    .region(config_1.default.location)
    .firestore.document(config_1.default.collectionPath)
    .onWrite(async (change, context) => {
    logs.start();
    const changeType = (0, util_1.getChangeType)(change);
    switch (changeType) {
        case util_1.ChangeType.CREATE:
            await handleCreateDocument(change.after, context);
            break;
        case util_1.ChangeType.DELETE:
            const objectID = (0, extract_1.getObjectID)(context);
            await handleDeleteDocument(objectID);
            break;
        case util_1.ChangeType.UPDATE:
            await handleUpdateDocument(change.before, change.after, context);
            break;
        default: {
            throw new Error(`Invalid change type: ${changeType}`);
        }
    }
});
// test@naver.com
exports.startFullIndexByUser = functions
    .region(config_1.default.location)
    .firestore.document(config_1.default.startAlgoliaCollectionPath)
    .onCreate(async (snap, context) => {
    const userEmail = snap.data().email; // 새로 등록된 이메일
    const collectionName = `/diarysV2/${userEmail}/diaryV2`;
    // 모든 문서를 색인하는 로직
    const collectionRef = firestoreDB.collection(collectionName);
    const snapshot = await collectionRef.get();
    console.log("snap", snap);
    console.log("context", context);
    console.log("collectionRef", collectionRef);
    console.log("snapshot", snapshot);
    const docs = snapshot.docs.map((doc) => {
        const data = doc.data();
        console.log("data", data);
        data.objectID = doc.id; // Algolia에 필요한 objectID 설정
        return data;
    });
    // // Algolia에 문서 색인
    // return algoliaIndex
    //   .saveObjects(docs)
    //   .then(() => {
    //     console.log("Documents indexed in Algolia");
    //   })
    //   .catch((error) => {
    //     console.error("Error indexing documents in Algolia", error);
    //   });
});
