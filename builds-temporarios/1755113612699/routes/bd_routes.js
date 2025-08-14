const express = require('express');
const { body } = require('express-validator');
const isAuth = require('../middleware/isAuth.js');
const bdControllers = require('../controllers/bd_query_controller.js');

const router = express.Router();

router.post(
  '/getOrcamento',
  isAuth,
  [body('consulta').trim().notEmpty()],
  bdControllers.getOrcamento,
);

module.exports = router;