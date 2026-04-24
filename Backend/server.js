require("dotenv").config();

const app = require("./src/app");
const connectToDB = require("./src/config/database");

connectToDB();

app.listen(PORT, "0.0.0.0", () => {
  console.log("Server is running on port", PORT);
});