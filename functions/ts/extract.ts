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

import { DocumentData, DocumentSnapshot } from "firebase-admin/firestore";

import config from "./config";
import * as logs from "./logs";
import { dataProcessor, processObject, valueProcessor } from "./processors";
import transform from "./transform";
import { getObjectSizeInBytes, isValidValue } from "./util";
import { EventContext } from "firebase-functions";

const PAYLOAD_MAX_SIZE = 102400;
const PAYLOAD_TOO_LARGE_ERR_MSG = "Record is too large.";
const trim = /^[\s\uFEFF\xA0]+|[\s\uFEFF\xA0]+$/g;

export const getPayload = async (snapshot: DocumentSnapshot): Promise<any> => {
  let payload: {
    [key: string]: boolean | string | number;
  } = {
    title: snapshot.get("title"),
    content: snapshot.get("content"),
    diaryCategory: snapshot.get("diaryCategory"),
    techCategory: snapshot.get("techCategory"),
    link: snapshot.get("link"),
  };

  // adding the objectId in the return to make sure to restore to original if changed in the post processing.
  return transform(payload);
};

export const getObjectID = (context: EventContext) => {
  const userEmail = context.params.userEmail;
  const diaryId = context.params.diaryId;
  return `diarysV2/${userEmail}/diaryV2/${diaryId}`;
};

const getAdditionalAlgoliaData = (context: EventContext) => {
  const eventTimestamp = Date.parse(context.timestamp);
  const userEmail = context.params.userEmail;
  const diaryId = context.params.diaryId;
  return {
    objectID: getObjectID(context),
    diaryId,
    userEmail,
    lastmodified: {
      _operation: "IncrementSet",
      value: eventTimestamp,
    },
  };
};

export const getAdditionalAlgoliaDataFullIndex = (
  context: EventContext,
  docId: string
) => {
  const eventTimestamp = Date.parse(context.timestamp);
  const userEmail = context.params.userEmail;
  const diaryId = docId;
  return {
    objectID: `diarysV2/${userEmail}/diaryV2/${diaryId}`,
    diaryId,
    userEmail,
    lastmodified: {
      _operation: "IncrementSet",
      value: eventTimestamp,
    },
  };
};

export default async function extract(
  snapshot: DocumentSnapshot,
  context: EventContext
): Promise<any> {
  // Check payload size and make sure its within limits before sending for indexing
  const payload = await getPayload(snapshot);

  const additionalData = getAdditionalAlgoliaData(context);

  const result = {
    ...payload,
    ...additionalData,
  };

  // FIXME: 넘어가면 content 빼기

  if (getObjectSizeInBytes(result) < PAYLOAD_MAX_SIZE) {
    return result;
  } else {
    throw new Error(PAYLOAD_TOO_LARGE_ERR_MSG);
  }
}

type Payload = {
  title?: string;
  content?: string;
  diaryCategory: string;
  techCategory?: string;
  link?: string;
  objectID: string; // diarysV2/{userEmail}/diaryV2/{diaryId}
};

export const transformToAloglia = (payload: Payload) => {
  const splitedObjectID = payload.objectID.split("/");
  const transformed = {
    objectID: payload.objectID,
    title: payload.title,
    content: payload.content,
    diaryCategory: payload.diaryCategory,
    techCategory: payload.techCategory,
    link: payload.link,
    userEmail: splitedObjectID[1],
    diaryId: splitedObjectID[splitedObjectID.length - 1],
  };
  const size = getObjectSizeInBytes(transformed);

  if (size > PAYLOAD_MAX_SIZE && transformed?.content) {
    transformed.content = transformed.content.substring(
      0,
      transformed.content.length / 2
    );
  }

  return transformed;
};
