function requireAuth(req, res, next) {

    if (!req.session.user) {

        return res.status(401).json({
            success: false,
            message: "Authentication required."
        });

    }

    next();
}


function requireRole(...allowedRoles) {

    return (req, res, next) => {

        if (!req.session.user) {

            return res.status(401).json({
                success: false,
                message: "Authentication required."
            });

        }

        if (!allowedRoles.includes(req.session.user.role)) {

            return res.status(403).json({
                success: false,
                message: "You do not have permission to perform this action."
            });

        }

        next();
    };
}


module.exports = {
    requireAuth,
    requireRole
};
