const path = require("path");
const express = require("express");
const session = require("express-session");
require("dotenv").config();

const { testConnection } = require("./db");
const authRoutes = require("./routes/auth");
const personnelRoutes = require("./routes/personnel");

const app = express();

const PORT = process.env.PORT || 3000;


// ========================================
// MIDDLEWARE
// ========================================

app.use(express.json());
app.use(express.urlencoded({ extended: true }));


// ========================================
// SESSION
// ========================================

app.use(
    session({
        secret:
            process.env.SESSION_SECRET ||
            "development-secret-change-this",

        resave: false,

        saveUninitialized: false,

        cookie: {
            httpOnly: true,
            secure: false,
            maxAge: 1000 * 60 * 60 // 1 hour
        }
    })
);


// ========================================
// FRONTEND LOCATION
// ========================================

const frontendPath = path.join(
    __dirname,
    "..",
    "Frontend"
);


// ========================================
// LOGIN PAGE
// ========================================

// When the user visits:
// http://localhost:3000/
//
// show login.html

app.get("/", (req, res) => {

    res.sendFile(
        path.join(
            frontendPath,
            "login.html"
        )
    );

});


// ========================================
// AUTHENTICATION API
// ========================================

app.use(
    "/api/auth",
    authRoutes
);

app.use(
    "/api/personnel",
    personnelRoutes
);


// ========================================
// STATIC FRONTEND FILES
// ========================================

// This allows the browser to access:
//
// /index.html
// /style.css
// /script.js
// /login.css
// /login.js
//
// etc.

app.use(
    express.static(frontendPath, {
        setHeaders: (res) => {
            res.setHeader("Cache-Control", "no-store, no-cache, must-revalidate, proxy-revalidate");
            res.setHeader("Pragma", "no-cache");
            res.setHeader("Expires", "0");
        }
    })
);


// ========================================
// HEALTH CHECK
// ========================================

app.get("/api/health", (req, res) => {

    res.json({
        success: true,
        message: "Personnel Management API is running."
    });

});


// ========================================
// START SERVER
// ========================================

async function startServer() {

    try {

        await testConnection();

        app.listen(
            PORT,
            () => {

                console.log(
                    `Server running at http://localhost:${PORT}`
                );

            }
        );

    } catch (error) {

        console.error(
            "Unable to start server:",
            error.message
        );

        process.exit(1);
    }
}


startServer();