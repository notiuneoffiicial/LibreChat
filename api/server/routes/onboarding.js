const express = require('express');
const { updateOnboardingStatus, updateGuidedTourStatus } = require('~/models');
const { requireJwtAuth } = require('~/server/middleware');

const router = express.Router();

router.use(requireJwtAuth);

/**
 * PATCH /onboarding/status
 * Updates the user's onboarding completion status.
 * Body: { onboardingCompleted: boolean }
 * Returns 200 and { updated: true, onboardingCompleted: boolean } when successful.
 */
router.patch('/status', async (req, res) => {
  const { onboardingCompleted } = req.body;

  if (typeof onboardingCompleted !== 'boolean') {
    return res.status(400).json({ error: 'onboardingCompleted must be a boolean value.' });
  }

  try {
    const updatedUser = await updateOnboardingStatus(req.user.id, onboardingCompleted);

    if (!updatedUser) {
      return res.status(404).json({ error: 'User not found.' });
    }

    res.json({
      updated: true,
      onboardingCompleted: updatedUser.personalization?.onboardingCompleted ?? false,
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

/**
 * PATCH /onboarding/guided-tour
 * Updates the user's guided tour completion status.
 * Body: { guidedTourCompleted: boolean }
 * Returns 200 and { updated: true, guidedTourCompleted: boolean } when successful.
 */
router.patch('/guided-tour', async (req, res) => {
  const { guidedTourCompleted } = req.body;

  if (typeof guidedTourCompleted !== 'boolean') {
    return res.status(400).json({ error: 'guidedTourCompleted must be a boolean value.' });
  }

  try {
    const updatedUser = await updateGuidedTourStatus(req.user.id, guidedTourCompleted);

    if (!updatedUser) {
      return res.status(404).json({ error: 'User not found.' });
    }

    res.json({
      updated: true,
      guidedTourCompleted: updatedUser.personalization?.guidedTourCompleted ?? false,
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

module.exports = router;

