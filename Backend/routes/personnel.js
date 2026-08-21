const express = require("express");
const { pool } = require("../db");
const { requireAuth } = require("../middleware/auth");

const router = express.Router();

router.get("/", requireAuth, async (req, res) => {
    try {
        const result = await pool.query(`
            SELECT
                TRIM(p.employeeid) AS id,
                TRIM(CONCAT_WS(' ', TRIM(p.firstname), NULLIF(TRIM(p.middlename), ''), TRIM(p.lastname))) AS name,
                TRIM(d.depname) AS department,
                TRIM(sp.positionname) AS level,
                TRIM(es.emplstatus) AS status,
                TRIM(p.contactnumber) AS phone,
                TRIM(p.email) AS email
            FROM personnel p
            JOIN department d ON d.id = p.deptid
            JOIN srposition sp ON sp.id = p.positionid
            JOIN emplstatus es ON es.id = p.statusid
            ORDER BY TRIM(p.employeeid)::int
        `);

        res.json({ success: true, employees: result.rows });
    } catch (error) {
        console.error("Personnel list error:", error);

        res.status(500).json({
            success: false,
            message: "Unable to load personnel list."
        });
    }
});

router.get("/options", requireAuth, async (req, res) => {
    try {
        const [departments, statuses, positions] = await Promise.all([
            pool.query(`
                SELECT id, TRIM(depname) AS name
                FROM department
                ORDER BY TRIM(depname)
            `),
            pool.query(`
                SELECT id, TRIM(emplstatus) AS name
                FROM emplstatus
                ORDER BY TRIM(emplstatus)
            `),
            pool.query(`
                SELECT id, TRIM(positionname) AS name
                FROM srposition
                ORDER BY TRIM(positionname)
            `)
        ]);

        res.json({
            success: true,
            options: {
                departments: departments.rows,
                statuses: statuses.rows,
                positions: positions.rows
            }
        });
    } catch (error) {
        console.error("Personnel options error:", error);

        res.status(500).json({
            success: false,
            message: "Unable to load personnel options."
        });
    }
});

router.get("/summary", requireAuth, async (req, res) => {
    try {
        const result = await pool.query(`
            SELECT
                COUNT(p.*)::int AS "totalEmployees",
                COUNT(p.*) FILTER (WHERE LOWER(TRIM(es.emplstatus)) = 'active')::int AS active,
                COUNT(p.*) FILTER (WHERE LOWER(TRIM(es.emplstatus)) = 'trainee')::int AS "traineeEmployees",
                COUNT(p.*) FILTER (WHERE LOWER(TRIM(es.emplstatus)) = 'resigned')::int AS resigned
            FROM personnel p
            LEFT JOIN emplstatus es
                ON es.id = p.statusid
        `);

        res.json({
            success: true,
            summary: result.rows[0]
        });
    } catch (error) {
        console.error("Personnel summary error:", error);

        res.status(500).json({
            success: false,
            message: "Unable to load personnel summary."
        });
    }
});

router.get("/breakdown", requireAuth, async (req, res) => {
    const breakdownQueries = {
        department: `
            SELECT TRIM(d.depname) AS label, COUNT(p.*)::int AS value
            FROM personnel p
            JOIN department d ON d.id = p.deptid
            GROUP BY TRIM(d.depname)
            ORDER BY value DESC, label
        `,
        status: `
            SELECT TRIM(es.emplstatus) AS label, COUNT(p.*)::int AS value
            FROM personnel p
            JOIN emplstatus es ON es.id = p.statusid
            GROUP BY TRIM(es.emplstatus)
            ORDER BY value DESC, label
        `,
        position: `
            SELECT TRIM(sp.positionname) AS label, COUNT(p.*)::int AS value
            FROM personnel p
            JOIN srposition sp ON sp.id = p.positionid
            GROUP BY TRIM(sp.positionname)
            ORDER BY value DESC, label
        `
    };

    const query = breakdownQueries[req.query.by];

    if (!query) {
        return res.status(400).json({
            success: false,
            message: "Breakdown must be department, status, or position."
        });
    }

    try {
        const result = await pool.query(query);
        res.json({ success: true, breakdown: result.rows });
    } catch (error) {
        console.error("Personnel breakdown error:", error);

        res.status(500).json({
            success: false,
            message: "Unable to load personnel breakdown."
        });
    }
});

router.get("/:employeeId", requireAuth, async (req, res) => {
    try {
        const result = await pool.query(
            `SELECT
                TRIM(p.employeeid) AS id,
                TRIM(p.firstname) AS firstname,
                TRIM(p.middlename) AS middlename,
                TRIM(p.lastname) AS lastname,
                p.dateofbirth,
                TRIM(p.gender) AS gender,
                TRIM(p.contactnumber) AS contactnumber,
                TRIM(p.email) AS email,
                p.datehired,
                p.leavedate,
                p.deptid,
                p.positionid,
                p.statusid,
                TRIM(d.depname) AS department,
                TRIM(sp.positionname) AS position,
                TRIM(es.emplstatus) AS status,
                p.createdate
             FROM personnel p
             LEFT JOIN department d ON d.id = p.deptid
             LEFT JOIN srposition sp ON sp.id = p.positionid
             LEFT JOIN emplstatus es ON es.id = p.statusid
             WHERE TRIM(p.employeeid) = $1
             LIMIT 1`,
            [req.params.employeeId]
        );

        if (result.rows.length === 0) {
            return res.status(404).json({
                success: false,
                message: "Personnel record not found."
            });
        }

        res.json({
            success: true,
            employee: result.rows[0]
        });
    } catch (error) {
        console.error("Load personnel record error:", error);

        res.status(500).json({
            success: false,
            message: "Unable to load personnel record."
        });
    }
});

router.patch("/:employeeId", requireAuth, async (req, res) => {
    const allowedFields = [
        "firstName",
        "middleName",
        "lastName",
        "dateOfBirth",
        "gender",
        "contactNumber",
        "email",
        "dateHired",
        "leaveDate",
        "department",
        "position",
        "employmentStatus"
    ];

    const updateEntries = allowedFields
        .filter((field) => Object.prototype.hasOwnProperty.call(req.body, field))
        .map((field) => ({ field, value: req.body[field] }));

    if (updateEntries.length === 0) {
        return res.status(400).json({
            success: false,
            message: "No editable fields were provided."
        });
    }

    const firstName = (req.body.firstName || "").trim();
    const middleName = (req.body.middleName || "").trim();
    const lastName = (req.body.lastName || "").trim();
    const dateOfBirth = req.body.dateOfBirth;
    const gender = req.body.gender;
    const contactNumber = req.body.contactNumber || "";
    const email = req.body.email || "";
    const dateHired = req.body.dateHired || null;
    const leaveDate = req.body.leaveDate || null;
    const department = req.body.department || null;
    const position = req.body.position || null;
    const employmentStatus = req.body.employmentStatus || null;

    if (!firstName || !lastName || !dateOfBirth || !gender || !dateHired) {
        return res.status(400).json({
            success: false,
            message: "First name, last name, date of birth, gender, and date hired are required."
        });
    }

    if ([firstName, middleName, lastName, gender, contactNumber, email].some((value) => value && value.length > 250)) {
        return res.status(400).json({
            success: false,
            message: "Text values must not exceed 250 characters."
        });
    }

    if (!/^\d+$/.test(contactNumber || "")) {
        return res.status(400).json({
            success: false,
            message: "Contact number must contain numbers only."
        });
    }

    if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email || "")) {
        return res.status(400).json({
            success: false,
            message: "Please enter a valid email address."
        });
    }

    if (department && !/^\d+$/.test(String(department))) {
        return res.status(400).json({
            success: false,
            message: "Department selection is invalid."
        });
    }

    if (position && !/^\d+$/.test(String(position))) {
        return res.status(400).json({
            success: false,
            message: "Position selection is invalid."
        });
    }

    if (employmentStatus && !/^\d+$/.test(String(employmentStatus))) {
        return res.status(400).json({
            success: false,
            message: "Employment status selection is invalid."
        });
    }

    try {
        const result = await pool.query(
            `UPDATE personnel
             SET firstname = $1,
                 middlename = $2,
                 lastname = $3,
                 dateofbirth = $4,
                 gender = $5,
                 contactnumber = $6,
                 email = $7,
                 datehired = $8,
                 leavedate = $9,
                 deptid = $10,
                 positionid = $11,
                 statusid = $12
             WHERE TRIM(employeeid) = $13
             RETURNING
                TRIM(employeeid) AS id,
                TRIM(firstname) AS firstname,
                TRIM(middlename) AS middlename,
                TRIM(lastname) AS lastname,
                dateofbirth,
                TRIM(gender) AS gender,
                TRIM(contactnumber) AS contactnumber,
                TRIM(email) AS email,
                datehired,
                leavedate,
                deptid,
                positionid,
                statusid,
                createdate`,
            [
                firstName,
                middleName || null,
                lastName,
                dateOfBirth,
                gender,
                contactNumber,
                email,
                dateHired,
                leaveDate || null,
                department || null,
                position || null,
                employmentStatus || null,
                req.params.employeeId
            ]
        );

        if (result.rows.length === 0) {
            return res.status(404).json({
                success: false,
                message: "Personnel record not found."
            });
        }

        res.json({
            success: true,
            message: "Personnel updated successfully.",
            employee: result.rows[0]
        });
    } catch (error) {
        console.error("Update personnel error:", error);

        res.status(500).json({
            success: false,
            message: "Unable to update personnel."
        });
    }
});

router.delete("/:employeeId", requireAuth, async (req, res) => {
    try {
        const result = await pool.query(
            `DELETE FROM personnel
             WHERE TRIM(employeeid) = $1
             RETURNING TRIM(employeeid) AS "employeeId"`,
            [req.params.employeeId]
        );

        if (result.rows.length === 0) {
            return res.status(404).json({
                success: false,
                message: "Personnel record not found."
            });
        }

        res.json({
            success: true,
            message: "Personnel removed successfully.",
            employeeId: result.rows[0].employeeId
        });
    } catch (error) {
        console.error("Remove personnel error:", error);

        res.status(500).json({
            success: false,
            message: "Unable to remove personnel."
        });
    }
});

router.post("/", requireAuth, async (req, res) => {
    const {
        employeeId,
        firstName,
        middleName,
        lastName,
        dateOfBirth,
        gender,
        contactNumber,
        email,
        dateHired,
        department,
        position,
        employmentStatus
    } = req.body;

    if (!/^\d{6}$/.test(employeeId || "")) {
        return res.status(400).json({ success: false, message: "Employee ID must contain exactly 6 digits." });
    }

    if ([firstName, middleName, lastName, gender, contactNumber, email].some((value) => value && value.length > 250)) {
        return res.status(400).json({ success: false, message: "Text values must not exceed 250 characters." });
    }

    if (!/^\d+$/.test(contactNumber || "")) {
        return res.status(400).json({ success: false, message: "Contact number must contain numbers only." });
    }

    if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email || "")) {
        return res.status(400).json({ success: false, message: "Please enter a valid email address." });
    }

    try {
        const result = await pool.query(
            `INSERT INTO personnel
                (employeeid, firstname, middlename, lastname, dateofbirth,
                 gender, contactnumber, email, datehired, deptid, positionid, statusid, createdate)
             VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, CURRENT_DATE)
             RETURNING id`,
            [
                employeeId,
                firstName,
                middleName || null,
                lastName,
                dateOfBirth,
                gender,
                contactNumber,
                email,
                dateHired,
                department,
                position,
                employmentStatus
            ]
        );

        res.status(201).json({
            success: true,
            message: "Personnel added successfully.",
            personnelId: result.rows[0].id
        });
    } catch (error) {
        console.error("Add personnel error:", error);

        if (error.code === "23505") {
            return res.status(409).json({ success: false, message: "That Employee ID already exists." });
        }

        res.status(500).json({
            success: false,
            message: "Unable to add personnel."
        });
    }
});

module.exports = router;