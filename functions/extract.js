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
exports.transformToAloglia = exports.getAdditionalAlgoliaDataFullIndex = exports.getObjectID = exports.getPayload = void 0;
const transform_1 = require("./transform");
const util_1 = require("./util");
const PAYLOAD_MAX_SIZE = 102400;
const PAYLOAD_TOO_LARGE_ERR_MSG = "Record is too large.";
const trim = /^[\s\uFEFF\xA0]+|[\s\uFEFF\xA0]+$/g;
const getPayload = async (snapshot) => {
    let payload = {
        title: snapshot.get("title"),
        content: snapshot.get("content"),
        diaryCategory: snapshot.get("diaryCategory"),
        techCategory: snapshot.get("techCategory"),
        link: snapshot.get("link"),
    };
    // adding the objectId in the return to make sure to restore to original if changed in the post processing.
    return (0, transform_1.default)(payload);
};
exports.getPayload = getPayload;
const getObjectID = (context) => {
    const userEmail = context.params.userEmail;
    const diaryId = context.params.diaryId;
    return `diarysV2/${userEmail}/diaryV2/${diaryId}`;
};
exports.getObjectID = getObjectID;
const getAdditionalAlgoliaData = (context) => {
    const eventTimestamp = Date.parse(context.timestamp);
    const userEmail = context.params.userEmail;
    const diaryId = context.params.diaryId;
    return {
        objectID: (0, exports.getObjectID)(context),
        diaryId,
        userEmail,
        lastmodified: {
            _operation: "IncrementSet",
            value: eventTimestamp,
        },
    };
};
const getAdditionalAlgoliaDataFullIndex = (context, docId) => {
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
exports.getAdditionalAlgoliaDataFullIndex = getAdditionalAlgoliaDataFullIndex;
async function extract(snapshot, context) {
    // Check payload size and make sure its within limits before sending for indexing
    const payload = await (0, exports.getPayload)(snapshot);
    const additionalData = getAdditionalAlgoliaData(context);
    const result = {
        ...payload,
        ...additionalData,
    };
    // FIXME: 넘어가면 content 빼기
    if ((0, util_1.getObjectSizeInBytes)(result) < PAYLOAD_MAX_SIZE) {
        return result;
    }
    else {
        throw new Error(PAYLOAD_TOO_LARGE_ERR_MSG);
    }
}
exports.default = extract;
const transformToAloglia = (payload) => {
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
    const size = (0, util_1.getObjectSizeInBytes)(transformed);
    if (size > PAYLOAD_MAX_SIZE && transformed?.content) {
        transformed.content = transformed.content.substring(0, transformed.content.length / 2);
    }
    return transformed;
};
exports.transformToAloglia = transformToAloglia;
