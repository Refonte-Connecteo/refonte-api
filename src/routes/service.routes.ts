import { Router } from 'express';
import * as serviceController from '@/controllers/service.controller';
import { authenticateAdmin } from '@/middlewares/auth.middleware';
import { uploadPdf } from '@/config/multer';

const router = Router();

router.get('/', serviceController.getAll);
router.get('/:id', serviceController.getById);

router.post('/', authenticateAdmin, uploadPdf('catalogue'), serviceController.create);
router.put('/:id', authenticateAdmin, uploadPdf('catalogue'), serviceController.update);
router.delete('/:id', authenticateAdmin, serviceController.remove);

router.get('/:id/sectors', serviceController.getSectors);
router.post('/:id/sectors', authenticateAdmin, serviceController.createSector);
router.put('/:id/sectors/:sectorId', authenticateAdmin, serviceController.updateSector);
router.delete('/:id/sectors/:sectorId', authenticateAdmin, serviceController.removeSector);

export default router;
