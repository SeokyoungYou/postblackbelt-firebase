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
import { getFirestore } from "firebase-admin/firestore";

import * as firebase from "firebase-admin";

import config from "./config";
import {
  getAdditionalAlgoliaDataFullIndex,
  getPayload,
  transformToAloglia,
} from "./extract";

import { version } from "./version";
import * as logs from "./logs";

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
      // TODO: 인덱싱 250개씩만 처리하도록 수정

      await indexStartFullIndex.partialUpdateObjects(results, {
        createIfNotExists: true,
      });
      logs.info("All documents indexed successfully.");
    } catch (e) {
      console.error("An error occurred while processing documents: ", e);
      logs.error(e as Error);
    }
  });

export const transformData = functions
  .region(config.location)
  .https.onRequest((request, response) => {
    if (request.method !== "POST") {
      response.status(405).send("Method Not Allowed");
      return;
    }

    try {
      const payload = request.body.data;
      const transformedPayload = transformToAloglia(payload);
      response.json({ result: transformedPayload });
    } catch (error) {
      console.error("Error transforming data:", error);
      response.status(500).send("Internal Server Error");
    }
  });
