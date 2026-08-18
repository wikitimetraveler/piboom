/**
 * Development work by David Lane
 */
import { Router } from 'express';
import { postConvertConditionsCdo } from '../controllers/encompass-conditions.controller.js';
import conditionsAssistantRoutes from '../controllers/conditions-assistant.controller.js';
import {
  encompassEnvMiddleware,
  getCatalogHandler,
  postInvokeHandler,
  restHandler,
  restPatchByAction,
} from '../controllers/encompass-live-api.controller.js';

const router = Router();
router.use(encompassEnvMiddleware);

router.post('/convert', postConvertConditionsCdo);
router.use('/assistant', conditionsAssistantRoutes);

router.get('/catalog', getCatalogHandler('conditions'));
router.post('/invoke', postInvokeHandler('conditions'));

router.get('/types', restHandler('conditions', 'ec.types.list'));
router.patch(
  '/types',
  restPatchByAction('conditions', {
    add: 'ec.types.create',
    update: 'ec.types.update',
    delete: 'ec.types.delete',
  }),
);
router.get('/types/:id', restHandler('conditions', 'ec.types.get', { id: 'typeId' }));

router.get('/templates', restHandler('conditions', 'ec.templates.list'));
router.patch(
  '/templates',
  restPatchByAction('conditions', {
    add: 'ec.templates.create',
    update: 'ec.templates.update',
  }),
);
router.get('/templates/:id', restHandler('conditions', 'ec.templates.get', { id: 'templateId' }));

router.get('/sets', restHandler('conditions', 'ec.sets.list'));
router.get('/sets/:id', restHandler('conditions', 'ec.sets.get', { id: 'setId' }));

router.get('/personas', restHandler('conditions', 'ec.personas.list'));
router.post('/automated-conditions', restHandler('conditions', 'ec.automated.evaluate'));

router.get('/loans/:loanId/conditions', restHandler('conditions', 'ec.loan.list', { loanId: 'loanId' }));
router.patch(
  '/loans/:loanId/conditions',
  restPatchByAction(
    'conditions',
    {
      add: 'ec.loan.add',
      update: 'ec.loan.update',
      remove: 'ec.loan.remove',
      duplicate: 'ec.loan.duplicate',
    },
    { loanId: 'loanId' },
  ),
);
router.get(
  '/loans/:loanId/conditions/:conditionId/comments',
  restHandler('conditions', 'ec.loan.comments.list', { loanId: 'loanId', conditionId: 'conditionId' }),
);
router.post(
  '/loans/:loanId/conditions/:conditionId/comments',
  restHandler('conditions', 'ec.loan.comments.add', { loanId: 'loanId', conditionId: 'conditionId' }),
);
router.get(
  '/loans/:loanId/conditions/:conditionId/tracking',
  restHandler('conditions', 'ec.loan.tracking.get', { loanId: 'loanId', conditionId: 'conditionId' }),
);
router.patch(
  '/loans/:loanId/conditions/:conditionId/tracking',
  restHandler('conditions', 'ec.loan.tracking.update', { loanId: 'loanId', conditionId: 'conditionId' }),
);
router.get(
  '/loans/:loanId/conditions/:conditionId/documents',
  restHandler('conditions', 'ec.loan.documents.list', { loanId: 'loanId', conditionId: 'conditionId' }),
);
router.patch(
  '/loans/:loanId/conditions/:conditionId/documents',
  restHandler('conditions', 'ec.loan.documents.update', { loanId: 'loanId', conditionId: 'conditionId' }),
);

export default router;
