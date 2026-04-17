const express = require("express");
const { checkClaim } = require("../controllers/analysisController");

const router = express.Router();

router.post("/check", checkClaim);
router.post("/", checkClaim);

module.exports = router;
