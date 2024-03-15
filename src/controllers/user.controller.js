import { asyncHandler } from "../utils/asyncHandler.js";
import {ApiError} from "../utils/ApiError.js";
import { User } from "../models/user.model.js";
import {uploadOnCloudinary} from "../utils/cloudinary.js";
import { ApiResponse } from "../utils/ApiResponse.js";
import jwt from "jsonwebtoken";
import mongoose from "mongoose";

const generateAccessandRefreshToken = async (userId)=>{

    try {
        
        const user = await User.findById(userId);
        const accessToken = await user.generateAccessToken();
        const refreshToken = await user.generateRefreshToken();

        user.refreshToken = refreshToken;

        await user.save({validateBeforeSave: false});

        return {
            accessToken,
            refreshToken
        }
    } catch (error) {
        throw new ApiError(500, "Something went wrong while generating refresh token and access token.", error);
    }
}

const registerUser = asyncHandler(async (req,res)=>{
    

    const {fullName, email, username, password} = req.body;

    if([fullName, email, username, password].some((field)=> field?.trim() == '') ) {
        throw new ApiError(400, "Please fill all the fields");
    }

    const existedUser = await User.findOne({
        $or: [{username: username}, {email: email}]
    })

    if(existedUser){
        throw new ApiError(409, "Username or email already exists");
    }

    const avatarLocalPath = req.files?.avatar[0]?.path;

    const coverImageLocalPath = req.files?.coverImage?req.files.coverImage[0].path:'';

    if(!avatarLocalPath){
        throw new ApiError(400, "Avatar not found in req.files");
    }

    const avatar = await uploadOnCloudinary(avatarLocalPath);

    const coverImage = coverImageLocalPath?await uploadOnCloudinary(coverImageLocalPath):"";

    if(!avatar){
        throw new ApiError(400, "avatar not recieved from cloudinary");
    }

    const user = await User.create({
        fullName,
        avatar: avatar.url,
        coverImage: coverImage?.url || "",
        email,
        username: username.toLowerCase() ,
        password
    })

    const createdUser =  await User.findById(user._id).select(
        "-password  -refreshToken"
    )

    if(!createdUser){
        throw new ApiError(500, "Something went wrong");
    }


    return res.status(201).json(
        new ApiResponse(201, createdUser, "User registered successfully")
    )
})

const loginUser = asyncHandler(async (req,res) => {
    const {username, email, password} = req.body;

    if(!username && !email){
        throw new ApiError(400, "username or email is required");
    }

    console.log(email);
    const user = await User.findOne({
        $or: [{username}, {email}]
    });

    console.log(user);

    if(!user){
        throw new ApiError(404, "User does not exist");
    };

    const isPasswordValid = await user.isPasswordCorrect(password);

    if(!isPasswordValid){
        throw new ApiError(401, "Invalid user credentials");
    }

    const {accessToken, refreshToken} = await generateAccessandRefreshToken(user._id);

    const loggedInUser = await User.findById(user._id).select(
        "-password -refreshToken"
    )

    const options = {
        httpOnly :true,
        secure: true
    }

    return res
    .status(200)
    .cookie("accessToken",accessToken,options)
    .cookie("refreshToken",refreshToken,options)
    .json(
        new ApiResponse(
            200,
            {
                user: loggedInUser,
                accessToken,
                refreshToken
            },
            "User logged in successfully"
        )
    )

})

const logoutUser = asyncHandler(async(req,res)=>{
    
    await User.findByIdAndUpdate(
        req.user._id,
        {
            $unset: {
                refreshToken: 1
            }
        },
        {
            new: true
        }
    )
    
    const options = {
        httpOnly :true,
        secure: true
    }

    return res
    .status(200)
    .clearCookie("accessToken",options)
    .clearCookie("refreshToken",options)
    .json(new ApiResponse(200,{},"user logged out"))
})

const refreshAccessToken = asyncHandler(async(req,res)=>{
    const incomingRefreshToken = req.cookies.refreshToken || req.body.refreshToken;

    if(!incomingRefreshToken){ 
        throw new ApiError(401, "unauthorized request");
    }

    const decodedToken = jwt.verify(
        incomingRefreshToken,
        process.env.REFRESH_TOKEN_SECRET
    )

    const user = await User.findById(decodedToken?._id).select(
        "-password"
    )

    if(!user) {
        throw new ApiError(401, "Invalid refresh token");
    }

    if(incomingRefreshToken !== user?.refreshToken){
        throw new ApiError(401, "Refresh token is expired or used");
    }

    const options = {
        httpOnly :true,
        secure: true
    }

    const {accessToken, newrefreshToken} = await generateAccessandRefreshToken(user._id);

    return res
    .status(200)
    .cookie("accessToken", accessToken)
    .cookie("refreshToken", newrefreshToken)
    .json(
        new ApiResponse(
            200,
            {
                accessToken,
                refreshToken: newrefreshToken
            },
            "Refresh token refreshed successfully"
        )
    )
});

const changeUserPassword = asyncHandler(async (req,res)=>{
    const {oldPassword, newPassword} = req.body;
    const user = await User.findById(req.user._id);

    const isPasswordValid = await user.isPasswordCorrect(oldPassword);

    if(!isPasswordValid){
        throw new ApiError(401, "Invalid old password");
    }

    user.password = newPassword;

    await user.save({validateBeforeSave:false});

    return res
    .status(200)
    .json(new ApiResponse(200,{},"Password changed successfully"))


})

const getCurrentUser = asyncHandler(async(req,res)=>{
    return res
    .status(200)
    .json(200, req.user, "current user fetched successfully")
})

const updateAccountDetails = asyncHandler(async(req,res)=>{
    const {fullName, email} = req.body;
    const updates = {};
    if(!fullName && !email) {
        throw new ApiError(400, "Please provide the detail to be updated");
    }

    if(fullName){
        updates.fullName = fullName;
    }

    if(email){
        updates.email = email;
    }

    const user = await User.findByIdAndUpdate(
        req.user._id,
        {
            $set: updates
        },
        {new:true}
        ).select("-password");

    return res
  .status(200)
  .json(new ApiResponse(200, user, "Account Details updated"))
})

const updateUserAvatar = asyncHandler(async(req,res)=>{

    const avatarLocalPath = req.file?.path

    if(!avatarLocalPath){
        throw new ApiError(400, "Avatar not found in req.files");
    }

    const avatar = await uploadOnCloudinary(avatarLocalPath);

    if(!avatar.url){
        throw new ApiError(400, "avatar not recieved from cloudinary while updating");
    }

    const user = await User.findByIdAndUpdate(
        req.user._id,
        {
            $set: {
                avatar: avatar.url
            }
        },
        {new:true}
        ).select("-password");

        return res
        .status(200)
        .json(
            new ApiResponse(
                200,
                user,
                "avatar image updated successfully"
            )
        )
})

const updateCoverImage = asyncHandler(async(req,res)=>{

    const coverLocalPath = req.file?.path

    if(!coverLocalPath){
        throw new ApiError(400, "Avatar not found in req.files");
    }

    const cover = await uploadOnCloudinary(coverLocalPath);

    if(!cover.url){
        throw new ApiError(400, "avatar not recieved from cloudinary while updating");
    }

    const user = await User.findByIdAndUpdate(
        req.user._id,
        {
            $set: {
                cover: cover.url
            }
        },
        {new:true}
        ).select("-password");


    return res
    .status(200)
    .json(
        new ApiResponse(
            200,
            user,
            "Cover image updated successfully"
        )
    )

})

const getUserChannelProfile = asyncHandler(async(req,res)=>{

    const {username} = req.params;

    if(!username?.trim()){
        throw new ApiError(400, "username is required");
    }

    const channel = await User.aggregate([

        {
            $match: {
                username: username?.toLowerCase()
            }
        },
        {
            $lookup:{
                from: "subscriptions",
                localField: "_id",
                foreignField: "channel",
                as: "subscribers"
            }
        },
        {
            $lookup: {
                from: "subscriptions",
                localField: "_id",
                foreignField: "subscriber",
                as: "subscribedTo"
            }
        },
        {
            $addFields: {
                subscribersCount: {
                    $size: "$subscribers"
                },
                subscribedToCount: {
                    $size: "$subscribedTo"
                },
                isSubscribed: {
                    $cond: {
                        if: {$in: [req.user?._id, "subscribers.subscriber"]},
                        then: true,
                        else: false
                    }
                }
            }
        },
        {
            $project: {
                fullName:1,
                username:1,
                avatar:1,
                coverImage:1,
                subscribersCount:1,
                subscribedToCount:1,
                isSubscribed:1,
                email:1
            }
        }
    ])

    if(!channel?.length){
        throw new ApiError(404, "Channel not found");
    }

    console.log("aggregate returns", channel);

    return res
    .status(200)
    .json(
        new ApiResponse(
            200,
            channel[0],
            "Channel fetched successfully"
        )
    )
})

const getWatchHistory = asyncHandler(async(req,res)=>{
    const user = await User.aggregate([
        {
            $match: {
                _id: new mongoose.Types.ObjectId(req.user.id)
            }
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
                                    $project: {
                                        fullName: 1,
                                        username: 1,
                                        avatar: 1
                                    }
                                }
                            ]
                        }
                    },
                    {
                        $addFields: {
                            owner: {
                                $first: "$owner"
                            }
                        }
                    }
                ]
            }
        }
    ])


    return res
    .status(200)
    .json(
        new ApiResponse(
            200,
            user[0].watchHistory,
            "Watch History fetched successfully"
        )
    )
})

export { 
    registerUser, 
    loginUser, 
    logoutUser, 
    refreshAccessToken, 
    changeUserPassword, 
    getCurrentUser, 
    updateAccountDetails,
    updateUserAvatar,
    updateCoverImage,
    getUserChannelProfile,
    getWatchHistory
};