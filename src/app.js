import express from "express";
import cors from "cors";
import CookieParser from "cookie-parser";

const app = express();

app.use(
  cors({
    origin: process.env.CORS_ORIGIN,
    credentials: true,
  })
);

app.use(express.json({ limit: "50kb" }));
app.use(express.urlencoded({ extended: true, limit: "50kb" }));
app.use(express.static("public"));
app.use(CookieParser());

// register routes
import userRoutes from "./routes/user.routes.js";
app.use("/api/v1/users", userRoutes);

export default app;
