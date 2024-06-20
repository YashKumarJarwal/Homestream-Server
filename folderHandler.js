const { dialog } = require('electron');
const fs = require('fs');
const path = require('path');

const jsonFilePath = path.join(__dirname, 'selectedFolder.json');

const selectFolder = () => {
  return new Promise((resolve, reject) => {
    dialog.showOpenDialog({ properties: ['openDirectory'] })
      .then(result => {
        if (result.canceled) {
          resolve(null);
        } else {
          const folderPath = result.filePaths[0];
          fs.writeFileSync(jsonFilePath, JSON.stringify({ folderPath }, null, 2));
          resolve(folderPath);
        }
      })
      .catch(err => reject(err));
  });
};

const getStoredPath = () => {
  if (fs.existsSync(jsonFilePath)) {
    const data = fs.readFileSync(jsonFilePath);
    const jsonData = JSON.parse(data);
    return jsonData.folderPath;
  }
  return null;
};

module.exports = {
  selectFolder,
  getStoredPath
};
