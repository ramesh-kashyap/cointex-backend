const { body, validationResult } = require('express-validator');





// Define validation rules
const validateRegistration = [
    body('name')
        .isString().notEmpty().withMessage('Name is required'),
    body('phone')
        .isMobilePhone().withMessage('Phone number must be valid')
        .notEmpty().withMessage('Phone number is required'),
    body('password')
        .isLength({ min: 8 }).withMessage('Password must be at least 8 characters')
        .matches(/[A-Z]/).withMessage('Password must contain at least one uppercase letter')
        .matches(/[a-z]/).withMessage('Password must contain at least one lowercase letter')
        .matches(/[0-9]/).withMessage('Password must contain at least one number')
        .matches(/[@$!%*?&#]/).withMessage('Password must contain at least one special character'),
    body('referralCode')
        .optional().isString().withMessage('Referral code must be a valid string'),
];

// Middleware to handle validation errors
const handleValidationErrors = (req, res, next) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({ errors: errors.array() }); // Send error response if validation fails
  }
  next(); // Proceed to the next middleware or handler if validation passes
};

module.exports = { validateRegistration, handleValidationErrors };
