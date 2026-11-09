import { Router } from "express";
import { getEarthquakes, syncEarthquakes, dispatchAidToEarthquake } from "../controllers/earthquakeController";
import { seedDatabase } from "../controllers/seedController";

const router = Router();

router.get("/", getEarthquakes);
router.post("/seed", seedDatabase);
router.post("/sync", syncEarthquakes);
router.post("/:id/dispatch", dispatchAidToEarthquake);

export default router;
