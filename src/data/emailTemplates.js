import { MAIL } from './brokers.js'

// Email + Asana comment templates, one per stage, ported from the Zap branch
// steps (nodes 24-35). `ctx` = { firstName, dealEndDate, asanaLink }.
// Each builder returns { subject, bodyHtml, comment }.
const P = MAIL.phone
const SIGN = 'The Ascot Wealth Management Mortgage Team'

const templates = {
  // ---- 6 months before deal end ----
  before6: ({ firstName, dealEndDate }) => ({
    subject: `${firstName}, quick heads-up on your mortgage deal ending`,
    bodyHtml: `
      <p>Hi ${firstName},</p>
      <p>A quick heads-up that your current mortgage deal is due to end on <strong>${dealEndDate}</strong>. Six months out is a great time to review options without any rush. We can look at a new deal with your current lender or compare remortgage options elsewhere if it saves you more.</p>
      <p><strong>If you'd like me to start now, just reply "yes"</strong> and I'll begin shortlisting the best rates. You can also call us on <strong>${P}</strong> to book a time that suits.</p>
      <p><strong>Helpful to have ready (optional):</strong></p>
      <ul><li>Recent payslips or income evidence</li><li>Latest mortgage statement</li><li>Estimated property value</li></ul>
      <p>Thanks,<br><strong>${SIGN}</strong></p>`,
    comment: `Hi ${firstName},\n\nA quick heads-up that your current mortgage deal is due to end on ${dealEndDate}. Six months out is a great time to review options without any rush. We can look at a new deal with your current lender or compare remortgage options elsewhere if it saves you more.\n\nIf you'd like me to start now, just reply "yes" and I'll begin shortlisting the best rates. You can also call us on ${P}.\n\nThanks,\n${SIGN}`,
  }),

  // ---- 3 months before deal end ----
  before3: ({ firstName, dealEndDate }) => ({
    subject: `${firstName}, time to secure your next mortgage rate`,
    bodyHtml: `
      <p>Hi ${firstName},</p>
      <p>We're now about <strong>3 months</strong> away from your current mortgage deal ending on <strong>${dealEndDate}</strong>. This is the ideal time to secure your next rate. Lenders allow us to lock in a new deal now, and if something better becomes available before completion, we can usually switch.</p>
      <p><strong>What we'll do next:</strong></p>
      <ol><li>Review the best available options with your current lender and others.</li><li>Secure the chosen rate and begin the application process.</li><li>Handle all paperwork and keep you updated at every stage.</li></ol>
      <p>To get started, please reply to this email or call us on <strong>${P}</strong>.</p>
      <p>Thanks,<br><strong>${SIGN}</strong></p>`,
    comment: `Hi ${firstName},\n\nWe're now about 3 months away from your current mortgage deal ending on ${dealEndDate}. This is the ideal time to secure your next rate.\n\nReply to this email or call ${P} and we'll review the best options with your current lender and the wider market.\n\nThanks,\n${SIGN}`,
  }),

  // ---- 1 month before deal end ----
  before1: ({ firstName, dealEndDate, asanaLink }) => ({
    subject: `Urgent: Your Current Mortgage Deal Ends on ${dealEndDate}`,
    bodyHtml: `
      <p>Hi ${firstName},</p>
      <p>I'm here to remind you that your current remortgage rate ends on <strong>${dealEndDate}</strong>. I'd love us to have a discussion about the best way forward. If we don't select a new deal in time, your mortgage will move to the lender's <strong>Standard Variable Rate (SVR)</strong>, which typically means a higher monthly payment, and is something we want to avoid.</p>
      <p>If you haven't decided yet, please reply to this email so we can arrange a time to talk, or give us a call on <strong>${P}</strong>.</p>
      <p><strong>What I'll do immediately:</strong></p>
      <ol><li>Confirm the best available option (stay or switch).</li><li>Secure the rate and handle the paperwork.</li><li>Keep you updated through completion.</li><li>Make the process quick and painless.</li></ol>
      <p>Thanks,<br><strong>${SIGN}</strong></p>`,
    comment: `The below email was sent to the client: ${firstName}\n\nSubject: Urgent: your mortgage deal ends ${dealEndDate}\n\nHi ${firstName},\n\nYour current remortgage rate ends on ${dealEndDate}. If we don't select a new deal in time, your mortgage will move to the lender's SVR (a higher monthly payment).\n\nIf you haven't decided yet, please reply or grab a slot here: ${asanaLink}.\n\nThanks,\nAscot Wealth Management`,
  }),

  // ---- 1 month after deal end (now on SVR) ----
  after1: ({ firstName, dealEndDate }) => ({
    subject: `${firstName}, your mortgage moved to SVR after ${dealEndDate} — let's review your options`,
    bodyHtml: `
      <p>Hi ${firstName},</p>
      <p>Your previous deal ended on <strong>${dealEndDate}</strong>, so your mortgage may now be on the lender's <strong>Standard Variable Rate (SVR)</strong>. That usually means a higher monthly payment.</p>
      <p>We can still help you switch to a better rate. In most cases we can line up a new deal quickly and manage the paperwork for you. If you'd like us to review options, please reply to this email or call <strong>${P}</strong>.</p>
      <p><strong>What we'll do:</strong></p>
      <ol><li>Compare a new deal with your current lender vs. remortgage options elsewhere.</li><li>Confirm the best choice and secure the rate.</li><li>Handle the application and keep you updated.</li></ol>
      <p>Thanks,<br><strong>${SIGN}</strong></p>`,
    comment: `Hi ${firstName},\n\nYour previous deal ended on ${dealEndDate}, so your mortgage may now be on the lender's SVR — usually a higher monthly payment.\n\nWe can still help you switch to a better rate. Reply to this email or call ${P}.\n\nThanks,\n${SIGN}`,
  }),

  // ---- 3 months after deal end ----
  after3: ({ firstName, dealEndDate }) => ({
    subject: `Still on SVR? Let's cut your Mortgage Payment if we can`,
    bodyHtml: `
      <p>Hi ${firstName},</p>
      <p>It's been a few months since your deal ended on <strong>${dealEndDate}</strong>. If you're still on the <strong>Standard Variable Rate (SVR)</strong>, we should check whether a new fixed or tracker deal could reduce your monthly payment.</p>
      <p><strong>Quick next step:</strong> reply "review my options" or call <strong>${P}</strong>. We'll compare suitable products with your current lender and others, then recommend the best fit.</p>
      <p><strong>Documents that help (if handy):</strong></p>
      <ul><li>Recent payslips or income evidence</li><li>Latest mortgage statement</li><li>Estimated property value</li></ul>
      <p>Thanks,<br><strong>${SIGN}</strong></p>`,
    comment: `Hi ${firstName},\n\nIt's been a few months since your deal ended on ${dealEndDate}. If you're still on the SVR, a new fixed or tracker deal could reduce your monthly payment.\n\nReply "review my options" or call ${P}.\n\nThanks,\n${SIGN}`,
  }),

  // ---- 6 months after deal end ----
  after6: ({ firstName, dealEndDate }) => ({
    subject: `Let's get you off SVR and onto a better deal`,
    bodyHtml: `
      <p>Hi ${firstName},</p>
      <p>If you've been on the lender's <strong>Standard Variable Rate (SVR)</strong> since your deal ended on <strong>${dealEndDate}</strong>, this is a good time to review. A new deal could provide cost certainty and may lower your monthly payments.</p>
      <p>We'll compare options with your current lender and the wider market, confirm the best fit, secure the rate, and handle the paperwork. Just reply to this email or call <strong>${P}</strong> to get started.</p>
      <p><strong>What you can expect:</strong></p>
      <ol><li>Clear side-by-side comparison of suitable products.</li><li>Fast application and regular updates.</li><li>Support through to completion.</li></ol>
      <p>Thanks,<br><strong>${SIGN}</strong></p>`,
    comment: `Hi ${firstName},\n\nIf you've been on the lender's SVR since your deal ended on ${dealEndDate}, this is a good time to review. A new deal could provide cost certainty and may lower your monthly payments.\n\nReply to this email or call ${P} to get started.\n\nThanks,\n${SIGN}`,
  }),
}

export function buildMessage(templateKey, ctx) {
  const fn = templates[templateKey]
  if (!fn) return { subject: '', bodyHtml: '', comment: '' }
  return fn(ctx)
}
