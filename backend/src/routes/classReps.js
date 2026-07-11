const express = require('express');
const auth = require('../middleware/auth');
const {
  myRepClasses,
  myOverrides,
  createOverride,
  deleteOverride,
} = require('../controllers/classRepController');

const router = express.Router();
router.use(auth);

router.get('/my-classes', myRepClasses);
router.get('/overrides', myOverrides);
router.post('/overrides', createOverride);
router.delete('/overrides/:id', deleteOverride);

module.exports = router;
