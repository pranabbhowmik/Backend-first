import { asyncHandeler } from "../utils/asyncHandeler.js";
import { ApiError } from "../utils/ApiError.js";
import { User } from "../models/user.model.js";
import { uploadCloudinaryImage } from "../utils/cloudinary.js";
import { ApiResponse } from "../utils/ApiResponse.js";
import jwt from "jsonwebtoken";

// generate access and refresh token
const generateAccessAndRefreshToken = async (userId) => {
  try {
    const user = await User.findById(userId);
    const accesToken = user.generateAccessToken();
    const refreshToken = user.generateRefreshToken();
    user.refreshToken = refreshToken;
    await user.save({ validateBeforeSave: false });
    return { accesToken, refreshToken };
  } catch (error) {
    throw new ApiError(500, " Somethinks went wrong Token generation failed");
  }
};

const registerUser = asyncHandeler(async (req, res) => {
  // get user details from frontend
  // validation - not empty
  // check if user already exists: username, email
  // check for images, check for avatar
  // upload them to cloudinary, avatar
  // create user object - create entry in db
  // remove password and refresh token field from response
  // check for user creation
  // return res

  const { fullName, username, email, password } = req.body;

  // Validation
  if ([fullName, username, email, password].some((field) => !field?.trim())) {
    throw new ApiError(400, "Please fill in all fields");
  }

  // Check if user already exists
  const userExists = await User.findOne({ $or: [{ username }, { email }] });
  if (userExists) {
    throw new ApiError(409, "User already exists");
  }
  console.log(req.files);

  // File upload paths
  const avatarLocalPath = req.files?.avatar?.[0]?.path;
  const coverImageLocalPath = req.files?.coverImage?.[0]?.path;

  if (!avatarLocalPath) {
    throw new ApiError(400, "Please upload an avatar");
  }

  // Upload files to Cloudinary
  const avatar = await uploadCloudinaryImage(avatarLocalPath);

  let coverImage;
  if (coverImageLocalPath) {
    coverImage = await uploadCloudinaryImage(coverImageLocalPath);
  } else {
    coverImage = { url: "" }; // Default value if no cover image is provided
  }

  if (!avatar) {
    throw new ApiError(400, "Error uploading avatar");
  }

  // Create the user
  const user = await User.create({
    fullName,
    avatar: avatar.url,
    coverImage: coverImage.url,
    email,
    password,
    username: username.toLowerCase(),
  });

  // Check user creation
  const createdUser = await User.findById(user._id).select(
    "-password -refreshToken"
  );

  if (!createdUser) {
    throw new ApiError(500, "User registration failed");
  }

  return res
    .status(201)
    .json(new ApiResponse(200, createdUser, "User registered successfully"));
});
const loginUser = asyncHandeler(async (req, res) => {
  // get user details from request body
  // show that the gmail is valid or not
  // check if user exists
  // check if password is correct
  // generate token
  // return response
  const { email, password } = req.body;
  // Check if user exists
  const user = await User.findOne({ email });
  if (!user) {
    throw new ApiError(404, "User not found");
  }
  // Check if password is correct
  const isPasswordvalid = await user.isPasswordCorrect(password);
  if (!isPasswordvalid) {
    throw new ApiError(401, "Password is incorrect");
  }

  // Generate token
  const { accesToken, refreshToken } = await generateAccessAndRefreshToken(
    user._id
  );
  // dont send password and refresh token
  const logInUser = await User.findById(user._id).select(
    "-password -refreshToken"
  );
  // cookie options
  const options = {
    httpsOnly: true,
    secure: true,
  };
  // send token in cookie
  return res
    .status(200)
    .cookie("refreshToken", refreshToken, options)
    .cookie("accesToken", accesToken, options)
    .json(
      new ApiResponse(
        200,
        { user: logInUser, accesToken, refreshToken },
        "User logged in Successfully"
      )
    );
});
// logout
const logoutUser = asyncHandeler(async (req, res) => {
  await User.findByIdAndUpdate(
    req.user._id,
    {
      $unset: {
        refreshToken: 1, // this removes the field from document
      },
    },
    {
      new: true,
    }
  );

  const options = {
    httpOnly: true,
    secure: true,
  };

  return res
    .status(200)
    .clearCookie("accessToken", options)
    .clearCookie("refreshToken", options)
    .json(new ApiResponse(200, {}, "User logged Out Successfully!"));
});

// refresh Access Token

const refreshAccessToken = asyncHandeler(async (req, res) => {
  const incomingRefreshToken =
    req.cookies.refreshToken || req.body.refreshToken;

  if (!incomingRefreshToken) {
    throw ApiError(400, "unauthorized request");
  }
  try {
    const decodedToken = jwt.verify(
      incomingRefreshToken,
      process.env.REFRESH_TOKEN_SECRET
    );

    const user = await User.findById(decodedToken?._id);

    if (!user) {
      throw ApiError(401, "Invalid refreshToken");
    }
    // check then refresh token is Match or not?
    if (incomingRefreshToken !== user?.refreshToken) {
      throw ApiError(401, "Refresh Token is Expired");
    }

    const options = {
      httpOnly: true,
      secure: true,
    };
    // generate new tokens when they not matched
    const { accesToken, newRefreshToken } = await generateAccessAndRefreshToken(
      user._id
    );
    return res
      .status(200)
      .cookie("accesToken", accesToken, options)
      .cookie("refreshToken", newRefreshToken, options)
      .json(
        new ApiResponse(
          200,
          { accesToken, refreshToken: newRefreshToken },
          "Access token refresh"
        )
      );
  } catch (error) {
    throw new ApiError(400, error?.message || "Invalid refresh token");
  }
});
export { registerUser, loginUser, logoutUser, refreshAccessToken };
