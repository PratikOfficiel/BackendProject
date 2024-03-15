import {Router} from "express";
import { loginUser, registerUser, logoutUser, refreshAccessToken,changeUserPassword, getCurrentUser, updateAccountDetails, updateCoverImage, updateUserAvatar, getUserChannelProfile, getWatchHistory } from "../controllers/user.controller.js";
import { upload } from "../middlewares/multer.middleware.js";
import { verifyJWT } from "../middlewares/auth.middleware.js";
const router = Router();


router.route("/register").post(
    upload.fields([
        { name: "avatar", maxCount: 1 },
        { name: "coverImage", maxCount: 1 }
    ]),
    registerUser
    );

console.log("going to register user");
router.route("/login").post(loginUser)

// secured routes

router.route("/logout").post(verifyJWT, logoutUser);
router.route("/refresh-token").post(refreshAccessToken);
router.route("/change-password").post(changeUserPassword);
router.route("/current-user").post(getCurrentUser);
router.route("/update-account").patch(verifyJWT, updateAccountDetails);
router.route("/avatar").patch(verifyJWT, upload.single("avatar"), updateUserAvatar);
router.route("/cover-image").patch(verifyJWT, upload.single("coverImage"), updateCoverImage);
router.route("/c/:username").get(verifyJWT,getUserChannelProfile);
router.route("/history").get(verifyJWT, getWatchHistory);

export default router;