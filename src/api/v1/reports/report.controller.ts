import { Request, Response, NextFunction } from 'express';
import { generateReportData } from './report.service';
import { generatePdfStream } from './report-pdf.generator';
import { logger } from '../../../logger';

export async function getSecurityAssessmentReport(req: Request, res: Response, next: NextFunction) {
  try {
    const projectIdStr = Array.isArray(req.params.projectId) ? req.params.projectId[0] : req.params.projectId;
    const projectId = parseInt(projectIdStr, 10);
    if (isNaN(projectId)) throw new Error('Invalid project ID');
    
    const userId = req.user!.id;
    const reportData = await generateReportData(projectId, userId);

    res.json({ success: true, data: reportData });
  } catch (err) {
    next(err);
  }
}

export async function getSecurityAssessmentPdf(req: Request, res: Response, next: NextFunction) {
  try {
    const projectIdStr = Array.isArray(req.params.projectId) ? req.params.projectId[0] : req.params.projectId;
    const projectId = parseInt(projectIdStr, 10);
    if (isNaN(projectId)) throw new Error('Invalid project ID');
    
    const userId = req.user!.id;
    
    logger.info('REPORT_GENERATION_STARTED', { projectId, userId, type: 'PDF' });
    const reportData = await generateReportData(projectId, userId);

    generatePdfStream(reportData, res);
    
    // Once pipe finishes, response is ended. We can consider it completed.
    logger.info('REPORT_GENERATION_COMPLETED', { projectId, userId, type: 'PDF' });
    logger.info('REPORT_PDF_GENERATED', { projectId, userId });
  } catch (err) {
    logger.error('REPORT_GENERATION_FAILED', { error: err });
    next(err);
  }
}
