const jwt = require("jsonwebtoken");

function verifyToken(req, res, next) {
  const authHeader = req.headers["authorization"];
  const token = authHeader && authHeader.split(" ")[1];
  if (!token) return res.status(401).json({ ok: false, error: "Token requerido" });
  jwt.verify(token, process.env.JWT_SECRET, (err, decoded) => {
    if (err) {
      if (err.name === "TokenExpiredError")
        return res.status(401).json({ ok: false, error: "TOKEN_EXPIRED" });
      return res.status(403).json({ ok: false, error: "Token invalido" });
    }
    req.user = decoded;
    next();
  });
}

module.exports = verifyToken;
