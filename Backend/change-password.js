const bcrypt = require("bcrypt");
const { pool } = require("./db");

async function changePassword() {
    const username = "admin";
    const newPassword = add new password here;

    try {
        const hashedPassword = await bcrypt.hash(newPassword, 12);

        const result = await pool.query(
            `UPDATE users
             SET password = $1
             WHERE username = $2`,
            [hashedPassword, username]
        );

        if (result.rowCount === 0) {
            console.log("User not found.");
        } else {
            console.log("Password updated successfully.");
        }

    } catch (error) {
        console.error("Error updating password:", error);
    } finally {
        await pool.end();
    }
}

changePassword();