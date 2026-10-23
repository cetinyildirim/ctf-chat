import type { LegalSection } from '@/components/legal/LegalDocument';

export const aupEnMeta = {
  title: 'SYDT Chat Rules of Use',
  updated: 'Last updated: October 2, 2026',
};

export const aupEnIntro = [
  'SYDT Chat is a communication platform for CTF competitions, connecting competitors, teams, organizers and support staff. Chat channels, direct messages, support tickets, announcements, surveys, team management and the live scoreboard are all covered by these rules.',
  'By creating an account, signing in or joining a server, you confirm that you have read and accept these rules. They apply to every user; additional duties for staff are listed separately. Organizers may announce extra rules for their own competition, and those rules are binding as well.',
];

export const aupEnSections: LegalSection[] = [
  {
    id: 'summary',
    title: 'Core rules at a glance',
    bullets: [
      'Only you may use your account; never share your password or your team invite code.',
      'Never share flags, solutions or hints with anyone outside your own team.',
      'Only attack systems the organizers list as targets; SYDT Chat, CTFd and the competition infrastructure are not targets.',
      'Be respectful; harassment, insults, hate speech and threats are prohibited.',
      'Use channels for their purpose; no spam, flooding or needless mentions.',
      'Report problems by opening a support ticket in the right category; do not pester staff via direct messages.',
      'Do not upload malware or disallowed file types.',
      'Read announcements that require acknowledgement; you are responsible for the rules in announcements you acknowledge.',
      'Do not try to evade sanctions with new accounts or by any other means.',
      'If you find a security vulnerability in the platform, do not exploit it; report it to the organizers via a support ticket.',
    ],
  },
  {
    id: 'roles',
    title: '1. Roles and definitions',
    paragraphs: [
      'Permissions are based on roles. A user has one platform-wide role and may also hold separate roles on each server.',
    ],
    bullets: [
      'Super administrator: responsible for the whole platform, system settings and backups.',
      'Administrator: manages competition and server configuration, teams, announcements and moderation.',
      'Moderator: keeps channels orderly, can mute users and reviews reports.',
      'Challenge author: prepares challenges and answers challenge-related support tickets.',
      'Team captain: represents the team and manages the team logo and invite code.',
      'Team member: a user competing on behalf of a team.',
      'Spectator / observer: a user who follows the competition without competing.',
      'In this document, "staff" means super administrators, administrators, moderators and challenge authors.',
    ],
  },
  {
    id: 'account',
    title: '2. Accounts and identity',
    bullets: [
      'Each person may use only one account. Sharing accounts, creating accounts for others or using someone else’s account is prohibited.',
      'Usernames must be 3–24 characters and may contain only letters, digits, underscore (_), dot (.) and hyphen (-). Usernames and display names may not contain insults, obscenity, political propaganda, advertising or impersonation.',
      'Pretending to be staff, an organizer or another team/user (impersonation) is prohibited.',
      'Passwords must be at least 8 characters with an uppercase letter, a lowercase letter and a digit. Avoid reusing passwords from other services.',
      'Sign out when you are done on shared computers. You are responsible for everything done with your account.',
      'If you suspect your account has been compromised, change your password immediately and inform the organizers.',
      'Team invite codes entered during or after registration may only be used by members of that team.',
    ],
  },
  {
    id: 'conduct',
    title: '3. General conduct',
    paragraphs: ['Across the whole platform (channels, direct messages, support tickets, profile fields) the following are prohibited:'],
    subsections: [
      {
        title: 'Disrespectful and harmful behaviour',
        bullets: [
          'Insults, profanity, belittling, mockery, harassment, persistent unwanted contact and threats.',
          'Hate speech and discrimination based on race, ethnicity, religion, sect, gender, sexual orientation, age, disability or similar traits.',
          'Sharing other people’s personal information (address, phone, ID details, photos, etc.) without consent (doxxing).',
          'Blackmail, provocation, or encouraging other users to break the rules.',
        ],
      },
      {
        title: 'Unlawful and inappropriate content',
        bullets: [
          'Any content that constitutes or incites a crime under the laws of the Republic of Türkiye; content praising or encouraging terrorism or violence.',
          'Obscene, sexual or violent imagery; any material depicting or implying child abuse (reported to authorities immediately).',
          'Content encouraging self-harm or suicide.',
          'Political propaganda, commercial advertising, fraud, phishing and deceptive links.',
          'Content infringing copyright or other intellectual property rights.',
        ],
      },
    ],
  },
  {
    id: 'integrity',
    title: '4. Competition integrity',
    paragraphs: [
      'Fair play is the foundation of CTF competitions. The following rules apply to all competitors and teams throughout the competition.',
    ],
    subsections: [
      {
        title: 'Sharing restrictions',
        bullets: [
          'Flags, solution steps, exploits, hints or other critical challenge information may only be shared in your own team channels and with your teammates.',
          'Posting information that leads to a solution (spoilers) in general chat, challenge discussion channels or other shared spaces is prohibited.',
          'Collaborating with other teams, trading flags or helping another team is prohibited.',
          'Writeups may only be published after the competition ends and in the way the organizers allow.',
        ],
      },
      {
        title: 'Attack scope',
        bullets: [
          'Only systems the organizers designate as challenge targets may be attacked.',
          'SYDT Chat, the CTFd scoreboard, the competition network and infrastructure, and other teams’ devices and accounts are not targets; scanning, attacking, denial of service or unauthorized access attempts against them are strictly prohibited.',
          'Brute-forcing the flag submission system or flooding it with automated requests is prohibited.',
          'If you notice an unintended vulnerability or an infrastructure fault, do not exploit it; report it via a support ticket.',
        ],
      },
      {
        title: 'Teams and accounts',
        bullets: [
          'A user may belong to only one team in a given competition.',
          'Getting help from people outside your team, letting others use your account or competing with multiple accounts is prohibited.',
          'Hints are obtained only through the system, and their cost is deducted from the team score. Hints may not be requested from staff via tickets or direct messages.',
        ],
      },
    ],
  },
  {
    id: 'channels',
    title: '5. Channels and messaging',
    subsections: [
      {
        title: 'Channel types and purposes',
        bullets: [
          'Announcement channels: only staff can post; they are read-only for competitors.',
          'General chat channels: open to all participants; stay on topic and respectful.',
          'Challenge discussion channels: for general questions about a challenge; no solutions, flags or spoilers.',
          'Team channels: visible only to team members and staff; used for team work.',
          'Staff channels: for internal organizer coordination; their content is confidential and may not be shared outside.',
          'Only staff can post in locked channels.',
        ],
      },
      {
        title: 'Message rules',
        bullets: [
          'Messages may be up to 4,000 characters. Sending many messages in a short time (flooding) is prohibited; the system automatically blocks more than 30 messages in 10 seconds.',
          'Cross-posting the same message to many channels, meaningless messages, chain messages and advertising count as spam.',
          'Use @mentions only to reach the person concerned; repeatedly mentioning staff or users without need is prohibited.',
          'You can edit and delete your own messages. Staff may delete messages that break the rules and pin important ones.',
          'Reactions may not be used to mock or harass.',
        ],
      },
      {
        title: 'Direct messages and friends',
        bullets: [
          'You can send direct messages to staff and to anyone who shares a server with you, without adding them as a friend.',
          'Sharing solutions, flags or hints between different teams is a competition violation, including via direct messages.',
          'Direct messages are subject to these rules as well; harassment, spam or leaking competition information via DM is prohibited.',
          'Open a support ticket instead of messaging staff directly about support issues.',
          'Friend requests may not be sent persistently or in a disruptive way.',
        ],
      },
    ],
  },
  {
    id: 'files',
    title: '6. File sharing',
    bullets: [
      'Messages may include images (JPEG, PNG, GIF, WebP), PDF, plain text, ZIP, Word/Excel documents, audio and video files.',
      'Files that can execute in a browser, such as HTML, JavaScript and SVG, cannot be uploaded. Files whose content does not match their extension are rejected.',
      'The file size limit is set by the platform administrator (100 MB by default). Support ticket messages may carry at most 5 files.',
      'Uploaded files may be security-scanned; files found to contain malicious content are deleted and rejected automatically.',
      'Sharing malware, viruses, exploit kits or files that could harm others’ devices is prohibited. Challenge files are distributed only through the organizers’ official channels.',
      'Sharing challenge files, screenshots containing flags or solution output in shared channels is prohibited.',
      'Share documents containing personal data (ID cards, student certificates, etc.) only when organizers ask for them, and only via a support ticket.',
    ],
  },
  {
    id: 'tickets',
    title: '7. Support tickets',
    paragraphs: [
      'Support tickets are the official way to reach organizers about challenge errors, technical problems, flag submission and scoring issues, and account/team matters.',
    ],
    bullets: [
      'Open your ticket in the correct category and select the challenge for challenge-related categories. Titles need at least 4 characters and descriptions at least 10.',
      'Describe the problem clearly: what you did, what you expected and what happened. Keep each ticket to a single issue.',
      'Do not open several tickets for the same issue; duplicates may be merged or closed by staff. The system blocks more than 10 new tickets per minute.',
      'Tickets may not be used to ask for hints or solutions. Clarifications to challenge descriptions, when needed, are announced to all teams.',
      'If your ticket is set to "Waiting for competitor", reply as soon as possible.',
      'A resolved or closed ticket can only be reopened with a stated reason; do not reopen tickets needlessly.',
      'Be respectful when talking to staff. Internal notes inside a ticket are visible to staff only.',
      'Organizers may temporarily restrict or disable ticket creation depending on the state of the competition.',
    ],
  },
  {
    id: 'announcements',
    title: '8. Announcements, surveys and notifications',
    bullets: [
      'Announcements are official competition communications. Rules and changes announced in them are binding.',
      'Announcements that require acknowledgement cannot be dismissed until you press "OK". Acknowledging an announcement means you have read and accepted it.',
      'You cannot continue using the platform until mandatory surveys are submitted. Answer surveys honestly.',
      'You can change your channel notification preferences; announcements and moderation notices addressed to you are delivered regardless of those preferences.',
    ],
  },
  {
    id: 'teams',
    title: '9. Teams',
    bullets: [
      'Team names and logos must follow the general conduct rules; no insults, obscenity, political or commercial content.',
      'Only the team captain can upload, change or remove the team logo. Logos or trademarks belonging to others may not be used without permission.',
      'Only the team captain can see the team invite code and must share it only with their own team members.',
      'Team channels are for team work; their content should not be shared outside the team.',
      'Members join a team with the invite code shared by the captain. Removing members or changing captains is done by organizers; send such requests via a support ticket.',
    ],
  },
  {
    id: 'profile',
    title: '10. Profiles and personal data',
    bullets: [
      'Profile photos, display names and other profile fields must follow the general conduct rules.',
      'You may not use other people’s photos or personal information in your profile.',
      'The platform processes your messages, tickets, uploaded files and account details to provide the service, keep it secure and run the competition.',
      'Your personal data is protected under Turkish Personal Data Protection Law No. 6698 (KVKK). Contact the organizers for requests regarding your data.',
    ],
  },
  {
    id: 'staff',
    title: '11. Duties of staff',
    paragraphs: ['In addition to all rules above, staff must:'],
    bullets: [
      'Treat all teams equally and impartially, and never help any team beyond official hints.',
      'Keep challenge content, flags, staff-channel conversations and internal ticket notes confidential.',
      'Use moderation powers (deleting messages, muting, removing from servers, suspending) only for rule violations, proportionately, and with a stated reason where possible.',
      'Answer support tickets within a reasonable time and keep their status accurate.',
      'Access users’ personal data only as required for their duties and never share it with third parties.',
      'All administrative actions are recorded in the audit log and can be reviewed.',
      'Super administrators must store system backups securely and never share them with unauthorized people.',
    ],
  },
  {
    id: 'reporting',
    title: '12. Reporting violations and vulnerabilities',
    bullets: [
      'You can report a user who breaks the rules with the "Report" option on their profile card.',
      'Report competition problems (challenge errors, infrastructure issues, scoring errors, etc.) via a support ticket.',
      'If you find a security vulnerability in SYDT Chat, report it to the organizers with details and without exploiting it. Good-faith, responsible reports do not lead to sanctions.',
      'Deliberately false, misleading or malicious reports are prohibited.',
      'In emergencies or criminal matters you may also contact law enforcement.',
    ],
  },
  {
    id: 'enforcement',
    title: '13. Moderation and sanctions',
    paragraphs: [
      'Depending on severity and repetition, the following sanctions may be applied alone or together. Serious violations may receive a severe sanction immediately, without escalation.',
    ],
    bullets: [
      'Warning: a verbal or written warning from staff.',
      'Message or content removal: messages, files or profile content that break the rules are removed.',
      'Mute: you cannot send messages for the set duration. You are notified of the duration and reason, and the restriction lifts automatically when it expires.',
      'Server removal: your access to that server is removed and you cannot rejoin through invite links.',
      'Account suspension: you cannot use the platform for a set period (1 hour, 1 day, 3 days, 7 days, 30 days) or indefinitely. You are signed out immediately, and the duration and reason are shown on the sign-in screen. Timed suspensions lift automatically.',
      'Competition sanctions: for cheating, flag sharing or attacks on infrastructure, organizers may deduct points or disqualify the team.',
      'Creating new accounts or using someone else’s account to evade a sanction leads to additional, more severe sanctions.',
      'Criminal matters and related records may be shared with the authorities where legally required.',
    ],
  },
  {
    id: 'appeals',
    title: '14. Appeals',
    bullets: [
      'If you believe a sanction is wrong, you may appeal to the organizers with your reasons within a reasonable time after being notified. If your account is suspended, send your appeal in writing through the contact channels the organizers have announced.',
      'Where possible, appeals are reviewed by a staff member other than the one who applied the sanction. The sanction remains in effect during the appeal.',
      'Appeals about points or disqualification during a competition are decided according to the rules announced by the competition organizers.',
    ],
  },
  {
    id: 'records',
    title: '15. Records, security and data retention',
    bullets: [
      'Sign-ins, administrative actions and moderation decisions are recorded for security and auditing.',
      'System data (the database and uploaded files) is backed up regularly. Messages and files you delete may remain in backups for the backup retention period.',
      'Competition communications may be retained for the period set by the organizers for appeals, post-event reporting and possible legal proceedings.',
      'Accessing the platform with automated tools (bots, scripts), bulk-scraping data or trying to bypass rate limits is prohibited.',
    ],
  },
  {
    id: 'law',
    title: '16. Governing law',
    paragraphs: [
      'These rules are applied under the legislation of the Republic of Türkiye, in particular Law No. 5651, the Personal Data Protection Law No. 6698 (KVKK) and the Turkish Penal Code.',
      'For matters not covered here, the rules announced by the competition organizers and the decisions of staff apply.',
    ],
  },
];

export const aupEnFooter = [
  'These rules may be updated when needed. Significant changes are published as announcements on the platform; continuing to use the platform after an update means you accept the current rules.',
  'For questions, open a support ticket or contact the competition organizers.',
];
