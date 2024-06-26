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
// test@naver.com

const config = {
  location: "asia-northeast3",
  algoliaAppId: process.env.MY_APP_ALGOLIA_APP_ID || "",
  algoliaAPIKey: process.env.MY_APP_ALGOLIA_API_KEY || "",
  algoliaAPIKeyStartFullIndexByUser:
    process.env.MY_APP_ALGOLIA_API_KEY_START_FULLINDEX_BYUSER || "",
  algoliaIndexName: process.env.MY_APP_ALGOLIA_INDEX_NAME || "",
  databaseId: "(default)",
  projectId: process.env.MY_APP_FIREBASE_PROJECT_ID || "",
  startAlgoliaCollectionPath: "/algoliaUsers/{userEmail}",
};

export type Config = typeof config;
export default config;
