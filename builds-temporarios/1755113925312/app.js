const express = require('express');
const bdRoutes = require('./routes/bd_routes.js');

const app = express();

app.use(express.json()); // body-parser integrado

app.use((req, res, next) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  next();
});

app.use('/bd', bdRoutes);

app.use((error, req, res, next) => {
  const statusCode = error.statusCode || 500;
  const errorMessage = error.message;
  res.status(statusCode).json({ errorMessage: errorMessage });
});

app.listen(12537, () => {
    console.log('App Alpha7 (BD) online na porta 12537');
});