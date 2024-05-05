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

import algoliaSearch from "algoliasearch";
import * as functions from "firebase-functions";
import { EventContext } from "firebase-functions";
import {
  DocumentData,
  DocumentSnapshot,
  getFirestore,
} from "firebase-admin/firestore";
import { getExtensions } from "firebase-admin/extensions";
import { getFunctions } from "firebase-admin/functions";
import * as firebase from "firebase-admin";
import { firestore } from "firebase-admin";
// import FieldPath = firestore.FieldPath;

import config from "./config";
import extract, {
  getAdditionalAlgoliaDataFullIndex,
  getObjectID,
  getPayload,
} from "./extract";
import {
  areFieldsUpdated,
  ChangeType,
  getChangeType,
  getObjectSizeInBytes,
} from "./util";
import { version } from "./version";
import * as logs from "./logs";
import { processObject } from "./processors";

const DOCS_PER_INDEXING = 250;
const clientExecuteIndex = algoliaSearch(
  config.algoliaAppId,
  config.algoliaAPIKeyExecuteIndexOperation
);
clientExecuteIndex.addAlgoliaAgent("firestore_integration", version);
export const indexExecuteIndex = clientExecuteIndex.initIndex(
  config.algoliaIndexName
);

const clientStartFullIndex = algoliaSearch(
  config.algoliaAppId,
  config.algoliaAPIKeyStartFullIndexByUser
);
clientStartFullIndex.addAlgoliaAgent("firestore_integration", version);
export const indexStartFullIndex = clientStartFullIndex.initIndex(
  config.algoliaIndexName
);

firebase.initializeApp();
const db = getFirestore(config.databaseId);

logs.init();

const handleCreateDocument = async (
  snapshot: DocumentSnapshot,
  context: EventContext
) => {
  try {
    const data = await extract(snapshot, context);

    logs.debug({
      ...data,
    });

    logs.createIndex(snapshot.id, data);
    await indexExecuteIndex.partialUpdateObject(data, {
      createIfNotExists: true,
    });
  } catch (e) {
    logs.error(e as Error);
  }
};

const handleUpdateDocument = async (
  before: DocumentSnapshot,
  after: DocumentSnapshot,
  context: EventContext
) => {
  try {
    if (areFieldsUpdated(config, before, after)) {
      logs.debug("Detected a change, execute indexing");

      const beforeData: DocumentData | undefined = await before.data();
      // loop through the after data snapshot to see if any properties were removed
      const undefinedAttrs = beforeData
        ? Object.keys(beforeData).filter(
            (key) => after.get(key) === undefined || after.get(key) === null
          )
        : [];
      logs.debug("undefinedAttrs", undefinedAttrs);
      // if no attributes were removed, then use partial update of the record.
      if (undefinedAttrs.length === 0) {
        const data = await extract(after, context);
        logs.updateIndex(after.id, data);
        logs.debug("execute partialUpdateObject");
        await indexExecuteIndex.partialUpdateObject(data, {
          createIfNotExists: true,
        });
      }
      // if an attribute was removed, then use save object of the record.
      else {
        const data = await extract(after, context);

        // delete null value attributes before saving.
        undefinedAttrs.forEach((attr) => delete data[attr]);

        logs.updateIndex(after.id, data);
        logs.debug("execute saveObject");
        await indexExecuteIndex.saveObject(data);
      }
    }
  } catch (e) {
    logs.error(e as Error);
  }
};

const handleDeleteDocument = async (deletedObjectID: string) => {
  try {
    logs.deleteIndex(deletedObjectID);
    await indexExecuteIndex.deleteObject(deletedObjectID);
  } catch (e) {
    logs.error(e as Error);
  }
};

// export const executeIndexOperation = functions.handler.firestore.document
//   .onWrite(async (change: Change<DocumentSnapshot>, context: EventContext): Promise<void> => {
export const executeIndexOperation = functions
  .region(config.location)
  .firestore.document(config.collectionPath)
  .onWrite(async (change, context: EventContext): Promise<void> => {
    logs.start();

    const changeType = getChangeType(change);

    switch (changeType) {
      case ChangeType.CREATE:
        await handleCreateDocument(change.after, context);
        break;
      case ChangeType.DELETE:
        const objectID = getObjectID(context);
        await handleDeleteDocument(objectID);
        break;
      case ChangeType.UPDATE:
        await handleUpdateDocument(change.before, change.after, context);
        break;
      default: {
        throw new Error(`Invalid change type: ${changeType}`);
      }
    }
  });

export const startFullIndexByUser = functions
  .region(config.location)
  .runWith({
    timeoutSeconds: 540,
    memory: "512MB",
  })
  .firestore.document(config.startAlgoliaCollectionPath)
  .onCreate(async (snap, context): Promise<void> => {
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
        const payload = await getPayload(doc);
        const additionalData = getAdditionalAlgoliaDataFullIndex(
          context,
          documentId
        );
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
      } catch (e) {
        logs.error(e as Error);
        throw e; // Rethrow to handle in the outer catch block
      }
    });

    const results = await Promise.all(indexUpdates);
    logs.info("Processing documents...", results);

    try {
      // TODO: 인덱싱 100개씩만 처리하도록 수정

      await indexStartFullIndex.partialUpdateObjects(results, {
        createIfNotExists: true,
      });
      logs.info("All documents indexed successfully.");
    } catch (e) {
      console.error("An error occurred while processing documents: ", e);
      logs.error(e as Error);
    }
  });
