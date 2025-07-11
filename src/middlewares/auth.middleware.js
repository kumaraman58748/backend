import {User} from "../models/user.model.js"
import jwt from "jsonwebtoken" 
import { ApiError } from "../utils/ApiError.js"
import { asyncHandler } from "../utils/asynchandler.js"
const verifyJWT=asyncHandler(async (req,res,next)=>{
    try{
        const token=req.cookies?.accessToken||req.header("Authorization")?.replace("Bearer ","")
        if(!token){
            throw new ApiError(401,"Unauthorized request")
        }
        const decodedToken=jwt.verify(token,process.env.ACCESS_TOKEN_SECRET)
        console.log("decoded token :", decodedToken)
        const user=await User.findById(decodedToken?._id).select("-password -refreshToken");
        console.log("user",user)     // from  database
        if(!user){
            throw new ApiError(401,"Invalid access token");
        }
        req.user=user;
        next();
    }catch(error){
        throw new ApiError(401, error?.message || "Invalid access token")
    }

})
export {verifyJWT}