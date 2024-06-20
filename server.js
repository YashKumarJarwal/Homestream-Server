const express = require('express');
const bodyParser = require('body-parser');
const cors = require('cors');
const fs = require('fs');
const path = require('path');
const mongoose = require('mongoose');

const app = express();
const PORT = 3001;
app.use(cors());
const uri = "mongodb+srv://Admin:Logan007@cluster0.8lyo8nn.mongodb.net/directories?retryWrites=true&w=majority&appName=Cluster0";

mongoose.connect(uri, {
  useNewUrlParser: true,
  useUnifiedTopology: true,
});

const videoSchema = new mongoose.Schema({
  folderName: { type: String, required: true },
  path: { type: String, required: true },
  thumbnail: { type: String, default: '' }
});

const folderSchema = new mongoose.Schema({
  name: String,
  path: String,
});

const Folder = mongoose.model('Folder', folderSchema);
const Video = mongoose.model('Video', videoSchema);

// Routes
app.get('/folders', async (req, res) => {
  try {
    const videos = await Video.find({}, 'folderName'); // Only fetch 'folderName' field
    const videoNames = videos.map(video => video.folderName);
    res.json(videoNames);
  } catch (err) {
    res.status(400).json('Error: ' + err);
  }
});

app.get('/folders/:folderName/files', async (req, res) => {
  const { folderName } = req.params;
  try {
    const video = await Video.findOne({ folderName });
    if (!video) {
      return res.status(404).json({ error: 'Folder not found' });
    }
    const files = fs.readdirSync(video.path).filter(file => validVideoExtensions.includes(path.extname(file).toLowerCase()));
    res.json(files);
  } catch (err) {
    res.status(500).json('Error: ' + err);
  }
});


app.get('/videos/:folderName/:fileName', async (req, res) => {
  const { folderName, fileName } = req.params;
  try {
    const video = await Video.findOne({ folderName });
    if (!video) {
      return res.status(404).send('Video not found');
    }

    const filePath = path.join(video.path, fileName);
    const relativePath = path.relative(__dirname, path.join(video.path, fileName));
    const stat = fs.statSync(relativePath);
    const fileSize = stat.size;
    const range = req.headers.range;
    const chunkSize = 10**6;
    if (range) {
      const parts = range.replace(/bytes=/, "").split("-");
      const start = Number(range.replace(/\D/g, ""));
      const end = Math.min(start + chunkSize, fileSize - 1);

      if (start >= fileSize) {
        res.status(416).send('Requested range not satisfiable\n' + start + ' >= ' + fileSize);
        return;
      }


      const file = fs.createReadStream(filePath, { start, end });
      const head = {
        'Content-Range': `bytes ${start}-${end}/${fileSize}`,
        'Accept-Ranges': 'bytes',
        'Content-Length': end - start + 1,
        'Content-Type': 'video/mp4',
      };


      file.pipe(res);
      res.writeHead(206, head);
    } else {
      const head = {
        'Content-Length': fileSize,
        'Content-Type': 'video/mp4',
      };
      res.writeHead(200, head);
      fs.createReadStream(filePath).pipe(res);
    }
  } catch (err) {
    console.error(err);
    res.status(500).send('Server Error');
  }
});

mongoose.connection.on('connected', () => {
  console.log('Connected to MongoDB');
});

mongoose.connection.on('error', (err) => {
  console.error('Error connecting to MongoDB:', err);
});

app.use(bodyParser.json());
app.use(cors());

const validVideoExtensions = ['.mp4', '.mkv', '.avi', '.mov', '.wmv'];

const baseDirectory = process.cwd();

app.post('/api/directory', async (req, res) => {
  const { directory } = req.body;

  if (!directory) {
    return res.status(400).json({ error: 'Directory path is required' });
  }

  console.log('Received directory:', directory);

  const relativeDirectory = path.relative(baseDirectory, directory);
  const folderName = path.basename(directory);

  console.log('Converted relative directory:', relativeDirectory);
  console.log('Extracted folder name:', folderName);

  const readDirectory = async (dir) => {
    try {
      const files = fs.readdirSync(dir);
      const videoFiles = [];

      for (const file of files) {
        const filePath = path.resolve(dir, file);
        let fileDetails;

        try {
          fileDetails = fs.lstatSync(filePath);
        } catch (err) {
          console.error('Error getting file details:', err);
          continue;
        }

        if (!fileDetails.isDirectory() && validVideoExtensions.includes(path.extname(file).toLowerCase())) {
          console.log('Video File: ' + file);
          videoFiles.push(file);
        }
      }

      if (videoFiles.length > 0) {
        const videoFolder = new Video({ folderName, path: directory, thumbnail: '' });
        
        try {
          await videoFolder.save();
          res.json({ message: 'Directory read successfully', videoFiles });
        } catch (dbErr) {
          console.error('Error inserting into MongoDB:', dbErr);
          res.status(500).json({ error: 'Error saving folder info to MongoDB: ' + dbErr.message });
        }
      } else {
        res.status(400).json({ message: 'No valid video files found in the directory' });
      }
    } catch (err) {
      console.error('Error reading directory:', err);
      res.status(500).json({ error: 'Error reading directory: ' + err.message });
    }
  };

  fs.access(directory, fs.constants.F_OK, (err) => {
    if (err) {
      console.error('Directory does not exist:', err);
      return res.status(400).json({ error: 'Directory does not exist: ' + directory });
    }

    readDirectory(directory);
  });
});

app.listen(PORT, () => {
  console.log(`Server is running on http://localhost:${PORT}`);
});
