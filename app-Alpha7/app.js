const express = require("express");
const app = express();
const bodyParser = require("body-parser");
const bdRoutes = require("./routes/bd_routes");

app.use(bodyParser.json());

app.use((req, res, next) => {
    res.setHeader("Access-Control-Allow-Origin", "*");
    res.setHeader("Access-Control-Allow-Methods", "GET", "POST");
    res.setHeader(
        "Access-Control-Allow-Headers",
        "Content-Type, Authorization"
    );
    next();
});

app.use('/bd', bdRoutes);

app.use((error, req, res, next) => {
    console.log(error.statusCode + '-' + error.message);
    const statusCode = error.statusCode || 500;
    const errorMessage = error.message;
    res.status(statusCode).json({ errorMessage: errorMessage });
});

console.log("App online")

app.listen(12537);
