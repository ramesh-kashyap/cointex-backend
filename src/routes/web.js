const express = require('express');
const authController = require('../controllers/authController');
const passport = require('passport');

const router = express.Router();


router.get('/', (req , res)=>{
res.send('hello');
});
router.get('/google',authController.googleLogin);
router.get('/register',authController.validateRegistration,authController.formRegister);
router.get('/login',authController.loginValidator,authController.loginHandler);
// Google Authentication Routes


module.exports = router;
