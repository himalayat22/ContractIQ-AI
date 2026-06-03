import { Router } from 'express';
import { ContractController } from '../controllers/ContractController.js';
import { uploadPdf } from '../../../middleware/upload.js';
import {
  validateGetContractParams,
  validateListContractsQuery,
} from '../validations/contract.validation.js';

/**
 * @param {{ contractService?: import('../services/ContractService.js').ContractService }} deps
 */
export function createContractRoutes({ contractService } = {}) {
  const contractRoutes = Router();
  const contractController = new ContractController(contractService);

  contractRoutes.post('/contracts/upload', uploadPdf, contractController.upload);
  contractRoutes.get('/contracts', validateListContractsQuery, contractController.list);
  contractRoutes.get('/contracts/:id', validateGetContractParams, contractController.getById);
  contractRoutes.delete('/contracts/:id', validateGetContractParams, contractController.delete);

  return contractRoutes;
}

export default createContractRoutes;
