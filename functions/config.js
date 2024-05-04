// config.js

const firebaseConfig = {
  apiKey: process.env.MY_APP_FIREBASE_API_KEY,
  authDomain: process.env.MY_APP_FIREBASE_AUTH_DOMAIN,
  databaseURL: process.env.MY_APP_FIREBASE_DB_URL,
  projectId: process.env.MY_APP_FIREBASE_PROJECT_ID,
  storageBucket: process.env.MY_APP_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: process.env.MY_APP_FIREBASE_MESSAGING_SEN_ID,
  appId: process.env.MY_APP_FIREBASE_APP_ID,
  measurementId: process.env.MY_APP_FIREBASE_MEASURMENT_ID,
};

const algoliaConfig = {
  appId: process.env.MY_APP_ALGOLIA_APP_ID,
  apiKey: process.env.MY_APP_ALGOLIA_API_KEY,
  searchOnlyApiKey: process.env.MY_APP_ALGOLIA_SEARCH_KEY,
  indexName: process.env.MY_APP_ALGOLIA_INDEX_NAME,
};

module.exports = { firebaseConfig, algoliaConfig };
