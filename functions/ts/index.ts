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

import * as functions from "firebase-functions";

import config from "./config";
import { transformToAloglia } from "./extract";

import * as logs from "./logs";

logs.init();

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
