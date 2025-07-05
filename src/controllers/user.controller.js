import { response } from "express";
import {asyncHandler} from "../utils/asynchandler.js";
import {ApiError} from "../utils/ApiError.js";
import {User} from "../models/user.model.js"
import {uploadOnCloudinary} from "../utils/cloudinary.js"
import {ApiResponse} from "../utils/ApiResponse.js"
import jwt from "jsonwebtoken"
const generateandrefreshToken = async(userId)=>{
  try {
      const user=await User.findById(userId)
      const refreshToken=user.generateRefreshToken()
      const accessToken=user.generateAccessToken()
      user.refreshToken=refreshToken
      await user.save({validateBeforeSave : false})
      return {accessToken,refreshToken}
  } catch (error) {
      throw new ApiError(500,"Something went wrong")
  }
}
const registerUser=asyncHandler(async (req,res,next)=>{
      // get user details from frontend
      // validation-not empty
      // check if user already exists
      // check for images ,check for avatar
      // upload them to cloudinary ,avatarr
      // create user object -create entry in db
      // remove passwrd and refresh token  field from response
      // check for user creation 
      // return response to frontend
      const {fullname,email,username,password}=req.body
      if(
        [fullname,email,username,password].some((field)=>field?.trim()=== "")
      ){
        throw new ApiError(400,"All fields are required")
      }
      const existeduser=await User.findOne({
        $or:[{email},{username}]
      })
      if (existeduser) {
            throw new ApiError(409, "User with email or username    kkalready exists")
        }
        const avatarlocalpath=req.files?.avatar[0]?.path;
        const coverImagelocalpath=req.files?.CoverImage[0]?.path;
        if(!avatarlocalpath){
          throw new ApiError(400,"Avatar is required")
        }

        const avatar = await uploadOnCloudinary(avatarlocalpath)
        const coverImage = await uploadOnCloudinary(coverImagelocalpath)
        if (!avatar) {
          throw new ApiError(400, "Avatar file is required")
        }
      const user = await User.create({
        fullname,
        avatar: avatar.url,
        CoverImage: coverImage?.url || "",
        email, 
        password,
        username: username.toLowerCase()
    })
    const createdUser = await User.findById(user._id).select(
      "-password -refreshToken"
  )

  if (!createdUser) {
      throw new ApiError(500, "Something went wrong while registering the user")
  }
  return res.status(201).json(
    new ApiResponse(200, createdUser, "User registered Successfully")
)
})
const loginuser=asyncHandler(async (req,res)=>{
  // req body -> data
  // username or email
  // find the user
  // password check
  // access and refresh token accessed if correct
  // send cookie
  // send responsej
  const {email,password,username}=req.body
  console.log(email)
  if(!username && !email){
    throw new ApiError(400,"Email or username is required")
  }
  const user=await User.findOne({
    $or:[{email},{username}]
  })
  if(!user){
    throw new ApiError(404,"User not found")
  }
  const isPasswordValid=user.isPasswordCorrect(password)
  if(!isPasswordValid){
    throw new ApiError(401,"Password is incorrect" )
  }
  const {accessToken,refreshToken}=await generateandrefreshToken(user._id)
  console.log("Access Token:", accessToken)
  console.log("Refresh Token:", refreshToken)
  
  const loggedInUser = await User.findById(user._id).select("-password -refreshToken")

  const options = {
      httpOnly: true,       // only modify by server not in  frontend
      secure: true
  }

  return res
  .status(200)
  .cookie("accessToken", accessToken, options)
  .cookie("refreshToken", refreshToken, options)
  .json(
      new ApiResponse(
          200, 
          {
              user: loggedInUser, accessToken, refreshToken
          },
          "User logged In Successfully"
      )
  )
})
const logoutUser=asyncHandler(async(req,res)=>{
  await User.findByIdAndUpdate(
    req.user._id,
    {
      $unset:{
        refreshToken:1
      },
     },
      {
        new:true
      }
  )
  const options = {
    httpOnly: true,
    secure: true
}

return res
.status(200)
.clearCookie("accessToken", options)
.clearCookie("refreshToken", options)
.json(new ApiResponse(200, {}, "User logged Out"))
  
})

const refreshAcessToken=asyncHandler(async (req,res)=>{
  const incomingrefreshToken=req.cookies.refreshToken||req.body.refreshToken
  if(!incomingrefreshToken){
    throw new ApiError(401,"unauthorized request")
  }
  try {
    const decodedToken=jwt.verify(incomingrefreshToken,process.env.REFRESH_TOKEN_SECRET)
    const user=await User.findById(decodedToken?._id)
    if (!user) {
      throw new ApiError(401, "Invalid refresh token")
  }

  if (incomingrefreshToken !== user?.refreshToken) {
      throw new ApiError(401, "Refresh token is expired or used")
      
  }
  const options = {
    httpOnly: true,
    secure: true
}

const {accessToken, refreshToken} = await generateandrefreshToken(user._id)
console.log("Access Token:", accessToken)
console.log("Refresh Token:", refreshToken)

return res
.status(200)
.cookie("accessToken", accessToken, options)
.cookie("refreshToken", refreshToken, options)
.json(
    new ApiResponse(
        200, 
        {accessToken, refreshToken },
        "Access token refreshed"
    )
)
  } catch (error) {
    throw new ApiError(401, error?.message || "Invalid refresh token")
  }
})
const changeCurrentPassword=asyncHandler(async(req,res)=>{
  const {oldpassword,newpassword}=req.body
  if(!oldpassword || !newpassword){
    throw new ApiError(400,"Old password and new password is required")
  }
  const user=await User.findById(req.user?._id)
  if(!user){
    throw new ApiError(400,"no user found")
  }
  const isPasswordCorrect=user.isPasswordCorrect(oldpassword);
  if(!isPasswordCorrect){
    throw new ApiError(400,"old password is wrong");
  }
  user.password=newpassword
  await user.save({validateBeforeSave:false})
  return res
    .status(200)
    .json(new ApiResponse(200, {}, "Password changed successfully"))
})
const getCurrentUser=asyncHandler(async(req,res)=>{
  return res
  .status(200)
  .json(new ApiResponse(
    200,
    req.user,
    "User fetched Successfully"
  ))
})
const updateCoverImage=asyncHandler(async (req,res)=>{
  const coverimagepath=req.file?.path
  if(!coverimagepath){
    throw new ApiError(400,"file not found")
  }
  const coverimage=await uploadOnCloudinary(coverimagepath)
  if(!coverimage.url){
    throw new ApiError(400,"error in publishing it to cloudinary");
  }
  const user=await User.findByIdAndUpdate(
    req.user?._id,
    {
      $set:{
        coverimage:coverimage.url
      }
    },{new:true}
  )
  return res.status(200).json(
    new ApiResponse(200, user, "Avatar image updated successfully")
  )
})
const updateAvatar=asyncHandler(async(req,res)=>{
  const avatarPath=req.file?.path
  if(!avatarPath){
    throw new ApiError(400,"file not found")
  }
  const avatar=await uploadOnCloudinary(avatarPath)
  if(!avatar.url){
    throw new ApiError(400,"error in publishing it to cloudinary");
  }
  const user=await User.findByIdAndUpdate(
    req.user?._id,
    {
      $set:{
        avatar:avatar.url
      }
    },
    {new:true}
  )
  return res.status(200).json(
    new ApiResponse(200, user, "Avatar image updated successfully")
  )
})
export {
    registerUser,
    loginuser,
    logoutUser,
    refreshAcessToken,
    changeCurrentPassword,
    updateCoverImage,
    getCurrentUser,
    updateAvatar
}