import { Router } from 'express';
import { getSecurityAssessmentReport, getSecurityAssessmentPdf } from './report.controller';

export const reportRouter = Router({ mergeParams: true });

reportRouter.get('/security-assessment', getSecurityAssessmentReport);
reportRouter.get('/security-assessment/pdf', getSecurityAssessmentPdf);
