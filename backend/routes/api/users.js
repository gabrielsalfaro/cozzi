// backend/routes/api/users.js
const express = require('express');
const bcrypt = require('bcryptjs');

const { setTokenCookie } = require('../../utils/auth');
const { User } = require('../../db/models');
const { Op } = require('sequelize');  // Import Op from Sequelize

const { check } = require('express-validator');
const { handleValidationErrors } = require('../../utils/validation');

const router = express.Router();

// Validation middleware for user sign-up
const validateSignup = [
    check('firstName')
      .notEmpty()
      .withMessage('First Name is required'),
    check('lastName')
      .notEmpty()
      .withMessage('Last Name is required'),
    check('email')
      .exists({ checkFalsy: true })
      .isEmail()
      .withMessage('Please provide a valid email.'),
    check('username')
      .exists({ checkFalsy: true })
      .isLength({ min: 4 })
      .withMessage('Please provide a username with at least 4 characters.')
      .not()
      .isEmail()
      .withMessage('Username cannot be an email.'),
    check('password')
      .exists({ checkFalsy: true })
      .isLength({ min: 6 })
      .withMessage('Password must be 6 characters or more.'),
    handleValidationErrors
];

// Sign up route to create a new user
router.post(
    '/',
    validateSignup,
    async (req, res) => {
        const { firstName, lastName, email, username, password } = req.body;

        try {
            // Check if the email or username already exists
            const existingUser = await User.findOne({
                where: {
                    [Op.or]: [{ email }, { username }]
                }
            });

            // If a user already exists with the provided email or username
            if (existingUser) {
                const errors = {};

                // Check if the email already exists
                if (existingUser.email === email) {
                    errors.email = "User with that email already exists";
                }

                // Check if the username already exists
                if (existingUser.username === username) {
                    errors.username = "User with that username already exists";
                }

                return res.status(500).json({
                    message: "User already exists",
                    errors,
                });
            }

            // Hash the password
            const hashedPassword = bcrypt.hashSync(password);

            // Create the new user in the database
            const user = await User.create({
                firstName,
                lastName,
                email,
                username,
                hashedPassword
            });

            // Create a safe user object to send in the response
            const safeUser = {
                id: user.id,
                firstName: user.firstName,
                lastName: user.lastName,
                email: user.email,
                username: user.username,
            };

            // Log the user in by setting the token cookie
            await setTokenCookie(res, safeUser);

            // Return the user's information
            return res.status(201).json({
                user: safeUser,
            });
        } catch (error) {
            // Log the error to help debugging
            console.error("Error during user sign-up:", error);

            // Return a more specific error message
            return res.status(500).json({
                message: "Internal Server Error",
                errors: error.message || error,
            });
        }
    }
);

module.exports = router;
