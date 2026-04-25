'use strict';

/**
 * BullMQ job queue service — powered by Redis via ioredis.
 *
 * Provides a fire-and-forget email queue that replaces the raw async IIFEs
 * scattered across controllers. Benefits over raw async:
 *   • Automatic retries with exponential back-off on SMTP failures
 *   • Jobs survive server restarts (persisted in Redis)
 *   • Built-in failure tracking (failed jobs stay in Redis for inspection)
 *
 * Usage:
 *   const { queueAnnouncementEmail } = require('../services/queue.service');
 *   await queueAnnouncementEmail(emails, { title, content, courseName, publishedAt });
 *
 * If Redis is unavailable the queue falls back to a direct in-process call
 * so emails still go out (just without retry guarantees).
 */

const { Queue, Worker } = require('bullmq');
const { createBullMQConnection, isRedisReady } = require('../config/redis');
const emailService = require('./email.service');

// ── Queue name ────────────────────────────────────────────────────────────────
const EMAIL_QUEUE = 'email';

// ── BullMQ needs its own dedicated connection (maxRetriesPerRequest: null) ────
// Each Queue/Worker gets a separate ioredis instance — BullMQ manages lifecycle.
function bullConnection() {
  return { connection: createBullMQConnection() };
}

// ── Queue instance (lazy — created on first use) ───────────────────────────────
let _queue = null;

function getQueue() {
  if (!_queue) {
    _queue = new Queue(EMAIL_QUEUE, {
      ...bullConnection(),
      defaultJobOptions: {
        attempts: 3,
        backoff: { type: 'exponential', delay: 5000 },
        removeOnComplete: 100,  // keep last 100 completed jobs
        removeOnFail:    200,   // keep last 200 failed jobs for inspection
      },
    });
  }
  return _queue;
}

// ── Worker (processes jobs) ───────────────────────────────────────────────────
let _worker = null;

function startWorker() {
  if (_worker) return;

  _worker = new Worker(
    EMAIL_QUEUE,
    async (job) => {
      const { type, payload } = job.data;

      switch (type) {
        case 'announcement':
          await emailService.sendAnnouncement(payload.emails, payload.data);
          break;
        case 'generic':
          await emailService.sendEmail(payload.to, payload.subject, payload.html);
          break;
        case 'meeting-invitation':
          await emailService.sendMeetingInvitation(payload.emails, payload.data);
          break;
        case 'meeting-reminder':
          await emailService.sendMeetingReminder(payload.emails, payload.data);
          break;
        case 'meeting-cancelled':
          await emailService.sendMeetingCancelled(payload.emails, payload.data);
          break;
        case 'discussion-notification':
          await emailService.sendDiscussionNotification(payload.emails, payload.data);
          break;
        case 'registration-approved':
          await emailService.sendRegistrationApproved(payload.to, payload.data);
          break;
        case 'registration-rejected':
          await emailService.sendRegistrationRejected(payload.to, payload.data);
          break;
        default:
          throw new Error(`Unknown email job type: ${type}`);
      }
    },
    {
      ...bullConnection(),
      concurrency: 3,
    }
  );

  _worker.on('completed', (job) => {
    console.log(`[queue] Email job ${job.id} (${job.data.type}) completed`);
  });

  _worker.on('failed', (job, err) => {
    console.error(
      `[queue] Email job ${job?.id} (${job?.data?.type}) failed after ${job?.attemptsMade} attempts:`,
      err.message
    );
  });

  console.log('[queue] Email worker started');
}

// ── Public API ────────────────────────────────────────────────────────────────

/**
 * Queue an announcement email blast.
 * Falls back to direct send if Redis is unavailable.
 *
 * @param {string[]} emails
 * @param {{ title, content, courseName, publishedAt }} data
 */
async function queueAnnouncementEmail(emails, data, { delay = 0 } = {}) {
  if (!isRedisReady()) {
    // Fallback: send directly, honouring delay via setTimeout
    const send = () => emailService.sendAnnouncement(emails, data).catch((err) =>
      console.error('[queue] Fallback announcement email failed:', err.message)
    );
    if (delay > 0) setTimeout(send, delay);
    else send();
    return;
  }
  await getQueue().add(
    'send-announcement',
    { type: 'announcement', payload: { emails, data } },
    { delay },
  );
}

/**
 * Queue a generic transactional email.
 * Falls back to direct send if Redis is unavailable.
 *
 * @param {string|string[]} to
 * @param {string} subject
 * @param {string} html
 */
async function queueEmail(to, subject, html) {
  if (!isRedisReady()) {
    emailService.sendEmail(to, subject, html).catch((err) =>
      console.error('[queue] Fallback email failed:', err.message)
    );
    return;
  }
  await getQueue().add('send-generic', { type: 'generic', payload: { to, subject, html } });
}

/**
 * Queue a meeting invitation email.
 * @param {string[]} emails
 * @param {{ meetingTitle, groupName, dateTime, meetingUrl, creatorName, notes?, appUrl? }} data
 */
async function queueMeetingInvitationEmail(emails, data) {
  if (!isRedisReady()) {
    emailService.sendMeetingInvitation(emails, data).catch((err) =>
      console.error('[queue] Fallback meeting invitation email failed:', err.message)
    );
    return;
  }
  await getQueue().add('send-meeting-invitation', { type: 'meeting-invitation', payload: { emails, data } });
}

/**
 * Queue a meeting reminder email.
 * @param {string[]} emails
 * @param {{ meetingTitle, groupName, dateTime, meetingUrl, reminderLabel }} data
 */
async function queueMeetingReminderEmail(emails, data) {
  if (!isRedisReady()) {
    emailService.sendMeetingReminder(emails, data).catch((err) =>
      console.error('[queue] Fallback meeting reminder email failed:', err.message)
    );
    return;
  }
  await getQueue().add('send-meeting-reminder', { type: 'meeting-reminder', payload: { emails, data } });
}

/**
 * Queue a meeting cancellation email.
 * @param {string[]} emails
 * @param {{ meetingTitle, groupName, dateTime, cancelledBy }} data
 */
async function queueMeetingCancelledEmail(emails, data) {
  if (!isRedisReady()) {
    emailService.sendMeetingCancelled(emails, data).catch((err) =>
      console.error('[queue] Fallback meeting cancelled email failed:', err.message)
    );
    return;
  }
  await getQueue().add('send-meeting-cancelled', { type: 'meeting-cancelled', payload: { emails, data } });
}

/**
 * Queue a discussion message notification email.
 * @param {string[]} emails
 * @param {{ senderName, senderRole, groupName, message, appUrl? }} data
 */
async function queueDiscussionNotificationEmail(emails, data) {
  if (!isRedisReady()) {
    emailService.sendDiscussionNotification(emails, data).catch((err) =>
      console.error('[queue] Fallback discussion notification email failed:', err.message)
    );
    return;
  }
  await getQueue().add('send-discussion-notification', { type: 'discussion-notification', payload: { emails, data } });
}

/**
 * Queue a registration-approved email to the applicant.
 * @param {string} to
 * @param {{ name: string, accountType: string, loginUrl?: string }} data
 */
async function queueRegistrationApprovedEmail(to, data) {
  if (!isRedisReady()) {
    emailService.sendRegistrationApproved(to, data).catch((err) =>
      console.error('[queue] Fallback registration-approved email failed:', err.message)
    );
    return;
  }
  await getQueue().add('send-registration-approved', { type: 'registration-approved', payload: { to, data } });
}

/**
 * Queue a registration-rejected email to the applicant.
 * @param {string} to
 * @param {{ name: string, accountType: string }} data
 */
async function queueRegistrationRejectedEmail(to, data) {
  if (!isRedisReady()) {
    emailService.sendRegistrationRejected(to, data).catch((err) =>
      console.error('[queue] Fallback registration-rejected email failed:', err.message)
    );
    return;
  }
  await getQueue().add('send-registration-rejected', { type: 'registration-rejected', payload: { to, data } });
}

// ── Initialise worker when module first loads ─────────────────────────────────
startWorker();

module.exports = {
  queueAnnouncementEmail,
  queueEmail,
  queueMeetingInvitationEmail,
  queueMeetingReminderEmail,
  queueMeetingCancelledEmail,
  queueDiscussionNotificationEmail,
  queueRegistrationApprovedEmail,
  queueRegistrationRejectedEmail,
};
