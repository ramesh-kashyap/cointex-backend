const express = require('express');
const authController = require('../controllers/authController');
const googleController = require('../controllers/googleController');
const apiBindController = require('../controllers/apiBindController');
const showCoinController = require('../controllers/showCoinController');
const passport = require('passport');
const { validateRegistration, handleValidationErrors } = require('../middleware/validateRegistration');
const { validateChangePassword } = require('../middleware/validateProfile');
const {validateEmail} = require('../middleware/validateProfile');
const {validatePhone} = require('../middleware/validateProfile')
const  spotTradeController  = require('../controllers/spotTradeController');
const  futureTradeController  = require('../controllers/futureTradeController');
const  profileController  = require('../controllers/profile/profileController');
const  authenticateJWT  = require('../middleware/middlewareController');
const router = express.Router();
const app = express();
app.use(express.json()); // Handles `application/json` content
app.use(express.urlencoded({ extended: true }));

router.get('/', (req , res)=>{
res.send('hello');
});



// router.get('/ok', (req, res) => {
//     try {
//         res.send('Hello World');
//     } catch (err) {
//         console.error(err);
//         res.status(500).send('Internal Server Error');
//     }
// });

//Auth

// router.post('/forget', authController.forgetValidator, authController.formForget)
// router.post('/reset', authController.resetValidator, authController.resetPass)
router.get('/google',googleController.googleLogin);
router.post('/register', validateRegistration,handleValidationErrors,authController.formRegister);
router.post('/login',authController.loginValidator,authController.loginHandler);
router.post('/verify-otp',authController.verifyOtp);
router.post('/otp-send',authController.sendOtp);

router.get('/coins',showCoinController.showCoin);
router.post('/apiBind',authenticateJWT ,apiBindController.apiBind);
router.get('/account-info', authenticateJWT ,spotTradeController.getAccountInfo);
router.get('/future-account-info',authenticateJWT , futureTradeController.getFutureAccountInfo);
// Google Authentication Routes

//profile
router.post('/change-password' ,validateChangePassword,authenticateJWT , profileController.changepass);
router.get('/invite', authenticateJWT ,profileController.invite);
router.post('/change-name',authenticateJWT, profileController.changename);
router.post('/change-mail', validateEmail,authenticateJWT, profileController.changemail);
router.post('/change-phone', validatePhone, authenticateJWT, profileController.changephone);
router.get('/getinfo',authenticateJWT, profileController.getinfo);
router.get('/getreffrial',authenticateJWT, profileController.reffrail);
router.get('/invite-comession',authenticateJWT, profileController.inviteCommession);
router.post('/upload',authenticateJWT, profileController.uploadImage); 
// router.post("/upload", authenticateJWT, upload.single("image"), profileController.uploadImage);
 
module.exports = router;
