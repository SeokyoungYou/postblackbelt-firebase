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
exports.executeIndexOperation = exports.index = void 0;
const algoliasearch_1 = require("algoliasearch");
const functions = require("firebase-functions");
// import { getExtensions } from "firebase-admin/extensions";
// import { getFunctions } from "firebase-admin/functions";
const firebase = require("firebase-admin");
// import FieldPath = firestore.FieldPath;
const config_1 = require("./config");
const extract_1 = require("./extract");
const util_1 = require("./util");
const version_1 = require("./version");
const logs = require("./logs");
// const DOCS_PER_INDEXING = 250;
const client = (0, algoliasearch_1.default)(config_1.default.algoliaAppId, config_1.default.algoliaAPIKey);
client.addAlgoliaAgent("firestore_integration", version_1.version);
exports.index = client.initIndex(config_1.default.algoliaIndexName);
firebase.initializeApp();
// const firestoreDB = getFirestore(config.databaseId);
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
            const userEmail = context.params.userEmail;
            const diaryId = context.params.diaryId;
            const objectID = `diarysV2/${userEmail}/diaryV2/${diaryId}`;
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
// export const executeFullIndexOperation = functions.tasks
//   .taskQueue()
//   .onDispatch(async (data: any) => {
//     const runtime = getExtensions().runtime();
//     logs.init();
//     logs.info("config.doFullIndexing", config.doFullIndexing);
//     if (!config.doFullIndexing) {
//       await runtime.setProcessingState(
//         "PROCESSING_COMPLETE",
//         'Existing documents were not indexed because "Indexing existing documents?" is configured to false. ' +
//           "If you want to run a full reindex, reconfigure this instance."
//       );
//       return;
//     }
//     logs.info("config.collectionPath", config.collectionPath);
//     const docId = data["docId"] ?? null;
//     const pastSuccessCount = (data["successCount"] as number) ?? 0;
//     const pastErrorCount = (data["errorCount"] as number) ?? 0;
//     // We also track the start time of the first invocation, so that we can report the full length at the end.
//     const startTime = (data["startTime"] as number) ?? Date.now();
//     let query: firebase.firestore.Query;
//     logs.info(
//       "Is Collection Group?",
//       config.collectionPath.indexOf("/") !== -1
//     );
//     if (config.collectionPath.indexOf("/") === -1) {
//       query = firestoreDB.collection(config.collectionPath);
//     } else {
//       query = firestoreDB.collectionGroup(
//         config.collectionPath.split("/").pop()
//       );
//     }
//     query = query.limit(DOCS_PER_INDEXING);
//     logs.debug("docId?", docId);
//     if (docId) {
//       let queryCursor = query.where(FieldPath.documentId(), "==", docId);
//       logs.debug("queryCursor?", queryCursor);
//       const querySnapshot = await queryCursor.get();
//       logs.debug("querySnapshot?", querySnapshot);
//       logs.debug("querySnapshot.docs?", querySnapshot.docs);
//       querySnapshot.docs.forEach((doc) => (query = query.startAfter(doc)));
//     }
//     logs.debug("query", query);
//     const snapshot = await query.get();
//     const promises = await Promise.allSettled(
//       snapshot.docs.map((doc) => extract(doc, startTime))
//     );
//     logs.debug("promises.length", promises.length);
//     (promises as any).forEach((v) => logs.info("v", v));
//     const records = (promises as any)
//       .filter((v) => v.status === "fulfilled")
//       .map((v) => v.value);
//     logs.info("records.length", records.length);
//     const responses = await index.saveObjects(records, {
//       autoGenerateObjectIDIfNotExist: true,
//     });
//     logs.debug("responses.objectIDs", responses.objectIDs);
//     logs.info("responses.taskIDs", responses.taskIDs);
//     const newSuccessCount = pastSuccessCount + records.length;
//     const newErrorCount = pastErrorCount;
//     if (snapshot.size === DOCS_PER_INDEXING) {
//       const newCursor = snapshot.docs[snapshot.size - 1];
//       const queue = getFunctions().taskQueue(
//         `locations/${config.location}/functions/executeFullIndexOperation`,
//         config.instanceId
//       );
//       await queue.enqueue({
//         docId: newCursor.id,
//         successCount: newSuccessCount,
//         errorCount: newErrorCount,
//         startTime: startTime,
//       });
//     } else {
//       // No more documents to index, time to set the processing state.
//       logs.fullIndexingComplete(newSuccessCount, newErrorCount);
//       if (newErrorCount === 0) {
//         return await runtime.setProcessingState(
//           "PROCESSING_COMPLETE",
//           `Successfully indexed ${newSuccessCount} documents in ${
//             Date.now() - startTime
//           }ms.`
//         );
//       } else if (newErrorCount > 0 && newSuccessCount > 0) {
//         return await runtime.setProcessingState(
//           "PROCESSING_WARNING",
//           `Successfully indexed ${newSuccessCount} documents, ${newErrorCount} errors in ${
//             Date.now() - startTime
//           }ms. See function logs for specific error messages.`
//         );
//       }
//       return await runtime.setProcessingState(
//         "PROCESSING_FAILED",
//         `Successfully indexed ${newSuccessCount} documents, ${newErrorCount} errors in ${
//           Date.now() - startTime
//         }ms. See function logs for specific error messages.`
//       );
//     }
//   });
