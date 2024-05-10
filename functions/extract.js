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
exports.transformToAloglia = void 0;
const util_1 = require("./util");
const PAYLOAD_MAX_SIZE = 102400;
const PAYLOAD_TOO_LARGE_ERR_MSG = "Record is too large.";
const trim = /^[\s\uFEFF\xA0]+|[\s\uFEFF\xA0]+$/g;
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
