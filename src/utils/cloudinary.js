import { v2 as cloudinary } from "cloudinary";
import fs from "fs";
// Configuration
cloudinary.config({
  cloud_name: process.env.CLOUDINARY_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
});

const uploadCloudinaryImage = async (localFilepath) => {
  try {
    if (!localFilepath) return null;
    const uploadResult = await cloudinary.uploader.upload(localFilepath, {
      resource_type: "auto",
    });

    // console.log("file is uploaded successfully", uploadResult.url);
    fs.unlinkSync(localFilepath);
    return uploadResult;
  } catch (error) {
    fs.unlinkSync(localFilepath);
  }
};

export { uploadCloudinaryImage };
