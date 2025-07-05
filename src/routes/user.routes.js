import { Router } from "express";
import {loginuser, logoutUser, registerUser,refreshAcessToken} from "../controllers/user.controller.js"
import {upload}  from "../middlewares/multer.middleware.js"
import { verifyJWT } from "../middlewares/auth.middleware.js";
const router=Router()
router.route("/register").post(
    upload.fields([
        {name:"avatar",maxCount:1},
        {name:"CoverImage",maxCount:1}
    ]),
    registerUser
)
router.route("/login").post(loginuser)
router.route("/logout").post(verifyJWT,logoutUser)
router.route("/refresh-token").post(refreshAcessToken) 
export default router;      