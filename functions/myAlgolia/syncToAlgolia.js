const functions = require("firebase-functions");
const admin = require("firebase-admin");
const algoliasearch = require("algoliasearch");
const { algoliaConfig } = require("./config");

admin.initializeApp();

const algoliaClient = algoliasearch(algoliaConfig.appId, algoliaConfig.apiKey);
const algoliaIndex = algoliaClient.initIndex(algoliaConfig.indexName);
const region = "asia-northeast3";

exports.syncToAlgolia = functions
  .region(region)
  .firestore.document("diarysV2/{userEmail}/diaryV2/{diaryId}")
  .onWrite((change, context) => {
    const data = change.after.exists ? change.after.data() : null;
    const userEmail = context.params.userEmail;
    const diaryId = context.params.diaryId;
    const objectID = `${userEmail}__id:${diaryId}`;

    console.log(`Processing document with ID: ${objectID}`);

    if (data && (data.title || data.content)) {
      // Check if title or content exists
      console.log(`Data to be indexed:`, data);

      const indexedData = {
        objectID: objectID,
        diaryId: diaryId,
        userEmail: userEmail,
        path: `diarysV2/${userEmail}/diaryV2/${diaryId}`, // Constructed full document path
        lastModified: {
          _operation: "IncrementSet",
          value: Date.now(),
        },
        title: data.title, // Use empty string if title does not exist
        content: data.content, // Use empty string if content does not exist
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
      console.log(
        `Document ${objectID} does not contain title or content and will not be indexed.`
      );
      if (!data) {
        // If document was deleted
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
    }
  });
