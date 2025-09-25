// import { Router } from "express";
// import { createReport } from "../controllers/reports.js";

// const router = Router();

// router.post('/', createReport);

// export default router;

import { Router } from "express";
import { createReport, listReports } from "../controllers/reports.js";

const router = Router();

router.post("/", createReport);
router.get("/", listReports);

export default router;



