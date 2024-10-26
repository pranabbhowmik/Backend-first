// import multer from "multer";

// const storage = multer.diskStorage({
//   destination: function (req, file, cb) {
//     cb(null, "../../public/temp");
//   },
//   filename: function (req, file, cb) {
//     cb(null, file.originalname);
//   },
// });

// export const upload = multer({
//   storage: storage,
// });

import multer from "multer";
import fs from "fs";
import path from "path";

// Define the path to the folder where files will be uploaded
const uploadDir = path.resolve("/public/temp");

// Ensure the directory exists, create it if necessary
if (!fs.existsSync(uploadDir)) {
  fs.mkdirSync(uploadDir, { recursive: true });
}

const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    cb(null, uploadDir); // Use the relative path resolved to an absolute path
  },
  filename: function (req, file, cb) {
    cb(null, file.originalname); // Use the original file name
  },
});

export const upload = multer({
  storage: storage,
});
