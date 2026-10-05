import { Router } from "express";
import { authenticate, authorize } from "../../common/middleware/auth";
import { syncLimiter } from "../../common/middleware/rateLimit";
import { idParams } from "../../common/validators";
import { doc } from "../../docs/registry";
import { stepController } from "./controller";
import { batchStepsBody, createStepBody, listStepsQuery } from "./schema";

const router = Router();
router.use(authenticate());

router.get(
  "/",
  authorize("READ"),
  ...doc({
    method: "get",
    path: "/steps",
    tags: ["Steps"],
    summary: "List daily step records",
    auth: true,
    query: listStepsQuery,
    paginated: true,
  }),
  stepController.list,
);

router.get(
  "/:id",
  authorize("READ"),
  ...doc({
    method: "get",
    path: "/steps/:id",
    tags: ["Steps"],
    summary: "Get one step record (own data only)",
    auth: true,
    params: idParams,
  }),
  stepController.get,
);

router.post(
  "/",
  authorize("WRITE"),
  ...doc({
    method: "post",
    path: "/steps",
    tags: ["Steps"],
    summary: "Create or update the step record for a date (one per day)",
    auth: true,
    body: createStepBody,
    successStatus: 201,
  }),
  stepController.create,
);

router.post(
  "/batch",
  authorize("WRITE"),
  syncLimiter,
  ...doc({
    method: "post",
    path: "/steps/batch",
    tags: ["Steps", "Sync"],
    summary: "Offline batch upload of up to 100 daily step records",
    description:
      "Upserts per (user, date). Records with an older client `updatedAt` than the server copy are reported in `conflicts` and not applied.",
    auth: true,
    body: batchStepsBody,
    rateLimited: true,
  }),
  stepController.batch,
);

export default router;
