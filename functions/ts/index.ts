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
import FieldPath = firestore.FieldPath;

import config from "./config";
import extract, { getObjectID } from "./extract";
import { areFieldsUpdated, ChangeType, getChangeType } from "./util";
import { version } from "./version";
import * as logs from "./logs";

const DOCS_PER_INDEXING = 250;
const client = algoliaSearch(config.algoliaAppId, config.algoliaAPIKey);

client.addAlgoliaAgent("firestore_integration", version);
export const index = client.initIndex(config.algoliaIndexName);

firebase.initializeApp();
const firestoreDB = getFirestore(config.databaseId);

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
    await index.partialUpdateObject(data, { createIfNotExists: true });
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
        await index.partialUpdateObject(data, { createIfNotExists: true });
      }
      // if an attribute was removed, then use save object of the record.
      else {
        const data = await extract(after, context);

        // delete null value attributes before saving.
        undefinedAttrs.forEach((attr) => delete data[attr]);

        logs.updateIndex(after.id, data);
        logs.debug("execute saveObject");
        await index.saveObject(data);
      }
    }
  } catch (e) {
    logs.error(e as Error);
  }
};

const handleDeleteDocument = async (deletedObjectID: string) => {
  try {
    logs.deleteIndex(deletedObjectID);
    await index.deleteObject(deletedObjectID);
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

exports.startFullIndexByUser = functions
  .region(config.location)
  .firestore.document(config.startAlgoliaCollectionPath)
  .onCreate(async (snap, context) => {
    const newUserEmail = snap.data().email; // 새로 등록된 이메일

    // 모든 문서를 색인하는 로직
    const collectionRef = firestoreDB.collection(config.collectionPath);
    const snapshot = await collectionRef.get();

    const docs = snapshot.docs.map((doc) => {
      const data = doc.data();
      data.objectID = doc.id; // Algolia에 필요한 objectID 설정
      return data;
    });

    // Algolia에 문서 색인
    return algoliaIndex
      .saveObjects(docs)
      .then(() => {
        console.log("Documents indexed in Algolia");
      })
      .catch((error) => {
        console.error("Error indexing documents in Algolia", error);
      });
  });
