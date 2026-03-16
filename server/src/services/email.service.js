const nodemailer = require('nodemailer');
const { SMTP_HOST, SMTP_PORT, SMTP_USER, SMTP_PASS, EMAIL_FROM } = require('../config/env');

// ─── Transport ─────────────────────────────────────────────────────────────────

console.log('[email] SMTP_HOST:', SMTP_HOST, '| SMTP_USER:', SMTP_USER, '| SMTP_PASS set:', !!SMTP_PASS);

const transporter = nodemailer.createTransport({
  host: SMTP_HOST || 'smtp.gmail.com',
  port: SMTP_PORT || 587,
  secure: (SMTP_PORT || 587) === 465, // true for 465 (SSL), false for 587 (STARTTLS)
  auth: {
    user: SMTP_USER,
    pass: SMTP_PASS, // Must be a Gmail App Password, NOT the account password
  },
});

// ─── Base Sender ───────────────────────────────────────────────────────────────

/**
 * Send a single email. Accepts one address or an array.
 * Returns a Promise — callers should attach .catch(console.error) and NOT await
 * so that email failures never block the HTTP response.
 */
async function sendEmail(to, subject, html) {
  const recipients = Array.isArray(to) ? to.filter(Boolean) : [to].filter(Boolean);
  if (recipients.length === 0) return;

  await transporter.sendMail({
    from: EMAIL_FROM || `"FCIT Graduation Platform" <${SMTP_USER}>`,
    to: recipients.join(', '),
    subject,
    html,
  });
}

// ─── Shared HTML Layout ────────────────────────────────────────────────────────

function layout(bodyContent) {
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>FCIT Graduation Platform</title>
</head>
<body style="margin:0;padding:0;background:#f3f4f6;font-family:Arial,Helvetica,sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#f3f4f6;padding:32px 16px;">
    <tr>
      <td align="center">
        <table width="600" cellpadding="0" cellspacing="0" style="background:#ffffff;border-radius:8px;overflow:hidden;box-shadow:0 2px 8px rgba(0,0,0,0.08);">
          <!-- Header -->
          <tr>
            <td style="background:#1a6b4a;padding:28px 32px;text-align:center;">
              <p style="margin:0;font-size:20px;font-weight:700;color:#ffffff;letter-spacing:0.5px;">
                FCIT Graduation Project Platform
              </p>
              <p style="margin:6px 0 0;font-size:13px;color:#a7d7c0;">
                King Abdulaziz University
              </p>
            </td>
          </tr>
          <!-- Body -->
          <tr>
            <td style="padding:32px;">
              ${bodyContent}
            </td>
          </tr>
          <!-- Footer -->
          <tr>
            <td style="background:#f9fafb;border-top:1px solid #e5e7eb;padding:20px 32px;text-align:center;">
              <p style="margin:0;font-size:12px;color:#9ca3af;">
                This is an automated notification from the FCIT Graduation Project Platform.
                Please do not reply to this email.
              </p>
              <p style="margin:8px 0 0;font-size:12px;color:#9ca3af;">
                King Abdulaziz University — Faculty of Computing and Information Technology
              </p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>`;
}

function heading(text) {
  return `<h2 style="margin:0 0 20px;font-size:22px;color:#111827;">${text}</h2>`;
}

function paragraph(text) {
  return `<p style="margin:0 0 14px;font-size:15px;color:#374151;line-height:1.6;">${text}</p>`;
}

function infoTable(rows) {
  const cells = rows
    .map(
      ([label, value]) => `
      <tr>
        <td style="padding:10px 14px;font-size:14px;color:#6b7280;white-space:nowrap;border-bottom:1px solid #f3f4f6;">${label}</td>
        <td style="padding:10px 14px;font-size:14px;color:#111827;border-bottom:1px solid #f3f4f6;">${value}</td>
      </tr>`
    )
    .join('');
  return `<table width="100%" cellpadding="0" cellspacing="0" style="border:1px solid #e5e7eb;border-radius:6px;margin:0 0 20px;border-collapse:collapse;">
    <tbody>${cells}</tbody>
  </table>`;
}

function ctaButton(label, href) {
  return `<div style="text-align:center;margin:24px 0 8px;">
    <a href="${href}" style="display:inline-block;padding:12px 28px;background:#1a6b4a;color:#ffffff;font-size:15px;font-weight:600;text-decoration:none;border-radius:6px;">
      ${label}
    </a>
  </div>`;
}

function statusBadge(status) {
  const isPositive = status === 'Approved';
  const bg   = isPositive ? '#dcfce7' : '#fef3c7';
  const text = isPositive ? '#166534' : '#92400e';
  return `<span style="display:inline-block;padding:3px 10px;border-radius:12px;background:${bg};color:${text};font-size:13px;font-weight:600;">${status}</span>`;
}

// ─── Template Functions ────────────────────────────────────────────────────────

/**
 * 1. New file submission alert → supervisor
 *
 * @param {string} supervisorEmail
 * @param {{ studentName: string, milestoneName: string, courseName: string, submittedAt: string, appUrl?: string }} data
 */
function sendSubmissionReceived(supervisorEmail, data) {
  const { studentName, milestoneName, courseName, submittedAt, appUrl = '' } = data;
  const formattedDate = new Date(submittedAt).toLocaleString('en-US', {
    dateStyle: 'medium', timeStyle: 'short',
  });

  const body = `
    ${heading('New File Submission Received')}
    ${paragraph('A student has submitted a file that requires your review.')}
    ${infoTable([
      ['Student', studentName],
      ['Course', courseName],
      ['Milestone / Submission', milestoneName],
      ['Submitted At', formattedDate],
    ])}
    ${appUrl ? ctaButton('View Submission', appUrl) : ''}
  `;

  return sendEmail(supervisorEmail, `[${courseName}] New Submission: ${milestoneName}`, layout(body));
}

/**
 * 2. Submission approved / changes requested → student(s)
 *
 * @param {string[]} studentEmails
 * @param {{ status: 'Approved'|'Changes Requested', feedback: string, milestoneName: string, courseName: string, appUrl?: string }} data
 */
function sendSubmissionDecision(studentEmails, data) {
  const { status, feedback, milestoneName, courseName, appUrl = '' } = data;

  const feedbackSection = feedback
    ? `<div style="background:#f9fafb;border-left:4px solid #1a6b4a;padding:14px 16px;margin:0 0 20px;border-radius:0 4px 4px 0;">
        <p style="margin:0 0 6px;font-size:13px;font-weight:600;color:#374151;">Supervisor Feedback</p>
        <p style="margin:0;font-size:14px;color:#374151;line-height:1.6;">${feedback.replace(/\n/g, '<br/>')}</p>
      </div>`
    : '';

  const body = `
    ${heading('Submission Status Update')}
    ${paragraph(`Your submission has been reviewed. Status: ${statusBadge(status)}`)}
    ${infoTable([
      ['Course', courseName],
      ['Milestone / Submission', milestoneName],
      ['Decision', status],
    ])}
    ${feedbackSection}
    ${appUrl ? ctaButton('View Submission', appUrl) : ''}
  `;

  return Promise.allSettled(
    studentEmails.filter(Boolean).map((email) =>
      sendEmail(email, `[${courseName}] Submission ${status}: ${milestoneName}`, layout(body))
    )
  );
}

/**
 * 3. Supervisor rubric evaluation submitted → student
 *
 * @param {string} studentEmail
 * @param {{ courseName: string, normalizedScore: number, maxScore: number, appUrl?: string }} data
 */
function sendSupervisorEvaluation(studentEmail, data) {
  const { courseName, normalizedScore, maxScore, appUrl = '' } = data;

  const body = `
    ${heading('Supervisor Evaluation Submitted')}
    ${paragraph('Your supervisor has submitted their evaluation for your graduation project.')}
    ${infoTable([
      ['Course', courseName],
      ['Supervisor Score', `${normalizedScore} / ${maxScore}`],
    ])}
    ${paragraph('Log in to the platform to view the detailed evaluation breakdown.')}
    ${appUrl ? ctaButton('View My Grades', appUrl) : ''}
  `;

  return sendEmail(studentEmail, `[${courseName}] Supervisor Evaluation Submitted`, layout(body));
}

/**
 * 4. Coordinator evaluation submitted → student
 *
 * @param {string} studentEmail
 * @param {{ courseName: string, normalizedScore: number, maxScore: number, appUrl?: string }} data
 */
function sendCoordinatorEvaluation(studentEmail, data) {
  const { courseName, normalizedScore, maxScore, appUrl = '' } = data;

  const body = `
    ${heading('Coordinator Evaluation Submitted')}
    ${paragraph('The course coordinator has submitted an evaluation for your graduation project.')}
    ${infoTable([
      ['Course', courseName],
      ['Coordinator Score', `${normalizedScore} / ${maxScore}`],
    ])}
    ${paragraph('Log in to the platform to view the detailed evaluation breakdown.')}
    ${appUrl ? ctaButton('View My Grades', appUrl) : ''}
  `;

  return sendEmail(studentEmail, `[${courseName}] Coordinator Evaluation Submitted`, layout(body));
}

/**
 * 5. Announcement broadcast → selected role recipients
 *
 * @param {string[]} recipientEmails
 * @param {{ title: string, content: string, courseName: string, publishedAt: string }} data
 */
function sendAnnouncement(recipientEmails, data) {
  const { title, content, courseName, publishedAt } = data;
  const formattedDate = new Date(publishedAt).toLocaleString('en-US', {
    dateStyle: 'medium', timeStyle: 'short',
  });

  const body = `
    ${heading('New Announcement')}
    ${infoTable([
      ['Course', courseName || 'All Courses'],
      ['Published', formattedDate],
    ])}
    <div style="background:#f9fafb;border:1px solid #e5e7eb;border-radius:6px;padding:18px;margin:0 0 20px;">
      <p style="margin:0 0 10px;font-size:16px;font-weight:700;color:#111827;">${title}</p>
      <p style="margin:0;font-size:14px;color:#374151;line-height:1.7;white-space:pre-line;">${content}</p>
    </div>
  `;

  const subject = courseName
    ? `[${courseName}] Announcement: ${title}`
    : `Announcement: ${title}`;

  return Promise.allSettled(
    recipientEmails.filter(Boolean).map((email) =>
      sendEmail(email, subject, layout(body))
    )
  );
}

/**
 * 6. Presentation scheduled → group students
 *
 * @param {string[]} studentEmails
 * @param {{ projectName: string, formattedDateTime: string, location: string|null, timeSlot: string, day: string, courseName?: string }} data
 */
function sendPresentationScheduled(studentEmails, data) {
  const { projectName, formattedDateTime, location, timeSlot, day, courseName = '' } = data;

  const rows = [
    ['Project', projectName],
    ['Date & Time', formattedDateTime],
    ['Day / Slot', `${day} – ${timeSlot}`],
  ];
  if (location) rows.push(['Location', location]);

  const body = `
    ${heading('Your Presentation Has Been Scheduled')}
    ${paragraph('A presentation date has been assigned for your graduation project. Please note the details below.')}
    ${infoTable(rows)}
    ${paragraph('Please ensure all group members are available at the scheduled time. Log in to the platform for more details.')}
  `;

  const subject = courseName
    ? `[${courseName}] Presentation Scheduled: ${projectName}`
    : `Presentation Scheduled: ${projectName}`;

  return Promise.allSettled(
    studentEmails.filter(Boolean).map((email) =>
      sendEmail(email, subject, layout(body))
    )
  );
}

// ─── Exports ───────────────────────────────────────────────────────────────────

module.exports = {
  sendEmail,
  sendSubmissionReceived,
  sendSubmissionDecision,
  sendSupervisorEvaluation,
  sendCoordinatorEvaluation,
  sendAnnouncement,
  sendPresentationScheduled,
};
