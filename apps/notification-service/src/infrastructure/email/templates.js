/**
 * MVP email templates (inline). Phase 2: load from `email_templates` collection.
 * @see docs/DATABASE_DESIGN.md §9.3
 */

const TEMPLATES = {
  analysis_complete: {
    subject: 'Analysis complete: {{contractTitle}}',
    text: 'Hi,\n\nYour contract "{{contractTitle}}" has been analyzed.\nRisk level: {{riskLevel}} ({{riskScore}}).\n\nView: {{appUrl}}\n',
    html: '<p>Hi,</p><p>Your contract <strong>{{contractTitle}}</strong> has been analyzed.</p><p>Risk: <strong>{{riskLevel}}</strong> ({{riskScore}}).</p><p><a href="{{appUrl}}">Open in ContractIQ</a></p>',
  },
  analysis_failed: {
    subject: 'Analysis failed: {{contractTitle}}',
    text: 'Hi,\n\nAnalysis failed for "{{contractTitle}}".\nReason: {{errorMessage}}\n\nRetry: {{appUrl}}\n',
    html: '<p>Hi,</p><p>Analysis failed for <strong>{{contractTitle}}</strong>.</p><p>{{errorMessage}}</p><p><a href="{{appUrl}}">Open in ContractIQ</a></p>',
  },
  high_risk: {
    subject: 'High risk alert: {{contractTitle}}',
    text: 'Hi,\n\nContract "{{contractTitle}}" was flagged as high risk (score {{riskScore}}).\n\nReview: {{appUrl}}\n',
    html: '<p>Hi,</p><p><strong>{{contractTitle}}</strong> was flagged as <strong>high risk</strong> ({{riskScore}}).</p><p><a href="{{appUrl}}">Review now</a></p>',
  },
  member_invited: {
    subject: 'You are invited to {{organizationName}}',
    text: 'Hi,\n\nYou have been invited to join {{organizationName}} on ContractIQ.\n\nAccept: {{inviteUrl}}\n',
    html: '<p>Hi,</p><p>You have been invited to join <strong>{{organizationName}}</strong>.</p><p><a href="{{inviteUrl}}">Accept invitation</a></p>',
  },
  generic: {
    subject: '{{title}}',
    text: '{{body}}\n',
    html: '<p>{{body}}</p>',
  },
};

function interpolate(template, data) {
  return template.replace(/\{\{(\w+)\}\}/g, (_match, key) => {
    const value = data[key];
    return value == null ? '' : String(value);
  });
}

export function renderEmailTemplate(templateId, data = {}) {
  const template = TEMPLATES[templateId] ?? TEMPLATES.generic;

  return {
    subject: interpolate(template.subject, data),
    text: interpolate(template.text, data),
    html: interpolate(template.html, data),
  };
}

export function listTemplateIds() {
  return Object.keys(TEMPLATES);
}
