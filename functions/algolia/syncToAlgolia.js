const functions = require("firebase-functions");
const admin = require("firebase-admin");
const algoliasearch = require("algoliasearch");
const { algoliaConfig } = require("../config");

admin.initializeApp();

const algoliaClient = algoliasearch(algoliaConfig.appId, algoliaConfig.apiKey);
const algoliaIndex = algoliaClient.initIndex(algoliaClient.indexName);
const region = "asia-northeast3";

exports.syncToAlgolia = functions
  .region(region)
  .firestore.document("diarysV2/{userEmail}/diaryV2/{diaryId}")
  .onWrite((change, context) => {
    const data = change.after.exists ? change.after.data() : null;
    const userEmail = context.params.userEmail;
    const diaryId = context.params.diaryId;
    const objectID = `${userEmail}__id:${diaryId}`;

    if (data) {
      const indexedData = {
        objectID: objectID,
        userEmail: userEmail,
        title: data.title, // 인덱싱할 'title' 필드 추가
        content: data.content, // 인덱싱할 'content' 필드 추가
      };

      return algoliaIndex
        .saveObject(indexedData)
        .then(() =>
          console.log(`Document ${objectID} added/updated in Algolia`)
        )
        .catch((error) => {
          console.error("Error when indexing document into Algolia", error);
          throw new functions.https.HttpsError(
            "internal",
            "Unable to index document into Algolia",
            error
          );
        });
    } else {
      return algoliaIndex
        .deleteObject(objectID)
        .then(() => console.log(`Document ${objectID} deleted from Algolia`))
        .catch((error) => {
          console.error("Error when deleting document from Algolia", error);
          throw new functions.https.HttpsError(
            "internal",
            "Unable to delete document from Algolia",
            error
          );
        });
    }
  });
