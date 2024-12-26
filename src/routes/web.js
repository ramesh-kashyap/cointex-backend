const express = require('express');
const authController = require('../controllers/authController');
const googleController = require('../controllers/googleController');
const passport = require('passport');
const { validateRegistration, handleValidationErrors } = require('../middleware/validateRegistration');

const router = express.Router();
const app = express();
app.use(express.json()); // Handles `application/json` content
app.use(express.urlencoded({ extended: true }));
router.get('/', (req , res)=>{
res.send('hello');
});
router.get('/google',googleController.googleLogin);
router.post('/register', validateRegistration,handleValidationErrors,authController.formRegister);
router.post('/login',authController.loginValidator,authController.loginHandler);
router.post('/verify-otp',authController.verifyOtp);
// Google Authentication Routes


module.exports = router;
