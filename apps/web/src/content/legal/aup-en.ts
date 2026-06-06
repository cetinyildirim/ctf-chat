import type { LegalSection } from '@/components/legal/LegalDocument';

export const aupEnMeta = {
  title: 'Acceptable Use Policy',
  updated: 'Last updated: 25 May 2026',
};

export const aupEnIntro = [
  'SYDT Chat provides a secure communication space for your team, community, or event. By creating a server or using the platform, you agree to this policy.',
  'These rules apply to all users, servers, channels, and shared content. The policy is designed to align with applicable law in Türkiye, including personal data protection and content moderation obligations.',
];

export const aupEnSections: LegalSection[] = [
  {
    id: 'safety',
    title: 'Keeping you safe',
    paragraphs: ['The following content and conduct are not permitted:'],
    subsections: [
      {
        title: 'Violence and illegal activity',
        bullets: [
          'Content that promotes or glorifies violent extremism or instructions to commit violence.',
          'Content that violates Turkish criminal law or incites criminal acts.',
          'Organizing or facilitating illegal weapons, explosives, or drug trade.',
        ],
      },
      {
        title: 'Hate and discrimination',
        bullets: [
          'Attacks based on protected characteristics including race, ethnicity, religion, gender, sexual orientation, disability, and similar grounds.',
          'Content that would require removal under applicable hosting and publication laws in Türkiye.',
        ],
      },
      {
        title: 'Harmful content',
        bullets: [
          'Encouraging self-harm or suicide (except public-health signposting to helplines).',
          'Non-consensual intimate imagery; any child sexual abuse material (reported to authorities immediately).',
          'Real-world gore or animal cruelty (limited exceptions for journalism or clearly labelled fiction).',
          'Doxxing, threats, or blackmail.',
        ],
      },
      {
        title: 'Fraud and malware',
        bullets: [
          'Phishing, scams, pyramid schemes, or deceptive commercial practices.',
          'Malware or unauthorized access tools.',
          'Intellectual property infringement.',
        ],
      },
    ],
  },
  {
    id: 'fair-use',
    title: 'Fair use',
    bullets: [
      'Unsolicited spam or unauthorized automation.',
      'Buying or selling accounts or memberships.',
      'Artificial growth of servers or resource abuse.',
      'Ban evasion.',
      'Unauthorized security testing without written permission.',
      'Collecting personal data without consent (KVKK / GDPR principles apply).',
      'Misleading the support team.',
    ],
  },
  {
    id: 'servers',
    title: 'Server owners and moderators',
    paragraphs: [
      'Server owners are responsible for moderation practices on their servers.',
      'Age-restricted content must be properly labelled and access-controlled.',
      'Commercial activity must comply with applicable Turkish consumer and e-commerce rules.',
    ],
  },
  {
    id: 'reporting',
    title: 'Reporting violations',
    paragraphs: [
      'Use in-app reporting where available. Contact local authorities for emergencies.',
      'Copyright claims should be submitted in writing with required details.',
    ],
  },
  {
    id: 'enforcement',
    title: 'Enforcement and appeals',
    bullets: [
      'Violations may result in warnings, suspensions, or permanent removal.',
      'You may appeal if you believe action was wrong; provide your evidence.',
    ],
  },
  {
    id: 'law',
    title: 'Governing law',
    paragraphs: [
      'Turkish law is primary for operation and interpretation of this policy.',
      'Data subject rights are handled under KVKK and, where applicable, GDPR.',
      'Mandatory consumer rights in Türkiye remain unaffected.',
    ],
  },
];

export const aupEnFooter = [
  'This document describes community rules; it is not a substitute for legal advice.',
  'We may update this policy; material changes will be communicated by reasonable means.',
];
