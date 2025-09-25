import { Router } from "express";
import multer from "multer";
import { registerTourist, listTourists, getTouristById, getTouristByPassport, verifyTouristByPassport } from "../controllers/tourists.js";

const upload = multer({ storage: multer.memoryStorage() });

const router = Router();

// Expect multipart/form-data with files: photo, documentPhoto
router.post(
    "/register",
    upload.fields([
        { name: "photo", maxCount: 1 },
        { name: "documentPhoto", maxCount: 1 }
    ]),
    registerTourist
);

router.get('/', listTourists);
// Put more specific route BEFORE the id route
router.get('/passport/:documentNo', getTouristByPassport);
router.get('/:id', getTouristById);
router.post('/verify', verifyTouristByPassport);

export default router;


