const express = require('express');
const authController = require('../controllers/authController');
const googleController = require('../controllers/googleController');
const apiBindController = require('../controllers/apiBindController');
const showCoinController = require('../controllers/showCoinController');
const passport = require('passport');
const { validateRegistration, handleValidationErrors } = require('../middleware/validateRegistration');
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

router.post('/forget', authController.forgetValidator, authController.formForget)
router.post('/reset', authController.resetValidator, authController.resetPass)
router.get('/google',googleController.googleLogin);
router.post('/register', validateRegistration,handleValidationErrors,authController.formRegister);
router.post('/login',authController.loginValidator,authController.loginHandler);
router.post('/verify-otp',authController.verifyOtp);

router.get('/coins',showCoinController.showCoin);
router.post('/apiBind',authenticateJWT ,apiBindController.apiBind);
router.get('/account-info', authenticateJWT ,spotTradeController.getAccountInfo);
router.get('/future-account-info',authenticateJWT , futureTradeController.getFutureAccountInfo);
// Google Authentication Routes

//profile
router.post('/change-password',authenticateJWT , profileController.changepass);
router.get('/invite', authenticateJWT ,profileController.invite);

module.exports = router;
