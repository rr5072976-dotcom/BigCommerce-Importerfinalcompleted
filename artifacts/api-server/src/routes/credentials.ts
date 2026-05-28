import { Router, type IRouter } from "express";
import { ValidateCredentialsBody } from "@workspace/api-zod";
import { validateStore } from "../lib/bigcommerce.js";

const router: IRouter = Router();

router.post("/credentials/validate", async (req, res): Promise<void> => {
  const parsed = ValidateCredentialsBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }

  const { storeHash, accessToken } = parsed.data;
  const result = await validateStore({ storeHash, accessToken });

  res.json({
    valid: result.valid,
    storeName: result.storeName ?? null,
    error: result.error ?? null,
  });
});

export default router;
