import { Router } from 'express';
import contractController from '../controllers/ContractController.js';
import { uploadPdf } from '../../../middleware/upload.js';
import {
  validateGetContractParams,
  validateListContractsQuery,
} from '../validations/contract.validation.js';

const contractRoutes = Router();

contractRoutes.post('/contracts/upload', uploadPdf, contractController.upload);
contractRoutes.get('/contracts', validateListContractsQuery, contractController.list);
contractRoutes.get('/contracts/:id', validateGetContractParams, contractController.getById);
contractRoutes.delete('/contracts/:id', validateGetContractParams, contractController.delete);

export default contractRoutes;
