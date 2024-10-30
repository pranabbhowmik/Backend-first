import { asyncHandeler } from "../utils/asyncHandeler.js";
import { ApiError } from "../utils/ApiError.js";
import { User } from "../models/user.model.js";
import { uploadCloudinaryImage } from "../utils/cloudinary.js";
import { ApiResponse } from "../utils/ApiResponse.js";
import jwt from "jsonwebtoken";
import mongoose from "mongoose";

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

// registation
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

// Login
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

// Change the current password
const changeCurrentPassword = asyncHandeler(async (req, res) => {
  const { oldpassword, newpassword } = req.body;
  const user = await User.findById(req.user?._id);
  // check that this old passwordis currect or not
  const isPasswordCorrect = await user.isPasswordCorrect(oldpassword);
  if (!isPasswordCorrect) {
    throw new ApiError(401, "The old Password is incorrect");
  }
  //  if the old password is currect then change the password and save it in the database
  user.password = newpassword;
  await user.save({ validateBeforeSave: false });
  // return the password
  return res.status(201).json(new ApiResponse(200, {}));
});

// get the current user
const getCurrentUser = asyncHandeler(async (req, res) => {
  return res
    .status(200)
    .json(new ApiResponse(200, req.user, "User fetched Successfully"));
});

// Update fullname or gmail and save
const updateAccountDetails = asyncHandeler(async (req, res) => {
  const { fullName, email } = req.body;

  // check that the user does not enter the empty update
  if (!fullName || !email) {
    throw new ApiError(400, "All fildes are required");
  }
  const user = await User.findById(
    user?._id,
    {
      $set: {
        fullName: fullName,
        email: email,
      },
    },
    { new: true }
  ).select("-password");
  return res
    .status(200)
    .json(new ApiResponse(200, user, "Account details updated successfully"));
});

// Update user Avatar Image and save
const updateUserAvatar = asyncHandeler(async (req, res) => {
  const avatarLocalPath = req.file?.path;
  if (!avatarLocalPath) {
    throw new ApiError(400, "Avatar files is missing");
  }
  const avatar = uploadCloudinaryImage(avatarLocalPath);
  if (!avatar.url) {
    throw new ApiError(401, "Error while uploading Avatar!");
  }

  const user = await User.findByIdAndUpdate(
    user?._id,
    {
      $set: {
        avatar: avatar.url,
      },
    },
    { new: true }
  ).select("-password");
  return res
    .status(200)
    .json(new ApiResponse(200, user, "Avater Updateed Successfully"));
});

// Update User CoverImage and save in the database
const updateUserCoverImage = asyncHandeler(async (req, res) => {
  const coverImageLocalPath = req.file?.path;
  // check thet the path is not empty
  if (!coverImageLocalPath) {
    throw new ApiError(400, "Cover image file is missing");
  }
  // if user give me the new coverimage then i upload the path
  const coverImage = uploadCloudinaryImage(coverImageLocalPath);
  if (!coverImage.url) {
    throw new ApiError(401, "Error while uploading on CoverImage");
  }

  const user = await User.findByIdAndUpdate(
    user?._id,
    {
      $set: {
        coverImage: coverImage.url,
      },
    },
    { new: true }
  ).select("-password");

  return res
    .status(200)
    .json(new ApiResponse(200, user, "coverImage Updateed Successfully"));
});

// Channel profile And subcriber and subcribed This is called Aggregation Pipeline

// An aggregation pipeline consists of one or more stages that process documents:
// Each stage performs an operation on the input documents. For example, a stage can filter documents, group documents, and calculate values.The documents that are output from a stage are passed to the next stage.An aggregation pipeline can return results for groups of documents. For example, return the total, average, maximum, and minimum values.
const getUserChannelProfile = asyncHandeler(async (req, res) => {
  const { username } = req.params;
  //  Checked that the username exiset or not
  if (!username.trim()) {
    throw new ApiError(401, "username is missing");
  }
  const channel = await User.aggregate([
    {
      $match: {
        username: username?.toLowerCase(),
      },
    },
    // Amai koto jon  Subscribed kore rakha6a ta dakhar method
    {
      $lookup: {
        from: "subscriptions",
        localField: "_id",
        foreignField: "channel",
        as: "subscribers",
      },
    },
    // Ami koto jon k Subscribed kore rakha6i ta dakhanor method
    {
      $lookup: {
        from: "subscriptions",
        localField: "_id",
        foreignField: "subscriber",
        as: "subscribedTo",
      },
    },
    // Ai 2 to ke Jog korar jonno addfiled pipline er method
    {
      $addFields: {
        subscribersCount: {
          $size: "$subscribers",
        },
        channelsSubscribedToCount: {
          $size: "$subscribedTo",
        },
        isSubscribed: {
          $cond: {
            if: { $in: [req.user?._id, "$subscribers.subscriber"] },
            then: true,
            else: false,
          },
        },
      },
    },
    {
      $project: {
        fullName: 1,
        username: 1,
        subscribersCount: 1,
        channelsSubscribedToCount: 1,
        isSubscribed: 1,
        avatar: 1,
        coverImage: 1,
        email: 1,
      },
    },
  ]);

  if (!channel?.length) {
    throw ApiError(400, "Channel does not Exists!");
  }
  return res
    .status(200)
    .json(
      new ApiResponse(200, channel[0], "User channel fetched successfully")
    );
});

//User Watch History method
const getWatchHistory = asyncHandeler(async (req, res) => {
  const user = await User.aggregate([
    {
      $match: {
        _id: new mongoose.Types.ObjectId(req.user._id),
      },
    },
    {
      $lookup: {
        from: "videos",
        localField: "watchHistory",
        foreignField: "_id",
        as: "watchHistory",
        pipeline: [
          {
            $lookup: {
              from: "users",
              localField: "owner",
              foreignField: "_id",
              as: "owner",
              pipeline: [
                {
                  // those thinks you want to show in the watch history Like Fullname,avatar,thumbel,views,
                  $project: {
                    fullName: 1,
                    username: 1,
                    avatar: 1,
                  },
                },
              ],
            },
          },
          {
            $addFields: {
              $first: "$owner",
            },
          },
        ],
      },
    },
  ]);
  return res
    .status(200)
    .json(
      new ApiResponse(
        200,
        user[0].watchHistory,
        "Watch history fetched successfully"
      )
    );
});

// Export Everything
export {
  registerUser,
  loginUser,
  logoutUser,
  refreshAccessToken,
  changeCurrentPassword,
  getCurrentUser,
  updateAccountDetails,
  updateUserAvatar,
  updateUserCoverImage,
  getUserChannelProfile,
  getWatchHistory,
};
