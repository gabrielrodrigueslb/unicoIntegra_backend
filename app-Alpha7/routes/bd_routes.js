const express = require("express");
const router = express.Router();
const { body } = require("express-validator");
const isAuth = require("../middleware/isAuth");
const bdControllers = require("../controllers/bd_query_controller");

router.post(
    "/getOrcamento",
    isAuth,
    [body("consulta").trim().notEmpty()],
    bdControllers.getOrcamento
);

module.exports = router;
