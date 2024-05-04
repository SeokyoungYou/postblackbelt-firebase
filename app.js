const firebase = require("firebase/app");
require("firebase/firestore");
const {
  getFirestore,
  collectionGroup,
  getCountFromServer,
} = require("firebase/firestore");

const { firebaseConfig } = require("./functions/config");

const app = firebase.initializeApp(firebaseConfig);
const db = getFirestore(app);

async function countAllDiaries() {
  try {
    const query = collectionGroup(db, "diarysV2");
    const querySnapshot = await getCountFromServer(query);
    console.log(
      "Total number of diaries in all diaryV2 collections: ",
      querySnapshot.data().count
    );
  } catch (error) {
    console.error("Error counting diaries:", error);
  }
}

countAllDiaries();
