const { syncToAlgolia } = require("./algolia/syncToAlgolia");
const {
  transformDataForAlgolia,
} = require("./algolia/transformDataForAlgolia");

exports.syncToAlgolia = syncToAlgolia;
exports.transformDataForAlgolia = transformDataForAlgolia;
