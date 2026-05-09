const nodemailer = require('nodemailer');
const { SMTP_HOST, SMTP_PORT, SMTP_USER, SMTP_PASS, EMAIL_FROM, APP_URL } = require('../config/env');
const { supabaseAdmin } = require('../config/supabase');

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
  const all = Array.isArray(to) ? to.filter(Boolean) : [to].filter(Boolean);
  if (all.length === 0) return;

  const recipients = await filterOptedInEmails(all);
  if (recipients.length === 0) return;

  await transporter.sendMail({
    from: EMAIL_FROM || `"FCIT Graduation Platform" <${SMTP_USER}>`,
    to: recipients.join(', '),
    subject,
    html,
  });
}

// ─── Opt-out Filter ────────────────────────────────────────────────────────────

/**
 * Given a list of email addresses, returns only those whose owners have NOT
 * explicitly disabled email notifications (email_notifications !== false).
 * Defaults to opted-in when the preference is unset or the profile is not found.
 */
async function filterOptedInEmails(emails) {
  const list = (Array.isArray(emails) ? emails : [emails]).filter(Boolean);
  if (list.length === 0) return [];

  try {
    const { data: profiles } = await supabaseAdmin
      .from('profiles')
      .select('id, email')
      .in('email', list);

    if (!profiles?.length) return list;

    const profileMap = Object.fromEntries(profiles.map((p) => [p.email, p.id]));

    const checks = await Promise.all(
      profiles.map(async (p) => {
        try {
          const { data: { user } } = await supabaseAdmin.auth.admin.getUserById(p.id);
          return { email: p.email, optedIn: user?.user_metadata?.email_notifications !== false };
        } catch {
          return { email: p.email, optedIn: true };
        }
      })
    );

    const optedInSet = new Set(checks.filter((c) => c.optedIn).map((c) => c.email));
    // Always include emails not in the profiles table (e.g. external addresses)
    return list.filter((e) => !profileMap[e] || optedInSet.has(e));
  } catch {
    // On any error, fail open and send to all
    return list;
  }
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

/**
 * Build a Google Calendar "Add event" URL.
 * Pass allDay:true for deadline-style events (date only, no time).
 */
function makeGoogleCalUrl({ title, startISO, durationMs = 3600000, allDay = false, description = '', location = '' }) {
  const start = new Date(startISO);
  const ymd    = (d) => d.toISOString().slice(0, 10).replace(/-/g, '');
  const ymdhms = (d) => d.toISOString().replace(/[-:]/g, '').replace(/\.\d{3}/, '') ;

  let dates;
  if (allDay) {
    const end = new Date(start);
    end.setUTCDate(end.getUTCDate() + 1);
    dates = `${ymd(start)}/${ymd(end)}`;
  } else {
    const end = new Date(start.getTime() + durationMs);
    dates = `${ymdhms(start)}/${ymdhms(end)}`;
  }

  const params = new URLSearchParams({ action: 'TEMPLATE', text: title, dates });
  if (description) params.set('details', description);
  if (location)    params.set('location', location);
  return `https://calendar.google.com/calendar/render?${params}`;
}

function googleCalendarButton(url) {
  return `<div style="text-align:center;margin:0 0 24px;">
    <a href="${url}" style="display:inline-block;padding:11px 32px;background:#4285f4;color:#ffffff;font-size:14px;font-weight:600;text-decoration:none;border-radius:8px;letter-spacing:0.3px;box-shadow:0 3px 8px rgba(66,133,244,0.35);">
      &#128197; Add to Google Calendar
    </a>
  </div>`;
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
 * Grade summary email — sent to a student whenever an evaluation is submitted.
 * Shows every grading component with score, max, and a visual progress bar.
 *
 * @param {string}   studentEmail
 * @param {{
 *   courseName:  string,
 *   studentName: string,
 *   trigger:     string,          // e.g. "Supervisor Evaluation Submitted"
 *   components:  Array<{
 *     name:     string,
 *     score:    number|null,
 *     maxScore: number,
 *   }>,
 *   totalScore:  number,
 *   totalMax:    number,
 *   appUrl?:     string,
 * }} data
 */
function sendAllGrades(studentEmail, data) {
  const { courseName, studentName, trigger, components, totalScore, totalMax, appUrl = APP_URL ? `${APP_URL}/student/grades` : '' } = data;

  // ── Score bar helper (inline SVG-less version using a table) ──────────────
  const pctBar = (score, max) => {
    if (score == null || max <= 0) return '';
    const pct = Math.min(100, Math.round((score / max) * 100));
    const color = pct >= 80 ? '#16a34a' : pct >= 60 ? '#ca8a04' : '#dc2626';
    return `<td style="padding-left:8px;width:90px;vertical-align:middle;">
      <div style="background:#e5e7eb;border-radius:4px;height:6px;width:90px;">
        <div style="background:${color};border-radius:4px;height:6px;width:${pct}%;"></div>
      </div>
    </td>`;
  };

  const componentRows = components.map((c, i) => {
    const haScore  = c.score != null;
    const scoreStr = haScore ? `<strong>${c.score}</strong>` : '<span style="color:#9ca3af;">—</span>';
    const maxStr   = `/ ${c.maxScore}`;
    return `<tr style="background:${i % 2 === 0 ? '#ffffff' : '#f9fafb'};">
      <td style="padding:10px 14px;font-size:14px;color:#374151;border-bottom:1px solid #f3f4f6;">${c.name}</td>
      <td style="padding:10px 14px;font-size:14px;color:#111827;white-space:nowrap;border-bottom:1px solid #f3f4f6;text-align:right;">
        ${scoreStr} <span style="color:#9ca3af;font-size:12px;">${maxStr}</span>
      </td>
      ${pctBar(c.score, c.maxScore)}
    </tr>`;
  }).join('');

  const totalPct = totalMax > 0 ? Math.round((totalScore / totalMax) * 100) : 0;
  const totalColor = totalPct >= 80 ? '#16a34a' : totalPct >= 60 ? '#ca8a04' : '#dc2626';

  const gradeTable = `
    <table width="100%" cellpadding="0" cellspacing="0"
           style="border:1px solid #e5e7eb;border-radius:8px;margin:0 0 24px;border-collapse:collapse;overflow:hidden;">
      <thead>
        <tr style="background:#f3f4f6;">
          <th style="padding:10px 14px;font-size:12px;color:#6b7280;text-align:left;border-bottom:1px solid #e5e7eb;text-transform:uppercase;letter-spacing:0.5px;">Component</th>
          <th style="padding:10px 14px;font-size:12px;color:#6b7280;text-align:right;border-bottom:1px solid #e5e7eb;text-transform:uppercase;letter-spacing:0.5px;">Score</th>
          <th style="padding:10px 14px;font-size:12px;color:#6b7280;border-bottom:1px solid #e5e7eb;width:90px;"></th>
        </tr>
      </thead>
      <tbody>${componentRows}</tbody>
      <tfoot>
        <tr style="background:#f0faf5;">
          <td style="padding:12px 14px;font-size:15px;font-weight:700;color:#1a6b4a;">Total</td>
          <td style="padding:12px 14px;font-size:15px;font-weight:700;color:${totalColor};text-align:right;">${totalScore} / ${totalMax}</td>
          <td style="padding:12px 14px;font-size:13px;color:${totalColor};font-weight:600;">${totalPct}%</td>
        </tr>
      </tfoot>
    </table>`;

  const body = `
    ${heading(trigger)}
    ${paragraph(`Dear <strong>${studentName}</strong>, a new grade has been posted for your graduation project in <strong>${courseName}</strong>. Here is your current grade breakdown:`)}
    ${gradeTable}
    <p style="margin:0 0 8px;font-size:12px;color:#9ca3af;text-align:center;">
      Components showing <em>—</em> have not yet been graded.
    </p>
    ${appUrl ? ctaButton('View My Grades', appUrl) : ''}
  `;

  return sendEmail(
    studentEmail,
    `[${courseName}] Grades Updated — ${trigger}`,
    layout(body, 'Grade Summary')
  );
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
  const { projectName, formattedDateTime, location, timeSlot, day, courseName = '', scheduledAt } = data;

  const rows = [
    ['Project', projectName],
    ['Date & Time', formattedDateTime],
    ['Day / Slot', `${day} – ${timeSlot}`],
  ];
  if (location) rows.push(['Location', location]);

  const calBlock = scheduledAt ? googleCalendarButton(makeGoogleCalUrl({
    title:      `Presentation: ${projectName}`,
    startISO:   scheduledAt,
    durationMs: 60 * 60 * 1000,
    location:   location || '',
  })) : '';

  const body = `
    ${heading('Your Presentation Has Been Scheduled')}
    ${paragraph('A presentation date has been assigned for your graduation project. Please note the details below.')}
    ${infoTable(rows)}
    ${calBlock}
    ${paragraph('Please ensure all group members are available at the scheduled time. Log in to the platform for more details.')}
  `;

  const subject = courseName
    ? `[${courseName}] Committee Evaluation Scheduled: ${projectName}`
    : `Committee Evaluation Scheduled: ${projectName}`;

  return Promise.allSettled(
    studentEmails.filter(Boolean).map((email) =>
      sendEmail(email, subject, layout(body, 'Committee Evaluation Scheduled'))
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
    const calLink = a.scheduledAt ? (() => {
      const url = makeGoogleCalUrl({
        title:      `Committee Evaluation: ${a.projectName}`,
        startISO:   a.scheduledAt,
        durationMs: 60 * 60 * 1000,
        location:   a.location || '',
      });
      return ` <a href="${url}" style="font-size:12px;color:#4285f4;text-decoration:none;white-space:nowrap;">&#128197; Add</a>`;
    })() : '';
    return `<tr style="background:${i % 2 === 0 ? '#ffffff' : '#f9fafb'};">
      <td style="padding:10px 14px;font-size:14px;color:#111827;border-bottom:1px solid #f3f4f6;">${a.projectName} (${a.groupCode})</td>
      <td style="padding:10px 14px;font-size:14px;color:#374151;border-bottom:1px solid #f3f4f6;">${a.formattedDateTime}${loc}${calLink}</td>
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

  const calUrl = makeGoogleCalUrl({
    title:       `[${courseName}] Deadline: ${milestoneName}`,
    startISO:    dueDate,
    allDay:      true,
    description: [courseName, description].filter(Boolean).join('\n'),
  });

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
    ${googleCalendarButton(calUrl)}
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
  const courseName = `CPIS-${courseType}`;
  const submitUrl = appUrl || (APP_URL ? `${APP_URL}/student/weekly-reports` : '');

  const body = `
    ${heading(`Week ${weekNumber} Report Now Open`)}
    ${paragraph(`Week <strong>${weekNumber}</strong> is now open for weekly report submissions in <strong>${courseName}</strong>.`)}
    ${infoTable([
      ['Course', courseName],
      ['Week',   `Week ${weekNumber}`],
      ['Status', 'Open for Submissions'],
    ])}
    ${paragraph('Please submit your weekly report before the week is closed.')}
    ${submitUrl ? ctaButton('Submit Weekly Report', submitUrl) : ''}
  `;

  return Promise.allSettled(
    studentEmails.filter(Boolean).map((email) =>
      sendEmail(email, `[${courseName}] Week ${weekNumber} Report Now Open`, layout(body, 'Weekly Report'))
    )
  );
}

/**
 * 9. Weekly report submitted → supervisor
 *
 * @param {string} supervisorEmail
 * @param {{ studentName: string, weekNumber: number, courseType: string, groupName?: string, appUrl?: string }} data
 */
function sendWeeklyReportSubmitted(supervisorEmail, data) {
  const { studentName, weekNumber, courseType, groupName = '', appUrl = '' } = data;
  const courseName = `CPIS-${courseType}`;
  const reviewUrl = appUrl || (APP_URL ? `${APP_URL}/supervisor/weekly-reports` : '');

  const rows = [
    ['Student', studentName],
    ['Course',  courseName],
    ['Week',    `Week ${weekNumber}`],
  ];
  if (groupName) rows.push(['Group', groupName]);

  const body = `
    ${heading(`Weekly Report #${weekNumber} Submitted`)}
    ${paragraph('A student has submitted their weekly report and it is ready for your review.')}
    ${infoTable(rows)}
    ${paragraph('Please log in to the platform to review the report and provide feedback.')}
    ${reviewUrl ? ctaButton('Review Weekly Report', reviewUrl) : ''}
  `;

  return sendEmail(
    supervisorEmail,
    `[${courseName}] Weekly Report #${weekNumber} Submitted`,
    layout(body, 'Weekly Report')
  );
}

/**
 * 10. Supervisor commented on a weekly report → group students
 *
 * @param {string[]} studentEmails
 * @param {{ supervisorName: string, weekNumber: number, courseType: string, commentPreview: string, groupName?: string, appUrl?: string }} data
 */
function sendWeeklyReportFeedback(studentEmails, data) {
  const {
    supervisorName, weekNumber, courseType, commentPreview,
    progressStatus, allMembersAttended, absentStudentName,
    groupName = '', appUrl = '',
  } = data;
  const courseName = `CPIS-${courseType}`;
  const reportsUrl = appUrl || (APP_URL ? `${APP_URL}/student/weekly-reports` : '');

  const PROGRESS_LABEL = {
    excellent:           'Excellent Progress',
    good:                'Good Progress',
    satisfactory:        'Satisfactory',
    'needs-improvement': 'Needs Improvement',
  };
  const PROGRESS_BADGE = {
    excellent:           { bg: '#dcfce7', color: '#166534' },
    good:                { bg: '#dbeafe', color: '#1e40af' },
    satisfactory:        { bg: '#fef3c7', color: '#92400e' },
    'needs-improvement': { bg: '#fee2e2', color: '#991b1b' },
  };

  const rows = [
    ['Supervisor', supervisorName],
    ['Course',     courseName],
    ['Week',       `Week ${weekNumber}`],
  ];
  if (groupName) rows.push(['Group', groupName]);

  if (progressStatus && PROGRESS_LABEL[progressStatus]) {
    const badge = PROGRESS_BADGE[progressStatus];
    rows.push(['Progress Status',
      `<span style="display:inline-block;padding:3px 10px;border-radius:12px;background:${badge.bg};color:${badge.color};font-size:13px;font-weight:600;">${PROGRESS_LABEL[progressStatus]}</span>`,
    ]);
  }

  if (typeof allMembersAttended === 'boolean') {
    const attendanceText = allMembersAttended
      ? 'Yes — all members attended'
      : (absentStudentName
          ? `No — absent: ${absentStudentName}`
          : 'No');
    rows.push(['All Members Attended', attendanceText]);
  }

  const commentBlock = commentPreview
    ? `<div style="background:#f9fafb;border-left:4px solid #1a6b4a;padding:14px 16px;margin:0 0 20px;border-radius:0 4px 4px 0;">
        <p style="margin:0 0 6px;font-size:13px;font-weight:600;color:#374151;">Supervisor Comment</p>
        <p style="margin:0;font-size:14px;color:#374151;line-height:1.6;">${commentPreview.replace(/\n/g, '<br/>')}</p>
      </div>`
    : '';

  const body = `
    ${heading(`Supervisor Feedback on Weekly Report #${weekNumber}`)}
    ${paragraph('Your supervisor has added feedback to your weekly report. Please log in to review it.')}
    ${infoTable(rows)}
    ${commentBlock}
    ${reportsUrl ? ctaButton('View Weekly Report', reportsUrl) : ''}
  `;

  return Promise.allSettled(
    studentEmails.filter(Boolean).map((email) =>
      sendEmail(
        email,
        `[${courseName}] Supervisor Feedback — Weekly Report #${weekNumber}`,
        layout(body, 'Weekly Report Feedback')
      )
    )
  );
}

/**
 * 11. Supervisor updated report status → group students
 *
 * @param {string[]} studentEmails
 * @param {{ supervisorName: string, weekNumber: number, courseType: string, status: 'reviewed'|'changes_requested', groupName?: string, appUrl?: string }} data
 */
function sendWeeklyReportStatusUpdate(studentEmails, data) {
  const { supervisorName, weekNumber, courseType, status, groupName = '', appUrl = '' } = data;
  const courseName   = `CPIS-${courseType}`;
  const reportsUrl   = appUrl || (APP_URL ? `${APP_URL}/student/weekly-reports` : '');
  const isReviewed   = status === 'reviewed';
  const statusLabel  = isReviewed ? 'Reviewed' : 'Changes Requested';
  const badgeBg      = isReviewed ? '#dcfce7' : '#fef3c7';
  const badgeColor   = isReviewed ? '#166534' : '#92400e';
  const statusBadgeHtml = `<span style="display:inline-block;padding:3px 10px;border-radius:12px;background:${badgeBg};color:${badgeColor};font-size:13px;font-weight:600;">${statusLabel}</span>`;

  const rows = [
    ['Supervisor', supervisorName],
    ['Course',     courseName],
    ['Week',       `Week ${weekNumber}`],
    ['Status',     statusBadgeHtml],
  ];
  if (groupName) rows.push(['Group', groupName]);

  const message = isReviewed
    ? 'Your supervisor has reviewed and accepted your weekly report.'
    : 'Your supervisor has reviewed your weekly report and is requesting changes. Please log in to see their feedback and resubmit.';

  const body = `
    ${heading(`Weekly Report #${weekNumber} — ${statusLabel}`)}
    ${paragraph(message)}
    ${infoTable(rows)}
    ${reportsUrl ? ctaButton('View Weekly Report', reportsUrl) : ''}
  `;

  return Promise.allSettled(
    studentEmails.filter(Boolean).map((email) =>
      sendEmail(
        email,
        `[${courseName}] Weekly Report #${weekNumber} — ${statusLabel}`,
        layout(body, 'Weekly Report Update')
      )
    )
  );
}

/**
 * 12. Submission deadline reminder (1 day before close_at) → students
 *
 * @param {string[]} studentEmails
 * @param {{ weekNumber: number, courseType: string, closeAt: string, appUrl?: string }} data
 */
function sendDeadlineReminder(studentEmails, data) {
  const { weekNumber, courseType, closeAt, appUrl = '' } = data;
  const courseName = `CPIS-${courseType}`;
  const deadline = new Date(closeAt).toLocaleString('en-US', {
    dateStyle: 'long', timeStyle: 'short',
  });

  const body = `
    ${heading(`⏰ Deadline Tomorrow — Week ${weekNumber} Report`)}
    ${paragraph(`Your weekly report for <strong>Week ${weekNumber}</strong> in <strong>${courseName}</strong> is due in less than 24 hours.`)}
    ${infoTable([
      ['Course',   courseName],
      ['Week',     `Week ${weekNumber}`],
      ['Deadline', `<strong style="color:#dc2626;">${deadline}</strong>`],
    ])}
    ${paragraph('Please submit your report before the deadline. Late submissions may not be accepted.')}
    ${appUrl ? ctaButton('Submit Weekly Report Now', appUrl) : ''}
  `;

  return Promise.allSettled(
    studentEmails.filter(Boolean).map((email) =>
      sendEmail(
        email,
        `[${courseName}] Reminder: Week ${weekNumber} Report Due Tomorrow`,
        layout(body, 'Deadline Reminder')
      )
    )
  );
}

// ─── Meeting Templates ─────────────────────────────────────────────────────────

/**
 * Meeting invitation email → sent to students and/or supervisor when a meeting
 * is created.
 *
 * @param {string[]} recipientEmails
 * @param {{ meetingTitle: string, groupName: string, dateTime: string, meetingUrl: string, creatorName: string, notes?: string, appUrl?: string }} data
 */
function sendMeetingInvitation(recipientEmails, data) {
  const { meetingTitle, groupName, dateTime, meetingUrl, location, creatorName, notes, appUrl = '' } = data;
  const formatted = new Date(dateTime).toLocaleString('en-US', {
    dateStyle: 'full', timeStyle: 'short',
  });

  const rows = [
    ['Meeting',     meetingTitle],
    ['Group',       groupName],
    ['Date & Time', `<strong>${formatted}</strong>`],
    ['Organiser',   creatorName],
  ];
  if (location)   rows.push(['Location', location]);
  if (notes)      rows.push(['Notes', notes]);

  const calUrl = makeGoogleCalUrl({
    title:       meetingTitle,
    startISO:    dateTime,
    durationMs:  60 * 60 * 1000,
    description: [groupName, notes].filter(Boolean).join('\n'),
    location:    location || meetingUrl || '',
  });

  const body = `
    ${heading('📅 Meeting Invitation')}
    ${paragraph(`You have been invited to a meeting for <strong>${groupName}</strong>.`)}
    ${infoTable(rows)}
    ${meetingUrl ? ctaButton('Join Meeting', meetingUrl) : ''}
    ${googleCalendarButton(calUrl)}
    ${appUrl ? `<p style="margin:0 0 24px;font-size:13px;color:#6b7280;text-align:center;">Or open the platform: <a href="${appUrl}" style="color:#1a6b4a;">${appUrl}</a></p>` : ''}
  `;

  return Promise.allSettled(
    recipientEmails.filter(Boolean).map((email) =>
      sendEmail(
        email,
        `[Meeting Invitation] ${meetingTitle} — ${groupName}`,
        layout(body, 'Meeting Invitation')
      )
    )
  );
}

/**
 * Meeting reminder email.
 *
 * @param {string[]} recipientEmails
 * @param {{ meetingTitle: string, groupName: string, dateTime: string, meetingUrl: string, reminderLabel: string }} data
 */
function sendMeetingReminder(recipientEmails, data) {
  const { meetingTitle, groupName, dateTime, meetingUrl, reminderLabel } = data;
  const formatted = new Date(dateTime).toLocaleString('en-US', {
    dateStyle: 'full', timeStyle: 'short',
  });

  const body = `
    ${heading(`⏰ Meeting Starting ${reminderLabel}`)}
    ${paragraph(`Your meeting <strong>${meetingTitle}</strong> for <strong>${groupName}</strong> starts <strong>${reminderLabel}</strong>.`)}
    ${infoTable([
      ['Meeting',     meetingTitle],
      ['Group',       groupName],
      ['Date & Time', `<strong style="color:#dc2626;">${formatted}</strong>`],
    ])}
    ${ctaButton('Join Meeting Now', meetingUrl)}
  `;

  return Promise.allSettled(
    recipientEmails.filter(Boolean).map((email) =>
      sendEmail(
        email,
        `[Reminder] ${meetingTitle} starts ${reminderLabel}`,
        layout(body, 'Meeting Reminder')
      )
    )
  );
}

/**
 * Meeting cancellation email.
 *
 * @param {string[]} recipientEmails
 * @param {{ meetingTitle: string, groupName: string, dateTime: string, cancelledBy: string }} data
 */
function sendMeetingCancelled(recipientEmails, data) {
  const { meetingTitle, groupName, dateTime, cancelledBy } = data;
  const formatted = new Date(dateTime).toLocaleString('en-US', {
    dateStyle: 'full', timeStyle: 'short',
  });

  const body = `
    ${heading('❌ Meeting Cancelled')}
    ${paragraph(`The following meeting has been cancelled by <strong>${cancelledBy}</strong>.`)}
    ${infoTable([
      ['Meeting',     meetingTitle],
      ['Group',       groupName],
      ['Was Scheduled', formatted],
    ])}
    ${paragraph('Please contact your supervisor or coordinator if you have any questions.')}
  `;

  return Promise.allSettled(
    recipientEmails.filter(Boolean).map((email) =>
      sendEmail(
        email,
        `[Cancelled] ${meetingTitle} — ${groupName}`,
        layout(body, 'Meeting Cancelled')
      )
    )
  );
}

/**
 * Discussion message notification → group members
 *
 * @param {string[]} recipientEmails
 * @param {{ senderName: string, senderRole: string, groupName: string, message: string, appUrl?: string }} data
 */
async function sendDiscussionNotification(recipientEmails, { senderName, senderRole, groupName, message, appUrl }) {
  const roleLabel = (senderRole || 'user').charAt(0).toUpperCase() + (senderRole || 'user').slice(1);
  const discussionPath = senderRole === 'student' ? '/student/meetings' : '/supervisor/meetings';
  const body =
    heading('New Discussion Message') +
    paragraph(`<strong>${senderName}</strong> (${roleLabel}) posted a new message in <strong>${groupName}</strong>.`) +
    infoTable([['Message', message]]) +
    (appUrl ? ctaButton('View Discussion', `${appUrl}${discussionPath}`) : '');

  return Promise.all(
    recipientEmails.filter(Boolean).map((email) =>
      sendEmail(email, `New Discussion Message — ${groupName}`, layout(body, 'Group Discussion'))
    )
  );
}

/**
 * Registration approved → applicant
 *
 * @param {string} to
 * @param {{ name: string, accountType: string, loginUrl?: string }} data
 */
function sendRegistrationApproved(to, { name, accountType, loginUrl = '' }) {
  const roleLabel = accountType === 'student' ? 'Student' : accountType === 'supervisor' ? 'Supervisor' : 'User';
  const body =
    heading('Your Registration Has Been Approved') +
    paragraph(`Congratulations, <strong>${name}</strong>! Your registration as a <strong>${roleLabel}</strong> on the FCIT Graduation Project Platform has been reviewed and approved.`) +
    paragraph('You can now log in to your account and access all platform features.') +
    (loginUrl ? ctaButton('Log In to the Platform', loginUrl) : '') +
    paragraph('If you have any questions, please contact your course coordinator.');

  return sendEmail(to, 'Your Registration Has Been Approved — FCIT Graduation Platform', layout(body, 'Registration Approved'));
}

/**
 * Registration rejected → applicant
 *
 * @param {string} to
 * @param {{ name: string, accountType: string }} data
 */
function sendRegistrationRejected(to, { name, accountType }) {
  const roleLabel = accountType === 'student' ? 'Student' : accountType === 'supervisor' ? 'Supervisor' : 'User';
  const body =
    heading('Registration Not Approved') +
    paragraph(`Dear <strong>${name}</strong>,`) +
    paragraph(`Thank you for registering on the FCIT Graduation Project Platform as a <strong>${roleLabel}</strong>. After review, we are unable to approve your registration at this time.`) +
    paragraph('If you believe this is an error or would like more information, please contact your course coordinator directly.');

  return sendEmail(to, 'Registration Status Update — FCIT Graduation Platform', layout(body, 'Registration Update'));
}

/**
 * Milestone deadline updated → students in the course
 *
 * @param {string[]} studentEmails
 * @param {{ milestoneName: string, courseName: string, openDate: string, dueDate: string, description?: string, appUrl?: string }} data
 */
function sendMilestoneDeadlineUpdated(studentEmails, data) {
  const { milestoneName, courseName, openDate, dueDate, description, appUrl = '' } = data;
  const fmt = (d) => new Date(d).toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' });

  const calUrl = makeGoogleCalUrl({
    title:       `[${courseName}] Deadline: ${milestoneName}`,
    startISO:    dueDate,
    allDay:      true,
    description: [courseName, description].filter(Boolean).join('\n'),
  });

  const body = `
    ${heading('Deadline Updated')}
    ${paragraph(`The deadline for <strong>${milestoneName}</strong> in <strong>${courseName}</strong> has been updated.`)}
    ${infoTable([
      ['Milestone', milestoneName],
      ['Course',    courseName],
      ['Opens',     fmt(openDate)],
      ['New Deadline', `<strong style="color:#dc2626;">${fmt(dueDate)}</strong>`],
    ])}
    ${description ? `<div style="background:#f9fafb;border:1px solid #e5e7eb;border-radius:6px;padding:18px;margin:0 0 20px;">
      <p style="margin:0;font-size:14px;color:#374151;line-height:1.7;white-space:pre-line;">${description}</p>
    </div>` : ''}
    ${googleCalendarButton(calUrl)}
    ${appUrl ? ctaButton('View Milestone', appUrl) : ''}
  `;

  return Promise.allSettled(
    studentEmails.filter(Boolean).map((email) =>
      sendEmail(email, `[${courseName}] Deadline Updated: ${milestoneName}`, layout(body, 'Deadline Updated'))
    )
  );
}

// ─── Exports ───────────────────────────────────────────────────────────────────

module.exports = {
  sendEmail,
  sendSubmissionReceived,
  sendRegistrationApproved,
  sendRegistrationRejected,
  sendSubmissionDecision,
  sendSupervisorEvaluation,
  sendAllGrades,
  sendCoordinatorEvaluation,
  sendAnnouncement,
  sendPresentationScheduled,
  sendCommitteeSchedule,
  sendMilestoneCreated,
  sendWeekOpened,
  sendWeeklyReportSubmitted,
  sendWeeklyReportFeedback,
  sendWeeklyReportStatusUpdate,
  sendDeadlineReminder,
  sendMeetingInvitation,
  sendMeetingReminder,
  sendMeetingCancelled,
  sendDiscussionNotification,
  sendMilestoneDeadlineUpdated,
};
