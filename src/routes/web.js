const express = require('express');
const authController = require('../controllers/authController');
const googleController = require('../controllers/googleController');
const apiBindController = require('../controllers/apiBindController');
const showCoinController = require('../controllers/showCoinController');
const passport = require('passport');
const { validateRegistration, handleValidationErrors } = require('../middleware/validateRegistration');
const  spotTradeController  = require('../controllers/spotTradeController');
const  futureTradeController  = require('../controllers/futureTradeController');
const  middlewareController  = require('../middleware/middlewareController');
const router = express.Router();
const app = express();
app.use(express.json()); // Handles `application/json` content
app.use(express.urlencoded({ extended: true }));
router.get('/ok', (req, res) => {
    try {
        res.send('Hello World');
    } catch (err) {
        console.error(err);
        res.status(500).send('Internal Server Error');
    }
});
router.get('/auth/google',googleController.googleLogin);
router.post('/register', validateRegistration,handleValidationErrors,authController.formRegister);
router.post('/login',authController.loginValidator,authController.loginHandler);
router.post('/verify-otp',authController.verifyOtp);
router.post('/otp-send',authController.sendOtp);
router.get('/coins',showCoinController.showCoin);
router.post('/apiBind',middlewareController,apiBindController.apiBind);
router.get('/account-info', middlewareController,spotTradeController.getAccountInfo);
router.get('/future-account-info',middlewareController, futureTradeController.getFutureAccountInfo);
// Google Authentication Routes


module.exports = router;
