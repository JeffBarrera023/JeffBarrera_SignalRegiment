const express = require("express");
const bcrypt = require("bcrypt");
const { pool } = require("../db");

const router = express.Router();

router.post("/login", async (req, res) => {
    const { username, password } = req.body;

    // Validate input
    if (!username || !password) {
        return res.status(400).json({
            success: false,
            message: "Username and password are required."
        });
    }

    try {
        // Find active user
        const result = await pool.query(
            `SELECT
                user_id,
                username,
                password,
                full_name,
                role,
                is_active
             FROM users
             WHERE username = $1
             AND is_active = TRUE`,
            [username.trim()]
        );

        if (result.rows.length === 0) {
            return res.status(401).json({
                success: false,
                message: "Invalid username or password."
            });
        }

        const user = result.rows[0];

        // Compare entered password with bcrypt hash
        const passwordMatch = await bcrypt.compare(
            password,
            user.password
        );

        if (!passwordMatch) {
            return res.status(401).json({
                success: false,
                message: "Invalid username or password."
            });
        }

        // Create session
        req.session.user = {
            id: user.user_id,
            username: user.username,
            fullName: user.full_name,
            role: user.role
        };

        return res.json({
            success: true,
            message: "Login successful.",
            user: req.session.user
        });

    } catch (error) {
        console.error("Login error:", error);

        return res.status(500).json({
            success: false,
            message: "An error occurred while processing the login."
        });
    }
});


// Check currently logged-in user
router.get("/me", (req, res) => {

    if (!req.session.user) {
        return res.status(401).json({
            success: false,
            message: "Not authenticated."
        });
    }

    res.json({
        success: true,
        user: req.session.user
    });
});


// Logout
router.post("/logout", (req, res) => {

    req.session.destroy((error) => {

        if (error) {
            console.error("Logout error:", error);

            return res.status(500).json({
                success: false,
                message: "Unable to logout."
            });
        }

        res.clearCookie("connect.sid");

        res.json({
            success: true,
            message: "Logout successful."
        });
    });
});


module.exports = router;