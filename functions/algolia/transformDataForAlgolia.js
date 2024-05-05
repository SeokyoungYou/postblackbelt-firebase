const functions = require("firebase-functions");
const admin = require("firebase-admin");

admin.initializeApp();

const region = "asia-northeast3";

exports.transformDataForAlgolia = functions
  .region(region)
  .firestore.document("diarysV2/{userEmail}/diaryV2/{diaryId}")
  .onWrite((change, context) => {
    const data = change.after.exists ? change.after.data() : null;
    const userEmail = context.params.userEmail;
    const diaryId = context.params.diaryId;
    const objectID = `${userEmail}__id:${diaryId}`;

    console.log(`Processing document with ID: ${objectID}`);

    if (data) {
      // Construct the data structure for Algolia index
      const transformedData = {
        objectID: objectID,
        diaryId: diaryId,
        userEmail: userEmail,
        path: `diarysV2/${userEmail}/diaryV2/${diaryId}`,
        lastModified: Date.now(),
        title: data.title, // Provide a default value if the field is missing
        content: data.content, // Provide a default value if the field is missing
      };

      console.log(`Transformed data for Algolia:`, transformedData);
      return transformedData; // Returning the transformed data
    } else {
      console.log(`No data found or document was deleted.`);
      return null; // Returning null or appropriate response if no data to process
    }
  });
