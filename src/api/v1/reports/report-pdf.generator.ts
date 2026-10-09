import PDFDocument from 'pdfkit';
import { Response } from 'express';
import { ReportData } from './report.types';

export function generatePdfStream(report: ReportData, res: Response) {
  const doc = new PDFDocument({ margin: 50 });

  res.setHeader('Content-Type', 'application/pdf');
  res.setHeader(
    'Content-Disposition',
    `attachment; filename="AtherOps_Assessment_${report.metadata.projectName.replace(/\s+/g, '_')}.pdf"`
  );

  doc.pipe(res);

  // Cover Page
  doc.fontSize(28).text('AtherOps Security Assessment', { align: 'center' });
  doc.moveDown();
  doc.fontSize(16).text(`Project: ${report.metadata.projectName}`, { align: 'center' });
  doc.fontSize(14).text(`Generated: ${new Date(report.metadata.generatedAt).toLocaleString()}`, { align: 'center' });
  doc.moveDown(4);

  // Executive Summary
  doc.fontSize(20).text('Executive Summary', { underline: true });
  doc.moveDown();
  doc.fontSize(12).text(`Total Resources: ${report.summary.resourceCount}`);
  doc.text(`Cloud Accounts: ${report.summary.cloudAccountCount}`);
  
  if (report.summary.overallRiskScore !== null) {
    doc.text(`Overall Risk Score: ${report.summary.overallRiskScore}/100`);
  } else {
    doc.text(`Overall Risk Score: Unavailable (No data)`);
  }
  
  doc.moveDown();
  doc.text(`Severity Distribution:`);
  doc.text(`  CRITICAL: ${report.summary.severityDistribution.CRITICAL}`);
  doc.text(`  HIGH: ${report.summary.severityDistribution.HIGH}`);
  doc.text(`  MEDIUM: ${report.summary.severityDistribution.MEDIUM}`);
  doc.text(`  LOW: ${report.summary.severityDistribution.LOW}`);
  doc.text(`  INFO: ${report.summary.severityDistribution.INFO}`);
  
  doc.addPage();

  // Security Findings
  doc.fontSize(20).text('Security Findings', { underline: true });
  doc.moveDown();
  
  if (report.findings.length > 0) {
    report.findings.forEach(f => {
      doc.fontSize(14).text(`[${f.severity}] ${f.title}`);
      doc.fontSize(10).text(`Resource: ${f.resource_name} (${f.resource_type})`);
      doc.text(`Description: ${f.description}`);
      if (f.recommendation) {
        doc.text(`Recommendation: ${f.recommendation}`);
      }
      doc.moveDown();
    });
  } else {
    doc.fontSize(12).text('No findings currently recorded.');
  }

  doc.addPage();

  // Attack Paths
  doc.fontSize(20).text('Attack Paths', { underline: true });
  doc.moveDown();
  
  if (report.attackPaths.length > 0) {
    report.attackPaths.forEach(ap => {
      doc.fontSize(14).text(`[${ap.severity}] ${ap.title}`);
      doc.fontSize(10).text(`Description: ${ap.description}`);
      doc.moveDown();
    });
  } else {
    doc.fontSize(12).text('No attack paths generated.');
  }

  doc.addPage();

  // Resources
  doc.fontSize(20).text('Resource Overview', { underline: true });
  doc.moveDown();
  
  if (report.resources.length > 0) {
    report.resources.slice(0, 100).forEach(r => {
      doc.fontSize(10).text(`${r.name} (${r.type}) - ${r.region} - ${r.cloud_account_name}`);
    });
    if (report.resources.length > 100) {
      doc.moveDown();
      doc.text(`... and ${report.resources.length - 100} more resources.`);
    }
  } else {
    doc.fontSize(12).text('No resources discovered.');
  }

  doc.addPage();

  // Billing
  doc.fontSize(20).text('Billing & Costs', { underline: true });
  doc.moveDown();
  
  if (report.costs) {
    doc.fontSize(14).text(`ACTUAL AWS BILLING: ${report.costs.totalSpend.toFixed(2)} ${report.costs.currency}`);
    doc.moveDown();
    report.costs.services.forEach(s => {
      doc.fontSize(10).text(`${s.serviceName}: ${s.amount.toFixed(2)}`);
    });
  } else {
    doc.fontSize(12).text('Billing data not available for this period.');
  }

  doc.addPage();

  // Limitations
  doc.fontSize(20).text('Limitations', { underline: true });
  doc.moveDown();
  
  if (report.limitations.length > 0) {
    report.limitations.forEach(l => {
      doc.fontSize(12).text(`- ${l}`);
    });
  } else {
    doc.fontSize(12).text('No specific limitations identified.');
  }

  doc.end();
}
