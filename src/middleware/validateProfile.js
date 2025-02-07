const { body, validationResult } = require('express-validator');


exports.validateChangePassword = [
    body('newPassword')
    .notEmpty().withMessage('New Password is required')
    .isLength({ min: 8}).withMessage('New Password must be at least 8 chrector long'),



    body('confirmPassword')
    .notEmpty().withMessage('Password Not Confirmed')
    .custom((value, {req}) => {
        if(value !== req.body.newPassword){
            throw new Error('Confirm password must match new password');
        }
        return true;
    }),

    (req, res, next)=>{
        const errors = validationResult(req);
        if(!errors.isEmpty()){
            return res.status(400).json({errors: errors.array()});
        }
        next();
    }

]

exports.validateEmail = [
    body('changeMail')
        .notEmpty().withMessage('Mail is Required')
        .isEmail().withMessage('Invalid email format'),
    (req, res, next) => {
        const errors = validationResult(req);
        if (!errors.isEmpty()) {
            return res.status(400).json({ 
                success: false, 
                message: errors.array()[0].msg 
            });
        }
        next();
    }
];

exports.validatePhone = [
    body('changePhone')
        .notEmpty().withMessage('Number is Required !')
        .isNumeric().withMessage('Invalid Number Formet')
        .isLength({min: 10, max: 10 }).withMessage('Number must be 10 chrector long'),
        (req, res, next) =>{
            const errors= validationResult(req);
            if(!errors.isEmpty()){
                return res.status(400).json({
                    sucses: false,
                    message: errors.array()[0].msg
                })
            }
            next();
        }
    
]