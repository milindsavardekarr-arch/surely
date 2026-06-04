import { Router } from 'express';
import multer from 'multer';
import {
  listContacts, getContact, createContact,
  updateContact, deleteContact, importContacts
} from '../controllers/contacts.controller';
import { authenticate, requireBusinessAccount } from '../middleware/auth.middleware';

const router = Router();
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 5 * 1024 * 1024 },
  fileFilter: (_req, file, cb) => {
    if (file.mimetype === 'text/csv' || file.originalname.endsWith('.csv')) cb(null, true);
    else cb(new Error('Only CSV files are allowed'));
  },
});

router.use(authenticate);
router.use(requireBusinessAccount);

router.get('/', listContacts);
router.post('/', createContact);
router.post('/import', upload.single('file'), importContacts);
router.get('/:id', getContact);
router.put('/:id', updateContact);
router.delete('/:id', deleteContact);

export default router;
