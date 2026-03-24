const nodemailer = require('nodemailer');
const { SMTP_HOST, SMTP_PORT, SMTP_USER, SMTP_PASS, EMAIL_FROM, APP_URL } = require('../config/env');

// ─── Transport ─────────────────────────────────────────────────────────────────


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

function layout(bodyContent, sectionLabel = 'Notification') {
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>FCIT Graduation Platform</title>
</head>
<body style="margin:0;padding:0;background:#f3f4f6;font-family:Arial,Helvetica,sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#f3f4f6;padding:40px 16px;">
    <tr>
      <td align="center">
        <table width="580" cellpadding="0" cellspacing="0" style="background:#ffffff;border-radius:12px;overflow:hidden;box-shadow:0 4px 16px rgba(0,0,0,0.10);">

          <!-- Header -->
          <tr>
            <td style="background:#ffffff;padding:36px 32px;text-align:center;border-bottom:3px solid #1a6b4a;">
              <img src="https://bmpnorvnjqzldrinfrop.supabase.co/storage/v1/object/public/assets/GPP_Logo.png"
                   alt="FCIT Graduation Project Platform"
                   width="160"
                   style="display:block;margin:0 auto 14px;max-width:100%;height:auto;" />
              <p style="margin:0;font-size:22px;font-weight:700;color:#1a6b4a;letter-spacing:0.5px;">
                FCIT Graduation Project Platform
              </p>
              <p style="margin:6px 0 0;font-size:13px;color:#6b7280;letter-spacing:0.3px;">
                King Abdulaziz University
              </p>
            </td>
          </tr>

          <!-- Accent bar -->
          <tr>
            <td style="background:#f0faf5;padding:14px 32px;border-bottom:1px solid #e5e7eb;">
              <p style="margin:0;font-size:12px;color:#6b7280;text-align:center;letter-spacing:0.5px;text-transform:uppercase;">
                ${sectionLabel}
              </p>
            </td>
          </tr>

          <!-- Body -->
          <tr>
            <td style="padding:44px 40px 36px;">
              ${bodyContent}
            </td>
          </tr>

          <!-- Footer -->
          <tr>
            <td style="background:#f9fafb;border-top:1px solid #e5e7eb;padding:22px 32px;text-align:center;">
              <p style="margin:0;font-size:12px;color:#9ca3af;line-height:1.6;">
                This is an automated notification from the FCIT Graduation Project Platform.<br/>
                Please do not reply to this email.
              </p>
              <p style="margin:10px 0 0;font-size:12px;color:#d1d5db;">
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
  return `<h2 style="margin:0 0 16px;font-size:24px;font-weight:700;color:#111827;text-align:center;">${text}</h2>`;
}

function paragraph(text) {
  return `<p style="margin:0 0 24px;font-size:15px;color:#4b5563;line-height:1.7;text-align:center;">${text}</p>`;
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
  return `<div style="text-align:center;margin:0 0 36px;">
    <a href="${href}" style="display:inline-block;padding:14px 44px;background:#1a6b4a;color:#ffffff;font-size:16px;font-weight:700;text-decoration:none;border-radius:8px;letter-spacing:0.3px;box-shadow:0 4px 12px rgba(26,107,74,0.35);">
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

  return sendEmail(supervisorEmail, `[${courseName}] New Submission: ${milestoneName}`, layout(body, 'New Submission'));
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
      sendEmail(email, `[${courseName}] Submission ${status}: ${milestoneName}`, layout(body, 'Submission Update'))
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

  return sendEmail(studentEmail, `[${courseName}] Supervisor Evaluation Submitted`, layout(body, 'Evaluation'));
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

  return sendEmail(studentEmail, `[${courseName}] Coordinator Evaluation Submitted`, layout(body, 'Evaluation'));
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

  const announcementsUrl = APP_URL ? `${APP_URL}/announcements` : '';

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
    ${announcementsUrl ? ctaButton('Read Announcement', announcementsUrl) : ''}
  `;

  const subject = courseName
    ? `[${courseName}] Announcement: ${title}`
    : `Announcement: ${title}`;

  return Promise.allSettled(
    recipientEmails.filter(Boolean).map((email) =>
      sendEmail(email, subject, layout(body, 'Announcement'))
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
      sendEmail(email, subject, layout(body, 'Presentation Scheduled'))
    )
  );
}

/**
 * 7. Committee assignment notification → one committee member
 *    Shows ALL presentations they are assigned to.
 *
 * @param {string} memberEmail
 * @param {{ memberName: string, assignments: Array<{ projectName: string, groupCode: string, formattedDateTime: string, day: string, timeSlot: string, location: string|null }> }} data
 */
function sendCommitteeSchedule(memberEmail, data) {
  const { memberName, assignments } = data;

  const rows = assignments.map((a, i) => {
    const loc = a.location ? ` — ${a.location}` : '';
    return `<tr style="background:${i % 2 === 0 ? '#ffffff' : '#f9fafb'};">
      <td style="padding:10px 14px;font-size:14px;color:#111827;border-bottom:1px solid #f3f4f6;">${a.projectName} (${a.groupCode})</td>
      <td style="padding:10px 14px;font-size:14px;color:#374151;border-bottom:1px solid #f3f4f6;">${a.formattedDateTime}${loc}</td>
    </tr>`;
  }).join('');

  const table = `<table width="100%" cellpadding="0" cellspacing="0" style="border:1px solid #e5e7eb;border-radius:6px;margin:0 0 20px;border-collapse:collapse;">
    <thead>
      <tr style="background:#f3f4f6;">
        <th style="padding:10px 14px;font-size:13px;color:#6b7280;text-align:left;border-bottom:1px solid #e5e7eb;">Project</th>
        <th style="padding:10px 14px;font-size:13px;color:#6b7280;text-align:left;border-bottom:1px solid #e5e7eb;">Date & Time</th>
      </tr>
    </thead>
    <tbody>${rows}</tbody>
  </table>`;

  const body = `
    ${heading('Your Presentation Committee Schedule')}
    ${paragraph(`Dear <strong>${memberName}</strong>, you have been assigned as a committee member for the following presentation(s):`)}
    ${table}
    ${paragraph('Please ensure you are available at the scheduled times. Log in to the platform for full details.')}
  `;

  return sendEmail(memberEmail, 'Your Presentation Committee Schedule', layout(body, 'Committee Schedule'));
}

/**
 * 8. New milestone created → students in the course
 *
 * @param {string[]} studentEmails
 * @param {{ milestoneName: string, courseName: string, openDate: string, dueDate: string, description?: string, appUrl?: string }} data
 */
function sendMilestoneCreated(studentEmails, data) {
  const { milestoneName, courseName, openDate, dueDate, description, appUrl = '' } = data;
  const fmt = (d) => new Date(d).toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' });

  const body = `
    ${heading('New Milestone Added')}
    ${paragraph(`A new milestone has been added for <strong>${courseName}</strong>.`)}
    ${infoTable([
      ['Milestone', milestoneName],
      ['Course',    courseName],
      ['Opens',     fmt(openDate)],
      ['Due',       fmt(dueDate)],
    ])}
    ${description ? `<div style="background:#f9fafb;border:1px solid #e5e7eb;border-radius:6px;padding:18px;margin:0 0 20px;">
      <p style="margin:0;font-size:14px;color:#374151;line-height:1.7;white-space:pre-line;">${description}</p>
    </div>` : ''}
    ${appUrl ? ctaButton('View Milestone', appUrl) : ''}
  `;

  return Promise.allSettled(
    studentEmails.filter(Boolean).map((email) =>
      sendEmail(email, `[${courseName}] New Milestone: ${milestoneName}`, layout(body, 'New Milestone'))
    )
  );
}

/**
 * 8. Weekly report week opened → students in the course
 *
 * @param {string[]} studentEmails
 * @param {{ weekNumber: number, courseType: string, appUrl?: string }} data
 */
function sendWeekOpened(studentEmails, data) {
  const { weekNumber, courseType, appUrl = '' } = data;
  const courseName = `SE ${courseType}`;

  const body = `
    ${heading(`Week ${weekNumber} Report Now Open`)}
    ${paragraph(`Week <strong>${weekNumber}</strong> is now open for weekly report submissions in <strong>${courseName}</strong>.`)}
    ${infoTable([
      ['Course', courseName],
      ['Week',   `Week ${weekNumber}`],
      ['Status', 'Open for Submissions'],
    ])}
    ${paragraph('Please submit your weekly report before the week is closed.')}
    ${appUrl ? ctaButton('Submit Weekly Report', appUrl) : ''}
  `;

  return Promise.allSettled(
    studentEmails.filter(Boolean).map((email) =>
      sendEmail(email, `[${courseName}] Week ${weekNumber} Report Now Open`, layout(body, 'Weekly Report'))
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
  sendCommitteeSchedule,
  sendMilestoneCreated,
  sendWeekOpened,
};
